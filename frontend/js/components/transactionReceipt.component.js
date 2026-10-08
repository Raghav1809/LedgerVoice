/**
 * transactionReceipt.component.js - Compact Single-Screen Transaction Receipt Component
 * Displays itemized receipt breakdown with items sold, quantities, rates,
 * individual totals, grand sum total, and WhatsApp/Print actions on a single screen without scrolling.
 */
app.component('transactionReceipt', {
  bindings: {
    transaction: '<',
    onReset: '&',
    isModal: '<'
  },
  template: `
    <div class="receipt-container animate-fade-in my-0">
      <!-- Single-Screen Ultra-Compact Receipt Card -->
      <div class="card border-0 shadow-lg receipt-card mx-auto" id="printableReceipt" style="max-width: 580px; border-radius: 14px; overflow: hidden;">
        
        <!-- Receipt Header Banner (Compact with optional close button) -->
        <div class="bg-gradient-primary text-white py-2 px-3 text-center position-relative">
          <button ng-if="$ctrl.isModal" type="button" class="btn-close btn-close-white position-absolute top-50 translate-middle-y end-0 me-3 shadow-none"
                  ng-click="$ctrl.onReset()" aria-label="Close" style="font-size:0.75rem;"></button>
          <div class="d-flex align-items-center justify-content-center gap-2">
            <i class="fa-solid fa-circle-check text-white fs-5"></i>
            <h6 class="fw-bold mb-0 letter-spacing-1">LedgerVoice Receipt</h6>
            <span class="badge bg-white text-dark fw-bold px-2 py-0.5 shadow-sm ms-1" style="font-size:0.72rem;">
              #LV-{{ $ctrl.transaction.id || 'NEW' }}
            </span>
          </div>
          <div class="small text-white-50" style="font-size:0.72rem; line-height:1.2;">Official Transaction &amp; Accounting Record</div>
        </div>

        <!-- Receipt Body (Compact Single Screen) -->
        <div class="card-body p-2.5 bg-white">
          <!-- Meta details grid -->
          <div class="row g-1 mb-2 pb-1.5 border-bottom small align-items-center" style="font-size:0.8rem;">
            <div class="col-6 text-truncate">
              <span class="text-muted">Customer:</span>
              <strong class="text-dark ms-1">{{ $ctrl.transaction.customer_name_raw || $ctrl.transaction.customer_name || 'General Customer' }}</strong>
            </div>
            <div class="col-6 text-end">
              <span class="text-muted">Date:</span>
              <strong class="text-dark ms-1">{{ $ctrl.formatDate($ctrl.transaction.date) }}</strong>
            </div>
            <div class="col-6 text-truncate" ng-if="$ctrl.transaction.customer_phone">
              <span class="text-muted">Phone:</span>
              <strong class="text-dark ms-1">{{ $ctrl.transaction.customer_phone }}</strong>
            </div>
            <div class="col-6 text-end" ng-class="{'col-12': !$ctrl.transaction.customer_phone}">
              <span class="text-muted">Type:</span>
              <span class="badge ms-1 py-0.5 px-2" ng-class="{
                'badge-credit': $ctrl.transaction.transaction_type === 'credit',
                'badge-payment': $ctrl.transaction.transaction_type === 'payment',
                'badge-sales': $ctrl.transaction.transaction_type === 'sales',
                'badge-expense': $ctrl.transaction.transaction_type === 'expense'
              }">{{ $ctrl.transaction.transaction_type | uppercase }}</span>
            </div>
          </div>

          <!-- Itemized Breakdown (If Items Sold) -->
          <div ng-if="$ctrl.hasItems()" class="mb-2">
            <div class="d-flex align-items-center justify-content-between mb-1">
              <span class="fw-bold text-dark small" style="font-size:0.78rem;">
                <i class="fa-solid fa-cart-flatbed-suitcase me-1 text-primary"></i> Items Breakdown
              </span>
              <span class="badge bg-light text-muted border py-0.5 px-1.5" style="font-size:0.68rem;">{{ $ctrl.getItems().length }} Item(s)</span>
            </div>

            <div class="table-responsive" style="max-height: 110px; overflow-y: auto;">
              <table class="table table-sm table-bordered align-middle mb-0 receipt-items-table" style="font-size:0.78rem;">
                <thead class="table-light">
                  <tr class="text-muted text-uppercase" style="font-size:0.68rem;">
                    <th style="width: 45%" class="py-1">Item</th>
                    <th style="width: 20%" class="text-center py-1">Qty</th>
                    <th style="width: 15%" class="text-end py-1">Rate</th>
                    <th style="width: 20%" class="text-end py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr ng-repeat="item in $ctrl.getItems()">
                    <td class="fw-medium text-dark py-0.5 text-truncate">{{ item.name }}</td>
                    <td class="text-center text-muted small py-0.5">{{ item.qty }} {{ item.unit }}</td>
                    <td class="text-end text-muted small py-0.5">₹{{ item.price | number:2 }}</td>
                    <td class="text-end fw-bold text-dark py-0.5">₹{{ (item.total || (item.qty * item.price)) | number:2 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Total Summary Box -->
          <div class="bg-light py-1.5 px-3 rounded-2 mb-2 border">
            <div class="d-flex justify-content-between align-items-center">
              <span class="fw-bold text-dark small">Grand Total:</span>
              <span class="fw-extrabold text-success" style="font-size:1.25rem; font-family:var(--font-display);">₹{{ $ctrl.transaction.amount | number:2 }}</span>
            </div>
          </div>

          <div class="small text-muted fst-italic text-center mb-1.5" style="font-size:0.74rem;" ng-if="$ctrl.transaction.description">
            <i class="fa-solid fa-quote-left me-1"></i> {{ $ctrl.transaction.description }}
          </div>

          <!-- WhatsApp Direct Share Bar -->
          <div class="pt-1.5 border-top no-print mb-1">
            <div class="row g-1.5 align-items-center">
              <div class="col-7">
                <input type="text" class="form-control form-control-sm py-1" style="font-size:0.8rem;" ng-model="$ctrl.phoneInput" placeholder="WhatsApp (e.g. 919876543210)">
              </div>
              <div class="col-5">
                <button class="btn btn-sm btn-success w-100 fw-semibold py-1" style="font-size:0.8rem;" type="button" ng-click="$ctrl.shareWhatsApp()" ng-disabled="!$ctrl.phoneInput">
                  <i class="fa-brands fa-whatsapp me-1"></i> WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Receipt Card Footer Actions (Single Screen Row) -->
        <div class="card-footer bg-light py-2 px-3 border-0 d-flex justify-content-between align-items-center gap-2 no-print">
          <button type="button" class="btn btn-sm btn-outline-secondary px-3 py-1" style="font-size:0.82rem;" ng-click="$ctrl.printReceipt()">
            <i class="fa-solid fa-print me-1"></i> Print Receipt
          </button>
          <button type="button" class="btn btn-sm btn-gradient-blue px-3 py-1 shadow-sm" style="font-size:0.82rem;" ng-click="$ctrl.onReset()">
            <i class="fa-solid" ng-class="$ctrl.isModal ? 'fa-check' : 'fa-microphone'"></i>
            {{ $ctrl.isModal ? 'Done' : 'Record Another' }}
          </button>
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

      var receiptHTML = receiptEl.outerHTML;
      var printWindow = $window.open('', '_blank', 'width=800,height=900');
      if (!printWindow) {
        $window.print();
        return;
      }

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
