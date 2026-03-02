import requests

print("Testing Trackify JWT Auth")

# 1. Register a test user
test_user = {"email": "testjwt@example.com", "password": "password123", "full_name": "Test JWT User"}
res_reg = requests.post("http://localhost:8000/api/auth/register", json=test_user)
print("Register:", res_reg.status_code, res_reg.text)

# 2. Login to get token
login_data = {"username": "testjwt@example.com", "password": "password123"}
res_login = requests.post("http://localhost:8000/api/auth/token", data=login_data)
print("Login (/token):", res_login.status_code)

if res_login.status_code == 200:
    token = res_login.json().get("access_token")
    print("Got Token:", token[:20], "...")
    
    # 3. Test /me endpoint with token
    headers = {"Authorization": f"Bearer {token}"}
    res_me = requests.get("http://localhost:8000/api/auth/me", headers=headers)
    print("Me (/me):", res_me.status_code, res_me.json())
else:
    print("Failed to get token", res_login.text)
