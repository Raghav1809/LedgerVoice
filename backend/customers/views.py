from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Customer
from .serializers import CustomerSerializer

from transactions.views import get_request_user

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'phone', 'email', 'notes']
    ordering_fields = ['name', 'created_at', 'updated_at']
    ordering = ['-updated_at']

    def get_queryset(self):
        user = get_request_user(self.request)
        from django.db.models import Sum, Q, DecimalField
        from django.db.models.functions import Coalesce

        credit_q = Q(transactions__transaction_type__in=['credit', 'sales'])
        payment_q = Q(transactions__transaction_type__in=['payment', 'expense'])

        return Customer.objects.filter(user=user).annotate(
            annotated_credit=Coalesce(Sum('transactions__amount', filter=credit_q), 0.0, output_field=DecimalField()),
            annotated_payments=Coalesce(Sum('transactions__amount', filter=payment_q), 0.0, output_field=DecimalField())
        )

    def perform_create(self, serializer):
        user = get_request_user(self.request)
        serializer.save(user=user)

    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        customer = self.get_object()
        from transactions.serializers import TransactionSerializer
        txs = customer.transactions.select_related('customer').order_by('-date', '-created_at')
        serializer = TransactionSerializer(txs, many=True)
        return Response({
            'customer': CustomerSerializer(customer).data,
            'transactions': serializer.data
        })
