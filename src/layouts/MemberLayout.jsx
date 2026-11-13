import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.js'
import { Info, Menu } from 'lucide-react'
import Sidebar from '../components/Sidebar.jsx'
import styles from './MemberLayout.module.css'

/* ============================================================
   MEMBER LAYOUT — ang hitsura ng site kapag NAKA-LOGIN.
   Sidebar sa kaliwa, walang navbar. Sa ibaba ng bawat page ay
   may maliit na footer na may paalala na capstone project ang
   website at para lang sa semester na ito — pareho sa lahat ng
   role. Dito lang palitan ang sinasabi nito.

   Ang <Outlet /> ay ang "butas" kung saan lalabas ang page.
   Ito ang nagpapalit depende sa URL habang nananatili ang
   sidebar — hindi na siya nire-render ulit kada palit ng page.
   ============================================================ */
function MemberLayout() {
  // Bukas ba ang sidebar sa mobile?
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  // Taon sa footer — automatic na nag-a-update
  const year = new Date().getFullYear()

  async function handleLogout() {
    setMenuOpen(false)
    await supabase.auth.signOut()

    /* Hindi na natin kailangang i-clear ang user state —
       ang onAuthStateChange sa AuthProvider ang bahala doon.
       Kapag naging null ang user, awtomatikong babalik ang
       App sa public layout na may navbar. */
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.layout}>
      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Madilim na takip sa likod ng sidebar sa mobile.
          Pagpindot dito, sasara ang menu. */}
      <div
        className={`${styles.overlay} ${menuOpen ? styles.overlayVisible : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <div className={styles.main}>
        {/* Topbar na may hamburger — sa mobile lang lalabas */}
        <div className={styles.mobileBar}>
          <button
            type="button"
            className={styles.burger}
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <Menu size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
          <p className={styles.mobileBrand}>
            STI<span className={styles.brandAccent}>-CO</span>
          </p>
        </div>

        <main className={styles.content}>
          <Outlet />
        </main>

        {/* Footer ng lahat ng page kapag naka-login */}
        <footer className={styles.footer}>
          <p className={styles.footerNotice}>
            <span className={styles.footerIcon} aria-hidden="true">
              <Info size={14} strokeWidth={2.6} />
            </span>
            This website is in use for S.Y. 2026–2027 only.
          </p>
          <p className={styles.footerCopy}>&copy; {year} STI-CO. All Rights Reserved.</p>
        </footer>
      </div>
    </div>
  )
}

export default MemberLayout