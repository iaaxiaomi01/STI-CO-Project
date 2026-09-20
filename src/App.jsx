import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.js'
import PublicLayout from './layouts/PublicLayout.jsx'
import MemberLayout from './layouts/MemberLayout.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Member from './pages/Member.jsx'

/* ============================================================
   DALAWANG MAGKAIBANG SITE SA ISANG APP

   Naka-login    → MemberLayout (sidebar, walang navbar)
   Hindi naka-login → PublicLayout (navbar at footer)

   Pansinin: ang mga route mismo ang nagbabago, hindi lang
   ang hitsura. Kapag hindi ka naka-login, LITERAL NA WALA
   ang /member sa route tree — kaya hindi mo ito mapupuntahan
   kahit i-type mo pa ang URL.

   Ito ang dahilan kung bakit hindi na natin kailangan ang
   ProtectedRoute. Ang route tree na mismo ang bantay.
   ============================================================ */
function App() {
  const { user, loading } = useAuth()

  /* Habang hinahanap pa ng Supabase ang naka-save na session.
     Kung wala ito, sandaling sisilip ang public layout bago
     bumalik sa member layout kapag nag-refresh ka. */
  if (loading) {
    return (
      <div style={{ padding: '6rem 1.25rem', textAlign: 'center' }}>
        Sinusuri ang iyong session…
      </div>
    )
  }

  return (
    <Routes>
      {user ? (
        /* ---------- NAKA-LOGIN ---------- */
        <Route element={<MemberLayout />}>
          <Route path="/member" element={<Member />} />

          {/* Dagdagan mo lang dito ng bagong member pages:
              <Route path="/profile" element={<Profile />} /> */}

          {/* Kahit anong ibang URL → dalhin sa member page */}
          <Route path="*" element={<Navigate to="/member" replace />} />
        </Route>
      ) : (
        /* ---------- HINDI NAKA-LOGIN ---------- */
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          {/* Kahit anong ibang URL → balik sa landing page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  )
}

export default App
