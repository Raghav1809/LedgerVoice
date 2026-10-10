from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from inventory.models import InventoryItem, StockMovement
from authentication.utils import get_user_business

class InventoryAndStockMovementTests(TestCase):
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
            product_name='Rice',
            unit='kg',
            price=60.0,
            quantity=50.0,
            low_stock_threshold=10.0
        )
        self.item_b = InventoryItem.objects.create(
            business=self.biz_b,
            user=self.user_b,
            product_name='Sugar',
            unit='kg',
            price=45.0,
            quantity=5.0,
            low_stock_threshold=10.0
        )

    def test_item_creation_and_stock_movement(self):
        res = self.client_a.post('/api/inventory/', {
            'product_name': 'Cooking Oil',
            'unit': 'litre',
            'price': 150.00,
            'quantity': 20.0
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        item_id = res.data['id']

        item = InventoryItem.objects.get(id=item_id)
        self.assertEqual(item.business, self.biz_a)
        self.assertEqual(item.quantity, 20.0)

        m = StockMovement.objects.filter(inventory_item=item).first()
        self.assertIsNotNone(m)
        self.assertEqual(m.movement_type, 'stock_in')
        self.assertEqual(m.quantity_after, 20.0)

    def test_stock_adjustment_api(self):
        res = self.client_a.post('/api/inventory/adjust-stock/', {
            'inventory_item_id': self.item_a.id,
            'movement_type': 'stock_out',
            'quantity': 10.0,
            'reason': 'Sales deduction'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.item_a.refresh_from_db()
        self.assertEqual(self.item_a.quantity, 40.0)

    def test_cross_business_isolation_and_oversell_rejection(self):
        # User A cannot view User B item
        res = self.client_a.get(f'/api/inventory/{self.item_b.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # User A cannot adjust User B item
        res_adj = self.client_a.post('/api/inventory/adjust-stock/', {
            'inventory_item_id': self.item_b.id,
            'movement_type': 'stock_out',
            'quantity': 1.0
        })
        self.assertEqual(res_adj.status_code, status.HTTP_404_NOT_FOUND)

    def test_legacy_browser_inventory_import(self):
        legacy_data = {
            'items': [
                {'product_name': 'Wheat Flour', 'unit': 'kg', 'price': 40.0, 'quantity': 15.0},
                {'product_name': 'Rice', 'unit': 'kg', 'price': 65.0, 'quantity': 10.0} # Updates existing Rice
            ]
        }
        res = self.client_a.post('/api/inventory/import-legacy/', legacy_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['success'])
        self.assertEqual(res.data['imported'], 1)
        self.assertEqual(res.data['updated'], 1)

        self.item_a.refresh_from_db()
        self.assertEqual(self.item_a.quantity, 60.0) # 50 + 10
