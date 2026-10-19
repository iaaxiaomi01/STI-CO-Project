import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.js'
import styles from './Login.module.css'

/* ============================================================
   ACCESS DENIED

   Lalabas ito kapag naka-login sa Microsoft ang user PERO:
     - wala ang email niya sa public.student_records, o
     - naka-is_active = false ang profile niya, o
     - hindi makuha ang profile (error sa database)

   Hindi siya makakapasok sa member pages hangga't hindi
   siya naidadagdag ng SAO o IT Admin sa student_records.
   ============================================================ */
function AccessDenied() {
  const { user, profile, profileError, refreshProfile } = useAuth()

  let message =
    'Your email is not on the student records list. ' +
    'Please contact the SAO or IT Administrator to be added.'

  if (profileError) {
    message =
      'Could not connect to the database right now. Please try again later.'
  } else if (profile && !profile.is_active) {
    message =
      'Your account has been deactivated. Please contact the SAO or IT Administrator.'
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <p className={styles.brand}>
          STI<span className={styles.brandAccent}>-CO</span>
        </p>

        <div className={styles.cardHead}>
          <h1 className={styles.title}>No access</h1>
          <p className={styles.subtitle}>{message}</p>
        </div>

        {user?.email && (
          <p className={styles.helpText}>
            Signed in as <strong>{user.email}</strong>
          </p>
        )}

        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1.5rem' }}>
          {profileError && (
            <button type="button" className={styles.msButton} onClick={refreshProfile}>
              <span className={styles.msButtonText}>Try again</span>
            </button>
          )}

          <button type="button" className={styles.msButton} onClick={handleLogout}>
            <span className={styles.msButtonText}>Log out</span>
          </button>
        </div>
      </div>
    </section>
  )
}

export default AccessDenied
