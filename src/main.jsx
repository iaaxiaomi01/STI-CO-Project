import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

/* Ang BrowserRouter ang nagbibigay ng routing sa buong app.
   Kailangan itong nasa labas ng <App /> para gumana ang
   <Routes>, <Route>, at <Link> sa loob. */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
