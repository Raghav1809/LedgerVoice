from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from authentication.models import Business, BusinessMember, UserProfile
from authentication.utils import get_user_business
from settings_app.models import UserSettings
from customers.models import Customer
from inventory.models import InventoryItem
from transactions.models import Transaction
from reminders.models import Reminder

class AuthenticationAndTenantIsolationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a = User.objects.create_user(username='usera', password='Password123!', email='usera@example.com')
        self.user_b = User.objects.create_user(username='userb', password='Password123!', email='userb@example.com')

        self.biz_a = get_user_business(self.user_a)
        self.biz_b = get_user_business(self.user_b)

        # Ensure onboarding is completed for both test users
        UserSettings.objects.update_or_create(user=self.user_a, defaults={'voice_onboarding_completed': True})
        UserSettings.objects.update_or_create(user=self.user_b, defaults={'voice_onboarding_completed': True})

    def test_user_registration(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'Password123!',
            'confirm_password': 'Password123!',
            'business_name': 'New Shop'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

        new_user = User.objects.get(username='newuser')
        biz = get_user_business(new_user)
        self.assertIsNotNone(biz)
        self.assertEqual(biz.name, 'New Shop')

    def test_login_success_and_failure(self):
        # Valid login
        response = self.client.post('/api/auth/login/', {
            'username': 'usera',
            'password': 'Password123!'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

        # Invalid login
        response_bad = self.client.post('/api/auth/login/', {
            'username': 'usera',
            'password': 'WrongPassword'
        })
        self.assertEqual(response_bad.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_request_rejected(self):
        response = self.client.get('/api/customers/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_business_creation_and_membership(self):
        self.assertEqual(self.biz_a.owner, self.user_a)
        self.assertEqual(self.biz_b.owner, self.user_b)
        self.assertNotEqual(self.biz_a.id, self.biz_b.id)

        membership_a = BusinessMember.objects.filter(business=self.biz_a, user=self.user_a).first()
        self.assertIsNotNone(membership_a)
        self.assertEqual(membership_a.role, 'OWNER')

    def test_independent_concurrent_tab_logins(self):
        """Simulate two tabs authenticating as different users independently."""
        # Tab 1 logs in as User A
        tab1_client = APIClient()
        res_a = tab1_client.post('/api/auth/login/', {'username': 'usera', 'password': 'Password123!'})
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)
        token_a = res_a.data['access']
        refresh_a = res_a.data['refresh']

        # Tab 2 logs in as User B
        tab2_client = APIClient()
        res_b = tab2_client.post('/api/auth/login/', {'username': 'userb', 'password': 'Password123!'})
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        token_b = res_b.data['access']
        refresh_b = res_b.data['refresh']

        # Verify tokens are distinct
        self.assertNotEqual(token_a, token_b)

        # Tab 1 makes authenticated request
        tab1_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_a}')
        res_profile_a = tab1_client.get('/api/auth/user/')
        self.assertEqual(res_profile_a.status_code, status.HTTP_200_OK)
        self.assertEqual(res_profile_a.data['username'], 'usera')

        # Tab 2 makes authenticated request
        tab2_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_b}')
        res_profile_b = tab2_client.get('/api/auth/user/')
        self.assertEqual(res_profile_b.status_code, status.HTTP_200_OK)
        self.assertEqual(res_profile_b.data['username'], 'userb')

    def test_independent_token_refresh(self):
        """Refreshing User A's token does not affect User B's active session."""
        res_a = self.client.post('/api/auth/login/', {'username': 'usera', 'password': 'Password123!'})
        res_b = self.client.post('/api/auth/login/', {'username': 'userb', 'password': 'Password123!'})

        token_a = res_a.data['access']
        refresh_a = res_a.data['refresh']
        token_b = res_b.data['access']

        # Tab 1 refreshes token
        res_refresh = self.client.post('/api/auth/token/refresh/', {'refresh': refresh_a})
        self.assertEqual(res_refresh.status_code, status.HTTP_200_OK)
        new_token_a = res_refresh.data['access']

        # New token for User A works
        client_a = APIClient()
        client_a.credentials(HTTP_AUTHORIZATION=f'Bearer {new_token_a}')
        self.assertEqual(client_a.get('/api/auth/user/').data['username'], 'usera')

        # Tab 2 token for User B is completely untouched and works
        client_b = APIClient()
        client_b.credentials(HTTP_AUTHORIZATION=f'Bearer {token_b}')
        self.assertEqual(client_b.get('/api/auth/user/').data['username'], 'userb')

    def test_independent_logout_behavior(self):
        """Simulate Tab 1 logging out (dropping credentials); Tab 2 remains logged in."""
        res_a = self.client.post('/api/auth/login/', {'username': 'usera', 'password': 'Password123!'})
        res_b = self.client.post('/api/auth/login/', {'username': 'userb', 'password': 'Password123!'})

        token_a = res_a.data['access']
        token_b = res_b.data['access']

        tab1_client = APIClient()
        tab1_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_a}')

        tab2_client = APIClient()
        tab2_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_b}')

        # Tab 1 logs out (clears its headers/sessionStorage)
        tab1_client.credentials() # No Authorization header

        # Tab 1 is now unauthenticated
        res_unauthed = tab1_client.get('/api/customers/')
        self.assertEqual(res_unauthed.status_code, status.HTTP_401_UNAUTHORIZED)

        # Tab 2 remains authenticated and can make API calls successfully
        res_authed = tab2_client.get('/api/customers/')
        self.assertEqual(res_authed.status_code, status.HTTP_200_OK)

    def test_cross_account_data_isolation_all_entities(self):
        """Ensure full isolation of customers, inventory, transactions, reminders, and analytics."""
        res_a = self.client.post('/api/auth/login/', {'username': 'usera', 'password': 'Password123!'})
        res_b = self.client.post('/api/auth/login/', {'username': 'userb', 'password': 'Password123!'})

        client_a = APIClient()
        client_a.credentials(HTTP_AUTHORIZATION=f"Bearer {res_a.data['access']}")

        client_b = APIClient()
        client_b.credentials(HTTP_AUTHORIZATION=f"Bearer {res_b.data['access']}")

        # 1. Customers
        cust_a_res = client_a.post('/api/customers/', {'name': 'Client A Customer', 'phone': '9111111111'}, format='json')
        self.assertEqual(cust_a_res.status_code, status.HTTP_201_CREATED)
        cust_a_id = cust_a_res.data['id']

        cust_b_res = client_b.post('/api/customers/', {'name': 'Client B Customer', 'phone': '9222222222'}, format='json')
        self.assertEqual(cust_b_res.status_code, status.HTTP_201_CREATED)
        cust_b_id = cust_b_res.data['id']

        # User A cannot see User B's customer
        res_get_a = client_a.get('/api/customers/')
        res_a_custs = res_get_a.data
        results_a = res_a_custs if isinstance(res_a_custs, list) else res_a_custs.get('results', [])
        self.assertTrue(any(c['id'] == cust_a_id for c in results_a))
        self.assertFalse(any(c['id'] == cust_b_id for c in results_a))

        # Direct access to User B's customer by User A returns 404
        self.assertEqual(client_a.get(f'/api/customers/{cust_b_id}/').status_code, status.HTTP_404_NOT_FOUND)

        # 2. Inventory
        inv_a_res = client_a.post('/api/inventory/', {'product_name': 'Rice 1kg', 'unit': 'kg', 'price': 50.0, 'quantity': 100}, format='json')
        self.assertEqual(inv_a_res.status_code, status.HTTP_201_CREATED)
        inv_a_id = inv_a_res.data['id']

        inv_b_res = client_b.post('/api/inventory/', {'product_name': 'Wheat 1kg', 'unit': 'kg', 'price': 40.0, 'quantity': 80}, format='json')
        self.assertEqual(inv_b_res.status_code, status.HTTP_201_CREATED)
        inv_b_id = inv_b_res.data['id']

        # User B cannot see User A's inventory item
        res_b_inv = client_b.get('/api/inventory/').data
        results_b = res_b_inv if isinstance(res_b_inv, list) else res_b_inv.get('results', [])
        self.assertTrue(any(i['id'] == inv_b_id for i in results_b))
        self.assertFalse(any(i['id'] == inv_a_id for i in results_b))
        self.assertEqual(client_b.get(f'/api/inventory/{inv_a_id}/').status_code, status.HTTP_404_NOT_FOUND)

        # 3. Transactions
        tx_a_res = client_a.post('/api/transactions/', {
            'customer': cust_a_id,
            'transaction_type': 'sales',
            'amount': 500.0,
            'date': '2026-10-15',
            'items': [{'inventory_item_id': inv_a_id, 'description': 'Rice 1kg', 'quantity': 10, 'unit_price': 50.0, 'unit': 'kg'}]
        }, format='json')
        self.assertEqual(tx_a_res.status_code, status.HTTP_201_CREATED)
        tx_a_id = tx_a_res.data['id']

        tx_b_res = client_b.post('/api/transactions/', {
            'customer': cust_b_id,
            'transaction_type': 'credit',
            'amount': 300.0,
            'date': '2026-10-15',
            'items': [{'inventory_item_id': inv_b_id, 'description': 'Wheat 1kg', 'quantity': 5, 'unit_price': 40.0, 'unit': 'kg'}]
        }, format='json')
        self.assertEqual(tx_b_res.status_code, status.HTTP_201_CREATED)
        tx_b_id = tx_b_res.data['id']

        # User A cannot see User B's transaction
        txs_a = client_a.get('/api/transactions/').data
        results_tx_a = txs_a if isinstance(txs_a, list) else txs_a.get('results', [])
        self.assertTrue(any(t['id'] == tx_a_id for t in results_tx_a))
        self.assertFalse(any(t['id'] == tx_b_id for t in results_tx_a))
        self.assertEqual(client_a.get(f'/api/transactions/{tx_b_id}/').status_code, status.HTTP_404_NOT_FOUND)

        # 4. Analytics / Insights Summary
        insights_a = client_a.get('/api/insights/summary/').data
        insights_b = client_b.get('/api/insights/summary/').data

        self.assertEqual(insights_a['total_sales'], 500.0)
        self.assertEqual(insights_a['total_credit'], 0.0)

        self.assertEqual(insights_b['total_sales'], 0.0)
        self.assertEqual(insights_b['total_credit'], 200.0)
        self.assertEqual(insights_b['pending_amount'], 200.0)

    def test_onboarding_middleware_prioritizes_jwt_bearer_token(self):
        """Middleware correctly resolves user from Bearer token even if different ambient user is present."""
        user_uncalibrated = User.objects.create_user(username='uncalibrated', password='Password123!')
        get_user_business(user_uncalibrated)
        UserSettings.objects.create(user=user_uncalibrated, voice_onboarding_completed=False)

        res_uncal = self.client.post('/api/auth/login/', {'username': 'uncalibrated', 'password': 'Password123!'})
        token_uncal = res_uncal.data['access']

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_uncal}')
        # Protected route should be blocked with 403 for uncalibrated user
        res = client.get('/api/transactions/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(res.json().get('code'), 'voice_onboarding_required')
