/**
 * transactionLedger.component.js - Ledger Table & History Management Component
 * Displays transaction records, search & filters, itemized breakdowns,
 * receipt modal view, and WhatsApp sharing.
 */
app.component('transactionLedger', {
  template: `
    <div>
      <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h2 class="fw-bold mb-1">Transaction Ledger</h2>
          <p class="text-muted small mb-0">View, search, filter, and print itemized receipts for credit, payment, sales, and expense transactions</p>
        </div>
        <div class="d-flex gap-2">
          <a href="#!/voice" class="btn btn-outline-blue">
            <i class="fa-solid fa-microphone me-2"></i> Voice Input
          </a>
          <button class="btn btn-gradient-blue shadow-sm" data-bs-toggle="modal" data-bs-target="#transactionModal" ng-click="$ctrl.openAddModal()">
            <i class="fa-solid fa-plus me-2"></i> Add Transaction
          </button>
        </div>
      </div>

      <!-- Search & Filter Controls -->
      <div class="card-custom p-3 mb-4">
        <div class="row g-3">
          <div class="col-md-6 col-lg-4">
            <div class="input-group">
              <span class="input-group-text bg-white"><i class="fa-solid fa-magnifying-glass text-muted"></i></span>
              <input type="text" class="form-control" placeholder="Search by customer or description..." ng-model="$ctrl.searchQuery" ng-change="$ctrl.loadTransactions()">
            </div>
          </div>
          <div class="col-md-6 col-lg-3">
            <select class="form-select" ng-model="$ctrl.filterType" ng-change="$ctrl.loadTransactions()">
              <option value="">All Transaction Types</option>
              <option value="credit">Credit (Gave)</option>
              <option value="payment">Payment (Got)</option>
              <option value="sales">Sales</option>
              <option value="expense">Expense</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Transactions Table -->
      <div class="card-custom p-0 overflow-hidden mb-4">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Description</th>
                <th>Status</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr ng-repeat-start="tx in $ctrl.transactions" ng-click="tx._showItems = tx.items_data && !tx._showItems ? !tx._showItems : (tx.items_data ? !tx._showItems : false)" ng-class="{'cursor-pointer': tx.items_data}">
                <td class="small text-muted fw-medium">{{ tx.date }}</td>
                <td class="fw-bold text-dark">
                  <span ng-if="tx.items_data" class="text-success">
                    <i class="fa-solid fa-cart-shopping me-1"></i>Sales
                  </span>
                  <span ng-if="!tx.items_data">{{ tx.customer_detail.name || tx.customer_name_raw || 'General' }}</span>
                </td>
                <td>
                  <span class="badge" ng-class="{
                    'badge-credit': tx.transaction_type === 'credit',
                    'badge-payment': tx.transaction_type === 'payment',
                    'badge-sales': tx.transaction_type === 'sales',
                    'badge-expense': tx.transaction_type === 'expense'
                  }">{{ tx.transaction_type | uppercase }}</span>
                  <span ng-if="tx.items_data" class="badge bg-success-subtle text-success ms-1" title="Click row to view items">
                    <i class="fa-solid fa-box-open me-1"></i>{{ tx.items_data.length }} item(s)
                  </span>
                </td>
                <td class="fw-bold fs-6 text-success">₹{{ tx.amount | number:2 }}</td>
                <td class="small text-muted">{{ tx.due_date || 'N/A' }}</td>
                <td class="small text-muted">
                  <span ng-if="!tx.items_data">{{ tx.description || '-' }}</span>
                  <span ng-if="tx.items_data" class="text-muted fst-italic small">
                    <i class="fa-solid fa-chevron-{{ tx._showItems ? 'up' : 'down' }} me-1"></i>{{ tx._showItems ? 'Hide' : 'Show' }} items
                  </span>
                </td>
                <td>
                  <span class="badge rounded-pill border" ng-class="{'bg-success-subtle text-success border-success': tx.status === 'settled', 'bg-warning-subtle text-warning border-warning': tx.status === 'pending', 'bg-light text-dark': tx.status !== 'settled' && tx.status !== 'pending'}">{{ tx.status }}</span>
                </td>
                <td class="text-end">
                  <!-- View Receipt Button -->
                  <button class="btn btn-sm btn-outline-primary p-1 px-2 me-1" ng-click="$event.stopPropagation(); $ctrl.viewReceipt(tx)" title="View Receipt">
                    <i class="fa-solid fa-receipt"></i>
                  </button>
                  <button class="btn btn-sm btn-light border p-1 px-2 me-1" ng-if="tx.transaction_type !== 'expense'" ng-click="$event.stopPropagation(); $ctrl.sendWhatsApp(tx)" title="Send WhatsApp Message">
                    <i class="fa-brands fa-whatsapp" style="color: #25D366;"></i>
                  </button>
                  <button class="btn btn-sm btn-light border p-1 px-2 me-1" data-bs-toggle="modal" data-bs-target="#transactionModal" ng-click="$event.stopPropagation(); $ctrl.openEditModal(tx)" title="Edit">
                    <i class="fa-solid fa-pen text-muted"></i>
                  </button>
                  <button class="btn btn-sm btn-light border p-1 px-2" ng-click="$event.stopPropagation(); $ctrl.deleteTransaction(tx)" title="Delete">
                    <i class="fa-solid fa-trash text-danger"></i>
                  </button>
                </td>
              </tr>
              <!-- Expandable Items Row for Sales Transactions -->
              <tr ng-repeat-end ng-if="tx.items_data && tx._showItems" class="bg-success-subtle">
                <td colspan="8" class="p-3">
                  <div class="fw-semibold text-success mb-2"><i class="fa-solid fa-list-ul me-1"></i>Sold Items Breakdown</div>
                  <table class="table table-sm table-bordered bg-white mb-0" style="max-width: 600px">
                    <thead class="table-light">
                      <tr>
                        <th>Item</th><th>Qty</th><th>Unit</th><th>Price (₹)</th><th>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr ng-repeat="item in tx.items_data">
                        <td class="fw-medium">{{ item.name }}</td>
                        <td>{{ item.qty }}</td>
                        <td>{{ item.unit }}</td>
                        <td>₹{{ item.price | number:2 }}</td>
                        <td class="fw-bold text-success">₹{{ (item.total || (item.qty * item.price)) | number:2 }}</td>
                      </tr>
                    </tbody>
                    <tfoot class="table-light">
                      <tr>
                        <td colspan="4" class="text-end fw-bold">Grand Total</td>
                        <td class="fw-bold text-success">₹{{ tx.amount | number:2 }}</td>
                      </tr>
                    </tfoot>
                  </table>
                </td>
              </tr>
              <tr ng-if="!$ctrl.isLoading && $ctrl.transactions.length === 0">
                <td colspan="8" class="text-center text-muted py-5">
                  <i class="fa-solid fa-receipt fs-1 mb-2"></i>
                  <p class="mb-0">No transactions recorded yet.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Transaction Add/Edit Modal -->
      <div class="modal fade" id="transactionModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content border-0 shadow">
            <div class="modal-header border-0 pb-0">
              <h5 class="modal-header-title fw-bold">{{ $ctrl.editMode ? 'Edit Transaction' : 'Add New Transaction' }}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form ng-submit="$ctrl.saveTransaction()">
                <div class="mb-3">
                  <label class="form-label fw-semibold small">Customer Name *</label>
                  <input type="text" class="form-control" ng-model="$ctrl.currentTx.customer_name" placeholder="Enter customer name" list="customerList">
                  <datalist id="customerList">
                    <option ng-repeat="c in $ctrl.customers" value="{{ c.name }}">
                  </datalist>
                </div>

                <div class="row g-3 mb-3">
                  <div class="col-md-6">
                    <label class="form-label fw-semibold small">Amount (₹) *</label>
                    <input type="number" step="0.01" class="form-control" ng-model="$ctrl.currentTx.amount" required placeholder="0.00">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label fw-semibold small">Transaction Type *</label>
                    <select class="form-select" ng-model="$ctrl.currentTx.transaction_type" required>
                      <option value="credit">Credit (Gave / Loaned)</option>
                      <option value="payment">Payment (Received / Got)</option>
                      <option value="sales">Sales</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>
                </div>

                <div class="row g-3 mb-3">
                  <div class="col-md-6">
                    <label class="form-label fw-semibold small">Transaction Date *</label>
                    <input type="date" class="form-control" ng-model="$ctrl.currentTx.date" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label fw-semibold small">Due Date (Optional)</label>
                    <input type="date" class="form-control" ng-model="$ctrl.currentTx.due_date">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold small">Description / Notes</label>
                  <textarea class="form-control" rows="2" ng-model="$ctrl.currentTx.description"></textarea>
                </div>

                <div class="d-flex justify-content-end gap-2 pt-2">
                  <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" class="btn btn-gradient-blue" data-bs-dismiss="modal">Save Transaction</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <!-- Receipt Modal -->
      <div class="modal fade" id="receiptModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered" style="max-width: 600px;">
          <div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
            <div class="modal-header border-0 bg-light pb-2">
              <h5 class="modal-title fw-bold"><i class="fa-solid fa-receipt text-primary me-2"></i> Transaction Receipt</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-0">
              <transaction-receipt transaction="$ctrl.selectedReceiptTx" on-reset="$ctrl.closeReceiptModal()"></transaction-receipt>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  controller: ['transactionService', 'customerService', 'toastService', '$window', function(transactionService, customerService, toastService, $window) {
    var ctrl = this;
    ctrl.transactions = [];
    ctrl.customers = [];
    ctrl.searchQuery = '';
    ctrl.filterType = '';
    ctrl.isLoading = false;
    ctrl.editMode = false;
    ctrl.currentTx = {};
    ctrl.selectedReceiptTx = null;

    ctrl.$onInit = function() {
      ctrl.loadTransactions();
      ctrl.loadCustomers();
    };

    ctrl.loadTransactions = function() {
      ctrl.isLoading = true;
      transactionService.getAll(ctrl.filterType, ctrl.searchQuery).then(function(res) {
        ctrl.transactions = res.data.results || res.data;
        ctrl.isLoading = false;
      }, function(err) {
        toastService.danger('Failed to load transactions');
        ctrl.isLoading = false;
      });
    };

    ctrl.loadCustomers = function() {
      customerService.getAll().then(function(res) {
        ctrl.customers = res.data.results || res.data;
      });
    };

    ctrl.openAddModal = function() {
      ctrl.editMode = false;
      ctrl.currentTx = {
        transaction_type: 'credit',
        date: new Date(),
        status: 'pending'
      };
    };

    ctrl.openEditModal = function(tx) {
      ctrl.editMode = true;
      ctrl.currentTx = angular.copy(tx);
      if (ctrl.currentTx.date) ctrl.currentTx.date = new Date(ctrl.currentTx.date);
      if (ctrl.currentTx.due_date) ctrl.currentTx.due_date = new Date(ctrl.currentTx.due_date);
      if (tx.customer_detail) ctrl.currentTx.customer_name = tx.customer_detail.name;
    };

    ctrl.saveTransaction = function() {
      var payload = angular.copy(ctrl.currentTx);
      if (payload.date) payload.date = payload.date.toISOString().split('T')[0];
      if (payload.due_date) payload.due_date = payload.due_date.toISOString().split('T')[0];

      if (ctrl.editMode) {
        transactionService.update(payload.id, payload).then(function() {
          toastService.success('Transaction updated successfully');
          ctrl.loadTransactions();
        }, function(err) {
          toastService.danger('Failed to update transaction');
        });
      } else {
        transactionService.create(payload).then(function() {
          toastService.success('Transaction created successfully');
          ctrl.loadTransactions();
        }, function(err) {
          toastService.danger('Failed to create transaction');
        });
      }
    };

    ctrl.deleteTransaction = function(tx) {
      if (confirm('Are you sure you want to delete this transaction?')) {
        transactionService.delete(tx.id).then(function() {
          toastService.success('Transaction deleted');
          ctrl.loadTransactions();
        }, function(err) {
          toastService.danger('Failed to delete transaction');
        });
      }
    };

    ctrl.viewReceipt = function(tx) {
      ctrl.selectedReceiptTx = tx;
      var modalEl = document.getElementById('receiptModal');
      if (modalEl && $window.bootstrap) {
        var modal = $window.bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }
    };

    ctrl.closeReceiptModal = function() {
      var modalEl = document.getElementById('receiptModal');
      if (modalEl && $window.bootstrap) {
        var modal = $window.bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
    };

    ctrl.sendWhatsApp = function(tx) {
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
      msg += "A " + tx.transaction_type.toUpperCase() + " transaction of *₹" + parseFloat(tx.amount).toFixed(2) + "* has been recorded on " + tx.date + ".\n";
      
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
  }]
});
