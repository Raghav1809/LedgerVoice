/**
 * authService.js - JWT Authentication & User Session Management for LedgerVoice
 */
app.factory('authService', ['$http', '$rootScope', '$location', 'API_BASE_URL', function($http, $rootScope, $location, API_BASE_URL) {
  var TOKEN_KEY = 'lv_token';
  var REFRESH_KEY = 'lv_refresh';
  var USER_KEY = 'lv_user';

  var service = {
    getToken: function() {
      return localStorage.getItem(TOKEN_KEY);
    },

    getRefreshToken: function() {
      return localStorage.getItem(REFRESH_KEY);
    },

    getUser: function() {
      var userJson = localStorage.getItem(USER_KEY);
      if (!userJson) return null;
      try {
        return JSON.parse(userJson);
      } catch (e) {
        return null;
      }
    },

    isAuthenticated: function() {
      var token = service.getToken();
      return !!token;
    },

    setSession: function(access, refresh, user) {
      if (access) localStorage.setItem(TOKEN_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      $rootScope.$broadcast('auth:changed', service.getUser());
    },

    login: function(credentials) {
      return $http.post(API_BASE_URL + '/auth/login/', credentials).then(function(res) {
        var data = res.data;
        var access = data.access;
        var refresh = data.refresh;
        var user = data.user || { username: credentials.username };

        service.setSession(access, refresh, user);

        // Fetch fresh user profile if not directly provided
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
      $rootScope.$broadcast('auth:changed', null);
      $location.path('/login');
    }
  };

  return service;
}]);
