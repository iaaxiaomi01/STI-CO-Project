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
import {
  Award,
  Building2,
  CalendarDays,
  Camera,
  Clock,
  GraduationCap,
  Hash,
  Layers,
  Mail,
  Shield,
  Trash2,
  User,
} from 'lucide-react'
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
/* ITSURA ("Portrait" — UI lang, walang binago sa data o aksyon):
   simpleng avatar na may manipis na dilaw na border (walang
   animation), malaking pangalan, at bawat detalye ay nasa sariling
   off-white na box na may icon. */

/* Icon ng bawat detalye (label → icon) */
const DETAIL_ICONS = {
  'Full name': User,
  'Student ID': Hash,
  Email: Mail,
  Program: GraduationCap,
  'Year level': Layers,
  Organization: Building2,
  Role: Shield,
  Position: Award,
  'Last sign-in': Clock,
  'Member since': CalendarDays,
}

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
          : 'The picture could not be uploaded. Please try again.',
      )
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove() {
    if (!profile) return
    if (!window.confirm('Remove your profile picture?')) return

    setAvatarError('')
    setBusy('remove')
    try {
      await removeAvatar(profile.id)
      await refreshProfile()
    } catch (err) {
      console.error('Hindi naalis ang avatar:', err)
      setAvatarError('The picture could not be removed. Please try again.')
    } finally {
      setBusy(null)
    }
  }

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

  /* Adviser: walang Student ID, Program at Year level
     SAO, School Head at SA: walang Student ID, Program, Year level at Organization */
  const isAdviser = profile?.role_id === 3
  const isSao = profile?.role_id === 4
  const isSchoolHead = profile?.role_id === 6
  const isSchoolAdmin = profile?.role_id === 8

  const DETAILS = [
    { label: 'Full name', value: fullName },
    ...(isAdviser || isSao || isSchoolHead || isSchoolAdmin
      ? []
      : [{ label: 'Student ID', value: profile?.student_id || '—' }]),
    { label: 'Email', value: profile?.email ?? user?.email ?? '—' },
    ...(isAdviser || isSao || isSchoolHead || isSchoolAdmin
      ? []
      : [
          { label: 'Program', value: profile?.program || '—' },
          { label: 'Year level', value: profile?.year_level || '—' },
        ]),
    ...(isSao || isSchoolHead || isSchoolAdmin
      ? []
      : [{ label: 'Organization', value: organization }]),
    { label: 'Role', value: profile?.roles?.name ?? roleConfig.label },
    /* Officer position (President, VP, atbp.) — ang Adviser ang nagbibigay */
    ...(profile?.officer_positions?.name
      ? [{ label: 'Position', value: profile.officer_positions.name }]
      : []),
    { label: 'Last sign-in', value: lastSignIn },
    { label: 'Member since', value: memberSince },
  ]

  return (
    <div className={styles.page}>
      <PageHeader title="Profile" />

      {/* ---------- PORTRAIT: avatar + pangalan ---------- */}
      <section className={styles.identity}>
        <div className={styles.avatarStage}>
          <div className={styles.avatarWrap}>
            <Avatar src={profile?.avatar_url} name={fullName} size="lg" />
            {busy && <span className={styles.avatarBusy} aria-hidden="true" />}
          </div>
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
                <Camera size={17} strokeWidth={2.3} aria-hidden="true" />
                {busy === 'upload'
                  ? 'Uploading…'
                  : profile.avatar_url
                    ? 'Change picture'
                    : 'Upload picture'}
              </button>

              {profile.avatar_url && (
                <button
                  type="button"
                  className={`${styles.avatarButton} ${styles.avatarRemove}`}
                  onClick={handleRemove}
                  disabled={Boolean(busy)}
                >
                  <Trash2 size={16} strokeWidth={2.3} aria-hidden="true" />
                  {busy === 'remove' ? 'Removing…' : 'Remove'}
                </button>
              )}
            </div>
          )}

          {avatarError ? (
            <p className={styles.avatarError} role="alert">
              {avatarError}
            </p>
          ) : (
            <p className={styles.avatarHint}>JPG, PNG or WEBP · up to 10 MB</p>
          )}
        </div>
      </section>

      {/* ---------- MGA DETALYE ---------- */}
      <dl className={styles.details}>
        {DETAILS.map((item) => {
          const Icon = DETAIL_ICONS[item.label]
          return (
            <div
              key={item.label}
              className={`${styles.detailRow} ${
                item.label === 'Position' ? styles.detailPosition : ''
              }`}
            >
              <dt className={styles.detailLabel}>
                <span className={styles.detailIcon} aria-hidden="true">
                  {Icon && <Icon size={18} strokeWidth={2.2} />}
                </span>
                {item.label}
              </dt>
              <dd className={styles.detailValue}>{item.value}</dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

export default Profile