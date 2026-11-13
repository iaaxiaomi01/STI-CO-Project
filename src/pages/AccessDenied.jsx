import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.js'
import { Lock } from 'lucide-react'
import styles from './AccessDenied.module.css'

/* ============================================================
   ACCESS DENIED

   Lalabas ito kapag naka-login sa Microsoft ang user PERO:
     - wala ang email niya sa public.student_records, o
     - naka-is_active = false ang profile niya, o
     - hindi makuha ang profile (error sa database)

   Hindi siya makakapasok sa member pages hangga't hindi
   siya naidadagdag ng SAO sa student_records (o sa Supabase Table Editor).

   ITSURA (AccessDenied.module.css — UI lang, pareho ang laman):
     iisang card sa gitna, kapareho ng background ng Login;
     navy na banda sa itaas na may "STI-CO", tapos ang mensahe,
     ang email na naka-login, at ang mga button.
   ============================================================ */
function AccessDenied() {
  const { user, profile, profileError, refreshProfile } = useAuth()

  let message =
    'Your email is not on the student records list. ' +
    'Please contact the School Administrator to be added.'

  if (profileError) {
    message =
      'Could not connect to the database right now. Please try again later.'
  } else if (profile && !profile.is_active) {
    message =
      'Your account has been deactivated. Please contact the School Administrator.'
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <section className={styles.page}>
      {/* Palamuti lang sa background — kapareho ng Login */}
      <div className={styles.backdrop} aria-hidden="true" />

      <div className={styles.card}>
        {/* Navy na banda sa itaas */}
        <div className={styles.band}>
          <p className={styles.brand}>
            STI<span className={styles.brandAccent}>-CO</span>
          </p>
        </div>

        <div className={styles.body}>
          <span className={styles.icon} aria-hidden="true">
            <Lock size={24} strokeWidth={2.2} />
          </span>

          <div className={styles.cardHead}>
            <h1 className={styles.title}>No access</h1>
            <p className={styles.subtitle}>{message}</p>
          </div>

          {user?.email && (
            <p className={styles.helpText}>
              Signed in as <strong>{user.email}</strong>
            </p>
          )}

          <div className={styles.actions}>
            {profileError && (
              <button type="button" className={styles.primary} onClick={refreshProfile}>
                Try again
              </button>
            )}

            <button type="button" className={styles.secondary} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AccessDenied