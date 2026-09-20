import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import styles from './Dashboard.module.css'

/* ISANG Dashboard component, MARAMING magkaibang itsura.

   Ang laman ay galing sa src/config/roles.js, base sa role ng
   naka-login. Kaya hindi natin kailangan ng MemberDashboard.jsx
   at OfficerDashboard.jsx — pare-pareho lang ang hugis, ang
   teksto at numero ang nagkakaiba.

   KAILAN DAPAT HIWALAYAN:
   Kapag ang isang role ay nangailangan ng ibang-ibang LAYOUT —
   hindi lang ibang teksto. Habang teksto at numero lang ang
   pinagkaiba, config lang ang kailangan. */
function Dashboard() {
  const { user, role } = useAuth()
  const roleConfig = getRoleConfig(role)

  const fullName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    'Member'

  const firstName = fullName.split(' ')[0]
  const initial = fullName.charAt(0).toUpperCase()

  return (
    <>
      <div className={styles.welcomeCard}>
        <div className={styles.avatar} aria-hidden="true">
          {initial}
        </div>

        <div className={styles.welcomeText}>
          <p className={styles.badge}>{roleConfig.label}</p>
          <h1 className={styles.title}>Kumusta, {firstName}!</h1>
          <p className={styles.sub}>{roleConfig.dashboard.subtitle}</p>
        </div>
      </div>

      {/* Stat tiles — nakalink sa kaukulang seksyon */}
      <div className={styles.statRow}>
        {roleConfig.dashboard.stats.map((stat) => (
          <Link key={stat.label} to={stat.to} className={styles.stat}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </Link>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Mga seksyon</h2>

      <div className={styles.cardGrid}>
        {roleConfig.dashboard.cards.map((card) => (
          <Link key={card.to} to={card.to} className={styles.card}>
            <span className={styles.cardIcon} aria-hidden="true">
              {card.icon}
            </span>
            <h3 className={styles.cardTitle}>{card.title}</h3>
            <p className={styles.cardText}>{card.text}</p>
          </Link>
        ))}
      </div>
    </>
  )
}

export default Dashboard
