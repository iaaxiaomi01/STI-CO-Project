import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import { displayNameOf } from '../lib/profile.js'
import PageHeader from '../components/PageHeader.jsx'
import styles from './Profile.module.css'

/* TOTOONG DATA — galing sa DALAWANG pinagmulan:
     profile — ang row mo sa public.profiles (Supabase database)
               student ID, kurso, year level, role, organisasyon
     user    — ang Microsoft account mo (Supabase Auth)
               paraan ng pag-login, huling sign-in

   Ang profile ay kinopya mula sa student_records noong una
   kang nag-login (trigger na handle_new_user). */
function Profile() {
  const { user, profile, role } = useAuth()
  const roleConfig = getRoleConfig(role)

  const fullName = displayNameOf(profile, user)
  const initial = fullName.charAt(0).toUpperCase()

  const provider = user?.app_metadata?.provider ?? '—'

  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString()
    : '—'

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString()
    : '—'

  const organization = profile?.organizations
    ? [profile.organizations.name, profile.organizations.department]
        .filter(Boolean)
        .join(' — ')
    : '—'

  const DETAILS = [
    { label: 'Buong pangalan', value: fullName },
    { label: 'Student ID', value: profile?.student_id || '—' },
    { label: 'Email', value: profile?.email ?? user?.email ?? '—' },
    { label: 'Kurso', value: profile?.program || '—' },
    { label: 'Year level', value: profile?.year_level || '—' },
    { label: 'Organisasyon', value: organization },
    { label: 'Role', value: profile?.roles?.name ?? roleConfig.label },
    { label: 'Paraan ng pag-login', value: provider },
    { label: 'Huling pag-sign in', value: lastSignIn },
    { label: 'Miyembro mula', value: memberSince },
  ]

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Ang impormasyon mo sa talaan ng paaralan."
      />

      <div className={styles.card}>
        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden="true">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              initial
            )}
          </div>

          <div className={styles.identityText}>
            <p className={styles.name}>{fullName}</p>
            <p className={styles.email}>{profile?.email ?? user?.email}</p>
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
          Ang student ID, role, at organisasyon ay hawak ng SAO at IT
          Administrator. Kung may mali, makipag-ugnayan sa kanila para
          maitama sa talaan.
        </p>
      </div>
    </>
  )
}

export default Profile
