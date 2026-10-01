/**
 * navbar.component.js - Premium Navigation Bar Component for LedgerVoice
 * Features: glassmorphism, active route highlighting, animated brand, auth state reactivity.
 */
app.component('appNavbar', {
  template: `
    <nav class="navbar navbar-expand-lg navbar-custom">
      <div class="container-fluid px-3 px-md-4">

        <!-- Brand -->
        <a class="navbar-brand navbar-brand-custom" href="#!/dashboard">
          <i class="fa-solid fa-microphone-lines"></i>
          LedgerVoice
        </a>

        <!-- Mobile Toggle -->
        <button class="navbar-toggler border-0 shadow-none px-2"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#navMenu"
                aria-controls="navMenu"
                aria-expanded="false"
                aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>

        <!-- Nav Links -->
        <div class="collapse navbar-collapse" id="navMenu">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0 gap-1">

            <li class="nav-item">
              <a class="nav-link nav-link-custom" 
                 ng-class="{'active': $ctrl.isActive('/dashboard')}"
                 href="#!/dashboard">
                <i class="fa-solid fa-chart-line me-1" style="font-size:0.85rem;"></i>
                Dashboard
              </a>
            </li>

            <li class="nav-item">
              <a class="nav-link nav-link-custom"
                 ng-class="{'active': $ctrl.isActive('/voice')}"
                 href="#!/voice">
                <i class="fa-solid fa-microphone me-1" style="font-size:0.85rem;"></i>
                Voice Record
              </a>
            </li>

            <li class="nav-item">
              <a class="nav-link nav-link-custom"
                 ng-class="{'active': $ctrl.isActive('/transactions')}"
                 href="#!/transactions">
                <i class="fa-solid fa-receipt me-1" style="font-size:0.85rem;"></i>
                Transactions
              </a>
            </li>

          </ul>

          <!-- Right: Auth Controls -->
          <div class="d-flex align-items-center gap-2 mt-2 mt-lg-0">

            <!-- Authenticated State -->
            <div ng-if="$ctrl.isAuthenticated" class="d-flex align-items-center gap-2">
              <!-- User Pill -->
              <div class="user-pill d-flex align-items-center gap-2 px-3 py-2 rounded-pill border">
                <div class="user-avatar-circle">
                  <i class="fa-solid fa-user-tie text-primary" style="font-size:0.85rem;"></i>
                </div>
                <div class="d-none d-sm-block lh-1">
                  <div class="fw-bold small text-dark" style="font-size:0.85rem;">
                    {{ $ctrl.user.first_name || $ctrl.user.username || 'User' }}
                  </div>
                  <small class="text-muted" style="font-size:0.7rem;">
                    {{ ($ctrl.user.profile && $ctrl.user.profile.business_name) || 'LedgerVoice Store' }}
                  </small>
                </div>
              </div>

              <!-- Logout Button -->
              <button class="btn btn-sm rounded-pill px-3"
                      style="border:1.5px solid rgba(220,38,38,0.35); color:#dc2626; background:rgba(220,38,38,0.06); transition:all 0.25s ease;"
                      ng-mouseenter="$event.target.style.background='rgba(220,38,38,0.12)'"
                      ng-mouseleave="$event.target.style.background='rgba(220,38,38,0.06)'"
                      ng-click="$ctrl.logout()"
                      title="Sign Out">
                <i class="fa-solid fa-right-from-bracket me-1"></i>
                <span class="d-none d-md-inline">Logout</span>
              </button>
            </div>

            <!-- Guest State -->
            <div ng-if="!$ctrl.isAuthenticated" class="d-flex align-items-center gap-2">
              <a href="#!/login"
                 class="btn btn-sm btn-outline-blue px-4 rounded-pill"
                 ng-class="{'active': $ctrl.isActive('/login')}">
                <i class="fa-solid fa-right-to-bracket me-1"></i> Sign In
              </a>
              <a href="#!/register"
                 class="btn btn-sm btn-gradient-blue px-4 rounded-pill shadow-sm"
                 ng-class="{'active': $ctrl.isActive('/register')}">
                <i class="fa-solid fa-user-plus me-1"></i> Sign Up
              </a>
            </div>

          </div>
        </div>

      </div>
    </nav>
  `,
  controller: ['$location', '$rootScope', 'authService', 'toastService',
    function($location, $rootScope, authService, toastService) {
      var ctrl = this;

      /**
       * JWT Auth State: isAuthenticated and user data are synced
       * reactively via $rootScope 'auth:changed' broadcasts.
       * The jwtInterceptor in app.js attaches the Bearer token to
       * every /api/ request — so this state drives what the user sees.
       */
      ctrl.updateAuthState = function() {
        ctrl.isAuthenticated = authService.isAuthenticated();
        ctrl.user = authService.getUser() || {};
      };

      ctrl.$onInit = function() {
        ctrl.updateAuthState();
      };

      // React to login / logout / register events broadcast from authService
      $rootScope.$on('auth:changed', function(event, user) {
        ctrl.updateAuthState();
      });

      ctrl.isActive = function(viewLocation) {
        return $location.path() === viewLocation;
      };

      ctrl.logout = function() {
        authService.logout();
        ctrl.updateAuthState();
        toastService.info('You have been signed out.');
      };
    }
  ]
});
