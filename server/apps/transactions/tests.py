from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from inventory.models import InventoryItem
from transactions.models import Transaction, TransactionItem
from authentication.utils import get_user_business

class TransactionIntegrityAndIsolationTests(TestCase):
    def setUp(self):
        self.client_a = APIClient()
        self.user_a = User.objects.create_user(username='usera', password='Password123!')
        self.biz_a = get_user_business(self.user_a)
        self.client_a.force_authenticate(user=self.user_a)

        self.client_b = APIClient()
        self.user_b = User.objects.create_user(username='userb', password='Password123!')
        self.biz_b = get_user_business(self.user_b)
        self.client_b.force_authenticate(user=self.user_b)

        self.item_a = InventoryItem.objects.create(
            business=self.biz_a,
            user=self.user_a,
            product_name='Salt',
            unit='kg',
            price=20.0,
            quantity=100.0
        )
        self.item_b = InventoryItem.objects.create(
            business=self.biz_b,
            user=self.user_b,
            product_name='Pepper',
            unit='kg',
            price=100.0,
            quantity=50.0
        )

    def test_backend_calculated_totals_and_stock_deduction(self):
        tx_data = {
            'transaction_type': 'sales',
            'status': 'completed',
            'items': [
                {'inventory_item_id': self.item_a.id, 'description': 'Salt', 'quantity': 5.0, 'unit_price': 20.0, 'unit': 'kg'}
            ]
        }
        res = self.client_a.post('/api/transactions/', tx_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(float(res.data['amount']), 100.0) # 5 * 20

        self.item_a.refresh_from_db()
        self.assertEqual(self.item_a.quantity, 95.0) # 100 - 5

    def test_user_a_cannot_use_user_b_inventory_item(self):
        tx_data = {
            'transaction_type': 'sales',
            'status': 'completed',
            'items': [
                {'inventory_item_id': self.item_b.id, 'description': 'Pepper', 'quantity': 2.0, 'unit_price': 100.0, 'unit': 'kg'}
            ]
        }
        res = self.client_a.post('/api/transactions/', tx_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancellation_reverses_stock(self):
        tx_data = {
            'transaction_type': 'sales',
            'status': 'completed',
            'items': [
                {'inventory_item_id': self.item_a.id, 'description': 'Salt', 'quantity': 10.0, 'unit_price': 20.0, 'unit': 'kg'}
            ]
        }
        res_create = self.client_a.post('/api/transactions/', tx_data, format='json')
        tx_id = res_create.data['id']

        self.item_a.refresh_from_db()
        self.assertEqual(self.item_a.quantity, 90.0)

        # Cancel transaction
        res_cancel = self.client_a.post(f'/api/transactions/{tx_id}/cancel/')
        self.assertEqual(res_cancel.status_code, status.HTTP_200_OK)

        self.item_a.refresh_from_db()
        self.assertEqual(self.item_a.quantity, 100.0) # Stock reversed
