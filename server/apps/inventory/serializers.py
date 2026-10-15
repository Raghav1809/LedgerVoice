from rest_framework import serializers
from .models import InventoryItem, StockMovement
from authentication.utils import get_user_business

class InventoryItemSerializer(serializers.ModelSerializer):
    quantity = serializers.FloatField(required=False, default=0.0, allow_null=True)
    purchase_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0.00)
    selling_price = serializers.DecimalField(source='price', max_digits=12, decimal_places=2, required=False)
    is_low_stock = serializers.ReadOnlyField()
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = InventoryItem
        fields = [
            'id', 'product_name', 'sku', 'description', 'unit',
            'purchase_price', 'price', 'selling_price', 'quantity',
            'low_stock_threshold', 'is_active', 'is_low_stock',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_product_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Product name cannot be empty.")
        return value.strip().title()

    def validate_price(self, value):
        if value is None or value < 0:
            raise serializers.ValidationError("Price cannot be negative.")
        return value

    def validate_purchase_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Purchase price cannot be negative.")
        return value

    def validate_quantity(self, value):
        if value is None:
            return 0.0
        if value < 0:
            raise serializers.ValidationError("Quantity cannot be negative.")
        return value

    def validate_unit(self, value):
        valid_units = [choice[0] for choice in InventoryItem.UNIT_CHOICES]
        if value not in valid_units:
            raise serializers.ValidationError(
                f"Invalid unit '{value}'. Must be one of: {', '.join(valid_units)}"
            )
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        if not request or not request.user:
            return attrs

        product_name = attrs.get('product_name', getattr(self.instance, 'product_name', '')).strip().title()
        business = get_user_business(request.user)

        qs = InventoryItem.objects.filter(product_name__iexact=product_name, is_active=True)
        if business:
            qs = qs.filter(business=business)
        else:
            qs = qs.filter(user=request.user)

        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError({
                'product_name': f"Product '{product_name}' already exists in your inventory."
            })

        return attrs


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='inventory_item.product_name')
    unit = serializers.ReadOnlyField(source='inventory_item.unit')
    created_by_username = serializers.ReadOnlyField(source='created_by.username')

    class Meta:
        model = StockMovement
        fields = [
            'id', 'inventory_item', 'product_name', 'unit', 'transaction',
            'movement_type', 'quantity', 'quantity_before', 'quantity_after',
            'reason', 'created_by_username', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class StockAdjustmentSerializer(serializers.Serializer):
    inventory_item_id = serializers.IntegerField()
    movement_type = serializers.ChoiceField(choices=['stock_in', 'stock_out', 'adjustment'])
    quantity = serializers.FloatField()
    reason = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Adjustment quantity must be greater than zero.")
        return value
