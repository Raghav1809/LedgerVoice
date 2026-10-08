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
    quantity: null,  // Optional
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
    { value: 'kg', label: 'kg (Kilograms)' },
    { value: 'g', label: 'g (Grams)' },
    { value: 'litre', label: 'litre (Litres)' },
    { value: 'ml', label: 'ml (Millilitres)' },
    { value: 'pcs', label: 'pcs (Pieces)' },
    { value: 'packet', label: 'packet (Packets)' },
    { value: 'box', label: 'box (Boxes)' },
    { value: 'bottle', label: 'bottle (Bottles)' },
    { value: 'bag', label: 'bag (Bags)' },
    { value: 'dozen', label: 'dozen (Dozens)' },
    { value: 'bundle', label: 'bundle (Bundles)' },
    { value: 'mtr', label: 'mtr (Metres)' },
    { value: 'ft', label: 'ft (Feet)' }
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
    $scope.formItem = { product_name: '', unit: 'kg', quantity: null, price: null };
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
    if ($scope.formItem.price === null || $scope.formItem.price === undefined || $scope.formItem.price < 0) {
      toastService.warning('Price cannot be negative or empty.');
      return;
    }

    // Stock quantity is OPTIONAL - allow null/0/empty
    var qtyVal = ($scope.formItem.quantity === null || $scope.formItem.quantity === undefined || $scope.formItem.quantity === '')
      ? 0.0
      : parseFloat($scope.formItem.quantity);
    if (isNaN(qtyVal) || qtyVal < 0) qtyVal = 0.0;

    $scope.isSaving = true;
    var data = {
      product_name: $scope.formItem.product_name.trim(),
      unit: $scope.formItem.unit,
      quantity: qtyVal,
      price: parseFloat($scope.formItem.price)
    };

    var promise;
    if ($scope.editMode && $scope.editingId) {
      promise = inventoryService.update($scope.editingId, data);
    } else {
      promise = inventoryService.create(data);
    }

    promise.then(function () {
      toastService.success($scope.editMode ? 'Inventory item updated!' : 'Inventory item added!');
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
  // INVENTORY VOICE RECOGNITION & SMART MULTI-PASS NLP PARSER
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
            $scope.voiceTranscript = ($scope.voiceTranscript ? $scope.voiceTranscript + ' ' : '') + finalText;
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
      toastService.info('Listening... Say something like "Add 10 kg sugar for 450 rupees"');
    }
  };

  $scope.$on('$destroy', function () {
    _stopInventoryRecognition();
  });

  $scope.parseVoiceInventory = function () {
    if ($scope.isRecording) {
      _stopInventoryRecognition();
      // Small delay to let final transcript settle after stopping recognition
      setTimeout(function() {
        $scope.$apply(function() {
          $scope._doParseVoiceInventory();
        });
      }, 300);
      return;
    }
    $scope._doParseVoiceInventory();
  };

  $scope._doParseVoiceInventory = function () {
    var text = ($scope.voiceTranscript || $scope.voiceInterim || '').trim();
    if (!text) {
      toastService.warning('No speech captured. Please speak clearly or type product details in the box above.');
      return;
    }

    var parsed = parseInventoryVoice(text);
    if (parsed && parsed.product_name) {
      $scope.voiceParsed = parsed;
      $scope.showVoiceConfirm = true;
      var priceStr = parsed.price > 0 ? '₹' + parsed.price : 'no price';
      var qtyStr = parsed.quantity > 0 ? parsed.quantity + ' ' + parsed.unit : 'qty not set';
      toastService.success('Extracted: "' + parsed.product_name + '" — ' + qtyStr + ' at ' + priceStr);
    } else {
      toastService.warning('Could not extract product details. Try: "10 kg sugar for 450 rupees" or "sugar at 45 rupees per kg"');
    }
  };

  $scope.confirmVoiceAdd = function () {
    if (!$scope.voiceParsed) return;

    if (!$scope.voiceParsed.product_name || !$scope.voiceParsed.product_name.trim()) {
      toastService.warning('Product name is required.');
      return;
    }
    if ($scope.voiceParsed.price === null || $scope.voiceParsed.price === undefined || $scope.voiceParsed.price < 0) {
      toastService.warning('Price cannot be negative.');
      return;
    }

    // Stock quantity is OPTIONAL in voice add too
    var qtyVal = ($scope.voiceParsed.quantity === null || $scope.voiceParsed.quantity === undefined || $scope.voiceParsed.quantity === '')
      ? 0.0
      : parseFloat($scope.voiceParsed.quantity);
    if (isNaN(qtyVal) || qtyVal < 0) qtyVal = 0.0;

    var data = {
      product_name: $scope.voiceParsed.product_name.trim(),
      unit: $scope.voiceParsed.unit || 'pcs',
      quantity: qtyVal,
      price: parseFloat($scope.voiceParsed.price) || 0.0
    };

    $scope.isSaving = true;
    inventoryService.create(data).then(function () {
      toastService.success('Added "' + data.product_name + '" to inventory catalog!');
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

  // ── Inventory Voice Unit Mapping ──────────────────────────────────
  var UNIT_MAP = {
    'kg': 'kg', 'kgs': 'kg', 'kilo': 'kg', 'kilos': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'g': 'g', 'gm': 'g', 'gms': 'g', 'gram': 'g', 'grams': 'g',
    'l': 'litre', 'ltr': 'litre', 'liter': 'litre', 'liters': 'litre', 'litre': 'litre', 'litres': 'litre',
    'ml': 'ml', 'milliliter': 'ml', 'millilitre': 'ml', 'milliliters': 'ml', 'millilitres': 'ml',
    'pcs': 'pcs', 'piece': 'pcs', 'pieces': 'pcs', 'pc': 'pcs', 'unit': 'pcs', 'units': 'pcs',
    'dozen': 'dozen', 'dozens': 'dozen', 'doz': 'dozen',
    'packet': 'packet', 'packets': 'packet', 'pack': 'packet', 'packs': 'packet', 'pkt': 'packet',
    'box': 'box', 'boxes': 'box',
    'bottle': 'bottle', 'bottles': 'bottle',
    'bag': 'bag', 'bags': 'bag',
    'bundle': 'bundle', 'bundles': 'bundle',
    'mtr': 'mtr', 'meter': 'mtr', 'meters': 'mtr', 'metre': 'mtr', 'metres': 'mtr',
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

    var raw = text.trim();
    // Normalize string: strip common action prefixes & punctuation
    var norm = raw
      .replace(/[,;:!?]/g, ' ')
      .replace(/\b(?:(?:add\s+)?inventory\s+|add\s+item\s+|add\s+product\s+|please\s+add\s+|add\s+|i\s+want\s+to\s+add\s+)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    var result = null;
    var m;

    // Pattern 1: QTY + UNIT + (of)? + PRODUCT_NAME + (price/rate/for/@)? + PRICE
    // e.g. "10 kg sugar for 450 rupees", "20 packets biscuit 200 rs", "5 litre oil at 800"
    var pQtyUnitProductPrice = new RegExp(
      '^(\\d+(?:\\.\\d+)?)\\s*\\b(' + unitPattern + ')\\b\\s+(?:of\\s+)?([a-zA-Z0-9][a-zA-Z0-9\\s]{0,35}?)\\s+' + CONN_RE + '\\s*' + PRICE_RE + '$',
      'i'
    );
    m = pQtyUnitProductPrice.exec(norm);
    if (m) {
      result = { product_name: m[3], quantity: m[1], unit: m[2], price: m[4] };
    }

    // Pattern 2: PRODUCT_NAME + QTY + UNIT + PRICE
    // e.g. "Sugar 10 kg 450 rupees", "Sunflower oil 5 litre 800 rs"
    if (!result) {
      var pProductQtyUnitPrice = new RegExp(
        '^([a-zA-Z0-9][a-zA-Z0-9\\s]{0,35}?)\\s+(\\d+(?:\\.\\d+)?)\\s*\\b(' + unitPattern + ')\\b\\s+' + CONN_RE + '\\s*' + PRICE_RE + '$',
        'i'
      );
      m = pProductQtyUnitPrice.exec(norm);
      if (m) {
        result = { product_name: m[1], quantity: m[2], unit: m[3], price: m[4] };
      }
    }

    // Pattern 3: PRODUCT_NAME + PRICE + per/each + UNIT
    // e.g. "Sugar 45 rupees per kg", "Oil 160 per litre"
    if (!result) {
      var pProductPricePerUnit = new RegExp(
        '^([a-zA-Z0-9][a-zA-Z0-9\\s]{0,35}?)\\s+' + CONN_RE + '\\s*' + PRICE_RE + '\\s+(?:per|a|an|each|\\/)?\\s*\\b(' + unitPattern + ')\\b$',
        'i'
      );
      m = pProductPricePerUnit.exec(norm);
      if (m) {
        result = { product_name: m[1], quantity: 1.0, unit: m[3], price: m[2] };
      }
    }

    // Pattern 4: PRICE + per/each + UNIT + PRODUCT_NAME
    // e.g. "45 rupees per kg sugar", "160 per litre oil"
    if (!result) {
      var pPricePerUnitProduct = new RegExp(
        '^' + PRICE_RE + '\\s+(?:per|a|an|each|\\/)?\\s*\\b(' + unitPattern + ')\\b\\s+(?:of\\s+)?([a-zA-Z0-9][a-zA-Z0-9\\s]{0,35}?)$',
        'i'
      );
      m = pPricePerUnitProduct.exec(norm);
      if (m) {
        result = { product_name: m[3], quantity: 1.0, unit: m[2], price: m[1] };
      }
    }

    // Pattern 5: QTY + UNIT + PRODUCT_NAME (without explicit price spoken)
    // e.g. "10 kg sugar", "5 litre oil", "20 packets biscuit"
    if (!result) {
      var pQtyUnitProduct = new RegExp(
        '^(\\d+(?:\\.\\d+)?)\\s*\\b(' + unitPattern + ')\\b\\s+(?:of\\s+)?([a-zA-Z0-9][a-zA-Z0-9\\s]{0,35}?)$',
        'i'
      );
      m = pQtyUnitProduct.exec(norm);
      if (m) {
        result = { product_name: m[3], quantity: m[1], unit: m[2], price: 0 };
      }
    }

    // Pattern 6: PRODUCT_NAME + QTY + UNIT (without explicit price)
    // e.g. "Sugar 10 kg", "Oil 5 litre"
    if (!result) {
      var pProductQtyUnit = new RegExp(
        '^([a-zA-Z0-9][a-zA-Z0-9\\s]{0,35}?)\\s+(\\d+(?:\\.\\d+)?)\\s*\\b(' + unitPattern + ')\\b$',
        'i'
      );
      m = pProductQtyUnit.exec(norm);
      if (m) {
        result = { product_name: m[1], quantity: m[2], unit: m[3], price: 0 };
      }
    }

    // Pattern 7: PRODUCT_NAME + PRICE (without explicit unit spoken)
    // e.g. "Sugar 450 rupees", "Oil 800"
    if (!result) {
      var pProductPrice = new RegExp(
        '^([a-zA-Z0-9][a-zA-Z0-9\\s]{0,35}?)\\s+' + CONN_RE + '\\s*' + PRICE_RE + '$',
        'i'
      );
      m = pProductPrice.exec(norm);
      if (m) {
        result = { product_name: m[1], quantity: 1.0, unit: 'pcs', price: m[2] };
      }
    }

    // PASS 2: Robust Fallback Entity Token Extraction
    if (!result) {
      var workingNorm = norm;
      var qtyVal = 1.0;
      var unitVal = 'pcs';
      var priceVal = 0;

      // Extract quantity + unit token if present anywhere
      var unitMatch = workingNorm.match(/(\d+(?:\.\d+)?)\s*\b(kg|kgs|kilo|kilos|kilogram|kilograms|g|gm|gms|gram|grams|l|ltr|liter|liters|litre|litres|ml|milliliter|millilitre|pcs|piece|pieces|pc|unit|units|dozen|dozens|packet|packets|pkt|pack|packs|box|boxes|bottle|bottles|bag|bags|bundle|bundles|meter|meters|metre|metres|mtr|ft|feet|foot)\b/i);
      if (unitMatch) {
        qtyVal = parseFloat(unitMatch[1]);
        unitVal = unitMatch[2];
        workingNorm = workingNorm.replace(unitMatch[0], ' ');
      }

      // Extract price token if present anywhere
      var priceMatch = workingNorm.match(/(?:rs\.?|rupees?|rupee|inr|₹|\$)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:rs\.?|rupees?|rupee|inr|₹|\$)|(?:\bfor\b|\bprice\b|\brate\b|\bat\b|\bcosting\b)\s*(\d+(?:\.\d+)?)/i);
      if (priceMatch) {
        priceVal = parseFloat(priceMatch[1] || priceMatch[2] || priceMatch[3] || 0);
        workingNorm = workingNorm.replace(priceMatch[0], ' ');
      }

      // Remaining clean words = Product Name
      var cleanProd = workingNorm
        .replace(/\b(?:rs\.?|rupees?|rupee|inr|₹|\$|add|item|product|inventory|for|at|rate|price|costs?|costing|is|of|a|an|the|to|please)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanProd && cleanProd.length >= 2) {
        result = {
          product_name: cleanProd,
          quantity: qtyVal,
          unit: unitVal,
          price: priceVal
        };
      }
    }

    if (result && result.product_name) {
      result.product_name = result.product_name.trim()
        .split(/\s+/)
        .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); })
        .join(' ');

      var rawUnit = (result.unit || '').toLowerCase().trim();
      result.unit = UNIT_MAP[rawUnit] || rawUnit || 'pcs';

      // Smart infer unit from product name if still pcs
      if (result.unit === 'pcs') {
        var lowerName = result.product_name.toLowerCase();
        if (/\b(?:oil|milk|water|juice|petrol|diesel|kerosene|ghee)\b/.test(lowerName)) {
          result.unit = 'litre';
        } else if (/\b(?:sugar|rice|wheat|flour|atta|dal|salt|pulses)\b/.test(lowerName)) {
          result.unit = 'kg';
        } else if (/\b(?:biscuit|biscuits|chips|soap|noodle|noodles|maggi|tea|coffee)\b/.test(lowerName)) {
          result.unit = 'packet';
        }
      }

      result.quantity = parseFloat(result.quantity || 1.0);
      result.price = parseFloat(result.price || 0);
    }

    return result;
  }

}]);
