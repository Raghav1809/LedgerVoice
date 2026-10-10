from django.db import transaction
from .models import Business, BusinessMember, UserProfile

def get_user_business(user):
    """
    Retrieves or creates the primary active business for the authenticated user.
    Ensures that every user always has access to their isolated Business context.
    """
    if not user or not user.is_authenticated:
        return None

    # Step 1: Ensure profile exists
    profile, _ = UserProfile.objects.get_or_create(user=user)

    # Step 2: Check if profile active_business is valid
    if profile.active_business and profile.active_business.is_active:
        # Verify active membership
        membership = BusinessMember.objects.filter(
            user=user,
            business=profile.active_business,
            is_active=True
        ).first()
        if membership:
            return profile.active_business

    # Step 3: Check if user belongs to any active business
    membership = BusinessMember.objects.filter(user=user, is_active=True, business__is_active=True).first()
    if membership:
        profile.active_business = membership.business
        profile.save(update_fields=['active_business'])
        return membership.business

    # Step 4: Create a new default business for this user
    with transaction.atomic():
        business_name = getattr(profile, 'business_name', None) or f"{user.username}'s Store"
        biz = Business.objects.create(
            name=business_name,
            owner=user,
            phone=getattr(profile, 'phone', ''),
            currency=getattr(profile, 'currency', 'INR (₹)')
        )
        BusinessMember.objects.create(
            business=biz,
            user=user,
            role='OWNER',
            is_active=True
        )
        profile.active_business = biz
        profile.save(update_fields=['active_business'])

    return biz
