from rest_framework import viewsets, permissions, filters
from django.contrib.auth.models import User
from django_filters.rest_framework import DjangoFilterBackend
from .models import Transaction
from .serializers import TransactionSerializer

LOCAL_USERNAME = 'local_user'


def get_local_user():
    """Return the single local user, creating it if necessary."""
    user, created = User.objects.get_or_create(
        username=LOCAL_USERNAME,
        defaults={'email': 'local@ledgervoice.local', 'is_active': True}
    )
    if created:
        user.set_password('ledgervoice_local_2026')
        user.save()
    return user


def get_request_user(request):
    """Return authenticated user or None."""
    if request and hasattr(request, 'user') and request.user.is_authenticated:
        return request.user
    return None


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['customer__name', 'customer_name_raw', 'description', 'amount']
    ordering_fields = ['date', 'amount', 'created_at']
    ordering = ['-date', '-created_at']

    def get_queryset(self):
        user = get_request_user(self.request)
        queryset = Transaction.objects.filter(user=user).select_related('customer')

        # Filter by customer ID
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        # Filter by transaction type
        tx_type = self.request.query_params.get('type')
        if tx_type:
            queryset = queryset.filter(transaction_type=tx_type)

        # Filter by status
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset

    def perform_create(self, serializer):
        from django.db import transaction
        user = get_request_user(self.request)

        with transaction.atomic():
            instance = serializer.save(user=user)

            # Auto-create reminder for credit/udhaar transactions — uses get_or_create to prevent duplicates
            try:
                if instance.customer and instance.transaction_type == 'credit':
                    from reminders.models import Reminder
                    from django.utils import timezone

                    due = instance.due_date if instance.due_date else (instance.date or timezone.localdate())
                    title = f"Due: {instance.description[:40]}" if instance.description else f"Credit Due from {instance.customer.name}"

                    Reminder.objects.get_or_create(
                        user=user,
                        customer=instance.customer,
                        amount=instance.amount,
                        due_date=due,
                        defaults={
                            'title': title,
                            'status': 'pending',
                            'notes': f"Auto-synced from credit transaction #{instance.id}."
                        }
                    )
                elif instance.customer and instance.transaction_type == 'payment':
                    # Mark oldest pending reminders as completed based on payment amount
                    from reminders.models import Reminder
                    pending = Reminder.objects.filter(
                        user=user,
                        customer=instance.customer,
                        status='pending'
                    ).order_by('due_date')

                    remaining = float(instance.amount)
                    for rem in pending:
                        if remaining <= 0:
                            break
                        if remaining >= float(rem.amount):
                            remaining -= float(rem.amount)
                            rem.status = 'completed'
                            rem.save()
                        else:
                            break
            except Exception:
                pass

