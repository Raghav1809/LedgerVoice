app.controller('ReminderController', ['$scope', 'reminderService', 'customerService', 'toastService', 'authService', 'apiService', function($scope, reminderService, customerService, toastService, authService, apiService) {
  $scope.userProfile = authService.getUser() || {};
  $scope.appSettings = {};
  
  // Fetch settings if endpoint available
  apiService.get('/settings/').then(function(res) {
    $scope.appSettings = res.data || {};
  }).catch(function() {
    $scope.appSettings = {};
  });

  $scope.reminders = [];
  $scope.allReminders = [];
  $scope.customers = [];
  $scope.isLoading = false;
  $scope.currentCategory = 'all';
  $scope.newReminder = {};

  $scope.loadAllReminders = function() {
    reminderService.getAll({}).then(function(res) {
      $scope.allReminders = res.data.results || res.data || [];
    });
  };

  $scope.loadReminders = function(category) {
    $scope.currentCategory = category || $scope.currentCategory;
    $scope.isLoading = true;

    var params = {};
    if ($scope.currentCategory !== 'all') {
      params.category = $scope.currentCategory;
    }

    reminderService.getAll(params).then(function(res) {
      $scope.reminders = res.data.results || res.data || [];
      $scope.loadAllReminders();
    }).catch(function() {
      toastService.danger('Failed to load reminders.');
    }).finally(function() {
      $scope.isLoading = false;
    });
  };

  $scope.getTodayDueTotal = function() {
    var todayStr = new Date().toISOString().split('T')[0];
    var total = 0;
    ($scope.allReminders || []).forEach(function(r) {
      if (r.due_date === todayStr && r.computed_status === 'pending') {
        total += (parseFloat(r.amount) || 0);
      }
    });
    return total;
  };

  $scope.getUpcomingCount = function() {
    var count = 0;
    ($scope.allReminders || []).forEach(function(r) {
      if (r.computed_status === 'pending') count++;
    });
    return count;
  };

  $scope.getMissedTotal = function() {
    var total = 0;
    ($scope.allReminders || []).forEach(function(r) {
      if (r.computed_status === 'missed') {
        total += (parseFloat(r.amount) || 0);
      }
    });
    return total;
  };

  $scope.getMissedCount = function() {
    var count = 0;
    ($scope.allReminders || []).forEach(function(r) {
      if (r.computed_status === 'missed') count++;
    });
    return count;
  };

  $scope.getCompletedCount = function() {
    var count = 0;
    ($scope.allReminders || []).forEach(function(r) {
      if (r.computed_status === 'completed') count++;
    });
    return count;
  };

  $scope.loadCustomers = function() {
    customerService.getAll().then(function(res) {
      $scope.customers = res.data.results || res.data || [];
    });
  };

  $scope.toggleStatus = function(reminder) {
    reminderService.toggleComplete(reminder.id).then(function(res) {
      reminder.status = res.data.status;
      reminder.computed_status = res.data.computed_status;
      toastService.success('Reminder status updated.');
      $scope.loadReminders();
    }).catch(function() {
      toastService.danger('Failed to update reminder status.');
    });
  };

  $scope.openAddModal = function() {
    $scope.newReminder = {
      due_date: new Date()
    };
    $scope.loadCustomers();
  };

  $scope.isSaving = false;
  $scope.searchQuery = '';

  $scope.filteredReminders = function() {
    return ($scope.reminders || []).filter(function(r) {
      if (!$scope.searchQuery || !$scope.searchQuery.trim()) return true;
      var q = $scope.searchQuery.trim().toLowerCase();
      var cName = (r.customer_detail ? r.customer_detail.name : '').toLowerCase();
      var rTitle = (r.title || '').toLowerCase();
      var rNotes = (r.notes || '').toLowerCase();
      var rAmount = String(r.amount || '');
      return cName.indexOf(q) !== -1 || rTitle.indexOf(q) !== -1 || rNotes.indexOf(q) !== -1 || rAmount.indexOf(q) !== -1;
    });
  };

  $scope.saveReminder = function() {
    if ($scope.isSaving) return; // Hard guard against double-submit
    if (!$scope.newReminder.customer || !$scope.newReminder.title || !$scope.newReminder.due_date) {
      toastService.warning('Customer, Title, and Due Date are required.');
      return;
    }

    $scope.isSaving = true;
    var payload = angular.copy($scope.newReminder);
    if (payload.due_date instanceof Date) {
      payload.due_date = payload.due_date.toISOString().split('T')[0];
    }

    reminderService.create(payload).then(function() {
      toastService.success('Reminder created successfully.');
      $scope.newReminder = {}; // Reset form immediately
      // Close modal programmatically
      var modalEl = document.getElementById('reminderModal');
      if (modalEl && window.bootstrap) {
        var modal = window.bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      $scope.loadReminders();
    }).catch(function(err) {
      var msg = 'Failed to create reminder.';
      if (err && err.data && err.data.non_field_errors) msg = err.data.non_field_errors[0];
      toastService.danger(msg);
    }).finally(function() {
      $scope.isSaving = false;
    });
  };

  $scope.deleteReminder = function(id) {
    if (confirm('Delete this reminder?')) {
      reminderService.delete(id).then(function() {
        toastService.success('Reminder removed.');
        $scope.loadReminders();
      }).catch(function() {
        toastService.danger('Failed to delete reminder.');
      });
    }
  };

  $scope.getDaysLeft = function(dueDateStr) {
    if (!dueDateStr) return '';
    var due = new Date(dueDateStr);
    var today = new Date();
    due.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    var diffTime = due - today;
    var diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Due today';
    if (diffDays > 0) return diffDays + ' day(s) left';
    return Math.abs(diffDays) + ' day(s) overdue';
  };

  $scope.sendWhatsApp = function(reminder) {
    var name = reminder.customer_detail ? reminder.customer_detail.name : 'Customer';
    var amount = reminder.amount || '0';
    var date = reminder.due_date || 'soon';
    var storeName = ($scope.userProfile.profile && $scope.userProfile.profile.business_name) ? $scope.userProfile.profile.business_name : 'LedgerVoice Store';
    
    var upiLink = $scope.appSettings.upi_link || '';
    if (!upiLink && $scope.appSettings.upi_id) {
      upiLink = "upi://pay?pa=" + $scope.appSettings.upi_id + "&pn=" + encodeURIComponent(storeName);
    }
    var paymentSection = upiLink ? ("Pay here: " + upiLink + "\n\n") : "";
    
    var text = "*Ledger Voice Reminder*\n\n" + 
               name + "! 🙏 Your pending credit of ₹" + amount + " has been recorded.\n" +
               "Due Date: " + date + "\n\n" +
               paymentSection +
               "*" + storeName + "*\n" +
               "Supported by Ledger Voice";
               
    var url = "https://wa.me/?text=" + encodeURIComponent(text);
    window.open(url, '_blank');
  };

  $scope.loadReminders('all');
}]);
