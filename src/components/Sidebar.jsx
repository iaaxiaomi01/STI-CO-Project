import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

/* PALITAN: mga link sa sidebar.

   Lahat ng ito ay may totoong page at totoong <Route> na sa
   App.jsx. Kapag magdadagdag ka ng bago:
     1. gumawa ng page sa src/pages/
     2. idagdag ang <Route> sa App.jsx
     3. idagdag ang item dito

   Kung may page na wala pa, lagyan mo ng "disabled: true" at
   magiging kulay-abo ito na may "soon" badge. */
const SIDEBAR_LINKS = [
  { label: 'Dashboard', to: '/dashboard', icon: '■' },
  { label: 'Events', to: '/events', icon: '◆' },
  { label: 'Announcements', to: '/announcements', icon: '★' },
  { label: 'Attendance', to: '/attendance', icon: '✓' },
  { label: 'Profile', to: '/profile', icon: '●' },
]

function Sidebar({ open, onClose, user, onLogout }) {
  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    'Member'

  const email = user?.email ?? ''
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
      <div className={styles.top}>
        {/* PALITAN: logo / pangalan ng site */}
        <p className={styles.brand}>
          STI<span className={styles.brandAccent}>-CO</span>
        </p>

        {/* Close button — sa mobile lang lalabas */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Isara ang menu"
        >
          ✕
        </button>
      </div>

      <nav className={styles.nav}>
        {SIDEBAR_LINKS.map((link) =>
          link.disabled ? (
            /* Wala pang page — hindi pa pindutin */
            <span key={link.label} className={styles.navItemDisabled}>
              <span className={styles.icon}>{link.icon}</span>
              {link.label}
              <span className={styles.soon}>soon</span>
            </span>
          ) : (
            /* Ang NavLink ay parang Link, pero alam niya kung
               siya ang kasalukuyang page. Ang className ay
               pwedeng maging function na tumatanggap ng
               { isActive } — dito nanggagaling ang highlight. */
            <NavLink
              key={link.label}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.icon}>{link.icon}</span>
              {link.label}
            </NavLink>
          ),
        )}
      </nav>

      {/* Naka-push sa ilalim ng sidebar — tingnan ang margin-top:auto */}
      <div className={styles.bottom}>
        <div className={styles.userBox}>
          <span className={styles.avatar} aria-hidden="true">
            {initial}
          </span>
          <span className={styles.userInfo}>
            <span className={styles.userName}>{displayName}</span>
            {email && <span className={styles.userEmail}>{email}</span>}
          </span>
        </div>

        <button type="button" className={styles.logout} onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
