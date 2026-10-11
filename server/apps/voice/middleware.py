import json
from django.http import JsonResponse
from rest_framework_simplejwt.authentication import JWTAuthentication
from settings_app.models import UserSettings


class VoiceOnboardingGateMiddleware:
    """
    Middleware that enforces mandatory completion of Voice Onboarding & Calibration.
    Blocks all protected API endpoints for authenticated users until they have completed
    all calibration exercises.

    Exempted endpoints:
    - /api/auth/*
    - /api/settings/*
    - /api/voice/onboarding-progress/
    - /api/voice/validate-practice/
    """

    EXEMPT_PREFIXES = (
        '/api/auth/',
        '/api/settings/',
        '/api/voice/onboarding-progress/',
        '/api/voice/validate-practice/',
    )

    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_authenticator = JWTAuthentication()

    def __call__(self, request):
        path = request.path

        # Only inspect API endpoints
        if path.startswith('/api/'):
            # Check if current path is exempt
            is_exempt = any(path.startswith(prefix) for prefix in self.EXEMPT_PREFIXES)

            if not is_exempt:
                user = getattr(request, 'user', None)

                # If not authenticated yet via session, try extracting from JWT Bearer token
                if not (user and user.is_authenticated):
                    try:
                        auth_header = self.jwt_authenticator.get_header(request)
                        if auth_header:
                            raw_token = self.jwt_authenticator.get_raw_token(auth_header)
                            if raw_token:
                                validated_token = self.jwt_authenticator.get_validated_token(raw_token)
                                user = self.jwt_authenticator.get_user(validated_token)
                    except Exception:
                        user = None

                # If user is authenticated, enforce onboarding completion
                if user and user.is_authenticated:
                    settings_obj = UserSettings.objects.filter(user=user).first()
                    if not settings_obj or not settings_obj.voice_onboarding_completed:
                        return JsonResponse({
                            'detail': 'Voice calibration must be completed before accessing this feature.',
                            'code': 'voice_onboarding_required',
                            'voice_onboarding_completed': False
                        }, status=403)

        return self.get_response(request)
