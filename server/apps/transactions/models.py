from django.db import models
from django.contrib.auth.models import User
from customers.models import Customer
from inventory.models import InventoryItem
from authentication.models import Business
from django.utils import timezone

class Transaction(models.Model):
    TRANSACTION_TYPES = (
        ('credit', 'Credit (Gave / Loaned)'),
        ('payment', 'Payment (Received / Got)'),
        ('cash_in', 'Cash In'),
        ('cash_out', 'Cash Out'),
        ('sales', 'Sales'),
        ('purchase', 'Purchase'),
        ('expense', 'Expense'),
        ('refund', 'Refund'),
    )

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('settled', 'Settled'),
    )

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='transactions', null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions', null=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    customer_name_raw = models.CharField(max_length=150, blank=True, null=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)  # Total amount
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, default='credit')
    date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    items_data = models.JSONField(blank=True, null=True, default=None)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_transactions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        c_name = self.customer.name if self.customer else (self.customer_name_raw or 'Sales')
        b_name = self.business.name if self.business else (self.user.username if self.user else 'System')
        return f"{self.transaction_type.upper()}: {self.amount} - {c_name} ({b_name} - {self.date})"

    @property
    def total_amount(self):
        return self.amount


class TransactionItem(models.Model):
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='items')
    inventory_item = models.ForeignKey(InventoryItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='transaction_items')
    description = models.CharField(max_length=255)
    quantity = models.FloatField(default=1.0)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=20, default='pcs')

    def __str__(self):
        return f"{self.description} x {self.quantity} ({self.line_total})"
