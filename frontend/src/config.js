// src/config.js
// Dynamic API URLs based on the environment (development vs production)

const API_BASE_URL = import.meta.env.PROD
  ? '' // In production, Vercel routes `/api` to the backend on the same domain
  : 'http://localhost:8000';

const WS_BASE_URL = import.meta.env.PROD
  ? (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host
  : 'ws://localhost:8000';

export { API_BASE_URL, WS_BASE_URL };
