import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import styles from './Dashboard.module.css'

/* PALITAN: pekeng numero muna ito.
   Kapag may database ka na, dito papasok ang totoong bilang
   mula sa Supabase. */
const STATS = [
  { label: 'Paparating na events', value: '0', to: '/events' },
  { label: 'Bagong announcements', value: '0', to: '/announcements' },
  { label: 'Attendance rate', value: '—', to: '/attendance' },
]

const QUICK_LINKS = [
  {
    to: '/events',
    icon: '◆',
    title: 'Events',
    text: 'Tingnan ang mga paparating na aktibidad at mag-sign up.',
  },
  {
    to: '/announcements',
    icon: '★',
    title: 'Announcements',
    text: 'Basahin ang pinakabagong balita mula sa organisasyon.',
  },
  {
    to: '/attendance',
    icon: '✓',
    title: 'Attendance',
    text: 'Suriin ang iyong record ng pagdalo sa mga aktibidad.',
  },
]

function Dashboard() {
  const { user } = useAuth()

  /* Saan nanggagaling ang pangalan:
     Ang Supabase ay naglalagay ng impormasyon mula sa Microsoft
     sa user_metadata. Nag-iiba ang eksaktong field depende sa
     klase ng account, kaya sunod-sunod ang hinahanap natin. */
  const fullName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    'Member'

  // Unang pangalan lang sa pagbati
  const firstName = fullName.split(' ')[0]
  const initial = fullName.charAt(0).toUpperCase()

  return (
    <>
      <div className={styles.welcomeCard}>
        <div className={styles.avatar} aria-hidden="true">
          {initial}
        </div>

        <div className={styles.welcomeText}>
          <p className={styles.badge}>Members only</p>
          <h1 className={styles.title}>Kumusta, {firstName}!</h1>
          <p className={styles.sub}>
            Narito ang mabilisang tanaw ng organisasyon.
          </p>
        </div>
      </div>

      {/* Stat tiles — nakalink sa kaukulang seksyon */}
      <div className={styles.statRow}>
        {STATS.map((stat) => (
          <Link key={stat.label} to={stat.to} className={styles.stat}>
            <span className={styles.statValue}>{stat.value}</span>
            <span className={styles.statLabel}>{stat.label}</span>
          </Link>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Mga seksyon</h2>

      <div className={styles.cardGrid}>
        {QUICK_LINKS.map((link) => (
          <Link key={link.to} to={link.to} className={styles.card}>
            <span className={styles.cardIcon} aria-hidden="true">
              {link.icon}
            </span>
            <h3 className={styles.cardTitle}>{link.title}</h3>
            <p className={styles.cardText}>{link.text}</p>
          </Link>
        ))}
      </div>
    </>
  )
}

export default Dashboard
