import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os

# Initialize Firebase Admin
try:
    # Resolve the absolute path of the directory containing this script
    base_dir = os.path.dirname(os.path.abspath(__file__))
    key_path = os.path.join(base_dir, "serviceAccountkey.json")
    
    # Check if a specific service account key file exists
    if os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
    else:
        # Fallback to application default credentials
        firebase_admin.initialize_app()
except ValueError:
    # App already initialized (e.g., in hot-reloading)
    pass

# Initialize Firestore client
db_client = firestore.client()

# Dependency
def get_db():
    return db_client
