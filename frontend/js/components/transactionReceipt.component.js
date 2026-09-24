/**
 * transactionReceipt.component.js - Modern Transaction Receipt Component
 * Displays itemized receipt breakdown with items sold, quantities, rates,
 * individual totals, grand sum total, and WhatsApp/Print actions.
 */
app.component('transactionReceipt', {
  bindings: {
    transaction: '<',
    onReset: '&'
  },
  template: `
    <div class="receipt-container animate-fade-in my-3">
      <!-- Receipt Card -->
      <div class="card border-0 shadow-lg receipt-card mx-auto" id="printableReceipt" style="max-width: 580px; border-radius: 16px; overflow: hidden;">
        
        <!-- Receipt Header Banner -->
        <div class="bg-gradient-primary text-white p-4 text-center position-relative">
          <div class="receipt-check-icon mb-2">
            <i class="fa-solid fa-circle-check text-white fs-1"></i>
          </div>
          <h4 class="fw-bold mb-1 letter-spacing-1">LedgerVoice Receipt</h4>
          <p class="small text-white-50 mb-0">Official Transaction &amp; Accounting Record</p>
          <span class="badge bg-white text-dark mt-2 fw-semibold px-3 py-1 shadow-sm">
            #LV-{{ $ctrl.transaction.id || 'NEW' }}
          </span>
        </div>

        <!-- Receipt Body -->
        <div class="card-body p-4 bg-white">
          <!-- Meta details -->
          <div class="row g-2 mb-3 pb-3 border-bottom small">
            <div class="col-6">
              <span class="text-muted d-block">Customer:</span>
              <strong class="text-dark fs-6">{{ $ctrl.transaction.customer_name_raw || $ctrl.transaction.customer_name || 'General / Cash Customer' }}</strong>
            </div>
            <div class="col-6 text-end">
              <span class="text-muted d-block">Date:</span>
              <strong class="text-dark">{{ $ctrl.formatDate($ctrl.transaction.date) }}</strong>
            </div>
            <div class="col-6" ng-if="$ctrl.transaction.customer_phone">
              <span class="text-muted d-block">Phone:</span>
              <strong class="text-dark">{{ $ctrl.transaction.customer_phone }}</strong>
            </div>
            <div class="col-6 text-end">
              <span class="text-muted d-block">Type:</span>
              <span class="badge" ng-class="{
                'badge-credit': $ctrl.transaction.transaction_type === 'credit',
                'badge-payment': $ctrl.transaction.transaction_type === 'payment',
                'badge-sales': $ctrl.transaction.transaction_type === 'sales',
                'badge-expense': $ctrl.transaction.transaction_type === 'expense'
              }">{{ $ctrl.transaction.transaction_type | uppercase }}</span>
            </div>
          </div>

          <!-- Itemized Breakdown (If Items Sold) -->
          <div ng-if="$ctrl.hasItems()" class="mb-4">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <h6 class="fw-bold text-dark mb-0">
                <i class="fa-solid fa-cart-flatbed-suitcase me-1 text-primary"></i> Sold Items Breakdown
              </h6>
              <span class="badge bg-light text-muted border">{{ $ctrl.getItems().length }} Item(s)</span>
            </div>

            <div class="table-responsive">
              <table class="table table-sm table-bordered align-middle mb-0 receipt-items-table">
                <thead class="table-light">
                  <tr class="small text-muted text-uppercase">
                    <th style="width: 40%">Item</th>
                    <th style="width: 20%" class="text-center">Qty</th>
                    <th style="width: 20%" class="text-end">Price</th>
                    <th style="width: 20%" class="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr ng-repeat="item in $ctrl.getItems()">
                    <td class="fw-medium text-dark">{{ item.name }}</td>
                    <td class="text-center text-muted small">{{ item.qty }} {{ item.unit }}</td>
                    <td class="text-end text-muted small">₹{{ item.price | number:2 }}</td>
                    <td class="text-end fw-bold text-dark">₹{{ (item.total || (item.qty * item.price)) | number:2 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Total Calculation Section -->
          <div class="bg-light p-3 rounded-3 mb-3 border">
            <div class="d-flex justify-content-between align-items-center mb-1 small text-muted">
              <span>Subtotal:</span>
              <span>₹{{ $ctrl.transaction.amount | number:2 }}</span>
            </div>
            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
              <span class="fw-bold text-dark fs-5">Grand Total:</span>
              <span class="fw-bold text-success fs-4">₹{{ $ctrl.transaction.amount | number:2 }}</span>
            </div>
          </div>

          <div class="small text-muted fst-italic text-center mb-3" ng-if="$ctrl.transaction.description">
            <i class="fa-solid fa-quote-left me-1"></i> {{ $ctrl.transaction.description }}
          </div>

          <!-- WhatsApp Share Section -->
          <div class="pt-3 border-top no-print">
            <label class="form-label fw-bold small text-muted">
              <i class="fa-brands fa-whatsapp text-success me-1"></i> Send Itemized Receipt via WhatsApp
            </label>
            <div class="input-group">
              <input type="text" class="form-control" ng-model="$ctrl.phoneInput" placeholder="Recipient WhatsApp number (e.g. 919876543210)">
              <button class="btn btn-success px-3" type="button" ng-click="$ctrl.shareWhatsApp()" ng-disabled="!$ctrl.phoneInput">
                <i class="fa-solid fa-paper-plane me-1"></i> Send
              </button>
            </div>
          </div>
        </div>

        <!-- Receipt Card Footer Actions -->
        <div class="card-footer bg-light p-3 border-0 d-flex flex-wrap justify-content-between gap-2 no-print">
          <button type="button" class="btn btn-outline-secondary px-3" ng-click="$ctrl.printReceipt()">
            <i class="fa-solid fa-print me-1"></i> Print Receipt
          </button>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-gradient-blue px-4 shadow-sm" ng-click="$ctrl.onReset()">
              <i class="fa-solid fa-microphone me-1"></i> Record Another
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  controller: ['$window', function($window) {
    var ctrl = this;

    ctrl.$onInit = function() {
      ctrl.phoneInput = (ctrl.transaction && (ctrl.transaction.customer_phone || (ctrl.transaction.customer_detail && ctrl.transaction.customer_detail.phone))) || '';
    };

    ctrl.$onChanges = function(changes) {
      if (changes.transaction && changes.transaction.currentValue) {
        ctrl.phoneInput = ctrl.transaction.customer_phone || (ctrl.transaction.customer_detail && ctrl.transaction.customer_detail.phone) || '';
      }
    };

    ctrl.hasItems = function() {
      return (ctrl.transaction && ((ctrl.transaction.items_data && ctrl.transaction.items_data.length > 0) || (ctrl.transaction.items && ctrl.transaction.items.length > 0)));
    };

    ctrl.getItems = function() {
      if (!ctrl.transaction) return [];
      return ctrl.transaction.items_data || ctrl.transaction.items || [];
    };

    ctrl.formatDate = function(d) {
      if (!d) return new Date().toLocaleDateString('en-IN');
      if (typeof d === 'string') return d;
      return new Date(d).toLocaleDateString('en-IN');
    };

    ctrl.printReceipt = function() {
      var receiptEl = document.getElementById('printableReceipt');
      if (!receiptEl) {
        $window.print();
        return;
      }

      // Clone the receipt HTML and open a dedicated print window
      var receiptHTML = receiptEl.outerHTML;
      var printWindow = $window.open('', '_blank', 'width=800,height=900');
      if (!printWindow) {
        // Popup blocked — fall back to window.print()
        $window.print();
        return;
      }

      // Gather all stylesheets from the current page
      var stylesheets = '';
      var links = document.querySelectorAll('link[rel="stylesheet"]');
      for (var i = 0; i < links.length; i++) {
        stylesheets += '<link rel="stylesheet" href="' + links[i].href + '">';
      }

      var printDoc = '<!DOCTYPE html><html><head>' +
        '<meta charset="UTF-8">' +
        '<title>LedgerVoice Receipt - Print</title>' +
        stylesheets +
        '<style>' +
        '  body { background: #fff; margin: 0; padding: 20px; font-family: "Inter", sans-serif; }' +
        '  .no-print, .card-footer { display: none !important; }' +
        '  #printableReceipt { max-width: 100% !important; width: 100% !important; box-shadow: none !important; border: 1px solid #ddd !important; border-radius: 8px !important; }' +
        '  .bg-gradient-primary { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%) !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
        '  .receipt-items-table { border-collapse: collapse !important; width: 100% !important; }' +
        '  .receipt-items-table thead th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
        '  .receipt-items-table td, .receipt-items-table th { border: 1px solid #dee2e6 !important; padding: 6px 8px !important; }' +
        '  .badge { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border: 1px solid #ccc !important; }' +
        '  .bg-light { background-color: #f8f9fa !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
        '  @media print { @page { margin: 10mm; size: A4; } }' +
        '</style>' +
        '</head><body>' +
        receiptHTML +
        '</body></html>';

      printWindow.document.open();
      printWindow.document.write(printDoc);
      printWindow.document.close();

      // Wait for stylesheets to load, then trigger print
      printWindow.onload = function() {
        setTimeout(function() {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 500);
      };
    };

    ctrl.shareWhatsApp = function() {
      var rawPhone = (ctrl.phoneInput || '').replace(/[\s\-\+]/g, '');
      if (!rawPhone) return;

      var customerName = ctrl.transaction.customer_name_raw || ctrl.transaction.customer_name || 'Customer';
      var dateStr = ctrl.formatDate(ctrl.transaction.date);
      var total = parseFloat(ctrl.transaction.amount || 0).toFixed(2);
      var items = ctrl.getItems();

      var msg = "🧾 *LedgerVoice Transaction Receipt*\n";
      msg += "━━━━━━━━━━━━━━━━━━━━\n";
      msg += "👤 *Customer:* " + customerName + "\n";
      msg += "📅 *Date:* " + dateStr + "\n";
      msg += "🏷️ *Type:* " + (ctrl.transaction.transaction_type || 'Sales').toUpperCase() + "\n";

      if (items && items.length > 0) {
        msg += "\n📦 *Items Sold:*\n";
        items.forEach(function(item, idx) {
          var itemTotal = (item.total || (item.qty * item.price)).toFixed(2);
          msg += (idx + 1) + ". *" + item.name + "* — " + item.qty + " " + item.unit + " @ ₹" + parseFloat(item.price).toFixed(2) + " = ₹" + itemTotal + "\n";
        });
      }

      msg += "━━━━━━━━━━━━━━━━━━━━\n";
      msg += "💰 *Total Amount:* ₹" + total + "\n\n";
      msg += "Thank you for doing business with us! 🙏";

      var url = "https://wa.me/" + rawPhone + "?text=" + encodeURIComponent(msg);
      $window.open(url, '_blank');
    };
  }]
});
