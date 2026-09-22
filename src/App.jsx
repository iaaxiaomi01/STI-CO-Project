import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.js'
import { getRoleConfig } from './config/roles.js'
import PublicLayout from './layouts/PublicLayout.jsx'
import MemberLayout from './layouts/MemberLayout.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Events from './pages/Events.jsx'
import Announcements from './pages/Announcements.jsx'
import Attendance from './pages/Attendance.jsx'
import Members from './pages/Members.jsx'
import Proposals from './pages/Proposals.jsx'
import Profile from './pages/Profile.jsx'
import AccessDenied from './pages/AccessDenied.jsx'

/* ============================================================
   REHISTRO NG PAGES

   Tinutugma nito ang URL sa component. Ang config/roles.js ang
   nagsasabi kung ALIN sa mga ito ang nakikita ng bawat role.

   Kapag magdadagdag ka ng page: irehistro dito, tapos idagdag
   sa sidebar ng mga role na dapat makakita nito.
   ============================================================ */
const PAGE_COMPONENTS = {
  '/dashboard': Dashboard,
  '/events': Events,
  '/announcements': Announcements,
  '/attendance': Attendance,
  '/members': Members,
  '/proposals': Proposals,
  '/profile': Profile,
}

/* ============================================================
   DALAWANG MAGKAIBANG SITE SA ISANG APP

   Naka-login       → MemberLayout (sidebar, walang navbar)
   Hindi naka-login → PublicLayout (navbar at footer)

   At sa loob ng naka-login, ang MGA ROUTE MISMO ay galing sa
   role. Kung walang Members sa sidebar ng Member, wala rin
   siyang route para doon — kaya kahit i-type niya ang
   /members, ibabalik siya sa dashboard.
   ============================================================ */
function App() {
  const { user, role, loading, accessDenied, profileError } = useAuth()

  /* Habang hinahanap pa ng Supabase ang naka-save na session
     at kinukuha ang profile mula sa database.
     Kung wala ito, sandaling sisilip ang public layout bago
     bumalik sa member layout kapag nag-refresh ka. */
  if (loading) {
    return (
      <div style={{ padding: '6rem 1.25rem', textAlign: 'center' }}>
        Sinusuri ang iyong session…
      </div>
    )
  }

  /* Naka-login sa Microsoft pero walang aktibong profile sa
     database (wala sa student_records, deactivated, o may error
     sa pagkuha). Hindi siya papasok sa member pages. */
  if (user && (accessDenied || profileError)) {
    return (
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/access-denied" element={<AccessDenied />} />
          <Route path="*" element={<Navigate to="/access-denied" replace />} />
        </Route>
      </Routes>
    )
  }

  const roleConfig = getRoleConfig(role)

  return (
    <Routes>
      {user ? (
        /* ---------- NAKA-LOGIN ---------- */
        <Route element={<MemberLayout />}>
          {roleConfig.sidebar.map((item) => {
            const PageComponent = PAGE_COMPONENTS[item.to]

            /* Kung may item sa sidebar na walang naka-rehistrong
               page, laktawan imbes na mag-crash. */
            if (!PageComponent) return null

            return (
              <Route key={item.to} path={item.to} element={<PageComponent />} />
            )
          })}

          {/* Kahit anong ibang URL — kasama ang mga page na bawal
              sa role na ito — balik sa dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      ) : (
        /* ---------- HINDI NAKA-LOGIN ---------- */
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  )
}

export default App
