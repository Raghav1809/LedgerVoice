/**
 * authService.js - JWT Authentication & 10-Hour Session Expiration Management for LedgerVoice
 */
app.factory('authService', ['$http', '$q', '$rootScope', '$location', 'API_BASE_URL', function($http, $q, $rootScope, $location, API_BASE_URL) {
  var TOKEN_KEY = 'lv_token';
  var REFRESH_KEY = 'lv_refresh';
  var USER_KEY = 'lv_user';
  var TIME_KEY = 'lv_login_timestamp';
  var SESSION_DURATION_MS = 10 * 60 * 60 * 1000; // 10 Hours in milliseconds

  var service = {
    getToken: function() {
      var t = sessionStorage.getItem(TOKEN_KEY);
      if (!t || t === 'null' || t === 'undefined' || !t.trim()) return null;
      return t;
    },

    getRefreshToken: function() {
      var r = sessionStorage.getItem(REFRESH_KEY);
      if (!r || r === 'null' || r === 'undefined' || !r.trim()) return null;
      return r;
    },

    getUser: function() {
      var userJson = sessionStorage.getItem(USER_KEY);
      if (!userJson || userJson === 'null' || userJson === 'undefined') return null;
      try {
        return JSON.parse(userJson);
      } catch (e) {
        return null;
      }
    },

    getLoginTimestamp: function() {
      var ts = sessionStorage.getItem(TIME_KEY);
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
      if (window.__lv_diagLog) {
        window.__lv_diagLog('authService:setSession', { user: user ? (user.username || user.first_name) : null });
      }
      if (access) sessionStorage.setItem(TOKEN_KEY, access);
      if (refresh) sessionStorage.setItem(REFRESH_KEY, refresh);
      if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      sessionStorage.setItem(TIME_KEY, Date.now().toString());
      $rootScope.$broadcast('auth:changed', service.getUser());
    },

    login: function(credentials) {
      if (window.__lv_diagLog) {
        window.__lv_diagLog('authService:login_attempt', { username: credentials.username });
      }
      return $http.post(API_BASE_URL + '/auth/login/', credentials).then(function(res) {
        var data = res.data;
        var access = data.access;
        var refresh = data.refresh;
        var user = data.user || { username: credentials.username };

        service.setSession(access, refresh, user);

        if (window.__lv_diagLog) {
          window.__lv_diagLog('authService:login_success', { username: credentials.username });
        }

        if (!data.user) {
          service.fetchCurrentUser();
        }

        return res;
      }).catch(function(err) {
        if (window.__lv_diagLog) {
          window.__lv_diagLog('authService:login_failed', { username: credentials.username, status: err ? err.status : 'error' });
        }
        return $q.reject(err);
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
          sessionStorage.setItem(USER_KEY, JSON.stringify(res.data));
          $rootScope.$broadcast('auth:changed', res.data);
        }
        return res.data;
      });
    },

    refreshToken: function() {
      var refresh = service.getRefreshToken();
      if (!refresh) {
        if (window.__lv_diagLog) window.__lv_diagLog('authService:refreshToken_no_token');
        return $q.reject('No refresh token available');
      }

      if (window.__lv_diagLog) window.__lv_diagLog('authService:refreshToken_attempt');
      return $http.post(API_BASE_URL + '/auth/token/refresh/', { refresh: refresh }).then(function(res) {
        if (res.data && res.data.access) {
          sessionStorage.setItem(TOKEN_KEY, res.data.access);
        }
        if (res.data && res.data.refresh) {
          sessionStorage.setItem(REFRESH_KEY, res.data.refresh);
        }
        if (window.__lv_diagLog) window.__lv_diagLog('authService:refreshToken_success');
        return res.data;
      }).catch(function(err) {
        if (window.__lv_diagLog) window.__lv_diagLog('authService:refreshToken_failed', { status: err ? err.status : 'error' });
        return $q.reject(err);
      });
    },

    logout: function() {
      if (window.__lv_diagLog) window.__lv_diagLog('authService:logout_initiated');
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TIME_KEY);
      sessionStorage.removeItem('ledgervoice_transactions');

      // Note: We deliberately do NOT touch localStorage here so that per-tab logout
      // cannot trigger storage events or mutate shared origin storage across tabs.
      if (window.__lv_diagLog) window.__lv_diagLog('authService:logout_completed');

      $rootScope.$broadcast('auth:changed', null);
      $location.path('/login');
    }
  };

  return service;
}]);
