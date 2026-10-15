from rest_framework import serializers
from .models import Customer
from authentication.utils import get_user_business

class CustomerSerializer(serializers.ModelSerializer):
    total_credit = serializers.ReadOnlyField()
    total_payments = serializers.ReadOnlyField()
    net_balance = serializers.ReadOnlyField()
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'email', 'address', 'notes', 'is_active', 'total_credit', 'total_payments', 'net_balance', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        request = self.context.get('request')
        if not request or not request.user:
            return value

        business = get_user_business(request.user)
        instance = self.instance
        qs = Customer.objects.filter(name__iexact=value, is_active=True)
        if business:
            qs = qs.filter(business=business)
        else:
            qs = qs.filter(user=request.user)

        if instance:
            qs = qs.exclude(id=instance.id)

        if qs.exists():
            raise serializers.ValidationError("A customer with this name already exists in your business.")
        return value
