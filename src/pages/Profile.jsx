import { useAuth } from '../context/AuthContext.js'
import PageHeader from '../components/PageHeader.jsx'
import styles from './Profile.module.css'

/* Hindi ito placeholder — totoong data ito.
   Lahat ng nasa page na ito ay galing sa Microsoft account
   mo, dumaan sa Supabase. Walang hardcoded dito. */
function Profile() {
  const { user } = useAuth()

  const fullName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    'Member'

  const initial = fullName.charAt(0).toUpperCase()

  /* Ang provider ay kung saan galing ang account — 'azure'
     para sa Microsoft. Kapag nagdagdag ka ng ibang paraan ng
     pag-login mamaya, dito mo makikita ang pinagkaiba. */
  const provider = user?.app_metadata?.provider ?? '—'

  /* Ang toLocaleString() ang nagpapalit ng petsa sa hugis na
     nakasanayan ng user, base sa setting ng browser niya. */
  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString()
    : '—'

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString()
    : '—'

  const DETAILS = [
    { label: 'Buong pangalan', value: fullName },
    { label: 'Email', value: user?.email ?? '—' },
    { label: 'Paraan ng pag-login', value: provider },
    { label: 'Huling pag-sign in', value: lastSignIn },
    { label: 'Miyembro mula', value: memberSince },
  ]

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Ang impormasyong ibinigay ng iyong Microsoft account."
      />

      <div className={styles.card}>
        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden="true">
            {initial}
          </div>

          <div className={styles.identityText}>
            <p className={styles.name}>{fullName}</p>
            <p className={styles.email}>{user?.email}</p>
          </div>
        </div>

        <dl className={styles.details}>
          {DETAILS.map((item) => (
            <div key={item.label} className={styles.detailRow}>
              <dt className={styles.detailLabel}>{item.label}</dt>
              <dd className={styles.detailValue}>{item.value}</dd>
            </div>
          ))}
        </dl>

        <p className={styles.note}>
          Ang impormasyong ito ay hawak ng Microsoft, hindi ng site
          na ito. Para palitan ang pangalan o email, sa account
          settings ng Microsoft mo ito gagawin.
        </p>
      </div>
    </>
  )
}

export default Profile
