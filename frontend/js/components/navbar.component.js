/**
 * navbar.component.js - Top Navigation Bar Component for LedgerVoice
 * Implements isolated component scope and active route highlighting.
 */
app.component('appNavbar', {
  template: `
    <nav class="navbar navbar-expand-lg navbar-custom">
      <div class="container-fluid">
        <a class="navbar-brand navbar-brand-custom" href="#!/voice">
          <i class="fa-solid fa-microphone-lines text-primary"></i> LedgerVoice
        </a>
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navMenu">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item">
              <a class="nav-link nav-link-custom" ng-class="{'active': $ctrl.isActive('/voice')}" href="#!/voice">
                <i class="fa-solid fa-microphone text-primary me-1"></i> Voice Record
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link nav-link-custom" ng-class="{'active': $ctrl.isActive('/transactions')}" href="#!/transactions">
                <i class="fa-solid fa-receipt me-1"></i> Transactions
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `,
  controller: ['$location', function($location) {
    var ctrl = this;
    ctrl.isActive = function(viewLocation) {
      return $location.path() === viewLocation;
    };
  }]
});
