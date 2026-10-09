"""
Management command: ensure_local_user
======================================
Creates (or returns) the single "local" user used by LedgerVoice
when authentication is disabled.  All transactions are owned by this user.

Usage:
    python manage.py ensure_local_user
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


LOCAL_USERNAME = 'local_user'
LOCAL_EMAIL    = 'local@ledgervoice.local'
LOCAL_PASSWORD = 'ledgervoice_local_2026'   # irrelevant – no one logs in


class Command(BaseCommand):
    help = 'Create the local default user for no-auth mode'

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            username=LOCAL_USERNAME,
            defaults={
                'email':      LOCAL_EMAIL,
                'is_active':  True,
                'is_staff':   False,
                'is_superuser': False,
            }
        )
        if created:
            user.set_password(LOCAL_PASSWORD)
            user.save()
            self.stdout.write(self.style.SUCCESS(
                f'Local user "{LOCAL_USERNAME}" created.'
            ))
        else:
            self.stdout.write(
                f'Local user "{LOCAL_USERNAME}" already exists — skipping.'
            )
