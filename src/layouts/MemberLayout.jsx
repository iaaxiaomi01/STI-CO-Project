import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.js'
import Sidebar from '../components/Sidebar.jsx'
import styles from './MemberLayout.module.css'

/* ============================================================
   MEMBER LAYOUT — ang hitsura ng site kapag NAKA-LOGIN.
   Sidebar sa kaliwa, walang navbar, walang footer.

   Ang <Outlet /> ay ang "butas" kung saan lalabas ang page.
   Ito ang nagpapalit depende sa URL habang nananatili ang
   sidebar — hindi na siya nire-render ulit kada palit ng page.
   ============================================================ */
function MemberLayout() {
  // Bukas ba ang sidebar sa mobile?
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

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
            aria-label="Buksan ang menu"
          >
            ☰
          </button>
          <p className={styles.mobileBrand}>
            STI<span className={styles.brandAccent}>-CO</span>
          </p>
        </div>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MemberLayout
