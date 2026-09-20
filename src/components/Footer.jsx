import styles from './Footer.module.css'

/* PALITAN: mga link sa footer */
const FOOTER_LINKS = [
  { label: 'Home', href: '#top' },
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Contact', href: '#contact' },
]

function Footer() {
  // Automatic na nag-a-update ang taon kada bagong taon
  const year = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandCol}>
          {/* PALITAN: pangalan at tagline */}
          <p className={styles.logo}>
            STI<span className={styles.logoAccent}>-CO</span>
          </p>
          <p className={styles.tagline}>
            Placeholder tagline — dito mo ilalagay ang maikling
            paglalarawan ng kompanya o organisasyon.
          </p>
        </div>

        <div className={styles.linkCol}>
          <h3 className={styles.colTitle}>Quick Links</h3>
          <ul className={styles.linkList}>
            {FOOTER_LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href} className={styles.link}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.linkCol}>
          <h3 className={styles.colTitle}>Contact</h3>
          {/* PALITAN: totoong contact details */}
          <ul className={styles.linkList}>
            <li className={styles.contactItem}>hello@sti-co.example</li>
            <li className={styles.contactItem}>+63 900 000 0000</li>
            <li className={styles.contactItem}>Metro Manila, Philippines</li>
          </ul>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <p>&copy; {year} STI-CO. All rights reserved.</p>
      </div>
    </footer>
  )
}

export default Footer
