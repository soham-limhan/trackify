from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
from typing import Optional
import random
import bcrypt
from jose import JWTError, jwt
from google.oauth2 import id_token
from google.auth.transport import requests
from google.cloud import firestore
import database
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

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

class VerifyOTP(BaseModel):
    email: EmailStr
    otp: str

class ResetPassword(BaseModel):
    token: str
    new_password: str

def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def send_otp_email(to_email: str, otp: str, subject: str = "Trackify - Password Reset OTP", is_registration: bool = False):
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USERNAME")
    smtp_pass = os.getenv("SMTP_PASSWORD")

    if not smtp_user or not smtp_pass:
        print(f"Warning: SMTP credentials not set. Would have sent OTP {otp} to {to_email}")
        return

    msg = MIMEMultipart()
    msg['From'] = smtp_user
    msg['To'] = to_email
    msg['Subject'] = subject

    if is_registration:
        body = f"Welcome to Trackify!\n\nYour registration OTP is: {otp}\n\nThis OTP is valid for 10 minutes."
    else:
        body = f"Your password reset OTP is: {otp}\n\nThis OTP is valid for 10 minutes."
        
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        print(f"Successfully sent OTP email to {to_email}")
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP email")

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

@router.post("/register")
def register(user: UserCreate, db: firestore.Client = Depends(database.get_db)):
    users_ref = db.collection('users').where('email', '==', user.email).limit(1).stream()
    if next(users_ref, None):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    
    # Generate OTP
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    pending_user_data = {
        "email": user.email,
        "hashed_password": hashed_password,
        "full_name": user.full_name,
        "otp": otp,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Check if already in pending and delete old
    pending_ref = db.collection('pending_users').where('email', '==', user.email).stream()
    for doc in pending_ref:
        doc.reference.delete()
        
    db.collection('pending_users').add(pending_user_data)
    
    send_otp_email(user.email, otp, subject="Trackify - Registration OTP", is_registration=True)
    
    return {"message": "OTP sent to email", "dev_otp": otp}

@router.post("/verify-registration-otp", response_model=Token)
def verify_registration_otp(request: VerifyOTP, db: firestore.Client = Depends(database.get_db)):
    pending_ref = db.collection('pending_users').where('email', '==', request.email).limit(1).stream()
    pending_doc = next(pending_ref, None)
    
    if not pending_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    pending_data = pending_doc.to_dict()
    
    if datetime.now(timezone.utc) > pending_data['expires_at']:
        pending_doc.reference.delete()
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    if request.otp != pending_data['otp']:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    # Check if email is already in users (edge case)
    users_ref = db.collection('users').where('email', '==', request.email).limit(1).stream()
    if next(users_ref, None):
        pending_doc.reference.delete()
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Create the user
    new_user_data = {
        "email": pending_data['email'],
        "hashed_password": pending_data['hashed_password'],
        "full_name": pending_data['full_name'],
        "google_id": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    db.collection('users').add(new_user_data)
    pending_doc.reference.delete()
    
    access_token = create_access_token(
        data={"sub": pending_data['email']},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer", "user": {"email": pending_data['email'], "name": pending_data['full_name']}}

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
        return {"message": "If that email is registered, an OTP has been sent."}
    
    user_data = user_doc.to_dict()
    if not user_data.get('is_active', True):
        raise HTTPException(status_code=400, detail="Account is inactive")
        
    # Generate a 6-digit OTP
    otp = str(random.randint(100000, 999999))
    
    # Store OTP with a 10-minute expiration
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Update the user document with the OTP and expiration
    doc_ref = db.collection('users').document(user_doc.id)
    doc_ref.update({
        "reset_otp": otp,
        "reset_otp_expires_at": expires_at
    })
    
    # Send the email with the OTP
    send_otp_email(request.email, otp)
    
    # Returning the OTP just for demo/dev purposes
    return {
        "message": "If that email is registered, an OTP has been sent.",
        "dev_otp": otp 
    }

@router.post("/verify-otp")
def verify_otp(request: VerifyOTP, db: firestore.Client = Depends(database.get_db)):
    users_ref = db.collection('users').where('email', '==', request.email).limit(1).stream()
    user_doc = next(users_ref, None)
    
    if not user_doc:
        raise HTTPException(status_code=400, detail="Invalid OTP or email")
        
    user_data = user_doc.to_dict()
    stored_otp = user_data.get("reset_otp")
    expires_at = user_data.get("reset_otp_expires_at")
    
    if not stored_otp or not expires_at:
        raise HTTPException(status_code=400, detail="Invalid OTP or email")
        
    # Check if expired
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    # Check if matches
    if request.otp != stored_otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    # Generate a short-lived reset token (e.g. 15 minutes) for the reset password step
    reset_token = create_access_token(
        data={"sub": request.email, "type": "password_reset"},
        expires_delta=timedelta(minutes=15)
    )
    
    # Clear the OTP
    doc_ref = db.collection('users').document(user_doc.id)
    doc_ref.update({
        "reset_otp": firestore.DELETE_FIELD,
        "reset_otp_expires_at": firestore.DELETE_FIELD
    })
    
    return {
        "message": "OTP verified successfully",
        "reset_token": reset_token
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
