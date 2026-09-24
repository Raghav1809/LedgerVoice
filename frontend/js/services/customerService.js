app.factory('customerService', ['$q', 'transactionService', function($q, transactionService) {
  return {
    getAll: function(params) {
      var deferred = $q.defer();
      transactionService.getAll().then(function(res) {
        var list = res.data;
        var uniqueNames = {};
        var customers = [];
        list.forEach(function(tx) {
          var name = tx.customer_name_raw || tx.customer_name;
          if (name && name !== 'General' && !uniqueNames[name]) {
            uniqueNames[name] = true;
            customers.push({ name: name });
          }
        });
        deferred.resolve({ data: customers });
      }).catch(function() {
        deferred.resolve({ data: [] });
      });
      return deferred.promise;
    },
    getById: function(id) {
      var deferred = $q.defer();
      deferred.resolve({ data: null });
      return deferred.promise;
    },
    getTransactions: function(id) {
      var deferred = $q.defer();
      deferred.resolve({ data: [] });
      return deferred.promise;
    },
    create: function(customerData) {
      var deferred = $q.defer();
      deferred.resolve({ data: customerData });
      return deferred.promise;
    },
    update: function(id, customerData) {
      var deferred = $q.defer();
      deferred.resolve({ data: customerData });
      return deferred.promise;
    },
    delete: function(id) {
      var deferred = $q.defer();
      deferred.resolve({ data: { success: true } });
      return deferred.promise;
    }
  };
}]);
