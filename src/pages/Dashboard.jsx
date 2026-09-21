import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import { supabase } from '../lib/supabaseClient.js'
import { displayNameOf, firstNameOf } from '../lib/profile.js'
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
  const { user, profile, role } = useAuth()
  const roleConfig = getRoleConfig(role)

  const fullName = displayNameOf(profile, user)
  const firstName = firstNameOf(profile, user)
  const initial = fullName.charAt(0).toUpperCase()

  /* TOTOONG DATA: bilang ng aktibong miyembro ng organisasyon
     mo. Galing sa function na my_org_member_count() sa Supabase.
     Kukunin lang kung may stat na key: 'memberCount' sa role
     config (Officer at Adviser). */
  const needsMemberCount = roleConfig.dashboard.stats.some(
    (stat) => stat.key === 'memberCount',
  )
  const [memberCount, setMemberCount] = useState(null)

  useEffect(() => {
    if (!needsMemberCount) return
    let active = true

    supabase.rpc('my_org_member_count').then(({ data, error }) => {
      if (!active) return
      if (error) {
        console.error('Hindi makuha ang member count:', error)
        return
      }
      setMemberCount(data)
    })

    return () => {
      active = false
    }
  }, [needsMemberCount])

  /* Ang value sa config ay default lang; papalitan kapag
     may totoong numero na. */
  function statValue(stat) {
    if (stat.key === 'memberCount') return memberCount ?? '…'
    return stat.value
  }

  return (
    <>
      <div className={styles.welcomeCard}>
        <div className={styles.avatar} aria-hidden="true">
          {initial}
        </div>

        <div className={styles.welcomeText}>
          <p className={styles.badge}>
            {roleConfig.label}
            {profile?.organizations?.name && ` · ${profile.organizations.name}`}
          </p>
          <h1 className={styles.title}>Kumusta, {firstName}!</h1>
          <p className={styles.sub}>{roleConfig.dashboard.subtitle}</p>
        </div>
      </div>

      {/* Stat tiles — nakalink sa kaukulang seksyon */}
      <div className={styles.statRow}>
        {roleConfig.dashboard.stats.map((stat) => (
          <Link key={stat.label} to={stat.to} className={styles.stat}>
            <span className={styles.statValue}>{statValue(stat)}</span>
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
