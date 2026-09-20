import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.js'
import msLogo from '../assets/microsoft-logo.svg'
import styles from './Login.module.css'

function Login() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  /* Naka-login ka na at bumalik ka sa /login? Diretso sa member
     page — walang saysay ang login page sa'yo. */
  useEffect(() => {
    if (!loading && user) {
      navigate('/member', { replace: true })
    }
  }, [user, loading, navigate])

  async function handleMicrosoftSignIn() {
    setError('')
    setBusy(true)

    /* IBA ITO SA MSAL: hindi popup, kundi buong-page na redirect.
       Aalis ang browser papunta sa Microsoft, mag-si-sign in ka
       doon, tapos babalik sa redirectTo sa baba.

       Kaya walang navigate() pagkatapos nito — ang browser mismo
       ang magdadala sa'yo pabalik. */
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        /* Kailangan ng Supabase ang 'email' scope.
           Idagdag ang 'offline_access' kung gusto mong
           manatiling naka-login nang matagal. */
        scopes: 'email',

        /* Saan babalik pagkatapos. DAPAT nakalista rin ito sa
           Supabase dashboard → Authentication → URL Configuration
           → Redirect URLs, kung hindi ay tatanggihan ito. */
        redirectTo: `${window.location.origin}/member`,
      },
    })

    if (signInError) {
      setError('Hindi natuloy ang sign-in. Subukan ulit.')
      console.error('Supabase OAuth error:', signInError)
      setBusy(false)
    }
    // Kung walang error, aalis na ang browser — wala nang susunod dito.
  }

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        {/* PALITAN: logo ng site mo */}
        <p className={styles.brand}>
          STI<span className={styles.brandAccent}>-CO</span>
        </p>

        <div className={styles.cardHead}>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.subtitle}>
            Gamitin ang iyong Microsoft account para makapasok.
          </p>
        </div>

        <button
          type="button"
          className={styles.msButton}
          onClick={handleMicrosoftSignIn}
          disabled={busy || loading}
        >
          <img src={msLogo} alt="" className={styles.msLogo} />
          <span className={styles.msButtonText}>
            {busy ? 'Inihahatid sa Microsoft…' : 'Sign in with Microsoft'}
          </span>
        </button>

        {error && <p className={styles.errorNotice}>{error}</p>}

        <p className={styles.helpText}>
          Kailangan mo ng STI Microsoft account para makapasok.
          Kung wala ka pa nito, makipag-ugnayan sa IT support.
        </p>
      </div>
    </section>
  )
}

export default Login
