from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from customers.models import Customer
from authentication.utils import get_user_business

class CustomerDataIsolationTests(TestCase):
    def setUp(self):
        self.client_a = APIClient()
        self.user_a = User.objects.create_user(username='usera', password='Password123!')
        self.biz_a = get_user_business(self.user_a)
        self.client_a.force_authenticate(user=self.user_a)

        self.client_b = APIClient()
        self.user_b = User.objects.create_user(username='userb', password='Password123!')
        self.biz_b = get_user_business(self.user_b)
        self.client_b.force_authenticate(user=self.user_b)

        self.cust_a = Customer.objects.create(
            business=self.biz_a,
            user=self.user_a,
            name='Customer A',
            phone='9999999999'
        )
        self.cust_b = Customer.objects.create(
            business=self.biz_b,
            user=self.user_b,
            name='Customer B',
            phone='8888888888'
        )

    def test_user_a_cannot_list_user_b_customers(self):
        res = self.client_a.get('/api/customers/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results') if isinstance(res.data, dict) else res.data
        names = [c['name'] for c in results]
        self.assertIn('Customer A', names)
        self.assertNotIn('Customer B', names)

    def test_user_a_cannot_view_or_edit_user_b_customer_detail(self):
        res_get = self.client_a.get(f'/api/customers/{self.cust_b.id}/')
        self.assertEqual(res_get.status_code, status.HTTP_404_NOT_FOUND)

        res_put = self.client_a.put(f'/api/customers/{self.cust_b.id}/', {'name': 'Hacked Name'})
        self.assertEqual(res_put.status_code, status.HTTP_404_NOT_FOUND)

        self.cust_b.refresh_from_db()
        self.assertEqual(self.cust_b.name, 'Customer B')
