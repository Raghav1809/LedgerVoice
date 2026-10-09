/**
 * DashboardController.js - Controls the Dashboard view & integrates with transaction modules
 */
app.controller('DashboardController', ['$scope', '$location', '$window', 'insightService', 'reminderService', 'toastService', function($scope, $location, $window, insightService, reminderService, toastService) {
  $scope.isLoading = true;
  $scope.summary = {};
  $scope.recentReminders = [];
  $scope.selectedReceiptTx = null;

  $scope.loadDashboardData = function() {
    $scope.isLoading = true;
    insightService.getSummary().then(function(res) {
      $scope.summary = res.data;
    }).catch(function(err) {
      console.error('Failed to load dashboard metrics:', err);
      toastService.danger('Failed to load dashboard metrics.');
    }).finally(function() {
      $scope.isLoading = false;
    });

    if (reminderService && typeof reminderService.getAll === 'function') {
      reminderService.getAll({ category: 'today' }).then(function(res) {
        $scope.recentReminders = res.data.results || res.data || [];
      }).catch(function(err) {
        console.warn('Reminders fetch error:', err);
      });
    }
  };

  $scope.filterTransactions = function(type, status) {
    var query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    $location.path('/transactions').search(query);
  };

  $scope.viewReceipt = function(tx) {
    $scope.selectedReceiptTx = tx;
    var modalEl = document.getElementById('dashboardReceiptModal');
    if (modalEl && $window.bootstrap) {
      var modal = $window.bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  };

  $scope.closeReceiptModal = function() {
    var modalEl = document.getElementById('dashboardReceiptModal');
    if (modalEl && $window.bootstrap) {
      var modal = $window.bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  };

  $scope.sendWhatsApp = function(tx) {
    var phone = (tx.customer_detail && tx.customer_detail.phone) || tx.customer_phone || '';
    var customerName = (tx.customer_detail && tx.customer_detail.name) || tx.customer_name_raw || 'Customer';
    var cleanPhone = phone.replace(/[\s\-\+]/g, '');

    if (!cleanPhone) {
      toastService.warning('No phone number attached to this customer.');
      return;
    }

    var msg = "🧾 *LedgerVoice Transaction Notice*\n";
    msg += "━━━━━━━━━━━━━━━━━━━━\n";
    msg += "Hello " + customerName + ",\n";
    msg += "A " + tx.transaction_type.toUpperCase() + " entry of *₹" + parseFloat(tx.amount).toFixed(2) + "* was recorded on " + tx.date + ".\n";

    if (tx.items_data && tx.items_data.length > 0) {
      msg += "\n*Items:*\n";
      tx.items_data.forEach(function(item, idx) {
        msg += (idx + 1) + ". " + item.name + " (" + item.qty + " " + item.unit + ") = ₹" + parseFloat(item.total || (item.qty * item.price)).toFixed(2) + "\n";
      });
    }

    if (tx.due_date) {
      msg += "\n📅 *Due Date:* " + tx.due_date + "\n";
    }
    msg += "━━━━━━━━━━━━━━━━━━━━\nThank you!";

    var url = "https://wa.me/" + cleanPhone + "?text=" + encodeURIComponent(msg);
    $window.open(url, '_blank');
  };

  $scope.getRecoveryPercentage = function() {
    var credit = $scope.summary.total_credit || 0;
    var recovered = $scope.summary.recovered_amount || 0;
    if (!credit || credit <= 0) return 100;
    return Math.min(100, Math.round((recovered / credit) * 100));
  };

  $scope.loadDashboardData();
}]);
