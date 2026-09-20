import { useState } from 'react'
import styles from './Login.module.css'
import msLogo from '../assets/microsoft-logo.svg'

function Login() {
  /* Tatlong posibleng estado ng page:
     'idle'        — naghihintay ng pindot
     'signing-in'  — kunwari may kausap na Microsoft
     'placeholder' — tapos na ang kunwaring proseso

     Isang state lang na may tatlong halaga — mas malinis kaysa
     tatlong magkahiwalay na true/false na useState. */
  const [status, setStatus] = useState('idle')

  function handleMicrosoftSignIn() {
    setStatus('signing-in')

    /* TODO — DITO PAPASOK ANG TOTOONG MICROSOFT LOGIN.
       Kapag handa ka na, ganito ang daan:

       1. Mag-register ng app sa Microsoft Entra ID (dating Azure AD)
          para makakuha ng Client ID at Tenant ID.
       2. npm install @azure/msal-browser @azure/msal-react
       3. Balutin ang <App /> ng <MsalProvider> sa main.jsx
       4. Palitan ang setTimeout sa baba ng:
             const { instance } = useMsal()
             instance.loginPopup({ scopes: ['User.Read'] })

       Sa ngayon, kunwari lang ang 900ms na paghihintay para
       makita mo ang loading state. */
    setTimeout(() => setStatus('placeholder'), 900)
  }

  const isSigningIn = status === 'signing-in'

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
          disabled={isSigningIn}
        >
          {/* PLACEHOLDER PARA SA MICROSOFT LOGO.
              Hindi ko iginuhit ang logo — kailangan mong kunin ang
              opisyal na asset mismo sa Microsoft. Hinihingi nila
              ito sa kanilang branding guidelines, at ang gawa-gawang
              kopya ay paglabag doon.

              Hanapin: "Microsoft identity platform branding
              guidelines" — may downloadable na SVG doon.

              Kapag nakuha mo na:
                1. Ilagay sa src/assets/microsoft-logo.svg
                2. import msLogo from '../assets/microsoft-logo.svg'
                3. Palitan ang <span> sa baba ng:
                   <img src={msLogo} alt="" className={styles.msLogo} /> */}
          <img src={msLogo} alt="" className={styles.msLogo} />

          <span className={styles.msButtonText}>
            {isSigningIn ? 'Nagsa-sign in…' : 'Sign in with Microsoft'}
          </span>
        </button>

        {/* Lalabas lang kapag tapos na ang kunwaring proseso */}
        {status === 'placeholder' && (
          <p className={styles.notice}>
            Dito papasok ang Microsoft sign-in window. Wala pang
            totoong authentication — placeholder pa lang ito.
          </p>
        )}

        <p className={styles.helpText}>
          Kailangan mo ng STI Microsoft account para makapasok.
          Kung wala ka pa nito, makipag-ugnayan sa IT support.
        </p>
      </div>
    </section>
  )
}

export default Login
