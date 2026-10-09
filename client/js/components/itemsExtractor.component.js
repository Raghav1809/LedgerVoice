/**
 * itemsExtractor.component.js - Items List & Sales Transaction Editor Component
 * Manages editable items table, unit selection, price calculation, inventory stock checks,
 * and sales transaction submission.
 */
app.component('itemsExtractor', {
  bindings: {
    items: '=',
    parsedData: '=',
    isSaving: '<',
    onSave: '&',
    onCancel: '&'
  },
  template: `
    <div class="items-extractor-widget border-top pt-4 mt-4 animate-fade-in">
      <!-- Header -->
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h4 class="fw-bold mb-0 text-success">
          <i class="fa-solid fa-cart-shopping me-2"></i> Sales Confirmation
        </h4>
        <span class="badge bg-success-subtle text-success fs-6">
          <i class="fa-solid fa-box-open me-1"></i> {{ $ctrl.items.length }} Item(s) Extracted
        </span>
      </div>
      <p class="text-muted small mb-3">AI extracted the items below. Edit quantities, units, or prices before saving.</p>

      <!-- Missing Price Alert -->
      <div ng-if="$ctrl.hasMissingPrices()" class="alert alert-warning border-warning d-flex align-items-center gap-2 mb-3">
        <i class="fa-solid fa-triangle-exclamation text-warning fs-5"></i>
        <div>
          <strong>Price Required:</strong> Please enter the price(s) for the highlighted items.
        </div>
      </div>

      <!-- Not Found Alert -->
      <div ng-if="$ctrl.hasNotFoundItems()" class="alert alert-danger-subtle border-danger d-flex align-items-start gap-2 mb-3 animate-fade-in">
        <i class="fa-solid fa-circle-exclamation text-danger fs-5 mt-1"></i>
        <div>
          <strong class="text-danger">Item Not Found in Catalog:</strong>
          <div class="mt-1 small">
            Please review the unit and unit price for items marked as 'Not in Catalog'.
          </div>
        </div>
      </div>

      <!-- Items Table -->
      <div class="table-responsive mb-3">
        <table class="table table-bordered align-middle mb-0" style="min-width: 640px">
          <thead class="table-light">
            <tr>
              <th style="width:25%">Item Name</th>
              <th style="width:12%">Qty</th>
              <th style="width:13%">Unit</th>
              <th style="width:15%">Price (₹)</th>
              <th style="width:13%">Total (₹)</th>
              <th style="width:17%">Price Source / Stock</th>
              <th style="width:5%" class="text-center">Del</th>
            </tr>
          </thead>
          <tbody>
            <tr ng-repeat="item in $ctrl.items track by $index" ng-class="{'table-warning': item.price_source === 'missing' && (!item.price || item.price <= 0), 'table-danger-subtle': item.not_found}">
              <td>
                <input type="text" class="form-control form-control-sm" ng-model="item.name" ng-change="$ctrl.lookupItem(item)" placeholder="Item name" required>
              </td>
              <td>
                <input type="number" min="0.001" step="0.001" class="form-control form-control-sm" ng-model="item.qty" ng-change="$ctrl.updateItemTotal(item)" placeholder="1">
              </td>
              <td>
                <select class="form-select form-select-sm" ng-model="item.unit" ng-change="$ctrl.updateItemTotal(item)">
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="litre">litre</option>
                  <option value="ml">ml</option>
                  <option value="pcs">pcs</option>
                  <option value="dozen">dozen</option>
                  <option value="box">box</option>
                  <option value="packet">packet</option>
                  <option value="bag">bag</option>
                  <option value="mtr">mtr</option>
                  <option value="ft">ft</option>
                </select>
              </td>
              <td>
                <input type="number" min="0" step="0.01" class="form-control form-control-sm" ng-model="item.price" ng-change="$ctrl.updateItemTotal(item)" placeholder="0.00" ng-class="{'is-invalid': item.price_source === 'missing' && (!item.price || item.price <= 0)}">
              </td>
              <td class="fw-bold text-success text-end">
                ₹{{ (item.qty * item.price) | number:2 }}
              </td>
              <td>
                <div class="mb-1">
                  <span ng-if="item.price_source === 'voice'" class="badge bg-success-subtle text-success d-inline-block">
                    <i class="fa-solid fa-microphone me-1"></i> Voice
                  </span>
                  <span ng-if="item.price_source === 'inventory'" class="badge bg-primary-subtle text-primary d-inline-block" title="From Inventory (₹{{item.inventory_price}} / {{item.inventory_unit}})">
                    <i class="fa-solid fa-boxes-stacked me-1"></i> Inventory
                  </span>
                  <span ng-if="item.price_source === 'missing' && (!item.price || item.price <= 0)" class="badge bg-danger-subtle text-danger d-inline-block animate-pulse">
                    <i class="fa-solid fa-triangle-exclamation me-1"></i> Price Missing
                  </span>
                  <span ng-if="item.price_source === 'manual' || (item.price_source === 'missing' && item.price > 0)" class="badge bg-warning-subtle text-warning d-inline-block">
                    <i class="fa-solid fa-keyboard me-1"></i> Manual
                  </span>
                  <span ng-if="item.not_found" class="badge bg-danger text-white d-inline-block ms-1">
                    Not in Catalog
                  </span>
                </div>
                <div class="small text-muted" ng-if="!item.not_found && item.stock_before !== null">
                  Stock: {{item.stock_before}} &rarr; <span class="fw-semibold" ng-class="{'text-danger': item.stock_after <= 0, 'text-dark': item.stock_after > 0}">{{item.stock_after}}</span> {{item.unit}}
                </div>
              </td>
              <td class="text-center">
                <button type="button" class="btn btn-sm btn-outline-danger p-1 px-2" ng-click="$ctrl.removeItem($index)" title="Remove item">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </td>
            </tr>
            <!-- Empty state -->
            <tr ng-if="$ctrl.items.length === 0">
              <td colspan="7" class="text-center text-muted py-3">
                <i class="fa-solid fa-box-open me-1"></i> No items — click Add Item below
              </td>
            </tr>
          </tbody>
          <tfoot class="table-light">
            <tr>
              <td colspan="4" class="text-end fw-bold">Grand Total</td>
              <td class="fw-bold text-success fs-5 text-end">₹{{ $ctrl.calculateGrandTotal() | number:2 }}</td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Add Item Button -->
      <div class="mb-3">
        <button type="button" class="btn btn-outline-success btn-sm px-3" ng-click="$ctrl.addItem()">
          <i class="fa-solid fa-plus me-1"></i> Add Item
        </button>
      </div>

      <!-- Customer & Date Fields -->
      <div class="row g-3 mb-3">
        <div class="col-md-4">
          <label class="form-label fw-semibold small">Customer Name <span class="text-muted fw-normal">(optional)</span></label>
          <input type="text" class="form-control" ng-model="$ctrl.parsedData.customer_name" placeholder="e.g. Rahul, John">
        </div>
        <div class="col-md-4">
          <label class="form-label fw-semibold small">Customer Phone <span class="text-muted fw-normal">(optional)</span></label>
          <input type="text" class="form-control" ng-model="$ctrl.parsedData.customer_phone" placeholder="e.g. 919876543210">
        </div>
        <div class="col-md-4">
          <label class="form-label fw-semibold small">Sale Date</label>
          <input type="date" class="form-control" ng-model="$ctrl.parsedData.date">
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label fw-semibold small">Notes / Description</label>
        <textarea class="form-control" rows="2" ng-model="$ctrl.parsedData.description" placeholder="Optional notes about this sale"></textarea>
      </div>

      <!-- Actions -->
      <div class="d-flex justify-content-between align-items-center gap-2 mt-3">
        <button type="button" class="btn btn-light border" ng-click="$ctrl.onCancel()">
          Cancel
        </button>
        <button type="button" class="btn btn-success px-4 shadow-sm" ng-click="$ctrl.triggerSave()" ng-disabled="$ctrl.isSaving || $ctrl.items.length === 0">
          <span ng-if="$ctrl.isSaving" class="spinner-border spinner-border-sm me-2"></span>
          <i class="fa-solid fa-floppy-disk me-2" ng-if="!$ctrl.isSaving"></i>
          Save &amp; Generate Receipt (₹{{ $ctrl.calculateGrandTotal() | number:2 }})
        </button>
      </div>
    </div>
  `,
  controller: ['inventoryService', function(inventoryService) {
    var ctrl = this;

    ctrl.calculateGrandTotal = function() {
      if (!ctrl.items) return 0;
      var sum = 0;
      ctrl.items.forEach(function(item) {
        var qty = parseFloat(item.qty) || 0;
        var price = parseFloat(item.price) || 0;
        sum += (qty * price);
      });
      return Math.round(sum * 100) / 100;
    };

    ctrl.updateItemTotal = function(item) {
      var qty = parseFloat(item.qty) || 0;
      var price = parseFloat(item.price) || 0;
      item.total = Math.round(qty * price * 100) / 100;
      if (item.price_source !== 'inventory' && item.price_source !== 'voice') {
        item.price_source = 'manual';
      }
      if (item.stock_before !== null && item.stock_before !== undefined) {
        item.stock_after = Math.max(0, item.stock_before - qty);
      }
    };

    ctrl.lookupItem = function(item) {
      if (!item.name) return;
      var inv = inventoryService.findByName(item.name);
      if (inv) {
        item.not_found = false;
        item.inventory_unit = inv.unit;
        item.inventory_price = inv.price;
        item.stock_before = inv.quantity;
        if (!item.price || item.price_source === 'missing') {
          item.price = inv.price;
          item.price_source = 'inventory';
        }
        if (!item.unit) item.unit = inv.unit;
        item.stock_after = Math.max(0, inv.quantity - (item.qty || 1));
      } else {
        item.not_found = true;
      }
      ctrl.updateItemTotal(item);
    };

    ctrl.addItem = function() {
      if (!ctrl.items) ctrl.items = [];
      ctrl.items.push({
        name: '',
        qty: 1,
        unit: 'kg',
        price: 0,
        total: 0,
        price_source: 'manual',
        not_found: false,
        stock_before: null,
        stock_after: null
      });
    };

    ctrl.removeItem = function(index) {
      if (ctrl.items) {
        ctrl.items.splice(index, 1);
      }
    };

    ctrl.hasMissingPrices = function() {
      if (!ctrl.items) return false;
      return ctrl.items.some(function(i) {
        return !i.price || parseFloat(i.price) <= 0;
      });
    };

    ctrl.hasNotFoundItems = function() {
      if (!ctrl.items) return false;
      return ctrl.items.some(function(i) { return i.not_found; });
    };

    ctrl.triggerSave = function() {
      if (ctrl.parsedData) {
        ctrl.parsedData.amount = ctrl.calculateGrandTotal();
      }
      if (ctrl.onSave) ctrl.onSave();
    };
  }]
});
