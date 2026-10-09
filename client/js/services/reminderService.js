/**
 * reminderService.js - Payment & Due date reminders service for LedgerVoice
 */
app.factory('reminderService', ['apiService', function(apiService) {
  return {
    getAll: function(params) {
      return apiService.get('/reminders/', params);
    },
    get: function(id) {
      return apiService.get('/reminders/' + id + '/');
    },
    create: function(data) {
      return apiService.post('/reminders/', data);
    },
    update: function(id, data) {
      return apiService.put('/reminders/' + id + '/', data);
    },
    delete: function(id) {
      return apiService.delete('/reminders/' + id + '/');
    },
    toggleComplete: function(id) {
      return apiService.post('/reminders/' + id + '/toggle_complete/');
    }
  };
}]);
