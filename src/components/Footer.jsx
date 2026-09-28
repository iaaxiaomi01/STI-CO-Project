import { MapPin, Phone, Mail } from 'lucide-react'
import stiLogo from '../assets/sti-logo.png'
import styles from './Footer.module.css'

/* ============================================================
   FOOTER — galing sa lumang landing Footer.
   Ginagamit ng PublicLayout, kaya lalabas sa Home at Login.

   PALITAN: mga contact details sa CONTACTS sa baba.
   ============================================================ */
const CONTACTS = [
  {
    icon: MapPin,
    lines: ['STI College San Pablo', 'San Pablo City, Laguna'],
  },
  {
    icon: Phone,
    lines: ['(049) 562-XXXX'],
  },
  {
    icon: Mail,
    lines: ['sti.co@sticsanpablo.edu.ph'],
  },
]

function Footer() {
  // Automatic na nag-a-update ang taon kada bagong taon
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      {/* Decorative background (aria-hidden: palamuti lang) */}
      <div className={styles.yellowTop} aria-hidden="true" />
      <div className={styles.yellowBottom} aria-hidden="true" />
      <div className={`${styles.dots} ${styles.dotsTop}`} aria-hidden="true" />
      <div className={`${styles.dots} ${styles.dotsBottom}`} aria-hidden="true" />

      <div className={styles.inner}>
        {/* BRAND */}
        <div className={styles.brand}>
          <div className={styles.brandHeader}>
            <img src={stiLogo} alt="STI College San Pablo Logo" />

            <div className={styles.brandTitle}>
              <h2>STI-CO</h2>
              <p>STUDENT ORGANIZATIONS</p>
              <p>STI COLLEGE SAN PABLO</p>
            </div>
          </div>

          <div className={styles.brandLine} />

          <p className={styles.tagline}>
            Empowering students today,
            <br />
            leading the change tomorrow.
          </p>
        </div>

        {/* CONTACT */}
        <div className={styles.contact}>
          <h3>CONTACT US</h3>

          {CONTACTS.map(({ icon: Icon, lines }) => (
            <div key={lines[0]} className={styles.contactItem}>
              <div className={styles.contactIcon}>
                <Icon size={21} />
              </div>

              <p>
                {lines.map((line, index) => (
                  <span key={line}>
                    {index > 0 && <br />}
                    {line}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.bottom}>
        &copy; {year} STI-CO. All Rights Reserved.
      </div>
    </footer>
  )
}

export default Footer
