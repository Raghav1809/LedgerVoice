var app = angular.module('ledgerVoiceApp', ['ngRoute']);

app.constant('API_BASE_URL', '/api');

// Diagnostic Logging & Per-Tab Identifier for Multi-Account Isolation Tracking
if (!window.__lv_tab_id) {
  window.__lv_tab_id = 'tab_' + Math.random().toString(36).substring(2, 7) + '_' + Date.now().toString().slice(-4);
}

window.__lv_diagLog = function(event, details) {
  var hasToken = !!sessionStorage.getItem('lv_token');
  var hasRefresh = !!sessionStorage.getItem('lv_refresh');
  var userJson = sessionStorage.getItem('lv_user');
  var username = 'anonymous';
  try {
    if (userJson) {
      var u = JSON.parse(userJson);
      username = u.username || u.first_name || 'unknown';
    }
  } catch(e) {}
  var detailStr = details ? ' | details=' + JSON.stringify(details) : '';
  console.log('[DIAG][' + window.__lv_tab_id + '][' + event + '] storage=sessionStorage hasToken=' + hasToken + ' hasRefresh=' + hasRefresh + ' user=' + username + detailStr);
};

// JWT HTTP Request/Response Interceptor
app.factory('jwtInterceptor', ['$q', '$location', 'toastService', function($q, $location, toastService) {
  return {
    request: function(config) {
      var token = sessionStorage.getItem('lv_token');
      var loginTime = parseInt(sessionStorage.getItem('lv_login_timestamp') || '0', 10);
      var isExpired = loginTime > 0 && (Date.now() - loginTime >= 10 * 60 * 60 * 1000);

      if (config.url && config.url.indexOf('/api/') !== -1 && config.url.indexOf('/api/auth/login/') === -1) {
        window.__lv_diagLog('jwtInterceptor:request', { url: config.url, isExpired: isExpired });
      }

      if (isExpired && config.url && config.url.indexOf('/api/auth/') === -1) {
        window.__lv_diagLog('jwtInterceptor:sessionExpired', { url: config.url });
        sessionStorage.removeItem('lv_token');
        sessionStorage.removeItem('lv_refresh');
        sessionStorage.removeItem('lv_user');
        sessionStorage.removeItem('lv_login_timestamp');
        $location.path('/login');
        return $q.reject('Session expired');
      }

      if (token && config.url && config.url.indexOf('/api/') !== -1) {
        config.headers = config.headers || {};
        config.headers.Authorization = 'Bearer ' + token;
      }
      return config;
    },
    responseError: function(rejection) {
      if (rejection.status === 401 && rejection.config && rejection.config.url.indexOf('/api/auth/login/') === -1) {
        window.__lv_diagLog('jwtInterceptor:401_unauthorized', {
          url: rejection.config ? rejection.config.url : 'unknown',
          status: rejection.status
        });
        sessionStorage.removeItem('lv_token');
        sessionStorage.removeItem('lv_refresh');
        sessionStorage.removeItem('lv_user');
        sessionStorage.removeItem('lv_login_timestamp');
        $location.path('/login');
      }
      return $q.reject(rejection);
    }
  };
}]);

var authResolve = {
  auth: ['$q', '$location', '$http', 'authService', 'API_BASE_URL', function($q, $location, $http, authService, API_BASE_URL) {
    if (!authService.isAuthenticated()) {
      $location.path('/login').replace();
      return $q.reject('AUTH_REQUIRED');
    }
    // Verify onboarding completion status from backend before allowing access to protected views
    return $http.get(API_BASE_URL + '/voice/onboarding-progress/').then(function(res) {
      var isCompleted = res.data && res.data.voice_onboarding_completed;
      if (!isCompleted) {
        $location.path('/onboarding').replace();
        return $q.reject('ONBOARDING_REQUIRED');
      }
      return true;
    }).catch(function(err) {
      if (err === 'ONBOARDING_REQUIRED') {
        return $q.reject(err);
      }
      $location.path('/onboarding').replace();
      return $q.reject('ONBOARDING_REQUIRED');
    });
  }]
};

var onboardingResolve = {
  auth: ['$q', '$location', 'authService', function($q, $location, authService) {
    if (!authService.isAuthenticated()) {
      $location.path('/login').replace();
      return $q.reject('AUTH_REQUIRED');
    }
    return $q.resolve(true);
  }]
};

var guestResolve = {
  guest: ['$q', '$location', 'authService', function($q, $location, authService) {
    if (authService.isAuthenticated()) {
      $location.path('/dashboard').replace();
      return $q.reject('ALREADY_AUTHENTICATED');
    }
    return $q.resolve(true);
  }]
};

function defaultRedirect() {
  var token = sessionStorage.getItem('lv_token');
  var ts = parseInt(sessionStorage.getItem('lv_login_timestamp') || '0', 10);
  var valid = token && token !== 'null' && token !== 'undefined' && ts && (Date.now() - ts < 10 * 60 * 60 * 1000);
  return valid ? '/dashboard' : '/login';
}

app.config(['$routeProvider', '$httpProvider', function ($routeProvider, $httpProvider) {
  $httpProvider.interceptors.push('jwtInterceptor');

  $routeProvider
    .when('/dashboard',    { templateUrl: 'views/dashboard.html',    controller: 'DashboardController', resolve: authResolve })
    .when('/voice',        { templateUrl: 'views/voice.html',        controller: 'VoiceInputController', resolve: authResolve })
    .when('/onboarding',   { templateUrl: 'views/onboarding.html',   controller: 'OnboardingController', resolve: onboardingResolve })
    .when('/transactions', { templateUrl: 'views/transactions.html', controller: 'TransactionController', resolve: authResolve })
    .when('/inventory',    { templateUrl: 'views/inventory.html',    controller: 'InventoryController', resolve: authResolve })
    .when('/reminders',    { templateUrl: 'views/reminders.html',    controller: 'ReminderController', resolve: authResolve })
    .when('/login',        { templateUrl: 'views/login.html',        controller: 'AuthController', resolve: guestResolve })
    .when('/register',     { templateUrl: 'views/register.html',     controller: 'AuthController', resolve: guestResolve })
    // Fallback & legacy redirects
    .when('/customers',  { redirectTo: '/dashboard' })
    .when('/insights',   { redirectTo: '/dashboard' })
    .when('/settings',   { redirectTo: '/dashboard' })
    .when('/',           { redirectTo: defaultRedirect })
    .otherwise(          { redirectTo: defaultRedirect });
}]);

// Global Route Guard & 10-Hour Session Expiration Check
app.run(['$rootScope', '$location', 'authService', 'toastService', function($rootScope, $location, authService, toastService) {
  var PUBLIC_ROUTES = ['/login', '/register'];

  function isPublicRoute(path) {
    return PUBLIC_ROUTES.indexOf(path) !== -1;
  }

  // Handle route resolution rejection
  $rootScope.$on('$routeChangeError', function(event, current, previous, rejection) {
    if (rejection === 'AUTH_REQUIRED') {
      toastService.warning('Please sign in to access LedgerVoice.');
      $location.path('/login').replace();
    } else if (rejection === 'ONBOARDING_REQUIRED') {
      toastService.info('Please complete voice calibration to unlock LedgerVoice.');
      $location.path('/onboarding').replace();
    }
  });

  // $routeChangeStart guard
  $rootScope.$on('$routeChangeStart', function(event, next) {
    var targetPath = (next && next.$$route && next.$$route.originalPath) ? next.$$route.originalPath : '';
    if (!targetPath) return;

    var pub = isPublicRoute(targetPath);
    var authed = authService.isAuthenticated();

    // Session expired: force logout
    if (authService.getToken() && authService.isSessionExpired()) {
      if (event && event.preventDefault) event.preventDefault();
      authService.logout();
      toastService.warning('Your 10-hour session has expired. Please log in again.');
      $location.path('/login').replace();
      return;
    }

    // Not logged in → trying to access protected page
    if (!pub && !authed) {
      if (event && event.preventDefault) event.preventDefault();
      toastService.warning('Access denied. Please sign in to continue.');
      $location.path('/login').replace();
      return;
    }

    // Already logged in → trying to go to /login or /register
    if (pub && authed) {
      if (event && event.preventDefault) event.preventDefault();
      $location.path('/dashboard').replace();
    }
  });

  // $locationChangeStart guard (catches initial page load or direct URL edits)
  $rootScope.$on('$locationChangeStart', function(event, newUrl) {
    var authed = authService.isAuthenticated();
    var isPub = (newUrl || '').indexOf('/login') !== -1 || (newUrl || '').indexOf('/register') !== -1;
    if (!authed && !isPub) {
      $location.path('/login').replace();
    }
  });
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