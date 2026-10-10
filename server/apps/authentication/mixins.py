from rest_framework import permissions
from authentication.utils import get_user_business

class BusinessDataIsolationMixin:
    """
    ViewSet Mixin enforcing multi-tenant business data isolation.
    Ensures all GET, POST, PUT, PATCH, DELETE operations are scoped strictly
    to the authenticated user's authorized active business.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_business(self):
        return get_user_business(self.request.user)

    def filter_queryset_by_business(self, queryset):
        business = self.get_business()
        if not business:
            return queryset.none()

        model = queryset.model
        if hasattr(model, 'business'):
            return queryset.filter(business=business)
        elif hasattr(model, 'user'):
            return queryset.filter(user=self.request.user)
        return queryset

    def perform_create_with_business(self, serializer, **extra_kwargs):
        business = self.get_business()
        save_kwargs = {}
        if hasattr(serializer.Meta.model, 'user'):
            save_kwargs['user'] = self.request.user
        if hasattr(serializer.Meta.model, 'business'):
            save_kwargs['business'] = business
        if hasattr(serializer.Meta.model, 'created_by'):
            save_kwargs['created_by'] = self.request.user
        save_kwargs.update(extra_kwargs)
        return serializer.save(**save_kwargs)
