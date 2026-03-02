from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models
import auth
import transactions

# Create the database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Trackify API")

# Configure CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], # Vite default
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(transactions.router, prefix="/api", tags=["transactions"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Trackify API"}
