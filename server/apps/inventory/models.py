from django.db import models
from django.contrib.auth.models import User
from authentication.models import Business

class InventoryItem(models.Model):
    """
    Stores a business's product, price, and stock inventory catalog.
    """
    UNIT_CHOICES = (
        ('kg', 'Kilogram'),
        ('g', 'Gram'),
        ('litre', 'Litre'),
        ('ml', 'Millilitre'),
        ('pcs', 'Piece'),
        ('dozen', 'Dozen'),
        ('packet', 'Packet'),
        ('box', 'Box'),
        ('bottle', 'Bottle'),
        ('bag', 'Bag'),
        ('bundle', 'Bundle'),
        ('mtr', 'Metre'),
        ('ft', 'Feet'),
    )

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='inventory_items', null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='inventory_items', null=True, blank=True)
    product_name = models.CharField(max_length=150)
    sku = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='pcs')
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    price = models.DecimalField(max_digits=12, decimal_places=2)  # Selling price
    quantity = models.FloatField(default=0.0, null=True, blank=True)  # Current stock quantity
    low_stock_threshold = models.FloatField(default=5.0, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['product_name']

    def __str__(self):
        b_name = self.business.name if self.business else (self.user.username if self.user else 'System')
        return f"{self.product_name} - Rs.{self.price}/{self.unit} ({b_name})"

    def save(self, *args, **kwargs):
        if self.product_name:
            self.product_name = self.product_name.strip().title()
        super().save(*args, **kwargs)

    @property
    def selling_price(self):
        return self.price

    @property
    def is_low_stock(self):
        if self.quantity is None:
            return False
        threshold = self.low_stock_threshold if self.low_stock_threshold is not None else 5.0
        return self.quantity <= threshold


class StockMovement(models.Model):
    MOVEMENT_TYPES = (
        ('stock_in', 'Stock Received'),
        ('stock_out', 'Stock Issued / Sale'),
        ('return', 'Customer Return'),
        ('adjustment', 'Stock Adjustment'),
    )

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='stock_movements')
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='stock_movements')
    transaction = models.ForeignKey('transactions.Transaction', on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity = models.FloatField()
    quantity_before = models.FloatField()
    quantity_after = models.FloatField()
    reason = models.CharField(max_length=255, blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.movement_type.upper()} ({self.quantity}) - {self.inventory_item.product_name} at {self.created_at}"
