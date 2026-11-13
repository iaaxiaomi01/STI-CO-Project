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
  Shield,
  Trash2,
} from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
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
/* ITSURA ("Floating card" — UI lang, walang binago sa data o aksyon):
   makulay na navy na backdrop na may dilaw na tuldok-tuldok, at sa
   gitna ay puting card na nakalutang. Nakausli sa itaas ng card ang
   avatar na may dilaw na singsing.
     Itaas ng card — avatar na may camera button sa gilid (parang sa
                     Facebook), pangalan, email, Role at Position
                     (bilang chips), hint at Remove
     Ibaba ng card — ang iba pang detalye; may sariling kulay ang
                     icon ng bawat isa
   Isang beses lang lumalabas ang bawat detalye (wala nang ulit). */

/* Icon at kulay ng bawat detalye sa listahan (label → icon/kulay) */
const DETAIL_ICONS = {
  'Student ID': Hash,
  Program: GraduationCap,
  'Year level': Layers,
  Organization: Building2,
  'Last sign-in': Clock,
  'Member since': CalendarDays,
}

const DETAIL_TONES = {
  'Student ID': 'toneNavy',
  Program: 'toneBlue',
  'Year level': 'toneViolet',
  Organization: 'toneAmber',
  'Last sign-in': 'tonePink',
  'Member since': 'toneGreen',
}

/* Nasa itaas na ng card ang mga ito — hindi na inuulit sa listahan */
const SHOWN_ON_TOP = new Set(['Full name', 'Email', 'Role', 'Position'])

function Profile() {
  const { user, profile, role, refreshProfile } = useAuth()
  const roleConfig = getRoleConfig(role)

  const fileInputRef = useRef(null)
  const [busy, setBusy] = useState(null) // null | 'upload' | 'remove'
  const [avatarError, setAvatarError] = useState('')
  /* true habang bukas ang "Remove your profile picture?" na dialog */
  const [confirmingRemove, setConfirmingRemove] = useState(false)

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

  /* Tinatawag ng ConfirmDialog pagkapindot ng "Remove"
     (kapalit ng window.confirm() ng browser). Sarado ang dialog
     pagkatapos; kapag pumalya, sa ilalim ng pangalan ang error. */
  async function handleRemove() {
    if (!profile) return

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
    ? new Date(user.last_sign_in_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
    : '—'

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })
    : '—'

  /* Pangalan lang ng org ang ipinapakita — inalis na ang department */
  const organization = profile?.organizations?.name || '—'

  /* Adviser: walang Student ID at Year level (may Program na)
     SAO, School Head at SA: walang Student ID, Program, Year level at Organization */
  const isAdviser = profile?.role_id === 3
  const isSao = profile?.role_id === 4
  const isSchoolHead = profile?.role_id === 6
  const isSchoolAdmin = profile?.role_id === 8

  const email = profile?.email ?? user?.email ?? '—'
  const roleName = profile?.roles?.name ?? roleConfig.label
  const positionName = profile?.officer_positions?.name || ''

  const DETAILS = [
    { label: 'Full name', value: fullName },
    ...(isAdviser || isSao || isSchoolHead || isSchoolAdmin
      ? []
      : [{ label: 'Student ID', value: profile?.student_id || '—' }]),
    { label: 'Email', value: email },
    /* Program: Member, Officer at Adviser */
    ...(isSao || isSchoolHead || isSchoolAdmin
      ? []
      : [{ label: 'Program', value: profile?.program || '—' }]),
    /* Year level: Member at Officer lang */
    ...(isAdviser || isSao || isSchoolHead || isSchoolAdmin
      ? []
      : [{ label: 'Year level', value: profile?.year_level || '—' }]),
    ...(isSao || isSchoolHead || isSchoolAdmin
      ? []
      : [{ label: 'Organization', value: organization }]),
    { label: 'Role', value: roleName },
    /* Officer position (President, VP, atbp.) — ang Adviser ang nagbibigay */
    ...(positionName ? [{ label: 'Position', value: positionName }] : []),
    { label: 'Last sign-in', value: lastSignIn },
    { label: 'Member since', value: memberSince },
  ]

  /* Ang listahan sa ibaba ng card: lahat maliban sa nasa itaas na */
  const LIST = DETAILS.filter((item) => !SHOWN_ON_TOP.has(item.label))

  return (
    <div className={styles.page}>
      <PageHeader title="Profile" />

      <div className={styles.stage}>
        <section className={styles.card}>
          {/* ---------- ITAAS: avatar (may camera), pangalan, chips ---------- */}
          <div className={styles.top}>
            <div className={styles.avatarWrap}>
              <Avatar src={profile?.avatar_url} name={fullName} size="lg" />
              {busy && <span className={styles.avatarBusy} aria-hidden="true" />}

              {/* Camera button sa gilid ng larawan (parang sa Facebook) —
                  pindutin para pumili ng bagong larawan */}
              {profile && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    onChange={handleFileChange}
                    hidden
                  />
                  <button
                    type="button"
                    className={styles.cameraButton}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={Boolean(busy)}
                    title={profile.avatar_url ? 'Change picture' : 'Upload picture'}
                    aria-label={profile.avatar_url ? 'Change picture' : 'Upload picture'}
                  >
                    <Camera size={18} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            <p className={styles.name}>{fullName}</p>
            <p className={styles.email}>{email}</p>

            <div className={styles.chips}>
              <span className={styles.chipRole} title="Role">
                <Shield size={15} strokeWidth={2.4} aria-hidden="true" />
                <span className={styles.srOnly}>Role: </span>
                {roleName}
              </span>
              {positionName && (
                <span className={styles.chipPosition} title="Position">
                  <Award size={15} strokeWidth={2.4} aria-hidden="true" />
                  <span className={styles.srOnly}>Position: </span>
                  {positionName}
                </span>
              )}
            </div>

            {/* Hint (o status habang nag-a-upload/nag-aalis) + Remove */}
            <div className={styles.avatarMeta}>
              {avatarError ? (
                <p className={styles.avatarError} role="alert">
                  {avatarError}
                </p>
              ) : (
                <p className={styles.avatarHint} aria-live="polite">
                  {busy === 'upload'
                    ? 'Uploading…'
                    : busy === 'remove'
                      ? 'Removing…'
                      : 'JPG, PNG or WEBP · up to 10 MB'}
                </p>
              )}

              {profile?.avatar_url && (
                <button
                  type="button"
                  className={styles.avatarRemove}
                  onClick={() => setConfirmingRemove(true)}
                  disabled={Boolean(busy)}
                >
                  <Trash2 size={14} strokeWidth={2.4} aria-hidden="true" />
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* ---------- IBABA: mga detalye ---------- */}
          <dl className={styles.details}>
            {LIST.map((item) => {
              const Icon = DETAIL_ICONS[item.label]
              const tone = styles[DETAIL_TONES[item.label]] ?? ''
              return (
                <div key={item.label} className={`${styles.detailRow} ${tone}`}>
                  <dt className={styles.detailLabel}>
                    <span className={styles.detailIcon} aria-hidden="true">
                      {Icon && <Icon size={19} strokeWidth={2.2} />}
                    </span>
                    {item.label}
                  </dt>
                  <dd
                    className={`${styles.detailValue} ${
                      item.label === 'Student ID' ? styles.mono : ''
                    }`}
                  >
                    {item.value}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      </div>

      {confirmingRemove && (
        <ConfirmDialog
          tone="danger"
          title='Remove your profile picture?'
          confirmLabel="Remove"
          busyLabel="Removing…"
          onConfirm={async () => {
            await handleRemove()
            setConfirmingRemove(false)
          }}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
  )
}

export default Profile