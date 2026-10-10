from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, Business, BusinessMember

class BusinessSerializer(serializers.ModelSerializer):
    owner_username = serializers.ReadOnlyField(source='owner.username')

    class Meta:
        model = Business
        fields = ['id', 'name', 'phone', 'email', 'address', 'currency', 'owner_username', 'created_at', 'updated_at']

class BusinessMemberSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    email = serializers.ReadOnlyField(source='user.email')

    class Meta:
        model = BusinessMember
        fields = ['id', 'user', 'username', 'email', 'role', 'joined_at', 'is_active']

class UserProfileSerializer(serializers.ModelSerializer):
    active_business_details = BusinessSerializer(source='active_business', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['phone', 'business_name', 'currency', 'active_business_details']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True, min_length=6)
    business_name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'confirm_password', 'business_name', 'phone']

    def validate(self, data):
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({"password": "Passwords do not match."})
        if User.objects.filter(username=data.get('username')).exists():
            raise serializers.ValidationError({"username": "Username already exists."})
        return data

    def create(self, validated_data):
        b_name = validated_data.pop('business_name', '') or 'LedgerVoice Store'
        phone = validated_data.pop('phone', '')
        validated_data.pop('confirm_password')

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            password=validated_data['password']
        )
        
        # Create default Business & Membership for isolation
        biz = Business.objects.create(
            name=b_name,
            owner=user,
            phone=phone,
            email=validated_data.get('email', '')
        )
        BusinessMember.objects.create(
            business=biz,
            user=user,
            role='OWNER',
            is_active=True
        )

        UserProfile.objects.create(
            user=user,
            business_name=b_name,
            phone=phone,
            active_business=biz
        )
        return user

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value
