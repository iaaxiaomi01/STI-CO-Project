import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import { displayNameOf } from '../lib/profile.js'
import {
  Building2,
  CalendarDays,
  FileText,
  Gem,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Megaphone,
  ScanLine,
  User,
  Users,
  X,
} from 'lucide-react'
import Avatar from './Avatar.jsx'
import styles from './Sidebar.module.css'

/* Ang laman ng sidebar ay HINDI nakasulat dito — galing siya
   sa src/config/roles.js, base sa role ng naka-login.

   Kaya ibang-iba ang nakikita ng Member at ng Officer, pero
   iisa lang ang component na ito. Doon ka magdagdag ng items,
   hindi dito. */
/* Icon ng bawat page (route → icon). Kapag may bagong page na
   wala rito, ang lumang simbolo sa config/roles.js (item.icon)
   ang lalabas. */
const NAV_ICONS = {
  '/dashboard': LayoutDashboard,
  '/events': CalendarDays,
  '/announcements': Megaphone,
  '/attendance': ScanLine,
  '/members': Users,
  '/proposals': FileText,
  '/rewards': Gem,
  '/org-health': HeartPulse,
  '/org-profile': Building2,
  '/profile': User,
}

function Sidebar({ open, onClose, user, onLogout }) {
  const { role, profile } = useAuth()
  const roleConfig = getRoleConfig(role)

  /* Galing sa profiles table ang pangalan; Microsoft account
     lang kapag wala pa. */
  const displayName = displayNameOf(profile, user)

  const email = user?.email ?? ''

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
          aria-label="Close menu"
        >
          <X size={20} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      <nav className={styles.nav}>
        {roleConfig.sidebar.map((item) => {
          const Icon = NAV_ICONS[item.to]
          return (
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
              <span className={styles.icon} aria-hidden="true">
                {Icon ? <Icon size={20} /> : item.icon}
              </span>
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* Naka-push sa ilalim ng sidebar — tingnan ang margin-top:auto */}
      <div className={styles.bottom}>
        <div className={styles.userBox}>
          <Avatar
            src={profile?.avatar_url}
            name={displayName}
            size="sm"
            className={styles.avatar}
          />
          <span className={styles.userInfo}>
            <span className={styles.userName}>{displayName}</span>
            {email && <span className={styles.userEmail}>{email}</span>}
          </span>
        </div>

        <div className={styles.bottomRow}>
          {/* Ipinapakita ang role para alam agad kung bakit
              ganito ang nakikitang menu */}
          <p className={styles.roleTag}>
            {/* "President · NEXI" kapag may officer position */}
            {profile?.officer_positions?.name ?? roleConfig.label}
            {profile?.organizations?.name && ` · ${profile.organizations.name}`}
          </p>

          <button
            type="button"
            className={styles.logout}
            onClick={onLogout}
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
