from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Customer
from .serializers import CustomerSerializer

from transactions.views import get_request_user

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'phone', 'email', 'notes']
    ordering_fields = ['name', 'created_at', 'updated_at']
    ordering = ['-updated_at']

    def get_queryset(self):
        user = get_request_user(self.request)
        return Customer.objects.filter(user=user)

    def perform_create(self, serializer):
        user = get_request_user(self.request)
        serializer.save(user=user)

    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        customer = self.get_object()
        from transactions.serializers import TransactionSerializer
        txs = customer.transactions.all().order_by('-date', '-created_at')
        serializer = TransactionSerializer(txs, many=True)
        return Response({
            'customer': CustomerSerializer(customer).data,
            'transactions': serializer.data
        })
