import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Award,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserCheck,
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import { DEV_ACCOUNTS, isDevLoginAllowed } from '../lib/devAuth.js'
import styles from './DevLogin.module.css'

/* ============================================================
   DEVELOPER LOGIN  (/dev-login)

   LOCALHOST LANG. Naka-lazy import ito sa App.jsx sa loob ng
   "import.meta.env.DEV", kaya HINDI ito kasama sa production
   build — wala ang page, wala ang route, wala ang code.

   Pumili ng role → mag-si-sign in gamit ang dev account ng
   role na iyon (email + password ng Supabase). Pareho ang
   password ng lahat ng dev account.

   Pagka-login, pareho ang daloy sa Microsoft login: kukunin ng
   AuthProvider ang profile, tapos dadalhin ka ng App sa
   /dashboard ng role na iyon.

   HITSURA: kapareho ng Login page (dalawang panel sa iisang
   card), pero madilim ang kaliwang panel at may dilaw na
   "Developer access" badge para hindi mapagkamalang totoong
   login page.

   OPTIONAL — para hindi na i-type ang password tuwing login:
   ilagay sa .env.local (HUWAG i-commit):
     VITE_DEV_PASSWORD=ang-password-mo
   Dito lang ito binabasa, at dahil wala sa production build
   ang file na ito, hindi rin ito mapupunta doon.
   ============================================================ */

/* Icon at maikling paliwanag bawat role. Naka-key sa "role"
   sa DEV_ACCOUNTS (lib/devAuth.js). Kapag nagdagdag ka ng role
   doon na wala rito, User icon at walang paliwanag ang lalabas. */
const ROLE_META = {
  Member: { icon: User, description: 'Views events, joins, and earns OG' },
  Officer: { icon: UserCheck, description: 'Posts announcements and proposals' },
  Adviser: { icon: GraduationCap, description: 'Manages the org and reviews proposals' },
  SAO: { icon: Building2, description: 'Student Affairs Office · all orgs' },
  'School Head': { icon: Award, description: 'Reviews proposals · all orgs' },
  'School Administrator': { icon: ShieldCheck, description: 'Manages users and organizations' },
}

function DevLogin() {
  const [password, setPassword] = useState(import.meta.env.VITE_DEV_PASSWORD ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [customEmail, setCustomEmail] = useState('')
  const [busyEmail, setBusyEmail] = useState('')
  const [error, setError] = useState('')

  /* Pangalawang bantay (ang una ay sa App.jsx) */
  if (!isDevLoginAllowed()) {
    return (
      <section className={styles.page}>
        <div className={styles.blockedCard}>
          <span className={styles.blockedIcon} aria-hidden="true">
            <Lock size={22} strokeWidth={2.2} />
          </span>
          <h1 className={styles.blockedTitle}>Not available</h1>
          <p className={styles.subtitle}>Developer login works on localhost only.</p>
          <Link to="/login" className={styles.back}>
            <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
            Back to Microsoft sign-in
          </Link>
        </div>
      </section>
    )
  }

  async function signInAs(email) {
    setError('')

    if (!password) {
      setError('Enter the developer password first.')
      return
    }

    setBusyEmail(email)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      console.error('Dev login error:', signInError)
      setError(
        signInError.message === 'Invalid login credentials'
          ? `Wrong password, or ${email} has not been created yet.`
          : signInError.message,
      )
      setBusyEmail('')
    }
    /* Kapag tagumpay, ang onAuthStateChange sa AuthProvider na
       ang bahala; mawawala ang page na ito at lilipat sa
       member layout. */
  }

  function handleCustomSubmit(event) {
    event.preventDefault()
    const email = customEmail.trim()
    if (email) signInAs(email)
  }

  const busy = Boolean(busyEmail)
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost'

  return (
    <section className={styles.page}>
      {/* Palamuti lang sa background */}
      <div className={styles.backdrop} aria-hidden="true" />

      <div className={styles.card}>
        {/* ---------- KALIWA: DEVELOPER PANEL ---------- */}
        <aside className={styles.sidePanel}>
          <div className={styles.sideTop}>
            <span className={styles.badge}>
              <span className={styles.badgeDot} aria-hidden="true" />
              Developer access
            </span>

            <p className={styles.brand}>
              STI<span className={styles.brandAccent}>-CO</span>
            </p>
            <p className={styles.sideTitle}>Developer Console</p>
            <p className={styles.sideText}>
              Sign in as any role to test the system without an STI Microsoft account.
            </p>
          </div>

          <dl className={styles.envList}>
            <div className={styles.envRow}>
              <dt>Environment</dt>
              <dd>Development</dd>
            </div>
            <div className={styles.envRow}>
              <dt>Host</dt>
              <dd className={styles.mono}>{host}</dd>
            </div>
            <div className={styles.envRow}>
              <dt>Accounts</dt>
              <dd>{DEV_ACCOUNTS.length}</dd>
            </div>
          </dl>

          <p className={styles.sideNotice}>
            <Lock size={15} strokeWidth={2.2} className={styles.sideNoticeIcon} aria-hidden="true" />
            For developers only. This page is not part of the deployed site.
          </p>
        </aside>

        {/* ---------- KANAN: SIGN IN ---------- */}
        <div className={styles.formPanel}>
          <div className={styles.head}>
            <p className={styles.eyebrow}>Developer sign-in</p>
            <h1 className={styles.title}>Choose a role</h1>
            <p className={styles.subtitle}>
              Enter the developer password, then pick the account you want to use.
            </p>
          </div>

          {/* ---- 1. Password ---- */}
          <label className={styles.field}>
            <span className={styles.label}>Developer password</span>
            <span className={styles.inputWrap}>
              <Lock size={17} strokeWidth={2.1} className={styles.inputIcon} aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                className={styles.input}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={busy}
              />
              <button
                type="button"
                className={styles.reveal}
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={busy}
              >
                {showPassword ? (
                  <EyeOff size={17} strokeWidth={2.1} aria-hidden="true" />
                ) : (
                  <Eye size={17} strokeWidth={2.1} aria-hidden="true" />
                )}
              </button>
            </span>
          </label>

          {/* ---- 2. Role ---- */}
          <p className={styles.label}>Sign in as</p>
          <ul className={styles.roleList}>
            {DEV_ACCOUNTS.map((account) => {
              const meta = ROLE_META[account.role] ?? { icon: User, description: '' }
              const Icon = meta.icon
              const isBusy = busyEmail === account.email

              return (
                <li key={account.email}>
                  <button
                    type="button"
                    className={`${styles.roleButton} ${isBusy ? styles.roleBusy : ''}`}
                    onClick={() => signInAs(account.email)}
                    disabled={busy}
                  >
                    <span className={styles.roleIcon} aria-hidden="true">
                      <Icon size={19} strokeWidth={2.1} />
                    </span>

                    <span className={styles.roleText}>
                      <span className={styles.roleTop}>
                        <span className={styles.roleName}>{account.role}</span>
                        <span className={styles.roleEmail}>{account.email}</span>
                      </span>
                      {meta.description && (
                        <span className={styles.roleDescription}>{meta.description}</span>
                      )}
                    </span>

                    <span className={styles.roleAction} aria-hidden="true">
                      {isBusy ? (
                        <span className={styles.spinner} />
                      ) : (
                        <ChevronRight size={18} strokeWidth={2.4} />
                      )}
                    </span>
                    {isBusy && <span className={styles.srOnly}>Signing in…</span>}
                  </button>
                </li>
              )
            })}
          </ul>

          {/* ---- Ibang email ---- */}
          <div className={styles.divider}>
            <span>or use another account</span>
          </div>

          <form className={styles.customRow} onSubmit={handleCustomSubmit}>
            <span className={styles.inputWrap}>
              <Mail size={17} strokeWidth={2.1} className={styles.inputIcon} aria-hidden="true" />
              <input
                type="email"
                className={styles.input}
                value={customEmail}
                onChange={(event) => setCustomEmail(event.target.value)}
                placeholder="name@sti-co.local"
                aria-label="Email address"
                disabled={busy}
              />
            </span>
            <button
              type="submit"
              className={styles.customButton}
              disabled={busy || !customEmail.trim()}
            >
              Sign in
            </button>
          </form>

          {error && (
            <p className={styles.error} role="alert">
              <AlertCircle size={17} strokeWidth={2.2} className={styles.errorIcon} aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <Link to="/login" className={styles.back}>
            <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
            Back to Microsoft sign-in
          </Link>
        </div>
      </div>
    </section>
  )
}

export default DevLogin