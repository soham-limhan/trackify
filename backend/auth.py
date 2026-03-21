from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from jose import JWTError, jwt
from google.oauth2 import id_token
from google.auth.transport import requests
from google.cloud import firestore
import database

router = APIRouter()

SECRET_KEY = "dummy_secret_for_demo_replace_me_in_prod"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days
GOOGLE_CLIENT_ID = "900285102288-2h5r7cnnaa88grtibqedqs5kfitsrito.apps.googleusercontent.com"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

class User(BaseModel):
    id: str
    email: str
    hashed_password: Optional[str] = None
    full_name: Optional[str] = None
    google_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleLogin(BaseModel):
    token: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class ForgotPassword(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str
    new_password: str

def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: firestore.Client = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    users_ref = db.collection('users').where('email', '==', email).limit(1).stream()
    user_doc = next(users_ref, None)
    
    if not user_doc:
        raise credentials_exception
        
    user_data = user_doc.to_dict()
    user_data['id'] = user_doc.id
    
    # Firestore timestamps can be DatetimeWithNanoseconds, BaseModel handles datetime
    if 'created_at' not in user_data:
        user_data['created_at'] = datetime.utcnow()
        
    return User(**user_data)

@router.post("/register", response_model=Token)
def register(user: UserCreate, db: firestore.Client = Depends(database.get_db)):
    users_ref = db.collection('users').where('email', '==', user.email).limit(1).stream()
    if next(users_ref, None):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    
    new_user_data = {
        "email": user.email,
        "hashed_password": hashed_password,
        "full_name": user.full_name,
        "google_id": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    update_time, doc_ref = db.collection('users').add(new_user_data)
    
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer", "user": {"email": user.email, "name": user.full_name}}

@router.post("/login", response_model=Token)
def login(user: UserLogin, db: firestore.Client = Depends(database.get_db)):
    users_ref = db.collection('users').where('email', '==', user.email).limit(1).stream()
    db_user = next(users_ref, None)
    
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
        
    user_data = db_user.to_dict()
    
    if not user_data.get('hashed_password') or not verify_password(user.password, user_data['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": user_data['email']},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer", "user": {"email": user_data['email'], "name": user_data.get('full_name')}}

@router.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: firestore.Client = Depends(database.get_db)):
    users_ref = db.collection('users').where('email', '==', form_data.username).limit(1).stream()
    db_user = next(users_ref, None)
    
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
        
    user_data = db_user.to_dict()
    
    if not user_data.get('hashed_password') or not verify_password(form_data.password, user_data['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": user_data['email']},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer", "user": {"email": user_data['email'], "name": user_data.get('full_name')}}

@router.get("/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "email": current_user.email,
        "full_name": current_user.full_name,
        "google_id": current_user.google_id
    }

@router.post("/google", response_model=Token)
def google_login(google_login: GoogleLogin, db: firestore.Client = Depends(database.get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(google_login.token, requests.Request(), GOOGLE_CLIENT_ID)
        
        email = idinfo['email']
        name = idinfo.get('name', '')
        google_id = idinfo['sub']
        
        users_ref = db.collection('users').where('email', '==', email).limit(1).stream()
        db_user_doc = next(users_ref, None)
        
        if not db_user_doc:
            new_user_data = {
                "email": email,
                "full_name": name,
                "google_id": google_id,
                "hashed_password": None,
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            }
            update_time, doc_ref = db.collection('users').add(new_user_data)
        else:
            user_data = db_user_doc.to_dict()
            if not user_data.get('google_id'):
                db_user_doc.reference.update({
                    "google_id": google_id,
                    "full_name": name if not user_data.get('full_name') else user_data.get('full_name')
                })
            name = user_data.get('full_name', name)
            
        access_token = create_access_token(
            data={"sub": email},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {"access_token": access_token, "token_type": "bearer", "user": {"email": email, "name": name}}

    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google Token")

@router.post("/forgot-password")
def forgot_password(request: ForgotPassword, db: firestore.Client = Depends(database.get_db)):
    users_ref = db.collection('users').where('email', '==', request.email).limit(1).stream()
    user_doc = next(users_ref, None)
    
    if not user_doc:
        # We don't want to expose whether a user exists or not
        return {"message": "If that email is registered, a password reset link has been sent."}
    
    user_data = user_doc.to_dict()
    if not user_data.get('is_active', True):
        raise HTTPException(status_code=400, detail="Account is inactive")
        
    # Generate a short-lived reset token (e.g. 15 minutes)
    reset_token = create_access_token(
        data={"sub": request.email, "type": "password_reset"},
        expires_delta=timedelta(minutes=15)
    )
    
    # In a real app, send an email here with a link like:
    # https://yourfrontend.com/reset-password?token=XYZ
    print(f"Password reset token for {request.email}: {reset_token}")
    
    # Returning the token just for demo/dev purposes
    return {
        "message": "If that email is registered, a password reset link has been sent.",
        "dev_reset_token": reset_token 
    }

@router.post("/reset-password")
def reset_password(request: ResetPassword, db: firestore.Client = Depends(database.get_db)):
    try:
        payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "password_reset":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
            
    except JWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
        
    users_ref = db.collection('users').where('email', '==', email).limit(1).stream()
    user_doc = next(users_ref, None)
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
        
    hashed_password = get_password_hash(request.new_password)
    
    doc_ref = db.collection('users').document(user_doc.id)
    doc_ref.update({"hashed_password": hashed_password})
    
    return {"message": "Password has been reset successfully"}
