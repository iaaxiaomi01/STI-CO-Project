import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, User } from 'lucide-react'
import stiLogo from '../assets/sti-logo.png'
import styles from './Header.module.css'

/* ============================================================
   HEADER (dating Navbar ng lumang landing page)

   Para sa HINDI PA naka-login na bisita lang ito — ginagamit ng
   PublicLayout, kaya lalabas ito sa Home at sa Login.
   Kapag naka-login, ang Sidebar na ang pumapalit (App.jsx).

   Tinanggal ang REGISTER button: sa bagong app, iisa na lang
   ang Microsoft sign-in (walang /register route).
   ============================================================ */
function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo} aria-label="Home" onClick={closeMenu}>
          <img src={stiLogo} alt="STI College San Pablo Logo" />
        </Link>

        {/* Desktop */}
        <nav className={styles.actions}>
          <Link to="/login" className={styles.loginBtn}>
            <User size={18} />
            LOGIN
          </Link>
        </nav>

        {/* Hamburger — tablet at mobile lang */}
        <button
          type="button"
          className={styles.menuToggle}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}>
        <Link to="/login" className={styles.mobileLogin} onClick={closeMenu}>
          <User size={18} />
          LOGIN
        </Link>
      </div>
    </header>
  )
}

export default Header
