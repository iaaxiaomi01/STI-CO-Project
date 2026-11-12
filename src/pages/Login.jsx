import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import msLogo from '../assets/microsoft-logo.svg'
import styles from './Login.module.css'

/* Lalabas lang ang page na ito kapag HINDI ka naka-login.
   Kapag naka-login ka, wala na ang /login sa route tree —
   tingnan ang App.jsx. Kaya hindi na natin kailangang
   manu-manong magbantay dito. */
function Login() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleMicrosoftSignIn() {
    setError('')
    setBusy(true)

    /* Buong-page na redirect ito, hindi popup. Aalis ang browser
       papunta sa Microsoft, mag-si-sign in ka doon, tapos babalik
       sa redirectTo sa baba.

       Kaya walang navigate() pagkatapos nito — ang browser mismo
       ang magdadala sa'yo pabalik. */
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        /* Kailangan ng Supabase ang 'email' scope.
           Idagdag ang 'offline_access' kung gusto mong
           manatiling naka-login nang matagal. */
        scopes: 'email',

        /* Ang root lang ang ibinibigay natin — hindi
           "/dashboard" o kahit anong partikular na page.

           BAKIT: ang redirectTo ay dapat nakalista sa Supabase
           dashboard → Authentication → URL Configuration. Ang
           root ay laging nakalista bilang Site URL, kaya
           imposible itong tanggihan.

           Pagbalik mo sa "/", hindi ito route sa member tree,
           kaya sasaluhin ka ng catch-all at dadalhin sa
           /dashboard — tingnan ang App.jsx. */
        redirectTo: window.location.origin,
      },
    })

    if (signInError) {
      setError('Sign-in did not go through. Please try again.')
      console.error('Supabase OAuth error:', signInError)
      setBusy(false)
    }
    // Kung walang error, aalis na ang browser — wala nang susunod dito.
  }

  return (
    <section className={styles.page}>
      {/* Palamuti lang sa background — tuldok-tuldok at malabong ilaw */}
      <div className={styles.backdrop} aria-hidden="true" />

      <div className={styles.card}>
        {/* ---------- KALIWA: BRAND PANEL ----------
            Palamuti at pangalan ng site. Sa mobile, nagiging
            maikling banner ito sa itaas ng form. */}
        <aside className={styles.brandPanel}>
          <div className={styles.orbit} aria-hidden="true">
            <span className={styles.ringOuter} />
            <span className={styles.ringMiddle}>
              <span className={styles.satellite} />
            </span>
            <span className={styles.ringInner} />
            <span className={styles.sun} />
          </div>

          <div className={styles.brandContent}>
            {/* PALITAN: logo ng site mo */}
            <p className={styles.brand}>
              STI<span className={styles.brandAccent}>-CO</span>
            </p>

            <p className={styles.tagline}>
              <span>All Organizations.</span>
              <span>One Campus.</span>
              <span className={styles.taglineAccent}>One Platform.</span>
            </p>
          </div>

          <p className={styles.secureNote}>
            <svg viewBox="0 0 24 24" className={styles.secureIcon} aria-hidden="true">
              <path
                d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.6 7.5 10 4.3-1.4 7.5-5.4 7.5-10v-6L12 2.5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="m8.8 12.2 2.2 2.2 4.3-4.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Secured by Microsoft sign-in
          </p>
        </aside>

        {/* ---------- KANAN: SIGN IN ---------- */}
        <div className={styles.formPanel}>
          <div className={styles.cardHead}>
            <p className={styles.eyebrow}>Welcome to STI-CO</p>
            <h1 className={styles.title}>Sign in</h1>
            <p className={styles.subtitle}>
              Use your Microsoft account to sign in.
            </p>
          </div>

          <button
            type="button"
            className={styles.msButton}
            onClick={handleMicrosoftSignIn}
            disabled={busy}
          >
            {busy ? (
              <span className={styles.spinner} aria-hidden="true" />
            ) : (
              <img src={msLogo} alt="" className={styles.msLogo} />
            )}
            <span className={styles.msButtonText}>
              {busy ? 'Redirecting to Microsoft…' : 'Sign in with Microsoft'}
            </span>
          </button>

          {error && (
            <p className={styles.errorNotice} role="alert">
              {error}
            </p>
          )}

          <div className={styles.helpText}>
            <svg viewBox="0 0 24 24" className={styles.helpIcon} aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 11v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="7.8" r="1.1" fill="currentColor" />
            </svg>
            <p>
              You need an STI Microsoft account to sign in.
              If you don't have one yet, please contact School Administrator.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Login
