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
      <div className={styles.card}>
        {/* PALITAN: logo ng site mo */}
        <p className={styles.brand}>
          STI<span className={styles.brandAccent}>-CO</span>
        </p>

        <div className={styles.cardHead}>
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
          <img src={msLogo} alt="" className={styles.msLogo} />
          <span className={styles.msButtonText}>
            {busy ? 'Redirecting to Microsoft…' : 'Sign in with Microsoft'}
          </span>
        </button>

        {error && <p className={styles.errorNotice}>{error}</p>}

        <p className={styles.helpText}>
          You need an STI Microsoft account to sign in.
          If you don't have one yet, please contact IT support.
        </p>
      </div>
    </section>
  )
}

export default Login
