/**
 * voiceRecorder.component.js - Voice Recording & Transcription Component
 * Encapsulates browser speech recognition, microphone controls, animations,
 * live transcript editing, and AI parse triggers.
 */
app.component('voiceRecorder', {
  bindings: {
    transcript: '=',
    isParsing: '<',
    onProcess: '&',
    onClear: '&'
  },
  template: `
    <div class="voice-recorder-widget">
      <!-- Microphone Pulse Interface -->
      <div class="mic-container">
        <div class="mic-btn-wrapper">
          <button type="button" class="mic-btn" ng-class="{'recording': $ctrl.isRecording}" ng-click="$ctrl.toggleRecording()" title="Click to start/stop recording">
            <i class="fa-solid" ng-class="$ctrl.isRecording ? 'fa-square' : 'fa-microphone'"></i>
          </button>
          <div class="mic-pulse-ring" ng-if="$ctrl.isRecording"></div>
        </div>

        <div class="fw-semibold text-center mb-3" ng-class="$ctrl.isRecording ? 'text-danger fw-bold' : 'text-muted'">
          <span ng-if="$ctrl.isRecording">
            <i class="fa-solid fa-circle text-danger me-1 animate-pulse"></i> Recording English Speech... Click to Stop
          </span>
          <span ng-if="!$ctrl.isRecording">
            <i class="fa-solid fa-microphone-lines me-1 text-primary"></i> Tap microphone to begin recording
          </span>
        </div>

        <!-- Live Transcript Textarea -->
        <textarea class="form-control mb-3 shadow-sm" rows="3" ng-model="$ctrl.transcript" ng-disabled="$ctrl.isRecording" placeholder="Transcribed text will appear here... (e.g. 'Items list sugar 2kg 80 rupees oil 2 liter 100 rupees wheat 1 and half kg 90 rupees')"></textarea>

        <!-- Control Action Buttons -->
        <div class="d-flex flex-wrap justify-content-between gap-3 w-100">
          <button type="button" class="btn btn-outline-danger" ng-click="$ctrl.clearText()" ng-disabled="!$ctrl.transcript">
            <i class="fa-solid fa-trash me-2"></i> Clear
          </button>
          <button type="button" class="btn btn-gradient-blue px-4 py-2" ng-click="$ctrl.triggerProcess()" ng-disabled="!$ctrl.transcript || $ctrl.isParsing">
            <span ng-if="$ctrl.isParsing" class="spinner-border spinner-border-sm me-2"></span>
            <i class="fa-solid fa-wand-magic-sparkles me-2" ng-if="!$ctrl.isParsing"></i> AI Parse &amp; Confirm
          </button>
        </div>
      </div>
    </div>
  `,
  controller: ['$scope', 'voiceService', 'toastService', function($scope, voiceService, toastService) {
    var ctrl = this;
    ctrl.isRecording = false;
    ctrl.isSupported = voiceService.isSupported;

    ctrl.$onInit = function() {
      $scope.$on('voice:statusChanged', function(evt, args) {
        ctrl.isRecording = args.isRecording;
        if (args.error) toastService.danger('Voice recognition error: ' + args.error);
      });

      $scope.$on('voice:transcriptUpdated', function(evt, args) {
        ctrl.transcript = args.transcript;
      });

      $scope.$on('voice:audioReady', function(evt, args) {
        if (ctrl.transcript && ctrl.transcript.trim()) {
          toastService.info('Extracting details using NLP...');
          ctrl.triggerProcess();
        }
      });
    };

    ctrl.toggleRecording = function() {
      if (!ctrl.isSupported) {
        toastService.warning('Browser microphone is not supported in this browser. Please use Chrome, Edge, or Safari.');
        return;
      }
      if (ctrl.isRecording) {
        voiceService.stopRecording();
      } else {
        voiceService.startRecording();
        toastService.info('Listening... Speak in English. Tap stop when finished.');
      }
    };

    ctrl.clearText = function() {
      voiceService.clearTranscript();
      ctrl.transcript = '';
      if (ctrl.onClear) ctrl.onClear();
    };

    ctrl.triggerProcess = function() {
      if (ctrl.onProcess) ctrl.onProcess();
    };
  }]
});
