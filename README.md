# Trackify V2

> A full-stack personal finance tracking application with AI-powered financial advisory, recurring expense automation, bank statement import, and rich data visualizations.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Firebase Setup](#2-firebase-setup)
  - [3. Backend Setup (Local)](#3-backend-setup-local)
  - [4. Frontend Setup (Local)](#4-frontend-setup-local)
  - [5. AI Advisor Setup (Ollama)](#5-ai-advisor-setup-ollama)
- [Environment Variables](#environment-variables)
- [Running with Docker](#running-with-docker)
- [API Reference](#api-reference)
  - [Authentication Endpoints](#authentication-endpoints)
  - [Transaction Endpoints](#transaction-endpoints)
  - [Analytics & AI Endpoints](#analytics--ai-endpoints)
  - [Recurring Expense Endpoints](#recurring-expense-endpoints)
  - [Export Endpoints](#export-endpoints)
  - [WebSocket](#websocket)
- [Frontend Pages & Routes](#frontend-pages--routes)
- [Key Components](#key-components)
- [Data Models](#data-models)
- [Deployment](#deployment)
  - [Docker Compose (Self-Hosted)](#docker-compose-self-hosted)
  - [Vercel (Cloud)](#vercel-cloud)
- [Security Notes](#security-notes)
- [Testing](#testing)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Trackify V2** is a production-ready personal finance management platform built with a **FastAPI** backend and a **React (Vite)** frontend. It allows users to:

- Register and authenticate securely (Email/Password + Google OAuth).
- Manually log income and expense transactions.
- Import bank statements directly from PDF files.
- Track and automate recurring EMI / subscription expenses.
- View rich analytics with categorized spending breakdowns.
- Get personalized financial advice powered by a local **Ollama LLM** (AI Financial Advisor).
- Export transaction history to **CSV** or **Excel**.
- Toggle between **light and dark themes**.
- See a live real-time clock via **WebSocket**.

All data is persisted in **Google Cloud Firestore**, ensuring scalability and reliability beyond a local SQLite file.

---

## Features

| Feature | Description |
|---|---|
| 🔐 **Authentication** | Email/password registration & login, Google OAuth 2.0, Forgot/Reset password flow |
| 💸 **Transaction Management** | Add, view, and delete income/expense transactions with categories and descriptions |
| 📄 **PDF Statement Import** | Parse and bulk-import transactions from bank statement PDFs |
| 🔁 **Recurring Expenses** | Schedule EMI-style recurring deductions with automatic monthly processing |
| 📊 **Analytics Dashboard** | Visual breakdowns of income vs. expenses by category (Recharts) |
| 🤖 **AI Financial Advisor** | LLM-powered advice via Ollama, supporting custom natural-language queries |
| 📤 **Export** | Download transaction history as `.csv` or `.xlsx` |
| 🌙 **Light / Dark Theme** | Fully supported theme toggle with CSS variables |
| ⏰ **Live Clock** | Real-time date/time display via WebSocket |
| 🐳 **Docker Support** | Full containerization for both frontend and backend |
| ☁️ **Vercel Deployment** | Frontend static build + Python backend serverless functions |

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Python 3.11** | Runtime |
| **FastAPI** | REST API framework |
| **Uvicorn** | ASGI server |
| **Google Cloud Firestore** | Primary database (via Firebase Admin SDK) |
| **Firebase Admin SDK** | Firestore client and service account auth |
| **bcrypt / passlib** | Password hashing |
| **python-jose** | JWT token creation and verification |
| **google-auth** | Google OAuth2 token verification |
| **PyPDF2** | PDF bank statement parsing |
| **pandas / openpyxl** | Excel export |
| **httpx** | Async HTTP client for Ollama API |
| **Pydantic** | Data validation and schema enforcement |
| **python-dotenv** | Environment variable loading |

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite 7** | Build tool and dev server |
| **React Router DOM 7** | Client-side routing |
| **Tailwind CSS 3** | Utility-first styling |
| **Framer Motion 12** | Page transition animations |
| **Recharts 3** | Financial data charts |
| **@react-oauth/google** | Google Sign-In integration |
| **lucide-react** | Icon library |
| **jwt-decode** | JWT token parsing on the client |
| **jsPDF / jspdf-autotable** | PDF export from the frontend |
| **html2canvas** | Screenshot-to-canvas for PDF |
| **three.js** | 3D visual effects (background) |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Docker / Docker Compose** | Container orchestration |
| **Nginx** | Reverse proxy and static file server |
| **Vercel** | Cloud deployment (frontend + serverless backend) |
| **Ollama** | Local LLM inference for AI Financial Advisor |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                    │
│           React 19 + Vite + Tailwind CSS                │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / WebSocket
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  Nginx Reverse Proxy                    │
│          /api/* → backend:8000                          │
│          /ws/*  → backend:8000 (WS upgrade)             │
│          /*     → React SPA (index.html)                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              FastAPI Backend (Python 3.11)              │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │  auth.py │  │transactions  │  │   ai_advisor.py   │ │
│  │          │  │    .py       │  │  (Ollama httpx)   │ │
│  └──────────┘  └──────────────┘  └───────────────────┘ │
│               ┌───────────────┐                         │
│               │  database.py  │                         │
│               │  (Firestore)  │                         │
│               └───────────────┘                         │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌─────────────────┐       ┌──────────────────────┐
│ Google Firestore│       │  Ollama LLM Server   │
│   (Cloud DB)    │       │  localhost:11434      │
└─────────────────┘       └──────────────────────┘
```

---

## Project Structure

```
TrackifyV2/
├── backend/
│   ├── main.py               # FastAPI app entry point, CORS, router registration
│   ├── auth.py               # Auth router: register, login, Google OAuth, JWT, password reset
│   ├── transactions.py       # Transactions, budgets, analytics, AI advice, exports, recurring
│   ├── ai_advisor.py         # Async Ollama LLM client, prompt builder, JSON parser
│   ├── database.py           # Firebase Admin SDK init, Firestore client dependency
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Backend container image (python:3.11-slim)
│   ├── .env                  # Firebase service account + Ollama config (NOT committed)
│   ├── .gitignore
│   ├── .dockerignore
│   ├── trackify.db           # SQLite file (legacy/dev artifact, not used in production)
│   ├── parse_test.py         # Manual PDF parsing test script
│   ├── test_auth.py          # Auth endpoint tests
│   ├── test_ai_parsing.py    # AI JSON parsing tests
│   ├── test_persistence.py   # Firestore persistence smoke test
│   ├── test_firebase_simple.py
│   ├── test_forgot_password.py
│   ├── test_reg.py
│   └── test_upload.py
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx          # React entry point
│   │   ├── App.jsx           # Router setup, animated page transitions, ThemeProvider
│   │   ├── config.js         # API_BASE_URL and WS_BASE_URL (dev vs. prod)
│   │   ├── index.css         # Global styles, CSS variables, theme tokens
│   │   ├── App.css
│   │   ├── components/
│   │   │   ├── Home.jsx           # Landing / marketing page
│   │   │   ├── Login.jsx          # Login form + Google Sign-In
│   │   │   ├── Register.jsx       # Registration form
│   │   │   ├── ForgotPassword.jsx # Forgot password flow
│   │   │   ├── ResetPassword.jsx  # Reset password with token
│   │   │   ├── Dashboard.jsx      # Main feature dashboard (tabs, charts, AI advisor)
│   │   │   ├── ThemeToggle.jsx    # Light/Dark mode toggle button
│   │   │   ├── ColorBends.jsx     # Animated gradient background (Three.js/Canvas)
│   │   │   ├── ColorBends.css
│   │   │   ├── LightPillar.jsx    # Decorative 3D light effect component
│   │   │   └── LightPillar.css
│   │   ├── contexts/
│   │   │   └── ThemeContext.jsx   # React context for theme state
│   │   └── assets/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── nginx.conf            # Nginx config for Docker: API proxy + SPA fallback
│   └── Dockerfile            # Multi-stage build: Node → Nginx
│
├── docker-compose.yml        # Orchestrates backend + frontend containers
├── vercel.json               # Vercel deployment configuration
├── package.json              # Root-level (minimal, for tooling)
└── README.md
```

---

## Prerequisites

Ensure the following are installed on your system:

- **Python 3.11+**
- **Node.js 20+** and **npm**
- **Docker & Docker Compose** (for containerized setup)
- **Git**
- A **Google Firebase** project with Firestore enabled
- **Ollama** (optional, required for the AI Advisor feature)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/TrackifyV2.git
cd TrackifyV2
```

### 2. Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project (or use an existing one).
2. Enable **Cloud Firestore** (Native mode).
3. Go to **Project Settings → Service Accounts → Generate new private key**.
4. Download the JSON key file. You will use its fields to populate the backend `.env` file.
5. In the Firebase Console, go to **Authentication → Sign-in method** and enable:
   - **Email/Password**
   - **Google** (note down the Web Client ID for the frontend)

### 3. Backend Setup (Local)

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create the .env file (see Environment Variables section below)
# Copy and fill in your Firebase credentials

# Start the development server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive API docs (Swagger UI): `http://localhost:8000/docs`

### 4. Frontend Setup (Local)

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 5. AI Advisor Setup (Ollama)

The AI Financial Advisor uses a local Ollama model. This is an **optional** feature — all other functionality works without it.

1. **Install Ollama**: Download from [https://ollama.com/](https://ollama.com/)

2. **Pull or create the model**:

   The backend defaults to a model named `financialadvisor`. You can either:

   - **Use an existing model** (e.g., `llama3`, `mistral`) and set `OLLAMA_MODEL_NAME` in your `.env`.
   - **Create a custom Modelfile** named `financialadvisor`:
     ```bash
     ollama create financialadvisor -f ./Modelfile
     ```

3. **Start Ollama**:
   ```bash
   ollama serve
   ```
   Ollama listens on `http://localhost:11434` by default.

4. **Update `.env`** (if using a different URL or model name):
   ```env
   OLLAMA_API_URL=http://localhost:11434/api/generate
   OLLAMA_MODEL_NAME=financialadvisor
   ```

> **Note**: When running in Docker, ensure the backend container can reach the host's Ollama instance. Set `OLLAMA_API_URL=http://host.docker.internal:11434/api/generate` in your `.env`.

---

## Environment Variables

Create a `backend/.env` file with the following variables. All Firebase fields come from your downloaded service account JSON key.

```env
# ── Firebase Service Account ──────────────────────────────
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com

# ── Ollama AI Advisor (Optional) ──────────────────────────
OLLAMA_API_URL=http://localhost:11434/api/generate
OLLAMA_MODEL_NAME=financialadvisor
```

> ⚠️ **Never commit your `.env` file to version control.** It is listed in `.gitignore`.

---

## Running with Docker

Docker Compose orchestrates both the **backend** and **frontend** containers with a single command.

```bash
# From the project root
docker-compose up --build
```

| Service | Container Name | Exposed Port |
|---|---|---|
| FastAPI Backend | `trackify-backend` | `8000` |
| Nginx + React Frontend | `trackify-frontend` | `80` |

- The **frontend** is served at `http://localhost:80`
- API calls from the frontend are proxied by Nginx: `http://localhost/api/*` → `http://backend:8000`
- The SQLite file `backend/trackify.db` is mounted as a volume for persistence (legacy dev artifact).

To stop the containers:
```bash
docker-compose down
```

---

## API Reference

Base URL (local): `http://localhost:8000`  
All protected endpoints require a `Bearer` token in the `Authorization` header.

### Authentication Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | Register a new user with email, password, and optional full name |
| `POST` | `/api/auth/login` | ❌ | Login with email and password, returns JWT |
| `POST` | `/api/auth/token` | ❌ | OAuth2 password flow (for Swagger UI compatibility) |
| `POST` | `/api/auth/google` | ❌ | Authenticate with a Google ID token |
| `GET` | `/api/auth/me` | ✅ | Get the currently authenticated user's profile |
| `POST` | `/api/auth/forgot-password` | ❌ | Request a password reset token (logged to console in dev) |
| `POST` | `/api/auth/reset-password` | ❌ | Reset password using a valid reset token |

**Register Request Body:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword",
  "full_name": "John Doe"
}
```

**Token Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

### Transaction Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/transactions/` | ✅ | Add a new transaction (income or expense) |
| `GET` | `/api/transactions/` | ✅ | List all transactions for the current user (sorted by date desc) |
| `DELETE` | `/api/transactions/reset` | ✅ | Delete **all** transactions and budgets for the current user |
| `POST` | `/api/transactions/budget` | ✅ | Set or update the monthly spending budget |
| `GET` | `/api/transactions/budget` | ✅ | Get the current budget |
| `POST` | `/api/transactions/upload-statement/` | ✅ | Upload a bank statement PDF to bulk-import transactions |

**Create Transaction Request Body:**
```json
{
  "amount": 1500.00,
  "type": "expense",
  "category": "Food",
  "description": "Grocery run at BigBazaar"
}
```

> `type` must be either `"income"` or `"expense"`.

**Upload Statement:**  
Send as `multipart/form-data` with the field `file` pointing to a `.pdf` file. Returns:
```json
{ "transactions_added": 42 }
```

---

### Analytics & AI Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/transactions/analytics` | ✅ | Returns income totals, expense totals, category breakdown, and rule-based advice |
| `POST` | `/api/transactions/ai-advice` | ✅ | Ask the AI Financial Advisor for personalized recommendations |

**AI Advice Request Body (optional `user_query`):**
```json
{
  "user_query": "Can I afford to buy a new laptop this month?"
}
```

**Analytics Response Schema:**
```json
{
  "total_income": 50000.00,
  "total_expenses": 32000.00,
  "expenses_by_category": {
    "Food": 8000.00,
    "Transport": 3500.00,
    "Entertainment": 2000.00
  },
  "financial_advice": [
    "Great job! You are saving 36.0% of your income...",
    "Your spending is diversified. Your top expense is 'Food' at 25.0%..."
  ],
  "ai_advisor_output": null
}
```

**AI Advice Response Schema:**
```json
{
  "summary": "Based on your spending, you can comfortably afford the laptop...",
  "key_insights": [
    { "category": "Savings", "action": "Your savings rate is healthy at 36%.", "priority": "Low" }
  ],
  "savings_tips": ["Consider setting aside ₹5,000/month in an emergency fund."],
  "risk_alerts": ["Entertainment spending increased 20% this month."]
}
```

---

### Recurring Expense Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/transactions/recurring` | ✅ | Schedule a new recurring EMI/subscription expense |
| `GET` | `/api/transactions/recurring` | ✅ | List all recurring expenses and process any overdue deductions |

**Create Recurring Expense Request Body:**
```json
{
  "amount": 3200.00,
  "category": "EMI",
  "description": "Home Loan EMI",
  "day_of_month": 5,
  "total_months": 120
}
```

> The system automatically processes overdue deductions on every `GET /transactions/` and `GET /transactions/recurring` call. Transactions are created in Firestore with an `is_recurring: true` flag.

---

### Export Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/transactions/export/csv` | ✅ | Download all transactions as a `.csv` file |
| `GET` | `/api/transactions/export/excel` | ✅ | Download all transactions as a `.xlsx` Excel file |

Files are named with the current date: `trackify_transactions_YYYYMMDD.csv`.

---

### WebSocket

| Endpoint | Description |
|---|---|
| `ws://localhost:8000/ws/clock` | Streams the current server time (12-hour format) and date every second |

**Message format:**
```json
{
  "time": "10:30:45 AM",
  "date": "Wednesday, 16 April 2026"
}
```

---

## Frontend Pages & Routes

| Route | Component | Description |
|---|---|---|
| `/` | `Home.jsx` | Landing page with app overview and call-to-action |
| `/login` | `Login.jsx` | Email/password login form + Google Sign-In button |
| `/register` | `Register.jsx` | New user registration form |
| `/forgot-password` | `ForgotPassword.jsx` | Submit email to receive a reset token |
| `/reset-password` | `ResetPassword.jsx` | Enter new password using the reset token from the URL |
| `/dashboard` | `Dashboard.jsx` | Protected main dashboard with all financial features |

All page transitions are animated with **Framer Motion** (opacity + blur fade effect).

---

## Key Components

### Dashboard (`Dashboard.jsx`)
The main application hub. Includes:
- **Live clock** via WebSocket connection
- **Transaction tab**: Add/view income and expenses, delete all data
- **Analytics tab**: Visual charts (Recharts) showing income vs. expenses and category breakdown
- **AI Advisor tab**: Interactive panel to submit natural-language queries to the LLM
- **Recurring Expenses tab**: Schedule and view EMI/subscription deductions
- **Export tab**: Download CSV and Excel reports
- **Budget management**: Set a monthly budget and view warnings

### ThemeContext (`contexts/ThemeContext.jsx`)
Provides a React context to toggle between `light` and `dark` CSS themes. The preference is stored in `localStorage`.

### ThemeToggle (`ThemeToggle.jsx`)
A floating toggle button that reads from and writes to `ThemeContext`.

### ColorBends / LightPillar
Decorative animated background components using **Three.js** and canvas-based animations for a premium visual experience on auth pages.

---

## Data Models

### Firestore Collections

#### `users`
```
{
  email: string,
  hashed_password: string | null,
  full_name: string | null,
  google_id: string | null,
  is_active: boolean,
  created_at: timestamp
}
```

#### `transactions`
```
{
  user_id: string,
  amount: number,
  type: "income" | "expense",
  category: string,
  description: string,
  date: timestamp,
  is_recurring?: boolean
}
```

#### `budgets`
```
{
  user_id: string,
  limit_amount: number
}
```

#### `recurring_expenses`
```
{
  user_id: string,
  amount: number,
  category: string,
  description: string,
  day_of_month: number,
  total_months: number,
  months_paid: number,
  next_deduction_date: timestamp,
  status: "active" | "completed",
  created_at: timestamp
}
```

---

## Deployment

### Docker Compose (Self-Hosted)

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

The `backend/trackify.db` SQLite file is mounted as a Docker volume. All real data is stored in Firestore.

Make sure your backend `.env` file is correctly populated before building. Docker Compose reads it via:
```yaml
env_file:
  - ./backend/.env
```

### Vercel (Cloud)

The `vercel.json` at the project root configures deployment:

- **Frontend**: Built as a static site from `frontend/package.json`, served from `dist/`.
- **Backend**: Python serverless functions via `@vercel/python` from `backend/main.py`.
- **Routing**: All `/api/*` requests are proxied to the Python backend.

To deploy:
```bash
npm install -g vercel
vercel --prod
```

Set all environment variables (from `backend/.env`) in the **Vercel project dashboard → Settings → Environment Variables**.

> **Important**: The WebSocket clock endpoint (`/ws/clock`) is **not supported** on Vercel's serverless platform. Consider using a long-polling fallback or a dedicated server for this feature in production.

---

## Security Notes

> ⚠️ The following items are flagged for production hardening:

1. **JWT Secret Key**: The `SECRET_KEY` in `auth.py` is currently a placeholder string. **Replace this with a strong, random secret** in production (e.g., generated via `openssl rand -hex 32`).
2. **CORS Origins**: The backend currently allows all origins (`"*"`) for development. Restrict this to your specific frontend domain in production.
3. **Password Reset Token**: The `forgot-password` endpoint returns the raw dev reset token in the response body. In production, this should be **sent via email only** and the `dev_reset_token` field must be removed from the response.
4. **`.env` file**: Must never be committed to version control. Verify your `.gitignore` includes `backend/.env`.
5. **Google Client ID**: The Google OAuth client ID is hardcoded in `auth.py`. Move this to an environment variable (`GOOGLE_CLIENT_ID`) in production.
6. **Firebase Credentials**: Use the environment variable approach (already implemented) and never commit the raw service account JSON.

---

## Testing

The `backend/` directory contains several test scripts. Run them individually using Python:

```bash
cd backend
# Activate your virtual environment first

# Test auth endpoints (register, login)
python test_auth.py

# Test AI JSON response parsing
python test_ai_parsing.py

# Test PDF upload parsing
python test_upload.py

# Test Firestore persistence
python test_persistence.py

# Test forgot-password flow
python test_forgot_password.py

# Test registration edge cases
python test_reg.py
```

All tests assume the backend server is running at `http://localhost:8000`.

---

## Known Limitations

- **AI Advisor requires Ollama**: The AI advice feature (`/api/transactions/ai-advice`) will return a 500 error if Ollama is not running or the model is unavailable.
- **PDF Parsing**: The bank statement parser is optimized for a specific PDF format (date-per-line followed by amount/balance). Other bank formats may not parse correctly.
- **WebSocket on Vercel**: The `/ws/clock` WebSocket endpoint is not compatible with Vercel's serverless function architecture.
- **No email integration**: The forgot-password flow generates a reset token but does not send emails. In development, the token is logged to the server console.
- **Budget is global**: The current budget system stores a single monthly budget limit per user, not per category.

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes, ensuring code quality and adding tests where applicable.
4. Commit your changes: `git commit -m "feat: add your feature"`
5. Push to your fork: `git push origin feature/your-feature-name`
6. Open a Pull Request against the `main` branch.

Please follow conventional commits and include relevant test updates.

---

## License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 Trackify Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
