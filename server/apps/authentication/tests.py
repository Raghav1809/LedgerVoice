from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from authentication.models import Business, BusinessMember, UserProfile
from authentication.utils import get_user_business

class AuthenticationAndTenantIsolationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_a = User.objects.create_user(username='usera', password='Password123!', email='usera@example.com')
        self.user_b = User.objects.create_user(username='userb', password='Password123!', email='userb@example.com')

        self.biz_a = get_user_business(self.user_a)
        self.biz_b = get_user_business(self.user_b)

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
