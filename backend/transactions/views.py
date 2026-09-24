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
    """Return authenticated user or fall back to local user for local mode."""
    if request and hasattr(request, 'user') and request.user.is_authenticated:
        return request.user
    return get_local_user()


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['customer__name', 'customer_name_raw', 'description', 'amount']
    ordering_fields = ['date', 'amount', 'created_at']
    ordering = ['-date', '-created_at']

    def get_queryset(self):
        user = get_request_user(self.request)
        queryset = Transaction.objects.filter(user=user)

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
        user = get_request_user(self.request)
        serializer.save(user=user)
