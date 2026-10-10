from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Reminder
from .serializers import ReminderSerializer
from authentication.mixins import BusinessDataIsolationMixin

class ReminderViewSet(BusinessDataIsolationMixin, viewsets.ModelViewSet):
    serializer_class = ReminderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'customer__name', 'notes']
    ordering_fields = ['due_date', 'created_at']
    ordering = ['due_date']

    def get_queryset(self):
        business = self.get_business()
        if business:
            queryset = Reminder.objects.filter(business=business).select_related('customer')
        else:
            queryset = Reminder.objects.filter(user=self.request.user).select_related('customer')

        category = self.request.query_params.get('category')
        today = timezone.now().date()

        if category == 'today':
            queryset = queryset.filter(due_date=today, status='pending')
        elif category == 'upcoming':
            queryset = queryset.filter(due_date__gt=today, status='pending')
        elif category == 'missed':
            queryset = queryset.filter(due_date__lt=today, status='pending')

        return queryset

    def perform_create(self, serializer):
        business = self.get_business()
        customer = serializer.validated_data.get('customer')
        amount = serializer.validated_data.get('amount')
        due_date = serializer.validated_data.get('due_date')

        existing = Reminder.objects.filter(
            business=business,
            customer=customer,
            amount=amount,
            due_date=due_date,
            status='pending'
        ).first()

        if existing:
            return

        self.perform_create_with_business(serializer)

    @action(detail=True, methods=['post'])
    def toggle_complete(self, request, pk=None):
        reminder = self.get_object()
        reminder.status = 'completed' if reminder.status != 'completed' else 'pending'
        reminder.save()
        return Response({
            'id': reminder.id,
            'status': reminder.status,
            'computed_status': reminder.current_status
        }, status=status.HTTP_200_OK)
