app.factory('transactionService', ['$q', function($q) {
  var STORAGE_KEY = 'ledgervoice_transactions';

  function getTransactions() {
    var stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  function saveTransactions(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  return {
    getAll: function(params) {
      var deferred = $q.defer();
      var list = getTransactions();

      if (params) {
        if (params.type) {
          list = list.filter(function(tx) {
            return tx.transaction_type === params.type;
          });
        }
        if (params.search) {
          var query = params.search.toLowerCase();
          list = list.filter(function(tx) {
            var name = (tx.customer_name_raw || tx.customer_name || '').toLowerCase();
            var desc = (tx.description || '').toLowerCase();
            var amt = String(tx.amount || '');
            return name.indexOf(query) !== -1 || desc.indexOf(query) !== -1 || amt.indexOf(query) !== -1;
          });
        }
      }

      deferred.resolve({ data: list });
      return deferred.promise;
    },
    getById: function(id) {
      var deferred = $q.defer();
      var list = getTransactions();
      var found = list.find(function(tx) { return tx.id === id; });
      if (found) {
        deferred.resolve({ data: found });
      } else {
        deferred.reject({ status: 404, data: 'Not found' });
      }
      return deferred.promise;
    },
    create: function(txData) {
      var deferred = $q.defer();
      var list = getTransactions();
      
      // Auto-generate ID and ensure proper formatting
      txData.id = 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      txData.created_at = new Date().toISOString();
      txData.updated_at = new Date().toISOString();
      
      list.unshift(txData); // Newest first
      saveTransactions(list);
      
      deferred.resolve({ data: txData });
      return deferred.promise;
    },
    update: function(id, txData) {
      var deferred = $q.defer();
      var list = getTransactions();
      var index = list.findIndex(function(tx) { return tx.id === id; });
      
      if (index !== -1) {
        txData.updated_at = new Date().toISOString();
        list[index] = txData;
        saveTransactions(list);
        deferred.resolve({ data: txData });
      } else {
        deferred.reject({ status: 404, data: 'Not found' });
      }
      return deferred.promise;
    },
    delete: function(id) {
      var deferred = $q.defer();
      var list = getTransactions();
      var filtered = list.filter(function(tx) { return tx.id !== id; });
      
      if (filtered.length < list.length) {
        saveTransactions(filtered);
        deferred.resolve({ data: { success: true } });
      } else {
        deferred.reject({ status: 404, data: 'Not found' });
      }
      return deferred.promise;
    }
  };
}]);
