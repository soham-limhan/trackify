<div align="center">

# 💰 Trackify

**A modern, full-stack personal finance tracker with rich visualizations, automated recurring expenses, and comprehensive reporting.**

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Vite](https://img.shields.io/badge/Vite_7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

</div>

---

## ✨ Features

### 📊 Dashboard & Analytics
- **Real-time live clock** via WebSocket connection
- **Financial summary cards** — total income, expenses, and net balance at a glance
- **Interactive charts** powered by Recharts:
  - Income vs. Expenses bar chart
  - Expense breakdown by category (donut chart)
  - Weekly spending pattern analysis
  - Top expense categories (horizontal bar)
  - Savings rate gauge (radial chart)
  - Daily income & expense trend lines
  - Cumulative net savings area chart

### 💳 Transaction Management
- Add income and expense transactions with category and description
- View recent transactions with color-coded indicators
- Budget/debit limit tracking with visual progress bar

### 🔁 Recurring Expenses (EMI)
- Set up recurring monthly expenses (e.g., Home Loan, Car EMI)
- Configure deduction day, total months, and category
- **Automatic deduction** — processes due EMIs on dashboard load
- Progress tracking with visual bars showing months paid vs. total

### 📄 Reporting & Export
- **PDF Reports** — generate downloadable PDF summaries with charts captured via `html2canvas`
- **CSV Export** — download transaction history as CSV
- **Excel Export** — download formatted `.xlsx` files with styled headers
- **Bank Statement Import** — upload and parse PDF bank statements to auto-create transactions

### 🔐 Authentication
- Email/password registration and login with bcrypt hashing
- **Google OAuth 2.0** sign-in integration
- JWT-based session management (7-day token expiry)
- Protected API routes with Bearer token authentication

### 🎨 Premium UI/UX
- Animated gradient background with glassmorphism design
- Smooth micro-animations and hover effects
- Fully responsive layout (mobile, tablet, desktop)
- Dark-themed with vibrant accent colors

---

## 🏗️ Tech Stack

| Layer        | Technology                                                                 |
|--------------|---------------------------------------------------------------------------|
| **Frontend** | React 19, Vite 7, TailwindCSS, Recharts, Lucide Icons, jsPDF, html2canvas |
| **Backend**  | Python, FastAPI, Pydantic, PyPDF2, openpyxl, pandas                        |
| **Database** | Google Cloud Firestore (Firebase Admin SDK)                               |
| **Auth**     | JWT (python-jose), bcrypt, Google OAuth 2.0                               |
| **DevOps**   | Docker, Docker Compose, Nginx                                             |

---

## 📁 Project Structure

```
TrackifyV2/
├── backend/
│   ├── main.py                 # FastAPI app entry point + WebSocket clock
│   ├── auth.py                 # Authentication routes (register, login, Google OAuth)
│   ├── transactions.py         # Transaction CRUD, budgets, recurring expenses, exports
│   ├── database.py             # Firebase Admin SDK initialization
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Backend container config
│   └── serviceAccountkey.json  # Firebase service account (not committed)
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # React Router setup
│   │   ├── App.css             # App-level styles
│   │   ├── main.jsx            # React entry point
│   │   ├── index.css           # Global styles + animated gradient
│   │   └── components/
│   │       ├── Home.jsx        # Landing page
│   │       ├── Login.jsx       # Login page (email + Google)
│   │       ├── Register.jsx    # Registration page
│   │       ├── Dashboard.jsx   # Main dashboard with all features
│   │       ├── ColorBends.jsx  # Animated color bends background effect
│   │       ├── ColorBends.css  # Color bends styles
│   │       ├── LightPillar.jsx # Light pillar visual effect
│   │       └── LightPillar.css # Light pillar styles
│   ├── package.json            # Node dependencies
│   ├── vite.config.js          # Vite configuration
│   ├── tailwind.config.js      # TailwindCSS configuration
│   ├── Dockerfile              # Frontend container config (Nginx)
│   └── nginx.conf              # Nginx reverse proxy config
├── docker-compose.yml          # Multi-container orchestration
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **Firebase Project** with Firestore enabled
- A `serviceAccountkey.json` file from your Firebase project

### 1. Clone the Repository

```bash
git clone https://github.com/soham-limhan/Trackify.git
cd Trackify
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Place your Firebase service account key
# Copy your serviceAccountkey.json into the backend/ directory

# Start the backend server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 🐳 Docker Deployment

Deploy both services with a single command:

```bash
docker-compose up --build
```

| Service    | URL                    |
|------------|------------------------|
| Frontend   | `http://localhost:80`   |
| Backend    | `http://localhost:8000` |

---

## 🔌 API Reference

### Authentication (`/api/auth`)

| Method | Endpoint    | Description                    |
|--------|-------------|--------------------------------|
| POST   | `/register` | Register with email & password |
| POST   | `/login`    | Login with email & password    |
| POST   | `/google`   | Login with Google OAuth token  |
| POST   | `/token`    | OAuth2 token endpoint          |
| GET    | `/me`       | Get current user profile       |

### Transactions (`/api/transactions`)

| Method | Endpoint       | Description                          |
|--------|----------------|--------------------------------------|
| POST   | `/`            | Create a new transaction             |
| GET    | `/`            | List all transactions (auth required)|
| GET    | `/analytics`   | Get income/expense analytics summary |
| POST   | `/budget`      | Set monthly budget limit             |
| GET    | `/budget`      | Get current budget                   |
| POST   | `/recurring`   | Create a recurring expense (EMI)     |
| GET    | `/recurring`   | List all recurring expenses          |
| POST   | `/upload-statement` | Upload & parse a PDF bank statement |
| GET    | `/export/csv`  | Export transactions as CSV           |
| GET    | `/export/excel`| Export transactions as Excel (.xlsx)  |

### WebSocket

| Endpoint    | Description                        |
|-------------|------------------------------------|
| `/ws/clock` | Real-time clock (sends every 1s)   |

---

## ⚙️ Environment & Configuration

| Variable              | Location               | Description                          |
|-----------------------|------------------------|--------------------------------------|
| `SECRET_KEY`          | `backend/auth.py`      | JWT signing secret                   |
| `GOOGLE_CLIENT_ID`    | `backend/auth.py`      | Google OAuth 2.0 Client ID           |
| `serviceAccountkey.json` | `backend/`          | Firebase Admin SDK credentials       |

> [!IMPORTANT]
> For production, move secrets to environment variables or a secrets manager. Never commit `serviceAccountkey.json` to version control.

---

## 📸 Screenshots

The dashboard features a premium glassmorphism design with animated gradients, interactive charts, and real-time data updates.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the ISC License. See the `package.json` for details.

---

<div align="center">

**Built with ❤️ by [Soham Limhan](https://github.com/soham-limhan)**

</div>

