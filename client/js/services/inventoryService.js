app.factory('inventoryService', ['apiService', '$q', function(apiService, $q) {
  var cachedItems = [];

  function updateCache(items) {
    if (Array.isArray(items)) {
      cachedItems = items;
    }
  }

  function refreshCache() {
    var token = localStorage.getItem('lv_token');
    if (!token) {
      return $q.resolve(cachedItems);
    }
    return apiService.get('/inventory/').then(function(res) {
      var items = res.data.results || res.data || [];
      updateCache(items);
      return items;
    }).catch(function() {
      return cachedItems;
    });
  }

  // Pre-fetch cache if logged in
  if (localStorage.getItem('lv_token')) {
    refreshCache();
  }

  return {
    refreshCache: refreshCache,
    
    getCachedItems: function() {
      return cachedItems;
    },

    getAll: function(params) {
      return apiService.get('/inventory/', params).then(function(res) {
        if (!params || Object.keys(params).length === 0) {
          updateCache(res.data.results || res.data || []);
        }
        return res;
      });
    },

    getById: function(id) {
      return apiService.get('/inventory/' + id + '/');
    },

    create: function(data) {
      return apiService.post('/inventory/', data).then(function(res) {
        refreshCache();
        return res;
      });
    },

    update: function(id, data) {
      return apiService.put('/inventory/' + id + '/', data).then(function(res) {
        refreshCache();
        return res;
      });
    },

    delete: function(id) {
      return apiService.delete('/inventory/' + id + '/').then(function(res) {
        refreshCache();
        return res;
      });
    },

    lookup: function(productName, unit) {
      var params = { product: productName };
      if (unit) params.unit = unit;
      return apiService.get('/inventory/lookup/', params);
    },

    findByName: function(name) {
      if (!name) return null;
      var normalized = name.trim().toLowerCase();
      return cachedItems.find(function(item) {
        var pName = (item.product_name || item.name || '').trim().toLowerCase();
        return pName === normalized;
      }) || null;
    },

    updateStock: function(name, qtySold) {
      var item = this.findByName(name);
      if (item && item.id) {
        var currentQty = parseFloat(item.quantity) || 0;
        var newQty = Math.max(0, currentQty - (parseFloat(qtySold) || 0));
        var payload = {
          product_name: item.product_name,
          unit: item.unit,
          price: item.price,
          quantity: newQty
        };
        return apiService.put('/inventory/' + item.id + '/', payload).then(function() {
          refreshCache();
        });
      }
      return $q.resolve();
    }
  };
}]);
