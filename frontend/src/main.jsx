import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'

const clientId = "YOUR_GOOGLE_CLIENT_ID_HERE";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={"900285102288-2h5r7cnnaa88grtibqedqs5kfitsrito.apps.googleusercontent.com"}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
