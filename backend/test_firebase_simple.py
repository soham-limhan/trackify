import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def test_connection():
    try:
        service_account_info = {
            "type": os.getenv("FIREBASE_TYPE", "service_account"),
            "project_id": os.getenv("FIREBASE_PROJECT_ID"),
            "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
            "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n"),
            "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
            "client_id": os.getenv("FIREBASE_CLIENT_ID"),
            "auth_uri": os.getenv("FIREBASE_AUTH_URI"),
            "token_uri": os.getenv("FIREBASE_TOKEN_URI"),
            "auth_provider_x509_cert_url": os.getenv("FIREBASE_AUTH_PROVIDER_CERT_URL"),
            "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_CERT_URL"),
            "universe_domain": os.getenv("FIREBASE_UNIVERSE_DOMAIN", "googleapis.com"),
        }

        if not service_account_info.get("project_id"):
            print("Error: FIREBASE_PROJECT_ID not set in .env file.")
            return

        cred = credentials.Certificate(service_account_info)
        firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        # List all collections to test the connection
        collections = db.collections()
        print("Successfully connected to Firestore!")
        print("Available collections:")
        for col in collections:
            print(f"- {col.id}")
            
    except Exception as e:
        print(f"Failed to connect to Firebase: {e}")

if __name__ == "__main__":
    test_connection()
