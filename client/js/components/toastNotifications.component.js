/**
 * toastNotifications.component.js - Global Toast Notifications Component
 * Listens to toastService notifications and displays floating alerts.
 */
app.component('toastNotifications', {
  template: `
    <div class="toast-container-custom">
      <div ng-repeat="toast in $ctrl.toasts" class="toast-custom animate-fade-in" ng-class="'border-' + toast.type">
        <div class="d-flex align-items-center gap-2">
          <i ng-if="toast.type === 'success'" class="fa-solid fa-circle-check text-success fs-5"></i>
          <i ng-if="toast.type === 'danger'" class="fa-solid fa-circle-exclamation text-danger fs-5"></i>
          <i ng-if="toast.type === 'warning'" class="fa-solid fa-triangle-exclamation text-warning fs-5"></i>
          <i ng-if="toast.type === 'info'" class="fa-solid fa-circle-info text-info fs-5"></i>
          <span class="fw-medium text-dark">{{ toast.message }}</span>
        </div>
        <button type="button" class="btn-close ms-3" ng-click="$ctrl.removeToast($index)"></button>
      </div>
    </div>
  `,
  controller: ['toastService', function(toastService) {
    var ctrl = this;
    ctrl.toasts = toastService.getToasts();

    ctrl.removeToast = function(index) {
      toastService.remove(index);
    };
  }]
});
