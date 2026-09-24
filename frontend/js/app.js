var app = angular.module('ledgerVoiceApp', ['ngRoute']);

app.constant('API_BASE_URL', '/api');

app.config(['$routeProvider', function ($routeProvider) {
  $routeProvider
    .when('/voice',        { templateUrl: 'views/voice.html',        controller: 'VoiceInputController' })
    .when('/transactions', { templateUrl: 'views/transactions.html', controller: 'TransactionController' })
    // Legacy redirects — keep old URLs working
    .when('/dashboard',  { redirectTo: '/voice' })
    .when('/customers',  { redirectTo: '/voice' })
    .when('/inventory',  { redirectTo: '/voice' })
    .when('/insights',   { redirectTo: '/voice' })
    .when('/reminders',  { redirectTo: '/voice' })
    .when('/settings',   { redirectTo: '/voice' })
    .when('/login',      { redirectTo: '/voice' })
    .when('/register',   { redirectTo: '/voice' })
    .when('/',           { redirectTo: '/voice' })
    .otherwise(          { redirectTo: '/voice' });
}]);

app.controller('MainController', ['$scope', '$location', 'toastService', function ($scope, $location, toastService) {
  $scope.toasts = toastService.toasts;
  $scope.isActive = function (viewLocation) { return viewLocation === $location.path(); };
  $scope.removeToast = function (index) { toastService.remove(index); };
}]);