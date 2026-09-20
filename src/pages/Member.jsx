import { useAuth } from '../context/AuthContext.js'
import styles from './Member.module.css'

function Member() {
  const { user } = useAuth()

  /* Saan nanggagaling ang pangalan:
     Ang Supabase ay naglalagay ng impormasyon mula sa Microsoft
     sa user_metadata. Nag-iiba ang eksaktong field depende sa
     klase ng account, kaya sunod-sunod ang hinahanap natin
     hanggang may makita.

     Ang "??" ay nullish coalescing: gamitin ang kaliwa maliban
     kung null o undefined ito — saka lumipat sa kanan. */
  const fullName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    'Member'

  const email = user?.email ?? ''

  // Unang letra para sa avatar circle
  const initial = fullName.charAt(0).toUpperCase()

  return (
    <section className={styles.page}>
      <div className={styles.container}>
        <div className={styles.welcomeCard}>
          <div className={styles.avatar} aria-hidden="true">
            {initial}
          </div>

          <div className={styles.welcomeText}>
            <p className={styles.badge}>Members only</p>
            <h1 className={styles.title}>Kumusta, {fullName}!</h1>
            {email && <p className={styles.email}>{email}</p>}
          </div>
        </div>

        {/* PALITAN: ito ang placeholder na laman ng member page.
            Dito mo ilalagay ang totoong content na para lang sa
            mga naka-sign in. */}
        <div className={styles.cardGrid}>
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Protektadong page</h2>
            <p className={styles.cardText}>
              Kapag hindi ka naka-sign in at sinubukan mong pumunta
              sa /member, ibabalik ka sa login page — kahit i-type
              mo pa nang direkta ang URL.
            </p>
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Galing sa Supabase</h2>
            <p className={styles.cardText}>
              Ang pangalan at email sa itaas ay hindi hardcoded.
              Galing sila sa Microsoft account mo, dumaan sa
              Supabase, at naka-save sa auth.users table.
            </p>
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Susunod na hakbang</h2>
            <p className={styles.cardText}>
              May database ka na ngayon. Pwede ka nang gumawa ng
              sariling table sa Supabase at i-ugnay ang bawat row
              sa user na gumawa nito.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}

export default Member
