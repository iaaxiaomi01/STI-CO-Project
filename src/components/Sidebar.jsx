import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import styles from './Sidebar.module.css'

/* Ang laman ng sidebar ay HINDI nakasulat dito — galing siya
   sa src/config/roles.js, base sa role ng naka-login.

   Kaya ibang-iba ang nakikita ng Member at ng Officer, pero
   iisa lang ang component na ito. Doon ka magdagdag ng items,
   hindi dito. */
function Sidebar({ open, onClose, user, onLogout }) {
  const { role } = useAuth()
  const roleConfig = getRoleConfig(role)

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
        {roleConfig.sidebar.map((item) => (
          /* Ang NavLink ay parang Link, pero alam niya kung
             siya ang kasalukuyang page. Ang className ay
             pwedeng maging function na tumatanggap ng
             { isActive } — dito nanggagaling ang highlight. */
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
          >
            <span className={styles.icon}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
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

        {/* Ipinapakita ang role para alam agad kung bakit
            ganito ang nakikitang menu */}
        <p className={styles.roleTag}>{roleConfig.label}</p>

        <button type="button" className={styles.logout} onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
