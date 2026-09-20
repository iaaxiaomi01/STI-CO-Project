import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AuthProvider from './context/AuthProvider.jsx'
import './index.css'
import App from './App.jsx'

/* Ang AuthProvider ang nagbibigay ng login state sa buong app.
   Nasa labas siya ng BrowserRouter para magamit ng kahit
   anong page ang useAuth(). */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
