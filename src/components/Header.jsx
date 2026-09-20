import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Header.module.css'

/* PALITAN: ito ang mga nav links.
   Pansinin ang "/" bago ang "#" — mahalaga ito. Ang "/#about" ay
   nangangahulugang "pumunta sa home page, tapos mag-scroll sa
   #about section". Kung "#about" lang, walang mangyayari kapag
   nasa ibang page ang user dahil wala doong #about section. */
const NAV_LINKS = [
  { label: 'Home', href: '/#top' },
  { label: 'About', href: '/#about' },
  { label: 'Services', href: '/#services' },
  { label: 'Contact', href: '/#contact' },
]

/* Para sa HINDI PA naka-login na bisita lang ang Header.
   Kapag naka-login, ang Sidebar na ang pumapalit dito —
   tingnan ang App.jsx. Kaya wala nang Logout o pangalan ng
   user dito; wala nang makakakita niyan sa navbar. */
function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* PALITAN: logo / pangalan ng site */}
        <Link to="/" className={styles.logo} onClick={closeMenu}>
          STI<span className={styles.logoAccent}>-CO</span>
        </Link>

        <button
          type="button"
          className={styles.burger}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={styles.navLink}
              onClick={closeMenu}
            >
              {link.label}
            </a>
          ))}

          <Link to="/login" className={styles.cta} onClick={closeMenu}>
            Login
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default Header
