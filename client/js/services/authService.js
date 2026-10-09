/**
 * authService.js - JWT Authentication & 10-Hour Session Expiration Management for LedgerVoice
 */
app.factory('authService', ['$http', '$rootScope', '$location', 'API_BASE_URL', function($http, $rootScope, $location, API_BASE_URL) {
  var TOKEN_KEY = 'lv_token';
  var REFRESH_KEY = 'lv_refresh';
  var USER_KEY = 'lv_user';
  var TIME_KEY = 'lv_login_timestamp';
  var SESSION_DURATION_MS = 10 * 60 * 60 * 1000; // 10 Hours in milliseconds

  var service = {
    getToken: function() {
      var t = localStorage.getItem(TOKEN_KEY);
      if (!t || t === 'null' || t === 'undefined' || !t.trim()) return null;
      return t;
    },

    getRefreshToken: function() {
      var r = localStorage.getItem(REFRESH_KEY);
      if (!r || r === 'null' || r === 'undefined' || !r.trim()) return null;
      return r;
    },

    getUser: function() {
      var userJson = localStorage.getItem(USER_KEY);
      if (!userJson || userJson === 'null' || userJson === 'undefined') return null;
      try {
        return JSON.parse(userJson);
      } catch (e) {
        return null;
      }
    },

    getLoginTimestamp: function() {
      var ts = localStorage.getItem(TIME_KEY);
      return ts ? parseInt(ts, 10) : 0;
    },

    isSessionExpired: function() {
      var token = service.getToken();
      if (!token) return true;
      var loginTime = service.getLoginTimestamp();
      if (!loginTime || isNaN(loginTime)) return true; // Require valid active login timestamp
      var elapsed = Date.now() - loginTime;
      return elapsed >= SESSION_DURATION_MS || elapsed < 0;
    },

    isAuthenticated: function() {
      var token = service.getToken();
      if (!token) return false;
      if (service.isSessionExpired()) {
        service.logout();
        return false;
      }
      return true;
    },

    setSession: function(access, refresh, user) {
      if (access) localStorage.setItem(TOKEN_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(TIME_KEY, Date.now().toString());
      $rootScope.$broadcast('auth:changed', service.getUser());
    },

    login: function(credentials) {
      return $http.post(API_BASE_URL + '/auth/login/', credentials).then(function(res) {
        var data = res.data;
        var access = data.access;
        var refresh = data.refresh;
        var user = data.user || { username: credentials.username };

        service.setSession(access, refresh, user);

        if (!data.user) {
          service.fetchCurrentUser();
        }

        return res;
      });
    },

    register: function(userData) {
      return $http.post(API_BASE_URL + '/auth/register/', userData).then(function(res) {
        var data = res.data;
        if (data.access) {
          service.setSession(data.access, data.refresh, data.user);
        }
        return res;
      });
    },

    fetchCurrentUser: function() {
      return $http.get(API_BASE_URL + '/auth/user/').then(function(res) {
        if (res.data) {
          localStorage.setItem(USER_KEY, JSON.stringify(res.data));
          $rootScope.$broadcast('auth:changed', res.data);
        }
        return res.data;
      });
    },

    refreshToken: function() {
      var refresh = service.getRefreshToken();
      if (!refresh) return Promise.reject('No refresh token available');

      return $http.post(API_BASE_URL + '/auth/token/refresh/', { refresh: refresh }).then(function(res) {
        if (res.data && res.data.access) {
          localStorage.setItem(TOKEN_KEY, res.data.access);
        }
        return res.data;
      });
    },

    logout: function() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TIME_KEY);
      $rootScope.$broadcast('auth:changed', null);
      $location.path('/login');
    }
  };

  return service;
}]);
