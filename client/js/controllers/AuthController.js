/**
 * AuthController.js - Authentication Controller for LedgerVoice
 * Manages user login, registration, validation, password toggles, and session handling.
 */
app.controller('AuthController', ['$scope', '$location', 'authService', 'onboardingService', 'toastService', function($scope, $location, authService, onboardingService, toastService) {
  $scope.isLoginMode = $location.path() === '/login';
  $scope.isLoading = false;
  $scope.errorMessage = '';
  $scope.showPassword = false;
  $scope.showConfirmPassword = false;

  // Login model
  $scope.loginData = {
    username: '',
    password: ''
  };

  // Register model
  $scope.regData = {
    first_name: '',
    last_name: '',
    business_name: '',
    phone: '',
    username: '',
    email: '',
    password: '',
    confirm_password: ''
  };

  // Toggle password visibility
  $scope.togglePassword = function() {
    $scope.showPassword = !$scope.showPassword;
  };

  $scope.toggleConfirmPassword = function() {
    $scope.showConfirmPassword = !$scope.showConfirmPassword;
  };

  // Quick autofill demo credentials
  $scope.fillDemoCredentials = function() {
    $scope.loginData.username = 'local_user';
    $scope.loginData.password = 'ledgervoice_local_2026';
    toastService.info('Demo credentials populated.');
  };

  // Submit Login
  $scope.handleLogin = function() {
    $scope.errorMessage = '';

    if (!$scope.loginData.username || !$scope.loginData.password) {
      $scope.errorMessage = 'Please provide both username and password.';
      return;
    }

    $scope.isLoading = true;
    authService.login($scope.loginData).then(function(res) {
      var user = authService.getUser() || { username: $scope.loginData.username };
      toastService.success('Welcome back, ' + (user.first_name || user.username || 'User') + '!');
      
      onboardingService.loadProgress().then(function(pRes) {
        if (pRes.data && pRes.data.voice_onboarding_completed) {
          $location.path('/dashboard');
        } else {
          $location.path('/onboarding');
        }
      }).catch(function() {
        $location.path('/onboarding');
      });
    }).catch(function(err) {
      var msg = 'Invalid username or password. Please try again.';
      if (err.data) {
        if (err.data.detail) msg = err.data.detail;
        else if (typeof err.data === 'string') msg = err.data;
      }
      $scope.errorMessage = msg;
      toastService.danger(msg);
    }).finally(function() {
      $scope.isLoading = false;
    });
  };

  // Submit Registration
  $scope.handleRegister = function() {
    $scope.errorMessage = '';

    if (!$scope.regData.username || !$scope.regData.password) {
      $scope.errorMessage = 'Username and password are required.';
      return;
    }

    if ($scope.regData.password.length < 6) {
      $scope.errorMessage = 'Password must be at least 6 characters long.';
      return;
    }

    if ($scope.regData.password !== $scope.regData.confirm_password) {
      $scope.errorMessage = 'Passwords do not match.';
      return;
    }

    $scope.isLoading = true;
    authService.register($scope.regData).then(function(res) {
      toastService.success('Account created successfully! Welcome to LedgerVoice.');
      $location.path('/onboarding');
    }).catch(function(err) {
      var msg = 'Registration failed. Please check your information.';
      if (err.data) {
        if (typeof err.data === 'object') {
          var firstKey = Object.keys(err.data)[0];
          var val = err.data[firstKey];
          msg = Array.isArray(val) ? val.join(' ') : String(val);
        } else if (typeof err.data === 'string') {
          msg = err.data;
        }
      }
      $scope.errorMessage = msg;
      toastService.danger(msg);
    }).finally(function() {
      $scope.isLoading = false;
    });
  };

  // If user is already authenticated and visits login/register, redirect to dashboard
  if (authService.isAuthenticated()) {
    $location.path('/dashboard');
  }
}]);
