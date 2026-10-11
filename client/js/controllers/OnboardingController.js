/**
 * OnboardingController.js - Voice Onboarding, Calibration & Training Controller
 * Enforces mandatory completion of exactly 4 essential commands.
 * No skipping or bypassing permitted.
 */
app.controller('OnboardingController', [
  '$scope',
  '$rootScope',
  '$timeout',
  '$location',
  'onboardingService',
  'voiceService',
  'toastService',
  function($scope, $rootScope, $timeout, $location, onboardingService, voiceService, toastService) {

    // ── Calibration State ─────────────────────────────────────────
    $scope.exercises = onboardingService.getAllExercises();
    $scope.totalExercises = onboardingService.TOTAL_EXERCISES; // 4
    $scope.currentIndex = 0; // 0 to 3
    $scope.isCompleted = false;

    // Active Exercise Interaction State
    $scope.isRecording = false;
    $scope.isEvaluating = false;
    $scope.liveTranscript = '';
    $scope.interimTranscript = '';
    $scope.validationResult = null;
    $scope.feedbackError = null;

    // Progress record
    $scope.progress = {
      completed_exercises: {},
      highest_unlocked_index: 0
    };

    // ── Getters ───────────────────────────────────────────────────
    $scope.getCurrentExercise = function() {
      return $scope.exercises[$scope.currentIndex] || $scope.exercises[0];
    };

    $scope.isCurrentExercisePassed = function() {
      var ex = $scope.getCurrentExercise();
      return !!($scope.progress.completed_exercises && $scope.progress.completed_exercises[ex.id]);
    };

    $scope.getProgressPercentage = function() {
      var count = Object.keys($scope.progress.completed_exercises || {}).length;
      return Math.round((count / $scope.totalExercises) * 100);
    };

    // ── Initialization & Persistence ────────────────────────────
    $scope.init = function() {
      onboardingService.loadProgress().then(function(res) {
        if (res.data) {
          var data = res.data;
          var stored = data.voice_onboarding_data || {};
          $scope.progress.completed_exercises = stored.completed_exercises || {};

          // If already completed and not re-practicing explicitly
          if (data.voice_onboarding_completed && $location.search().repeat !== 'true') {
            $scope.isCompleted = true;
            $location.path('/dashboard').replace();
            return;
          }

          // Determine current active exercise (resume from highest unfinished)
          var resumeIndex = 0;
          for (var i = 0; i < $scope.exercises.length; i++) {
            if ($scope.progress.completed_exercises[$scope.exercises[i].id]) {
              resumeIndex = i + 1;
            } else {
              break;
            }
          }

          if (resumeIndex >= $scope.totalExercises) {
            $scope.currentIndex = $scope.totalExercises - 1;
            $scope.isCompleted = true;
          } else {
            $scope.currentIndex = resumeIndex;
            $scope.progress.highest_unlocked_index = resumeIndex;
          }
        }
      }).catch(function(err) {
        console.warn('Could not load onboarding progress from server:', err);
      });
    };

    $scope.persistProgress = function(markComplete) {
      var payload = {
        voice_onboarding_completed: !!markComplete,
        voice_onboarding_level: Object.keys($scope.progress.completed_exercises).length,
        voice_onboarding_data: {
          completed_exercises: $scope.progress.completed_exercises,
          last_completed_at: new Date().toISOString()
        }
      };

      return onboardingService.saveProgress(payload).then(function(res) {
        // Broadcast change so app and auth know
        $rootScope.$broadcast('onboarding:updated', payload);
        return res;
      }).catch(function(err) {
        console.error('Failed to persist progress:', err);
      });
    };

    // ── Recording Interaction ────────────────────────────────────
    $scope.toggleRecording = function() {
      if ($scope.isRecording) {
        $scope.stopRecording();
      } else {
        $scope.startRecording();
      }
    };

    $scope.startRecording = function() {
      $scope.liveTranscript = '';
      $scope.interimTranscript = '';
      $scope.validationResult = null;
      $scope.feedbackError = null;
      voiceService.startRecording();
    };

    $scope.stopRecording = function() {
      voiceService.stopRecording();
    };

    // Listen to voiceService events
    $scope.$on('voice:statusChanged', function(evt, data) {
      $scope.isRecording = data.isRecording;
    });

    $scope.$on('voice:transcriptUpdated', function(evt, data) {
      $scope.liveTranscript = data.transcript;
      $scope.interimTranscript = data.interimTranscript;
    });

    $scope.$on('voice:audioReady', function() {
      $timeout(function() {
        if ($scope.liveTranscript && $scope.liveTranscript.trim()) {
          $scope.validateTranscript();
        } else {
          $scope.feedbackError = 'No speech detected. Please speak clearly into your microphone.';
        }
      }, 300);
    });

    // ── Validation & Progression ─────────────────────────────────
    $scope.validateTranscript = function() {
      var text = ($scope.liveTranscript || '').trim();
      if (!text) {
        toastService.warning('Please speak the phrase before submitting.');
        return;
      }

      var exercise = $scope.getCurrentExercise();
      $scope.isEvaluating = true;
      $scope.feedbackError = null;

      onboardingService.validatePractice(text, exercise.expected)
        .then(function(res) {
          $scope.isEvaluating = false;
          var val = res.data.validation || {};
          var parsed = res.data.parsed || {};

          $scope.validationResult = {
            passed: val.passed,
            fields: val.fields || {},
            items_detail: val.items_detail || [],
            parsed: parsed
          };

          if (val.passed) {
            // Mark current exercise as completed
            $scope.progress.completed_exercises[exercise.id] = {
              completed_at: new Date().toISOString(),
              transcript: text,
              parsed: parsed
            };

            // Check if this was the final exercise!
            var completedCount = Object.keys($scope.progress.completed_exercises).length;
            if (completedCount >= $scope.totalExercises) {
              $scope.isCompleted = true;
              $scope.persistProgress(true).then(function() {
                toastService.success('All ' + $scope.totalExercises + ' calibration commands passed successfully! Calibration complete.');
              });
            } else {
              $scope.progress.highest_unlocked_index = Math.max($scope.progress.highest_unlocked_index, $scope.currentIndex + 1);
              $scope.persistProgress(false).then(function() {
                toastService.success('Exercise ' + exercise.number + ' passed! Well done.');
              });
            }
          } else {
            // Build explanatory message of what failed
            var failureReasons = [];
            angular.forEach(val.fields, function(fieldData, fieldName) {
              if (!fieldData.match) {
                if (fieldName === 'amount') {
                  failureReasons.push('Amount mismatch: expected ₹' + fieldData.expected + ', recognized ₹' + (fieldData.actual || 0));
                } else if (fieldName === 'customer_name') {
                  failureReasons.push('Customer name not recognized: expected "' + fieldData.expected + '"');
                } else if (fieldName === 'items') {
                  failureReasons.push('Items mismatch: expected ' + fieldData.expected_count + ' items, found ' + fieldData.actual_count);
                } else if (fieldName === 'due_date') {
                  failureReasons.push('Due date not recognized: expected "' + fieldData.expected + '"');
                } else if (fieldName === 'payment_status') {
                  failureReasons.push('Payment status not recognized: expected "' + fieldData.expected + '"');
                } else {
                  failureReasons.push(fieldName + ' did not match expected value');
                }
              }
            });
            $scope.feedbackError = failureReasons.length ? failureReasons.join('. ') + '.' : 'Some details were not recognized correctly. Please retry speaking clearly.';
          }
        })
        .catch(function(err) {
          $scope.isEvaluating = false;
          $scope.feedbackError = 'Validation failed due to a network or server error. Please try again.';
          console.error('Validation error:', err);
        });
    };

    $scope.nextExercise = function() {
      if (!$scope.isCurrentExercisePassed()) {
        toastService.warning('You must pass this exercise before moving to the next.');
        return;
      }

      if ($scope.currentIndex < $scope.totalExercises - 1) {
        $scope.currentIndex++;
        $scope.retryExercise();
      } else {
        $scope.isCompleted = true;
      }
    };

    $scope.retryExercise = function() {
      $scope.validationResult = null;
      $scope.liveTranscript = '';
      $scope.interimTranscript = '';
      $scope.feedbackError = null;
    };

    // Quick test fill for accessibility and rapid verification
    $scope.fillSamplePhrase = function() {
      var exercise = $scope.getCurrentExercise();
      $scope.liveTranscript = exercise.phrase;
      $scope.validateTranscript();
    };

    $scope.enterDashboard = function() {
      if ($scope.isCompleted) {
        $location.path('/dashboard').replace();
      }
    };

    // Clean up recording on destroy
    $scope.$on('$destroy', function() {
      if ($scope.isRecording) {
        voiceService.stopRecording();
      }
    });

    // Start
    $scope.init();
  }
]);
