import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext.js'
import { getRoleConfig } from '../config/roles.js'
import { displayNameOf } from '../lib/profile.js'
import {
  ACCEPTED_TYPES,
  AvatarError,
  removeAvatar,
  uploadAvatar,
} from '../lib/avatar.js'
import PageHeader from '../components/PageHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import styles from './Profile.module.css'

/* TOTOONG DATA — galing sa DALAWANG pinagmulan:
     profile — ang row mo sa public.profiles (Supabase database)
               student ID, kurso, year level, role, organisasyon
     user    — ang Microsoft account mo (Supabase Auth)
               paraan ng pag-login, huling sign-in

   Ang profile ay kinopya mula sa student_records noong una
   kang nag-login (trigger na handle_new_user).

   AVATAR: ikaw lang ang makakapagpalit ng sarili mong larawan.
   Pagkatapos mag-upload, tinatawag ang refreshProfile() para
   sabay-sabay magbago ang larawan dito, sa Sidebar at sa
   Dashboard. */
function Profile() {
  const { user, profile, role, refreshProfile } = useAuth()
  const roleConfig = getRoleConfig(role)

  const fileInputRef = useRef(null)
  const [busy, setBusy] = useState(null) // null | 'upload' | 'remove'
  const [avatarError, setAvatarError] = useState('')

  const fullName = displayNameOf(profile, user)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    /* I-reset para gumana ulit kahit parehong file ang piliin */
    e.target.value = ''
    if (!file || !profile) return

    setAvatarError('')
    setBusy('upload')
    try {
      await uploadAvatar(profile.id, file)
      await refreshProfile()
    } catch (err) {
      console.error('Hindi na-upload ang avatar:', err)
      setAvatarError(
        err instanceof AvatarError
          ? err.message
          : 'Hindi na-upload ang larawan. Subukan ulit.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove() {
    if (!profile) return
    if (!window.confirm('Alisin ang iyong profile picture?')) return

    setAvatarError('')
    setBusy('remove')
    try {
      await removeAvatar(profile.id)
      await refreshProfile()
    } catch (err) {
      console.error('Hindi naalis ang avatar:', err)
      setAvatarError('Hindi naalis ang larawan. Subukan ulit.')
    } finally {
      setBusy(null)
    }
  }

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
          <div className={styles.avatarWrap}>
            <Avatar src={profile?.avatar_url} name={fullName} size="lg" />
            {busy && <span className={styles.avatarBusy} aria-hidden="true" />}
          </div>

          <div className={styles.identityText}>
            <p className={styles.name}>{fullName}</p>
            <p className={styles.email}>{profile?.email ?? user?.email}</p>

            {profile && (
              <div className={styles.avatarActions}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  onChange={handleFileChange}
                  hidden
                />
                <button
                  type="button"
                  className={styles.avatarButton}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={Boolean(busy)}
                >
                  {busy === 'upload'
                    ? 'Ina-upload…'
                    : profile.avatar_url
                      ? 'Palitan ang larawan'
                      : 'Mag-upload ng larawan'}
                </button>

                {profile.avatar_url && (
                  <button
                    type="button"
                    className={`${styles.avatarButton} ${styles.avatarRemove}`}
                    onClick={handleRemove}
                    disabled={Boolean(busy)}
                  >
                    {busy === 'remove' ? 'Inaalis…' : 'Alisin'}
                  </button>
                )}
              </div>
            )}

            {avatarError ? (
              <p className={styles.avatarError} role="alert">
                {avatarError}
              </p>
            ) : (
              <p className={styles.avatarHint}>JPG, PNG o WEBP · hanggang 10 MB</p>
            )}
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
