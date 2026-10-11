from django.urls import path
from .views import SpeechParseView, PracticeValidateView, OnboardingProgressView

urlpatterns = [
    path('parse/', SpeechParseView.as_view(), name='voice_parse'),
    path('validate-practice/', PracticeValidateView.as_view(), name='voice_validate_practice'),
    path('onboarding-progress/', OnboardingProgressView.as_view(), name='voice_onboarding_progress'),
]
