import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import auth
import transactions
import asyncio
import datetime

app = FastAPI(title="Trackify API")

# Configure CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "https://trackify-puce.vercel.app/","https://subscribe-winds-sofa-slight.trycloudflare.com/","*"], # More permissive for debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Trackify API"}

@app.websocket("/ws/clock")
async def clock_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            now = datetime.datetime.now()
            time_str = now.strftime("%I:%M:%S %p")  # 12-hour format
            date_str = now.strftime("%A, %d %B %Y")
            await websocket.send_json({"time": time_str, "date": date_str})
            await asyncio.sleep(1)
    except Exception:
        pass
