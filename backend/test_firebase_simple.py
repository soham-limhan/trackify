import firebase_admin
from firebase_admin import credentials, firestore
import os

def test_connection():
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        key_path = os.path.join(base_dir, "serviceAccountkey.json")
        
        if not os.path.exists(key_path):
            print(f"Error: {key_path} not found.")
            return

        cred = credentials.Certificate(key_path)
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
