import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Header.module.css'

/* PALITAN: ito ang mga nav links.
   Ngayon, naka-anchor (#) sila dahil iisang page lang ang laman —
   lahat ng sections ay nasa landing page. Kapag may totoo ka nang
   separate pages, palitan ang <a href="#about"> ng
   <Link to="/about"> mula sa react-router-dom. */
const NAV_LINKS = [
  { label: 'Home', href: '#top' },
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Contact', href: '#contact' },
]

function Header() {
  // Para sa mobile hamburger menu: bukas ba o sarado?
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* PALITAN: logo / pangalan ng site */}
        <Link to="/" className={styles.logo} onClick={closeMenu}>
          STI<span className={styles.logoAccent}>-CO</span>
        </Link>

        {/* Hamburger button — lalabas lang sa mobile (tingnan ang CSS) */}
        <button
          type="button"
          className={styles.burger}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        {/* Ganito i-combine ang dalawang class sa CSS Modules:
            template literal + conditional */}
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

          <a href="#contact" className={styles.cta} onClick={closeMenu}>
            Get Started
          </a>
        </nav>
      </div>
    </header>
  )
}

export default Header
