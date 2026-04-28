import pytest
import time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_registration_flow():
    unique_timestamp = int(time.time())
    email = f"reguser_{unique_timestamp}@example.com"
    pwd = "password123"
    
    print(f"\n1. Initiating registration for {email}...")
    test_user = {"email": email, "password": pwd, "full_name": "Test Reg User"}
    res_reg = client.post("/api/auth/register", json=test_user)
    assert res_reg.status_code == 200, f"Registration initiate failed: {res_reg.text}"
    
    data = res_reg.json()
    otp = data.get("dev_otp")
    assert otp is not None, "FAILED: No OTP returned in dev_otp field"
        
    print("2. Verifying Registration OTP...")
    res_verify = client.post("/api/auth/verify-registration-otp", json={"email": email, "otp": otp})
    assert res_verify.status_code == 200, f"Verify OTP failed: {res_verify.text}"
    
    verify_data = res_verify.json()
    token = verify_data.get("access_token")
    assert token is not None, "FAILED: No token returned after OTP verification"
    
    print("3. Testing login with new account...")
    login_data = {"username": email, "password": pwd}
    res_login = client.post("/api/auth/token", data=login_data)
    assert res_login.status_code == 200, f"Couldn't login with new account. Response: {res_login.text}"
    assert "access_token" in res_login.json()
    
    print("SUCCESS! Registration OTP works.")
