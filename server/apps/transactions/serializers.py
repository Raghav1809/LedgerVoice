from rest_framework import serializers
from django.db import transaction as db_transaction
from .models import Transaction, TransactionItem
from customers.models import Customer
from customers.serializers import CustomerSerializer
from inventory.models import InventoryItem, StockMovement
from authentication.utils import get_user_business

class TransactionItemSerializer(serializers.ModelSerializer):
    inventory_item_id = serializers.IntegerField(required=False, allow_null=True)
    product_name = serializers.ReadOnlyField(source='description')

    class Meta:
        model = TransactionItem
        fields = ['id', 'inventory_item', 'inventory_item_id', 'description', 'product_name', 'quantity', 'unit_price', 'line_total', 'unit']
        read_only_fields = ['id', 'line_total']


class TransactionSerializer(serializers.ModelSerializer):
    customer_detail = CustomerSerializer(source='customer', read_only=True)
    customer_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    customer_phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0.00)
    items = TransactionItemSerializer(many=True, required=False)

    class Meta:
        model = Transaction
        fields = [
            'id', 'customer', 'customer_name', 'customer_phone', 'customer_name_raw', 'customer_detail',
            'amount', 'amount_paid', 'transaction_type', 'date', 'due_date', 'description', 'notes',
            'status', 'items_data', 'items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = data.copy()
            if 'due_date' in data and (data['due_date'] == '' or data['due_date'] is None):
                data['due_date'] = None
            if 'date' in data and (data['date'] == '' or data['date'] is None):
                data.pop('date', None)
        return super().to_internal_value(data)

    def validate(self, attrs):
        request = self.context.get('request')
        if not request or not request.user:
            return attrs

        business = get_user_business(request.user)

        # Validate customer ownership
        customer = attrs.get('customer')
        if customer and business and customer.business_id != business.id:
            raise serializers.ValidationError({"customer": "Customer does not belong to your business."})

        # Validate items ownership if items are passed
        items_input = self.initial_data.get('items', [])
        for item_data in items_input:
            inv_id = item_data.get('inventory_item_id') or item_data.get('inventory_item')
            if inv_id and business:
                inv_item = InventoryItem.objects.filter(id=inv_id, is_active=True).first()
                if not inv_item or inv_item.business_id != business.id:
                    raise serializers.ValidationError({
                        "items": f"Inventory item {inv_id} does not belong to your business."
                    })

        return attrs

    def create(self, validated_data):
        items_input = validated_data.pop('items', None) or self.initial_data.get('items', [])
        customer_name = validated_data.pop('customer_name', None)
        customer_phone = validated_data.pop('customer_phone', None)
        passed_user = validated_data.pop('user', None)
        passed_business = validated_data.pop('business', None)

        request = self.context.get('request')
        user = passed_user or (request.user if request else None)
        business = passed_business or get_user_business(user)

        from django.utils import timezone
        if 'date' not in validated_data or not validated_data['date']:
            validated_data['date'] = timezone.localdate()

        tx_type = validated_data.get('transaction_type', 'credit')
        is_sales = tx_type == 'sales'

        with db_transaction.atomic():
            # Resolve customer within business
            if not is_sales:
                if customer_name and not validated_data.get('customer'):
                    clean_name = customer_name.strip()
                    cust_qs = Customer.objects.filter(name__iexact=clean_name, is_active=True)
                    customer = cust_qs.filter(business=business).first() if business else cust_qs.filter(user=user).first()
                    if not customer:
                        customer = Customer.objects.create(
                            business=business,
                            user=user,
                            name=clean_name,
                            phone=customer_phone
                        )
                    else:
                        if customer_phone and not customer.phone:
                            customer.phone = customer_phone
                            customer.save()
                    validated_data['customer'] = customer
                    validated_data['customer_name_raw'] = customer.name
                elif validated_data.get('customer'):
                    customer = validated_data.get('customer')
                    if customer_phone and not customer.phone:
                        customer.phone = customer_phone
                        customer.save()
                    validated_data['customer_name_raw'] = customer.name
            else:
                if customer_name and customer_name.strip():
                    validated_data['customer_name_raw'] = customer_name.strip()

            if tx_type == 'credit' and 'status' not in validated_data:
                validated_data['status'] = 'pending'

            # 1. Process items line totals & calculate total_amount backend-side
            processed_line_items = []
            calculated_total = 0.0

            # Check items_data fallback if items list empty
            if not items_input and validated_data.get('items_data') and isinstance(validated_data['items_data'], list):
                items_input = [
                    {
                        'description': i.get('name', 'Sales Item'),
                        'quantity': float(i.get('qty', 1.0)),
                        'unit_price': float(i.get('price', 0.0)),
                        'unit': i.get('unit', 'pcs')
                    }
                    for i in validated_data['items_data']
                ]

            for item_data in items_input:
                desc = item_data.get('description') or item_data.get('name') or 'Item'
                qty = float(item_data.get('quantity') or item_data.get('qty') or 1.0)
                price = float(item_data.get('unit_price') or item_data.get('price') or 0.0)
                line_total = round(qty * price, 2)
                unit = item_data.get('unit', 'pcs')
                inv_id = item_data.get('inventory_item_id') or item_data.get('inventory_item')

                calculated_total += line_total
                processed_line_items.append({
                    'inv_id': inv_id,
                    'description': desc,
                    'quantity': qty,
                    'unit_price': price,
                    'line_total': line_total,
                    'unit': unit
                })

            if processed_line_items:
                validated_data['amount'] = round(calculated_total, 2)

            # Create Transaction record
            tx_obj = Transaction.objects.create(
                business=business,
                user=user,
                created_by=user,
                **validated_data
            )

            # 2. Create TransactionItems and StockMovements with locking
            for line in processed_line_items:
                inv_item = None
                if line['inv_id']:
                    inv_item = InventoryItem.objects.select_for_update().filter(id=line['inv_id']).first()

                # If inv_item not explicitly linked, attempt lookup by name
                if not inv_item and business and line['description']:
                    inv_item = InventoryItem.objects.select_for_update().filter(
                        business=business,
                        product_name__iexact=line['description'].strip(),
                        is_active=True
                    ).first()

                TransactionItem.objects.create(
                    transaction=tx_obj,
                    inventory_item=inv_item,
                    description=line['description'],
                    quantity=line['quantity'],
                    unit_price=line['unit_price'],
                    line_total=line['line_total'],
                    unit=line['unit']
                )

                # Stock movement for sales or purchases
                if inv_item and tx_obj.status == 'completed':
                    old_qty = inv_item.quantity or 0.0
                    if tx_type in ('sales', 'credit'):
                        new_qty = max(0.0, old_qty - line['quantity'])
                        m_type = 'stock_out'
                    elif tx_type in ('purchase', 'stock_in'):
                        new_qty = old_qty + line['quantity']
                        m_type = 'stock_in'
                    else:
                        m_type = None

                    if m_type:
                        inv_item.quantity = new_qty
                        inv_item.save(update_fields=['quantity', 'updated_at'])

                        StockMovement.objects.create(
                            business=business or inv_item.business,
                            inventory_item=inv_item,
                            transaction=tx_obj,
                            movement_type=m_type,
                            quantity=line['quantity'],
                            quantity_before=old_qty,
                            quantity_after=new_qty,
                            reason=f"Transaction #{tx_obj.id} ({tx_type})",
                            created_by=user
                        )

            # Repayment logic
            if tx_type == 'payment' and tx_obj.customer:
                pending_credits = Transaction.objects.filter(
                    business=business,
                    customer=tx_obj.customer,
                    transaction_type='credit',
                    status='pending'
                ).order_by('date', 'created_at')

                remaining_payment = float(tx_obj.amount)
                for credit_tx in pending_credits:
                    if remaining_payment <= 0:
                        break
                    credit_amt = float(credit_tx.amount)
                    if remaining_payment >= credit_amt:
                        credit_tx.status = 'settled'
                        credit_tx.save()
                        remaining_payment -= credit_amt

            return tx_obj

    def update(self, instance, validated_data):
        validated_data.pop('user', None)
        request = self.context.get('request')
        user = request.user if request else None
        business = get_user_business(user)

        with db_transaction.atomic():
            return super().update(instance, validated_data)