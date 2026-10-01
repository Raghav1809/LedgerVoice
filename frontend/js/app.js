var app = angular.module('ledgerVoiceApp', ['ngRoute']);

app.constant('API_BASE_URL', '/api');

// JWT HTTP Request/Response Interceptor
app.factory('jwtInterceptor', ['$q', '$location', function($q, $location) {
  return {
    request: function(config) {
      var token = localStorage.getItem('lv_token');
      if (token && config.url && config.url.indexOf('/api/') !== -1) {
        config.headers = config.headers || {};
        config.headers.Authorization = 'Bearer ' + token;
      }
      return config;
    },
    responseError: function(rejection) {
      if (rejection.status === 401 && rejection.config && rejection.config.url.indexOf('/api/auth/login/') === -1) {
        localStorage.removeItem('lv_token');
        localStorage.removeItem('lv_refresh');
        localStorage.removeItem('lv_user');
      }
      return $q.reject(rejection);
    }
  };
}]);

app.config(['$routeProvider', '$httpProvider', function ($routeProvider, $httpProvider) {
  $httpProvider.interceptors.push('jwtInterceptor');

  $routeProvider
    .when('/dashboard',    { templateUrl: 'views/dashboard.html',    controller: 'DashboardController' })
    .when('/voice',        { templateUrl: 'views/voice.html',        controller: 'VoiceInputController' })
    .when('/transactions', { templateUrl: 'views/transactions.html', controller: 'TransactionController' })
    .when('/login',        { templateUrl: 'views/login.html',        controller: 'AuthController' })
    .when('/register',     { templateUrl: 'views/register.html',     controller: 'AuthController' })
    // Fallback & legacy redirects
    .when('/customers',  { redirectTo: '/dashboard' })
    .when('/inventory',  { redirectTo: '/dashboard' })
    .when('/insights',   { redirectTo: '/dashboard' })
    .when('/reminders',  { redirectTo: '/dashboard' })
    .when('/settings',   { redirectTo: '/dashboard' })
    .when('/',           { redirectTo: '/dashboard' })
    .otherwise(          { redirectTo: '/dashboard' });
}]);

app.controller('MainController', ['$scope', '$location', 'toastService', 'authService', function ($scope, $location, toastService, authService) {
  $scope.toasts = toastService.toasts;
  $scope.currentUser = authService.getUser();
  $scope.isAuthenticated = authService.isAuthenticated();

  $scope.$on('auth:changed', function(event, user) {
    $scope.currentUser = user;
    $scope.isAuthenticated = authService.isAuthenticated();
  });

  $scope.isActive = function (viewLocation) { return viewLocation === $location.path(); };
  $scope.removeToast = function (index) { toastService.remove(index); };
  $scope.logout = function() {
    authService.logout();
    toastService.info('You have been logged out.');
  };
}]);