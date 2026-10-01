/**
 * transactionService.js - Connects transaction module directly to backend API (/api/transactions/)
 * with seamless caching and reactive data flow for dashboard updates.
 */
app.factory('transactionService', ['$q', 'apiService', function($q, apiService) {
  var STORAGE_KEY = 'ledgervoice_transactions';

  function getLocalBackup() {
    var stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  function saveLocalBackup(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  return {
    getAll: function(params) {
      // params can be object or direct (type, search)
      var queryParams = {};
      if (typeof params === 'string') {
        if (params) queryParams.type = params;
      } else if (params && typeof params === 'object') {
        queryParams = params;
      }

      return apiService.get('/transactions/', queryParams).then(function(res) {
        var results = res.data.results || res.data || [];
        saveLocalBackup(results);
        return res;
      }).catch(function(err) {
        // Fallback to local storage if API is unreachable
        var list = getLocalBackup();
        if (queryParams.type) {
          list = list.filter(function(t) { return t.transaction_type === queryParams.type; });
        }
        if (queryParams.search) {
          var q = queryParams.search.toLowerCase();
          list = list.filter(function(t) {
            var name = (t.customer_name_raw || t.customer_name || (t.customer_detail && t.customer_detail.name) || '').toLowerCase();
            var desc = (t.description || '').toLowerCase();
            return name.indexOf(q) !== -1 || desc.indexOf(q) !== -1;
          });
        }
        return { data: list };
      });
    },

    getById: function(id) {
      return apiService.get('/transactions/' + id + '/');
    },

    create: function(txData) {
      return apiService.post('/transactions/', txData).then(function(res) {
        // Update local backup
        var list = getLocalBackup();
        list.unshift(res.data);
        saveLocalBackup(list);
        return res;
      });
    },

    update: function(id, txData) {
      return apiService.put('/transactions/' + id + '/', txData).then(function(res) {
        var list = getLocalBackup();
        var idx = list.findIndex(function(t) { return t.id === id; });
        if (idx !== -1) {
          list[idx] = res.data;
          saveLocalBackup(list);
        }
        return res;
      });
    },

    delete: function(id) {
      return apiService.delete('/transactions/' + id + '/').then(function(res) {
        var list = getLocalBackup();
        var filtered = list.filter(function(t) { return t.id !== id; });
        saveLocalBackup(filtered);
        return res;
      });
    }
  };
}]);
