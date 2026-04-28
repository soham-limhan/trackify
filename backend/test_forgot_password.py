import pytest
import time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_forgot_password_flow():
    # Use a unique email based on timestamp so we can run the test repeatedly
    # without running into the "Email already registered" error
    unique_timestamp = int(time.time())
    email = f"forgotuser_{unique_timestamp}@example.com"
    pwd1 = "oldpassword"
    pwd2 = "newpassword"
    
    print(f"\n1. Registering user {email}...")
    test_user = {"email": email, "password": pwd1, "full_name": "Forgot User"}
    res_reg = client.post("/api/auth/register", json=test_user)
    assert res_reg.status_code == 200, f"Registration failed: {res_reg.text}"
    
    print("2. Requesting forgot password...")
    res_forgot = client.post("/api/auth/forgot-password", json={"email": email})
    assert res_forgot.status_code == 200, f"Forgot password failed: {res_forgot.text}"
    
    data = res_forgot.json()
    otp = data.get("dev_otp")
    assert otp is not None, "FAILED: No OTP returned in dev_otp field"
        
    print("3. Verifying OTP...")
    res_verify = client.post("/api/auth/verify-otp", json={"email": email, "otp": otp})
    assert res_verify.status_code == 200, f"Verify OTP failed: {res_verify.text}"
    
    verify_data = res_verify.json()
    token = verify_data.get("reset_token")
    assert token is not None, "FAILED: No reset token returned after OTP verification"
    
    print("4. Resetting password...")
    res_reset = client.post("/api/auth/reset-password", json={
        "token": token,
        "new_password": pwd2
    })
    assert res_reset.status_code == 200, f"Reset password failed: {res_reset.text}"
    assert res_reset.json().get("message") == "Password has been reset successfully"
    
    print("4. Testing login with NEW password...")
    login_data = {"username": email, "password": pwd2}
    res_login = client.post("/api/auth/token", data=login_data)
    assert res_login.status_code == 200, f"Couldn't login with new password. Response: {res_login.text}"
    assert "access_token" in res_login.json()
    
    print("SUCCESS! Password reset works.")
