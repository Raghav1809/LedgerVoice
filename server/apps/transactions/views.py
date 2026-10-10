from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction as db_transaction
from .models import Transaction, TransactionItem
from .serializers import TransactionSerializer, TransactionItemSerializer
from authentication.mixins import BusinessDataIsolationMixin
from inventory.models import InventoryItem, StockMovement

class TransactionViewSet(BusinessDataIsolationMixin, viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['customer__name', 'customer_name_raw', 'description', 'amount']
    ordering_fields = ['date', 'amount', 'created_at']
    ordering = ['-date', '-created_at']

    def get_queryset(self):
        business = self.get_business()
        if business:
            queryset = Transaction.objects.filter(business=business).select_related('customer', 'business')
        else:
            queryset = Transaction.objects.filter(user=self.request.user).select_related('customer')

        customer_id = self.request.query_params.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        tx_type = self.request.query_params.get('type')
        if tx_type:
            queryset = queryset.filter(transaction_type=tx_type)

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset

    def perform_create(self, serializer):
        business = self.get_business()
        with db_transaction.atomic():
            instance = serializer.save(user=self.request.user, business=business)

            # Auto-create reminder for credit/udhaar transactions
            try:
                if instance.customer and instance.transaction_type == 'credit':
                    from reminders.models import Reminder
                    from django.utils import timezone

                    due = instance.due_date if instance.due_date else (instance.date or timezone.localdate())
                    title = f"Due: {instance.description[:40]}" if instance.description else f"Credit Due from {instance.customer.name}"

                    Reminder.objects.get_or_create(
                        business=business,
                        user=self.request.user,
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
                    from reminders.models import Reminder
                    pending = Reminder.objects.filter(
                        business=business,
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

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        tx_obj = self.get_object()
        if tx_obj.status == 'cancelled':
            return Response({'error': 'Transaction is already cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        business = self.get_business()
        with db_transaction.atomic():
            tx_obj.status = 'cancelled'
            tx_obj.save(update_fields=['status', 'updated_at'])

            # Compensating stock movements for items in cancelled sales
            if tx_obj.transaction_type in ('sales', 'credit'):
                for item in tx_obj.items.all():
                    if item.inventory_item:
                        inv = InventoryItem.objects.select_for_update().get(id=item.inventory_item.id)
                        old_qty = inv.quantity or 0.0
                        new_qty = old_qty + item.quantity
                        inv.quantity = new_qty
                        inv.save(update_fields=['quantity', 'updated_at'])

                        StockMovement.objects.create(
                            business=business or inv.business,
                            inventory_item=inv,
                            transaction=tx_obj,
                            movement_type='return',
                            quantity=item.quantity,
                            quantity_before=old_qty,
                            quantity_after=new_qty,
                            reason=f"Compensating return for cancelled transaction #{tx_obj.id}",
                            created_by=request.user
                        )

            return Response({
                'message': f'Transaction #{tx_obj.id} cancelled successfully.',
                'transaction': TransactionSerializer(tx_obj, context={'request': request}).data
            }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='pay')
    def record_payment(self, request, pk=None):
        tx_obj = self.get_object()
        pay_amount = float(request.data.get('amount_paid', 0.0))
        if pay_amount <= 0:
            return Response({'error': 'Amount paid must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            tx_obj.amount_paid = float(tx_obj.amount_paid or 0.0) + pay_amount
            if tx_obj.amount_paid >= float(tx_obj.amount):
                tx_obj.status = 'settled'
            tx_obj.save(update_fields=['amount_paid', 'status', 'updated_at'])

            return Response({
                'message': f'Payment of ₹{pay_amount} recorded.',
                'transaction': TransactionSerializer(tx_obj, context={'request': request}).data
            }, status=status.HTTP_200_OK)
