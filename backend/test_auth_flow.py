import os
import sys
import django
import time

sys.stdout.reconfigure(encoding='utf-8')

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'voicekhata_backend.settings')
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth.models import User

client = APIClient()

uname = f"testuser_{int(time.time())}"

print(f"--- Step 1: Register New User ({uname}) ---")
reg_data = {
    "username": uname,
    "password": "password123",
    "confirm_password": "password123",
    "email": f"{uname}@example.com",
    "first_name": "Test",
    "last_name": "User",
    "business_name": "Test Store",
    "phone": "9876543210"
}
res = client.post('/api/auth/register/', reg_data, format='json')
print(f"Register status: {res.status_code}")
print(f"Register response: {res.json()}")

token = res.json().get('access')

print("\n--- Step 2: Check Database for User ---")
user_exists = User.objects.filter(username=uname).exists()
print(f"User exists in database: {user_exists}")

print("\n--- Step 3: Fetch Profile with JWT Bearer Token ---")
client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
res_profile = client.get('/api/auth/user/')
print(f"Profile status: {res_profile.status_code}")
print(f"Profile response: {res_profile.json()}")

print("\n--- Step 4: Create Customer with JWT Bearer Token ---")
cust_data = {"name": "Customer One", "phone": "9998887770"}
res_cust = client.post('/api/customers/', cust_data, format='json')
print(f"Customer create status: {res_cust.status_code}")
print(f"Customer response: {res_cust.json()}")

print("\n--- Step 5: Unauthenticated request to /api/customers/ ---")
client_unauth = APIClient()
res_unauth = client_unauth.get('/api/customers/')
print(f"Unauth GET status: {res_unauth.status_code}")
print(f"Unauth customers count: {len(res_unauth.json())}")

print("\n--- Step 6: Cleanup test user ---")
User.objects.filter(username__startswith="testuser_").delete()
User.objects.filter(username="newtestuser100").delete()
print("Cleaned up.")
