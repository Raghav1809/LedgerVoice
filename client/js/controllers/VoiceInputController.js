/**
 * VoiceInputController.js - Modernized Voice & NLP Controller for LedgerVoice
 * Integrates itemsParserService, speech recognition, and transaction receipt generation.
 */
app.controller('VoiceInputController', [
  '$scope', 'voiceService', 'transactionService', 'inventoryService', 'itemsParserService', 'toastService', '$window',
  function ($scope, voiceService, transactionService, inventoryService, itemsParserService, toastService, $window) {

    $scope.isSupported = voiceService.isSupported;
    $scope.isRecording = false;
    $scope.transcript = voiceService.getTranscript();
    $scope.interimTranscript = '';
    $scope.isParsing = false;
    $scope.isSaving = false;
    $scope.showConfirmation = false;
    $scope.isSaved = false;
    $scope.savedTransaction = null;

    // Sales / Items List mode state
    $scope.isSalesMode = false;
    $scope.salesItems = [];

    $scope.parsedData = {
      customer_name: '',
      customer_phone: '',
      amount: 0,
      transaction_type: 'credit',
      due_date: '',
      description: '',
      date: new Date(),
      status: 'pending'
    };

    // Voice event listeners
    $scope.$on('voice:statusChanged', function (evt, args) {
      $scope.isRecording = args.isRecording;
      if (args.error) toastService.danger('Voice recognition error: ' + args.error);
    });

    $scope.$on('voice:transcriptUpdated', function (evt, args) {
      $scope.transcript = args.transcript;
      $scope.interimTranscript = args.interimTranscript;
    });

    $scope.clearText = function () {
      voiceService.clearTranscript();
      $scope.transcript = '';
      $scope.showConfirmation = false;
      $scope.isSalesMode = false;
      $scope.salesItems = [];
    };

    // ── PARSE RESPONSE HANDLER ──────────────────────────────────────────

    function handleParseResponse(res) {
      var data = res.data;

      if (data.notes && data.parser_used === 'gemini-audio') {
        $scope.transcript = data.notes;
      }

      // 1. Try client-side Items List parsing first
      var itemsListRes = itemsParserService.parseItemsList($scope.transcript);
      var rawItems = itemsListRes ? (itemsListRes.items || itemsListRes) : null;
      if (rawItems && rawItems.length > 0) {
        $scope.isSalesMode = true;
        $scope.salesItems = itemsParserService.enrichWithInventory(rawItems);

        var notFoundItems = $scope.salesItems.filter(function (i) { return i.not_found; });
        if (notFoundItems.length > 0) {
          var names = notFoundItems.map(function (i) { return i.name; }).join(', ');
          toastService.warning('Items not in catalog: ' + names + '. Please review unit & price.');
        }

        var detectedCust = (itemsListRes && itemsListRes.customer_name) || data.customer_name || '';

        $scope.parsedData = {
          customer_name: detectedCust,
          customer_phone: data.customer_phone || '',
          amount: $scope.calculateSalesTotal(),
          transaction_type: 'sales',
          due_date: data.due_date ? new Date(data.due_date) : null,
          description: data.notes || $scope.transcript,
          date: data.date ? new Date(data.date) : new Date(),
          status: 'completed'
        };
        toastService.success('Items List detected! ' + $scope.salesItems.length + ' item(s) extracted' + (detectedCust ? (' for ' + detectedCust) : '') + '.');
        $scope.showConfirmation = true;
        $scope.isParsing = false;
        return;
      }

      // 2. SALES MODE from backend: items array present
      if (data.is_sales && data.items && data.items.length > 0) {
        $scope.isSalesMode = true;
        var backendItems = data.items.map(function (item) {
          return {
            name: item.name || '',
            qty: parseFloat(item.qty) || 1,
            unit: item.unit || null,
            price: parseFloat(item.price) || 0,
            explicit_price: (parseFloat(item.price) > 0)
          };
        });

        $scope.salesItems = itemsParserService.enrichWithInventory(backendItems);

        $scope.parsedData = {
          customer_name: data.customer_name || '',
          customer_phone: data.customer_phone || '',
          amount: $scope.calculateSalesTotal(),
          transaction_type: 'sales',
          due_date: data.due_date ? new Date(data.due_date) : null,
          description: data.notes || '',
          date: data.date ? new Date(data.date) : new Date(),
          status: 'completed'
        };
        toastService.success('Sales items extracted via ' + (data.parser_used || 'AI') + '!');

      // 3. STANDARD TRANSACTION MODE (credit, payment, expense)
      } else {
        $scope.isSalesMode = false;
        $scope.salesItems = [];
        $scope.parsedData = {
          customer_name: data.customer_name || 'General',
          customer_phone: data.customer_phone || '',
          amount: data.amount || 0,
          transaction_type: data.transaction_type || 'credit',
          due_date: data.due_date ? new Date(data.due_date) : null,
          description: data.notes || '',
          date: data.date ? new Date(data.date) : new Date(),
          status: data.status || 'pending'
        };
        toastService.success('Voice details extracted successfully!');
      }

      $scope.showConfirmation = true;
      $scope.isParsing = false;
    }

    $scope.processSpeech = function () {
      if (!$scope.transcript) {
        toastService.warning('Please enter or record a speech transcript first.');
        return;
      }
      if ($scope.isRecording) voiceService.stopRecording();

      $scope.isParsing = true;

      // Check if client itemsParser detects items directly
      var directItemsRes = itemsParserService.parseItemsList($scope.transcript);
      var directItems = directItemsRes ? (directItemsRes.items || directItemsRes) : null;
      if (directItems && directItems.length > 0) {
        $scope.isSalesMode = true;
        $scope.salesItems = itemsParserService.enrichWithInventory(directItems);
        var custName = (directItemsRes && directItemsRes.customer_name) || '';
        $scope.parsedData = {
          customer_name: custName,
          customer_phone: '',
          amount: $scope.calculateSalesTotal(),
          transaction_type: 'sales',
          due_date: null,
          description: $scope.transcript,
          date: new Date(),
          status: 'completed'
        };
        toastService.success('Extracted ' + $scope.salesItems.length + ' item(s)' + (custName ? (' for ' + custName) : '') + '!');
        $scope.showConfirmation = true;
        $scope.isParsing = false;
        return;
      }

      // Backend NLP parsing
      voiceService.parseTranscript($scope.transcript).then(handleParseResponse).catch(function () {
        toastService.danger('Failed to parse speech transcript.');
        $scope.isParsing = false;
      });
    };

    $scope.calculateSalesTotal = function () {
      var total = 0;
      ($scope.salesItems || []).forEach(function (item) {
        total += (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
      });
      return Math.round(total * 100) / 100;
    };

    // ── Save Transaction ────────────────────────────────────────────────

    $scope.saveTransaction = function () {
      if ($scope.isSalesMode) {
        if (!$scope.salesItems || $scope.salesItems.length === 0) {
          toastService.warning('Please add at least one item.');
          return;
        }
        var invalidItem = $scope.salesItems.some(function (item) {
          return !item.name || !item.name.trim() || parseFloat(item.price) <= 0;
        });
        if (invalidItem) {
          toastService.warning('Each item must have a valid name and price greater than 0.');
          return;
        }

        var total = $scope.calculateSalesTotal();
        if (total <= 0) {
          toastService.warning('Total sales amount must be greater than 0.');
          return;
        }

        var itemsData = $scope.salesItems.map(function (item) {
          var qty = parseFloat(item.qty) || 1;
          var price = parseFloat(item.price) || 0;
          return {
            name: item.name.trim(),
            qty: qty,
            unit: item.unit || 'pcs',
            price: price,
            total: Math.round(qty * price * 100) / 100
          };
        });

        var payload = {
          customer_name: $scope.parsedData.customer_name || '',
          customer_phone: $scope.parsedData.customer_phone || '',
          amount: total,
          transaction_type: 'sales',
          due_date: $scope.parsedData.due_date ? $scope.parsedData.due_date.toISOString().split('T')[0] : null,
          description: $scope.parsedData.description,
          date: $scope.parsedData.date ? $scope.parsedData.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          status: 'completed',
          items_data: itemsData
        };

        $scope.isSaving = true;
        transactionService.create(payload).then(function (res) {
          // Inventory stock update
          $scope.salesItems.forEach(function (item) {
            if (!item.not_found && item.stock_before !== null) {
              inventoryService.updateStock(item.name, item.qty);
            }
          });

          toastService.success('Sales transaction saved! Generated itemized receipt.');
          $scope.savedTransaction = res.data;
          if ($scope.savedTransaction) {
            $scope.savedTransaction.items_data = itemsData;
            if (!$scope.savedTransaction.customer_phone) {
              $scope.savedTransaction.customer_phone = payload.customer_phone;
            }
          }
          $scope.isSaved = true;
          $scope.showConfirmation = false;
          $scope.isSalesMode = false;
          $scope.salesItems = [];
          voiceService.clearTranscript();
          $scope.transcript = '';
        }).catch(function (err) {
          var errMsg = 'Failed to save sales transaction.';
          if (err.data) {
            var firstKey = Object.keys(err.data)[0];
            if (firstKey) errMsg = firstKey + ': ' + (err.data[firstKey][0] || err.data[firstKey]);
          }
          toastService.danger(errMsg);
        }).finally(function () {
          $scope.isSaving = false;
        });

      } else {
        // Standard credit/payment
        if (!$scope.parsedData.customer_name) {
          toastService.warning('Customer name is required.');
          return;
        }
        if (!$scope.parsedData.amount || $scope.parsedData.amount <= 0) {
          toastService.warning('Please enter a valid amount.');
          return;
        }

        $scope.isSaving = true;
        var payload = {
          customer_name: $scope.parsedData.customer_name,
          customer_phone: $scope.parsedData.customer_phone || '',
          amount: $scope.parsedData.amount,
          transaction_type: $scope.parsedData.transaction_type,
          due_date: $scope.parsedData.due_date ? $scope.parsedData.due_date.toISOString().split('T')[0] : null,
          description: $scope.parsedData.description,
          date: $scope.parsedData.date ? $scope.parsedData.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          status: $scope.parsedData.status || 'completed'
        };

        transactionService.create(payload).then(function (res) {
          toastService.success('Transaction saved for ' + $scope.parsedData.customer_name + '!');
          $scope.savedTransaction = res.data;
          if ($scope.savedTransaction && !$scope.savedTransaction.customer_phone) {
            $scope.savedTransaction.customer_phone = payload.customer_phone;
          }
          $scope.isSaved = true;
          $scope.showConfirmation = false;
          voiceService.clearTranscript();
          $scope.transcript = '';
        }).catch(function (err) {
          var errMsg = 'Failed to save transaction.';
          if (err.data) {
            if (err.data.amount) errMsg = 'Amount error: ' + err.data.amount[0];
            else if (err.data.customer_name) errMsg = 'Customer error: ' + err.data.customer_name[0];
            else if (err.data.due_date) errMsg = 'Due date error: ' + err.data.due_date[0];
          }
          toastService.danger(errMsg);
        }).finally(function () {
          $scope.isSaving = false;
        });
      }
    };

    $scope.resetRecordState = function () {
      $scope.clearText();
      $scope.isSaved = false;
      $scope.savedTransaction = null;
    };

    $scope.$on('$destroy', function () {
      if ($scope.isRecording) {
        voiceService.stopRecording();
      }
    });
  }
]);