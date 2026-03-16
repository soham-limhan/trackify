import httpx
import logging

logging.basicConfig(level=logging.INFO)

def test_upload():
    # Login to get token first
    login_data = {
        "username": "test@example.com",
        "password": "password"
    }
    
    try:
        response = httpx.post("http://localhost:8000/api/auth/token", data=login_data)
        if response.status_code != 200:
            print(f"Login failed: {response.text}")
            return
            
        token = response.json()["access_token"]
        
        headers = {
            "Authorization": f"Bearer {token}"
        }
        
        # Now try to upload the PDF
        files = {'file': ('Statements.pdf', open('../Statements.pdf', 'rb'), 'application/pdf')}
        
        print("Uploading statement...")
        upload_response = httpx.post("http://localhost:8000/api/transactions/upload-statement/", headers=headers, files=files)
        
        print(f"Upload status: {upload_response.status_code}")
        print(f"Upload response: {upload_response.text}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_upload()
