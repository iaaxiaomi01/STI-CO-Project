import { useState } from 'react'
import { Link } from 'react-router-dom'
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
   password ng lahat ng dev account (itinakda sa DEV_LOGIN.sql).

   Pagka-login, pareho ang daloy sa Microsoft login: kukunin ng
   AuthProvider ang profile, tapos dadalhin ka ng App sa
   /dashboard ng role na iyon.

   OPTIONAL — para hindi na i-type ang password tuwing login:
   ilagay sa .env.local (HUWAG i-commit):
     VITE_DEV_PASSWORD=ang-password-mo
   Dito lang ito binabasa, at dahil wala sa production build
   ang file na ito, hindi rin ito mapupunta doon.
   ============================================================ */
function DevLogin() {
  const [password, setPassword] = useState(import.meta.env.VITE_DEV_PASSWORD ?? '')
  const [customEmail, setCustomEmail] = useState('')
  const [busyEmail, setBusyEmail] = useState('')
  const [error, setError] = useState('')

  /* Pangalawang bantay (ang una ay sa App.jsx) */
  if (!isDevLoginAllowed()) {
    return (
      <section className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Not available</h1>
          <p className={styles.subtitle}>Developer login works on localhost only.</p>
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
          ? `Wrong password, or ${email} has not been created yet. Run DEV_LOGIN.sql in Supabase.`
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

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.badge}>DEV · localhost</span>
          <h1 className={styles.title}>Developer login</h1>
          <p className={styles.subtitle}>
            Sign in as any role without a Microsoft account. FOR DEVELOPERS ONLY!
          </p>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Developer password</span>
          <input
            type="password"
            className={styles.input}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={busy}
          />
        </label>

        <p className={styles.sectionLabel}>Sign in as</p>
        <div className={styles.grid}>
          {DEV_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className={styles.roleButton}
              onClick={() => signInAs(account.email)}
              disabled={busy}
            >
              <span className={styles.roleName}>
                {busyEmail === account.email ? 'Signing in…' : account.role}
              </span>
              <span className={styles.roleNote}>{account.note}</span>
            </button>
          ))}
        </div>

        <form className={styles.customRow} onSubmit={handleCustomSubmit}>
          <input
            type="email"
            className={styles.input}
            value={customEmail}
            onChange={(event) => setCustomEmail(event.target.value)}
            disabled={busy}
          />
          <button type="submit" className={styles.customButton} disabled={busy || !customEmail.trim()}>
            Sign in
          </button>
        </form>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <Link to="/login" className={styles.back}>
          ← Back to Microsoft sign-in
        </Link>
      </div>
    </section>
  )
}

export default DevLogin
