from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import InventoryItem, StockMovement
from .serializers import InventoryItemSerializer, StockMovementSerializer, StockAdjustmentSerializer
from authentication.mixins import BusinessDataIsolationMixin
from authentication.utils import get_user_business

UNIT_CONVERSIONS = {
    # Mass: base = grams
    'kg': ('mass', 1000.0),
    'g': ('mass', 1.0),
    # Volume: base = ml
    'litre': ('volume', 1000.0),
    'ml': ('volume', 1.0),
}

def convert_inventory_price(inventory_item, requested_unit):
    """
    Convert an inventory item's price to a different unit within the same family.
    Returns (converted_price_per_unit, True) if conversion is possible,
    or (original_price, False) if units are incompatible.
    """
    inv_unit = inventory_item.unit
    inv_price = float(inventory_item.price)

    if inv_unit == requested_unit:
        return inv_price, True

    inv_conv = UNIT_CONVERSIONS.get(inv_unit)
    req_conv = UNIT_CONVERSIONS.get(requested_unit)

    if inv_conv and req_conv and inv_conv[0] == req_conv[0]:
        price_per_base = inv_price / inv_conv[1]
        converted_price = price_per_base * req_conv[1]
        return round(converted_price, 2), True

    return inv_price, False


class InventoryViewSet(BusinessDataIsolationMixin, viewsets.ModelViewSet):
    """
    CRUD & Stock Management ViewSet for InventoryItem.
    All operations are scoped to the authenticated user's Business.
    """
    serializer_class = InventoryItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product_name', 'sku', 'description']
    ordering_fields = ['product_name', 'price', 'quantity', 'created_at', 'updated_at']
    ordering = ['product_name']

    def get_queryset(self):
        business = self.get_business()
        if business:
            return InventoryItem.objects.filter(business=business, is_active=True)
        return InventoryItem.objects.filter(user=self.request.user, is_active=True)

    def perform_create(self, serializer):
        with transaction.atomic():
            item = self.perform_create_with_business(serializer)
            business = item.business or self.get_business()
            # Record initial stock movement if quantity > 0
            if item.quantity and item.quantity > 0:
                StockMovement.objects.create(
                    business=business,
                    inventory_item=item,
                    movement_type='stock_in',
                    quantity=item.quantity,
                    quantity_before=0.0,
                    quantity_after=item.quantity,
                    reason='Initial inventory registration',
                    created_by=self.request.user
                )

    def perform_update(self, serializer):
        old_item = self.get_object()
        old_qty = old_item.quantity or 0.0
        with transaction.atomic():
            item = serializer.save()
            new_qty = item.quantity or 0.0
            if abs(new_qty - old_qty) > 0.001:
                business = item.business or self.get_business()
                m_type = 'stock_in' if new_qty > old_qty else 'stock_out'
                StockMovement.objects.create(
                    business=business,
                    inventory_item=item,
                    movement_type=m_type,
                    quantity=abs(new_qty - old_qty),
                    quantity_before=old_qty,
                    quantity_after=new_qty,
                    reason='Manual stock update via inventory edit',
                    created_by=self.request.user
                )

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()

    @action(detail=False, methods=['get'], url_path='lookup')
    def lookup(self, request):
        product_name = request.query_params.get('product', '').strip()
        requested_unit = request.query_params.get('unit', '').strip().lower()

        if not product_name:
            return Response({'error': 'Product name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        business = self.get_business()
        qs = InventoryItem.objects.filter(product_name__iexact=product_name, is_active=True)
        if business:
            item = qs.filter(business=business).first()
        else:
            item = qs.filter(user=request.user).first()

        if not item:
            return Response({'found': False, 'product': product_name}, status=status.HTTP_200_OK)

        data = InventoryItemSerializer(item, context={'request': request}).data
        data['found'] = True

        if requested_unit and requested_unit != item.unit:
            converted_price, success = convert_inventory_price(item, requested_unit)
            if success:
                data['converted_price'] = converted_price
                data['converted_unit'] = requested_unit
                data['conversion_applied'] = True
            else:
                data['conversion_applied'] = False

        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        items = self.get_queryset()
        low_stock_items = [item for item in items if item.is_low_stock]
        serializer = InventoryItemSerializer(low_stock_items, many=True, context={'request': request})
        return Response({
            'count': len(low_stock_items),
            'results': serializer.data
        })

    @action(detail=False, methods=['post'], url_path='adjust-stock')
    def adjust_stock(self, request):
        serializer = StockAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        business = self.get_business()
        with transaction.atomic():
            item = InventoryItem.objects.select_for_update().filter(
                id=data['inventory_item_id'],
                is_active=True
            ).first()

            if not item or (business and item.business_id != business.id):
                return Response({'error': 'Inventory item not found or unauthorized.'}, status=status.HTTP_404_NOT_FOUND)

            qty_change = data['quantity']
            m_type = data['movement_type']
            old_qty = item.quantity or 0.0

            if m_type == 'stock_in':
                new_qty = old_qty + qty_change
            elif m_type == 'stock_out':
                if old_qty < qty_change:
                    return Response({
                        'error': f"Insufficient stock. Available: {old_qty}, Requested: {qty_change}"
                    }, status=status.HTTP_400_BAD_REQUEST)
                new_qty = old_qty - qty_change
            else: # manual adjustment
                new_qty = qty_change

            item.quantity = new_qty
            item.save(update_fields=['quantity', 'updated_at'])

            movement = StockMovement.objects.create(
                business=business or item.business,
                inventory_item=item,
                movement_type=m_type,
                quantity=qty_change,
                quantity_before=old_qty,
                quantity_after=new_qty,
                reason=data.get('reason') or f"Manual stock adjustment ({m_type})",
                created_by=request.user
            )

            return Response({
                'message': 'Stock updated successfully.',
                'item': InventoryItemSerializer(item, context={'request': request}).data,
                'movement': StockMovementSerializer(movement).data
            }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='movements')
    def movements(self, request):
        business = self.get_business()
        if business:
            movements = StockMovement.objects.filter(business=business).select_related('inventory_item', 'created_by')
        else:
            movements = StockMovement.objects.filter(inventory_item__user=request.user).select_related('inventory_item', 'created_by')

        item_id = request.query_params.get('inventory_item')
        if item_id:
            movements = movements.filter(inventory_item_id=item_id)

        serializer = StockMovementSerializer(movements[:100], many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='import-legacy')
    def import_legacy(self, request):
        """
        Migrates legacy browser storage inventory items (e.g. from ledgervoice_inventory)
        safely into the authenticated user's isolated PostgreSQL business database.
        Idempotent: updates existing items by name or creates new items.
        """
        items_payload = request.data.get('items', [])
        if not isinstance(items_payload, list):
            return Response({'error': 'Invalid payload format. Expected array under "items".'}, status=status.HTTP_400_BAD_REQUEST)

        business = self.get_business()
        if not business:
            return Response({'error': 'No active business context found.'}, status=status.HTTP_400_BAD_REQUEST)

        imported_count = 0
        updated_count = 0
        failed_records = []

        with transaction.atomic():
            for idx, raw_item in enumerate(items_payload):
                try:
                    p_name = str(raw_item.get('product_name') or raw_item.get('name') or raw_item.get('product') or '').strip().title()
                    if not p_name:
                        failed_records.append({'index': idx, 'data': raw_item, 'reason': 'Missing product name'})
                        continue

                    unit = str(raw_item.get('unit') or 'pcs').strip().lower()
                    price = float(raw_item.get('price') or raw_item.get('selling_price') or 0.0)
                    qty = float(raw_item.get('quantity') or raw_item.get('qty') or 0.0)

                    if price < 0 or qty < 0:
                        failed_records.append({'index': idx, 'data': raw_item, 'reason': 'Negative price or quantity'})
                        continue

                    inv_item = InventoryItem.objects.filter(
                        business=business,
                        product_name__iexact=p_name,
                        is_active=True
                    ).first()

                    if inv_item:
                        inv_item.unit = unit
                        inv_item.price = price
                        inv_item.quantity = (inv_item.quantity or 0.0) + qty
                        inv_item.save()
                        updated_count += 1
                    else:
                        inv_item = InventoryItem.objects.create(
                            business=business,
                            user=request.user,
                            product_name=p_name,
                            unit=unit,
                            price=price,
                            quantity=qty,
                            is_active=True
                        )
                        imported_count += 1

                    if qty > 0:
                        StockMovement.objects.create(
                            business=business,
                            inventory_item=inv_item,
                            movement_type='stock_in',
                            quantity=qty,
                            quantity_before=0.0,
                            quantity_after=inv_item.quantity,
                            reason='Imported from legacy browser localStorage',
                            created_by=request.user
                        )

                except Exception as e:
                    failed_records.append({'index': idx, 'data': raw_item, 'reason': str(e)})

        return Response({
            'success': True,
            'message': f"Legacy inventory migration complete. {imported_count} imported, {updated_count} updated, {len(failed_records)} failed.",
            'total_processed': len(items_payload),
            'imported': imported_count,
            'updated': updated_count,
            'failed_count': len(failed_records),
            'failed_records': failed_records
        }, status=status.HTTP_200_OK)
