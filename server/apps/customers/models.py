from django.db import models
from django.contrib.auth.models import User
from django.db.models import Sum
from authentication.models import Business

class Customer(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='customers', null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='customers', null=True, blank=True)
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at', 'name']

    def __str__(self):
        b_name = self.business.name if self.business else (self.user.username if self.user else 'System')
        return f"{self.name} ({b_name})"

    @property
    def total_credit(self):
        if hasattr(self, '_total_credit'):
            return self._total_credit
        if hasattr(self, 'annotated_credit') and self.annotated_credit is not None:
            self._total_credit = float(self.annotated_credit)
            return self._total_credit
        credit_sum = self.transactions.filter(transaction_type__in=['credit', 'sales']).aggregate(total=Sum('amount'))['total'] or 0.0
        self._total_credit = float(credit_sum)
        return self._total_credit

    @property
    def total_payments(self):
        if hasattr(self, '_total_payments'):
            return self._total_payments
        if hasattr(self, 'annotated_payments') and self.annotated_payments is not None:
            self._total_payments = float(self.annotated_payments)
            return self._total_payments
        payment_sum = self.transactions.filter(transaction_type__in=['payment', 'expense']).aggregate(total=Sum('amount'))['total'] or 0.0
        self._total_payments = float(payment_sum)
        return self._total_payments

    @property
    def net_balance(self):
        # Outstanding credit owed by customer = total credit - total payments
        return round(self.total_credit - self.total_payments, 2)
