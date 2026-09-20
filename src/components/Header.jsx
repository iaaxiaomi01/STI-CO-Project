import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.js'
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

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  const closeMenu = () => setMenuOpen(false)

  // Unang pangalan lang para hindi masikip ang header
  const displayName =
    user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? ''
  const firstName = displayName.split(' ')[0]

  async function handleLogout() {
    closeMenu()

    await supabase.auth.signOut()

    /* Hindi na natin kailangang i-clear ang user state —
       ang onAuthStateChange sa AuthProvider ang bahala doon,
       awtomatiko. */
    navigate('/', { replace: true })
  }

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

          {/* Nagpapalit ang dulo ng nav depende kung naka-sign in.
              Naka-sign in  → Member link, pangalan, at Logout
              Hindi pa      → Login button */}
          {user ? (
            <>
              <Link to="/member" className={styles.navLink} onClick={closeMenu}>
                Member
              </Link>

              {firstName && (
                <span className={styles.userName}>Hi, {firstName}</span>
              )}

              <button type="button" className={styles.logout} onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className={styles.cta} onClick={closeMenu}>
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
