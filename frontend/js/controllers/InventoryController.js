app.controller('InventoryController', ['$scope', 'inventoryService', 'toastService', function ($scope, inventoryService, toastService) {

  // ── State ─────────────────────────────────────────────────────────
  $scope.inventoryItems = [];
  $scope.isLoading = true;
  $scope.searchQuery = '';
  $scope.editMode = false;
  $scope.isSaving = false;

  // Form model for Add / Edit modal
  $scope.formItem = {
    product_name: '',
    unit: 'kg',
    quantity: 1.0,
    price: null
  };
  $scope.editingId = null;

  // Voice add state  ── all private to InventoryController ──────────
  $scope.isVoiceMode = false;
  $scope.isRecording = false;
  $scope.voiceTranscript = '';
  $scope.voiceInterim = '';
  $scope.voiceParsed = null;
  $scope.showVoiceConfirm = false;

  // Valid units for display
  $scope.unitOptions = [
    { value: 'kg', label: 'kg' },
    { value: 'g', label: 'g' },
    { value: 'litre', label: 'litre' },
    { value: 'ml', label: 'ml' },
    { value: 'piece', label: 'piece' },
    { value: 'pcs', label: 'pcs' },
    { value: 'bottle', label: 'bottle' },
    { value: 'dozen', label: 'dozen' },
    { value: 'packet', label: 'packet' },
    { value: 'box', label: 'box' },
    { value: 'bag', label: 'bag' },
    { value: 'bundle', label: 'bundle' },
    { value: 'mtr', label: 'mtr' },
    { value: 'ft', label: 'ft' }
  ];
  $scope.Math = window.Math;
  $scope.selectedUnitFilter = '';
  $scope.showLowStockOnly = false;

  $scope.toggleLowStockFilter = function() {
    $scope.showLowStockOnly = !$scope.showLowStockOnly;
  };

  $scope.getTotalStockUnits = function() {
    var total = 0;
    ($scope.inventoryItems || []).forEach(function(item) {
      total += (parseFloat(item.quantity) || 0);
    });
    return total;
  };

  $scope.getLowStockCount = function() {
    var count = 0;
    ($scope.inventoryItems || []).forEach(function(item) {
      if ((parseFloat(item.quantity) || 0) < 5) count++;
    });
    return count;
  };

  $scope.getTotalInventoryValue = function() {
    var val = 0;
    ($scope.inventoryItems || []).forEach(function(item) {
      val += (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0);
    });
    return val;
  };

  $scope.filteredItems = function() {
    return ($scope.inventoryItems || []).filter(function(item) {
      if ($scope.showLowStockOnly && (parseFloat(item.quantity) || 0) >= 5) {
        return false;
      }
      if ($scope.selectedUnitFilter && item.unit !== $scope.selectedUnitFilter) {
        return false;
      }
      if ($scope.searchQuery && $scope.searchQuery.trim()) {
        var q = $scope.searchQuery.trim().toLowerCase();
        var pName = (item.product_name || '').toLowerCase();
        return pName.indexOf(q) !== -1;
      }
      return true;
    });
  };


  // ── Load Inventory ────────────────────────────────────────────────
  $scope.loadInventory = function () {
    $scope.isLoading = true;
    var params = {};
    if ($scope.searchQuery && $scope.searchQuery.trim()) {
      params.search = $scope.searchQuery.trim();
    }
    inventoryService.getAll(params).then(function (res) {
      $scope.inventoryItems = res.data.results || res.data;
    }).catch(function () {
      toastService.danger('Failed to load inventory items.');
    }).finally(function () {
      $scope.isLoading = false;
    });
  };

  $scope.loadInventory();

  // ── Search with debounce ──────────────────────────────────────────
  var searchTimer = null;
  $scope.onSearchChange = function () {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      $scope.$apply(function () {
        $scope.loadInventory();
      });
    }, 300);
  };

  // ── Add / Edit Modal ──────────────────────────────────────────────
  $scope.openAddModal = function () {
    $scope.editMode = false;
    $scope.editingId = null;
    $scope.formItem = { product_name: '', unit: 'kg', quantity: 1.0, price: null };
  };

  $scope.openEditModal = function (item) {
    $scope.editMode = true;
    $scope.editingId = item.id;
    $scope.formItem = {
      product_name: item.product_name,
      unit: item.unit,
      quantity: parseFloat(item.quantity) || 1.0,
      price: parseFloat(item.price)
    };
  };

  $scope.saveItem = function () {
    // Validation
    if (!$scope.formItem.product_name || !$scope.formItem.product_name.trim()) {
      toastService.warning('Product name cannot be empty.');
      return;
    }
    if ($scope.formItem.quantity === null || $scope.formItem.quantity === undefined || $scope.formItem.quantity <= 0) {
      toastService.warning('Quantity must be greater than zero.');
      return;
    }
    if ($scope.formItem.price === null || $scope.formItem.price === undefined || $scope.formItem.price < 0) {
      toastService.warning('Price cannot be negative or empty.');
      return;
    }

    $scope.isSaving = true;
    var data = {
      product_name: $scope.formItem.product_name.trim(),
      unit: $scope.formItem.unit,
      quantity: $scope.formItem.quantity,
      price: $scope.formItem.price
    };

    var promise;
    if ($scope.editMode && $scope.editingId) {
      promise = inventoryService.update($scope.editingId, data);
    } else {
      promise = inventoryService.create(data);
    }

    promise.then(function () {
      toastService.success($scope.editMode ? 'Inventory item updated!' : 'Inventory item added!');
      // Close modal
      var modalEl = document.getElementById('inventoryFormModal');
      if (modalEl && window.bootstrap) {
        var modal = window.bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      $scope.loadInventory();
    }).catch(function (err) {
      var errMsg = 'Failed to save inventory item.';
      if (err.data) {
        if (err.data.product_name) {
          errMsg = Array.isArray(err.data.product_name) ? err.data.product_name[0] : err.data.product_name;
        } else if (err.data.quantity) {
          errMsg = Array.isArray(err.data.quantity) ? err.data.quantity[0] : err.data.quantity;
        } else if (err.data.price) {
          errMsg = Array.isArray(err.data.price) ? err.data.price[0] : err.data.price;
        } else if (err.data.non_field_errors) {
          errMsg = err.data.non_field_errors[0];
        }
      }
      toastService.danger(errMsg);
    }).finally(function () {
      $scope.isSaving = false;
    });
  };

  // ── Delete ────────────────────────────────────────────────────────
  $scope.deleteItem = function (item) {
    if (!confirm('Delete "' + item.product_name + '" from inventory?')) return;
    inventoryService.delete(item.id).then(function () {
      toastService.success('"' + item.product_name + '" deleted from inventory.');
      $scope.loadInventory();
    }).catch(function () {
      toastService.danger('Failed to delete inventory item.');
    });
  };

  $scope.adjustStock = function (item, delta) {
    var newQty = Math.max(0, (parseFloat(item.quantity) || 0) + delta);
    newQty = Math.round(newQty * 1000) / 1000;
    var data = {
      product_name: item.product_name,
      unit: item.unit,
      quantity: newQty,
      price: item.price
    };
    inventoryService.update(item.id, data).then(function () {
      item.quantity = newQty;
      toastService.success('Stock for ' + item.product_name + ' updated to ' + newQty + ' ' + item.unit);
    }).catch(function () {
      toastService.danger('Failed to update stock quantity.');
    });
  };



  // ════════════════════════════════════════════════════════════════════
  // INVENTORY-PRIVATE VOICE ADD
  // Uses its own SpeechRecognition instance – completely independent
  // from voiceService and VoiceInputController. No $rootScope events.
  // ════════════════════════════════════════════════════════════════════

  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var inventoryRecognition = null;

  function _safeApply(fn) {
    if ($scope.$$phase || $scope.$root.$$phase) {
      fn();
    } else {
      $scope.$apply(fn);
    }
  }

  function _startInventoryRecognition() {
    if (!SpeechRecognition) {
      toastService.warning('Speech recognition is not supported in this browser. Use Chrome or Edge.');
      return;
    }
    if (inventoryRecognition) {
      _stopInventoryRecognition();
    }

    $scope.voiceTranscript = '';
    $scope.voiceInterim = '';
    $scope.isRecording = true;

    try {
      inventoryRecognition = new SpeechRecognition();
      inventoryRecognition.continuous = true;
      inventoryRecognition.interimResults = true;
      inventoryRecognition.lang = 'en-US';

      inventoryRecognition.onresult = function (event) {
        var interimText = '';
        var finalText = '';

        for (var i = event.resultIndex; i < event.results.length; i++) {
          var result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }

        _safeApply(function () {
          if (finalText) {
            $scope.voiceTranscript += finalText;
          }
          $scope.voiceInterim = interimText;
        });
      };

      inventoryRecognition.onerror = function (event) {
        var errCode = event.error;
        _safeApply(function () {
          $scope.isRecording = false;
        });
        if (inventoryRecognition) {
          inventoryRecognition.onresult = null;
          inventoryRecognition.onerror = null;
          inventoryRecognition.onend = null;
          try { inventoryRecognition.abort(); } catch (e) { }
          inventoryRecognition = null;
        }
        if (errCode !== 'no-speech') {
          toastService.danger('Microphone error: ' + errCode);
        }
      };

      inventoryRecognition.onend = function () {
        if ($scope.isRecording) {
          var dead = inventoryRecognition;
          if (dead) {
            dead.onresult = null;
            dead.onerror = null;
            dead.onend = null;
          }
          inventoryRecognition = null;
          setTimeout(function () {
            if ($scope.isRecording) {
              _startInventoryRecognition();
            }
          }, 150);
        }
      };

      inventoryRecognition.start();
    } catch (e) {
      toastService.danger('Failed to start microphone.');
      $scope.isRecording = false;
      inventoryRecognition = null;
    }
  }

  function _stopInventoryRecognition() {
    $scope.isRecording = false;
    if (inventoryRecognition) {
      try {
        inventoryRecognition.onresult = null;
        inventoryRecognition.onerror = null;
        inventoryRecognition.onend = null;
        inventoryRecognition.stop();
      } catch (e) { }
      inventoryRecognition = null;
    }
  }

  $scope.openVoiceAdd = function () {
    $scope.isVoiceMode = true;
    $scope.voiceTranscript = '';
    $scope.voiceInterim = '';
    $scope.voiceParsed = null;
    $scope.showVoiceConfirm = false;
    $scope.isRecording = false;
  };

  $scope.closeVoiceAdd = function () {
    _stopInventoryRecognition();
    $scope.isVoiceMode = false;
    $scope.voiceTranscript = '';
    $scope.voiceInterim = '';
    $scope.voiceParsed = null;
    $scope.showVoiceConfirm = false;
  };

  $scope.toggleVoiceRecording = function () {
    if ($scope.isRecording) {
      _stopInventoryRecognition();
    } else {
      _startInventoryRecognition();
      toastService.info('Listening... Say something like "Add 20 kg sugar for 1000 rupees"');
    }
  };

  $scope.$on('$destroy', function () {
    _stopInventoryRecognition();
  });

  $scope.parseVoiceInventory = function () {
    var text = ($scope.voiceTranscript || '').trim();
    if (!text) {
      toastService.warning('No speech captured. Please record again.');
      return;
    }

    var parsed = parseInventoryVoice(text);
    if (parsed) {
      $scope.voiceParsed = parsed;
      $scope.showVoiceConfirm = true;
    } else {
      toastService.warning('Could not extract product details. Try: "Sugar 45 rupees per kg" or "Add 20 kg sugar for 1000 rupees"');
    }
  };

  $scope.confirmVoiceAdd = function () {
    if (!$scope.voiceParsed) return;

    var data = {
      product_name: $scope.voiceParsed.product_name,
      unit: $scope.voiceParsed.unit,
      quantity: $scope.voiceParsed.quantity,
      price: $scope.voiceParsed.price
    };

    $scope.isSaving = true;
    inventoryService.create(data).then(function () {
      toastService.success('Added "' + data.product_name + '" to inventory via voice!');
      $scope.closeVoiceAdd();
      $scope.loadInventory();
    }).catch(function (err) {
      var errMsg = 'Failed to add inventory item.';
      if (err.data) {
        if (err.data.product_name) {
          errMsg = Array.isArray(err.data.product_name) ? err.data.product_name[0] : err.data.product_name;
        } else if (err.data.quantity) {
          errMsg = Array.isArray(err.data.quantity) ? err.data.quantity[0] : err.data.quantity;
        }
      }
      toastService.danger(errMsg);
    }).finally(function () {
      $scope.isSaving = false;
    });
  };

  // ── Inventory Voice Parser ───────────────────────────────────────
  var UNIT_MAP = {
    'kg': 'kg', 'kgs': 'kg', 'kilo': 'kg', 'kilos': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'g': 'g', 'gm': 'g', 'gms': 'g', 'gram': 'g', 'grams': 'g',
    'l': 'litre', 'ltr': 'litre', 'liter': 'litre', 'liters': 'litre',
    'litre': 'litre', 'litres': 'litre',
    'ml': 'ml', 'milliliter': 'ml', 'millilitre': 'ml',
    'milliliters': 'ml', 'millilitres': 'ml',
    'piece': 'pcs', 'pieces': 'pcs', 'pcs': 'pcs', 'pc': 'pcs',
    'unit': 'pcs', 'units': 'pcs',
    'dozen': 'dozen', 'dozens': 'dozen', 'doz': 'dozen',
    'packet': 'packet', 'packets': 'packet', 'pack': 'packet', 'packs': 'packet',
    'box': 'box', 'boxes': 'box',
    'bottle': 'bottle', 'bottles': 'bottle',
    'bag': 'bag', 'bags': 'bag',
    'bundle': 'bundle', 'bundles': 'bundle',
    'meter': 'mtr', 'meters': 'mtr', 'mtr': 'mtr',
    'ft': 'ft', 'feet': 'ft', 'foot': 'ft',
    'ton': 'kg', 'tons': 'kg'
  };

  var unitKeys = Object.keys(UNIT_MAP).sort(function (a, b) { return b.length - a.length; });
  var unitPattern = unitKeys.join('|');

  var CUR_RE = '(?:rs\\.?|rupees?|rupee|inr|₹|\\$)';
  var PRICE_RE = CUR_RE + '?\\s*(\\d+(?:\\.\\d{1,2})?)\\s*' + CUR_RE + '?';
  var CONN_RE = '(?:at|is|for|of|price|costs?|costing|rate(?:\\s+of)?|to|@)?';

  function parseInventoryVoice(text) {
    if (!text) return null;

    var norm = text.trim()
      .replace(/[,;:!]/g, ' ')
      .replace(/^(?:(?:add\s+)?inventory\s+|add\s+|i\s+have\s+)/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.,!?;:]+$/, '')
      .trim();

    var result = null;
    var m;

    var pQtyUnitProductPrice = new RegExp(
      '^(\\d+(?:\\.\\d+)?)\\s*\\b(' + unitPattern + ')\\b\\s+(?:of\\s+)?([a-zA-Z][a-zA-Z\\s]{0,29}?)\\s+' + CONN_RE + '\\s*' + PRICE_RE + '$',
      'i'
    );
    m = pQtyUnitProductPrice.exec(norm);
    if (m) {
      result = { product_name: m[3], quantity: m[1], unit: m[2], price: m[4] };
    }

    if (!result) {
      var pProductQtyUnitPrice = new RegExp(
        '^([a-zA-Z][a-zA-Z\\s]{0,29}?)\\s+(\\d+(?:\\.\\d+)?)\\s*\\b(' + unitPattern + ')\\b\\s+' + CONN_RE + '\\s*' + PRICE_RE + '$',
        'i'
      );
      m = pProductQtyUnitPrice.exec(norm);
      if (m) {
        result = { product_name: m[1], quantity: m[2], unit: m[3], price: m[4] };
      }
    }

    if (!result) {
      var pProductPricePerUnit = new RegExp(
        '^([a-zA-Z0-9][a-zA-Z0-9\\s]{0,30}?)\\s+' + CONN_RE + '\\s*' + PRICE_RE + '\\s+(?:per|a|an|each|\\/)?\\s*\\b(' + unitPattern + ')\\b$',
        'i'
      );
      m = pProductPricePerUnit.exec(norm);
      if (m) {
        result = { product_name: m[1], quantity: 1.0, unit: m[3], price: m[2] };
      }
    }

    if (!result) {
      var pPricePerUnitProduct = new RegExp(
        '^' + PRICE_RE + '\\s+(?:per|a|an|each|\\/)?\\s*\\b(' + unitPattern + ')\\b\\s+(?:of\\s+)?([a-zA-Z0-9][a-zA-Z0-9\\s]{0,30}?)$',
        'i'
      );
      m = pPricePerUnitProduct.exec(norm);
      if (m) {
        result = { product_name: m[3], quantity: 1.0, unit: m[2], price: m[1] };
      }
    }

    if (!result) {
      var pD = new RegExp(
        '^([a-zA-Z0-9][a-zA-Z0-9\\s]{0,30}?)\\s+' + CONN_RE + '\\s*' + PRICE_RE + '$',
        'i'
      );
      m = pD.exec(norm);
      if (m) {
        result = { product_name: m[1], quantity: 1.0, unit: '', price: m[2] };
      }
    }

    if (!result) {
      var pE = new RegExp(
        '^' + PRICE_RE + '\\s+(?:of\\s+)?([a-zA-Z0-9][a-zA-Z0-9\\s]{0,30}?)$',
        'i'
      );
      m = pE.exec(norm);
      if (m) {
        result = { product_name: m[2], quantity: 1.0, unit: '', price: m[1] };
      }
    }

    if (result) {
      result.product_name = result.product_name.trim()
        .split(/\s+/)
        .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); })
        .join(' ');

      var rawUnit = (result.unit || '').toLowerCase().trim();
      result.unit = UNIT_MAP[rawUnit] || rawUnit || 'pcs';
      result.quantity = parseFloat(result.quantity || 1.0);
      result.price = parseFloat(result.price);
    }

    return result;
  }

}]);
