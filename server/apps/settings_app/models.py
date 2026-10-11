from django.db import models
from django.contrib.auth.models import User
from authentication.models import Business

class UserSettings(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='settings', null=True, blank=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='app_settings')
    theme = models.CharField(max_length=20, default='light')
    currency = models.CharField(max_length=10, default='INR (₹)')
    language = models.CharField(max_length=10, default='en') # Locked to English
    enable_notifications = models.BooleanField(default=True)
    sound_effects = models.BooleanField(default=True)
    upi_link = models.CharField(max_length=500, blank=True, null=True)
    upi_id = models.CharField(max_length=100, blank=True, null=True)

    # Voice Onboarding & Calibration fields
    voice_onboarding_completed = models.BooleanField(default=False)
    voice_onboarding_level = models.IntegerField(default=0)  # 0=not started, 1-4=completed levels
    voice_onboarding_data = models.JSONField(blank=True, null=True, default=None)  # Per-exercise progress

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Settings for {self.user.username}"
