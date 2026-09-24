app.factory('inventoryService', ['$q', function($q) {
  var STORAGE_KEY = 'ledgervoice_inventory';

  // Seed default catalog if empty
  var defaultCatalog = [
    { name: 'Sugar', unit: 'kg', price: 45, quantity: 50.0 },
    { name: 'Oil', unit: 'litre', price: 120, quantity: 30.0 },
    { name: 'Rice', unit: 'kg', price: 60, quantity: 100.0 },
    { name: 'Wheat', unit: 'kg', price: 40, quantity: 150.0 }
  ];

  function getCatalog() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultCatalog));
      return defaultCatalog;
    }
    return JSON.parse(stored);
  }

  function saveCatalog(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  return {
    getAll: function() {
      var deferred = $q.defer();
      deferred.resolve({ data: getCatalog() });
      return deferred.promise;
    },
    
    findByName: function(name) {
      if (!name) return null;
      var catalog = getCatalog();
      var normalized = name.trim().toLowerCase();
      
      // Match exact or contains case-insensitive
      return catalog.find(function(item) {
        return item.name.toLowerCase() === normalized;
      }) || null;
    },

    updateStock: function(name, qtySold) {
      var catalog = getCatalog();
      var normalized = name.trim().toLowerCase();
      var found = false;

      for (var i = 0; i < catalog.length; i++) {
        if (catalog[i].name.toLowerCase() === normalized) {
          catalog[i].quantity = Math.max(0, catalog[i].quantity - parseFloat(qtySold));
          found = true;
          break;
        }
      }

      if (found) {
        saveCatalog(catalog);
      }
      return found;
    },

    createOrUpdate: function(itemData) {
      var catalog = getCatalog();
      var normalized = itemData.name.trim().toLowerCase();
      var index = catalog.findIndex(function(item) {
        return item.name.toLowerCase() === normalized;
      });

      if (index !== -1) {
        catalog[index].unit = itemData.unit || catalog[index].unit;
        catalog[index].price = parseFloat(itemData.price) || catalog[index].price;
        catalog[index].quantity = parseFloat(itemData.quantity) || catalog[index].quantity;
      } else {
        catalog.push({
          name: itemData.name.trim(),
          unit: itemData.unit || 'pcs',
          price: parseFloat(itemData.price) || 0,
          quantity: parseFloat(itemData.quantity) || 0
        });
      }
      saveCatalog(catalog);
    }
  };
}]);
