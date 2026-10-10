from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Customer
from .serializers import CustomerSerializer
from authentication.mixins import BusinessDataIsolationMixin
from django.db.models import Sum, Q, DecimalField
from django.db.models.functions import Coalesce

class CustomerViewSet(BusinessDataIsolationMixin, viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'phone', 'email', 'notes']
    ordering_fields = ['name', 'created_at', 'updated_at']
    ordering = ['-updated_at']

    def get_queryset(self):
        business = self.get_business()
        credit_q = Q(transactions__transaction_type__in=['credit', 'sales'])
        payment_q = Q(transactions__transaction_type__in=['payment', 'expense'])

        if business:
            qs = Customer.objects.filter(business=business, is_active=True)
        else:
            qs = Customer.objects.filter(user=self.request.user, is_active=True)

        return qs.annotate(
            annotated_credit=Coalesce(Sum('transactions__amount', filter=credit_q), 0.0, output_field=DecimalField()),
            annotated_payments=Coalesce(Sum('transactions__amount', filter=payment_q), 0.0, output_field=DecimalField())
        )

    def perform_create(self, serializer):
        self.perform_create_with_business(serializer)

    def perform_destroy(self, instance):
        # Soft delete (archive)
        instance.is_active = False
        instance.save()

    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        customer = self.get_object()
        from transactions.serializers import TransactionSerializer
        txs = customer.transactions.select_related('customer').order_by('-date', '-created_at')
        serializer = TransactionSerializer(txs, many=True)
        return Response({
            'customer': CustomerSerializer(customer, context={'request': request}).data,
            'transactions': serializer.data
        })
