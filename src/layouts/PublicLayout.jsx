import { Outlet } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'

/* ============================================================
   PUBLIC LAYOUT — ang hitsura ng site kapag HINDI NAKA-LOGIN.
   Navbar sa taas, footer sa ibaba.

   Ang <Outlet /> ang butas kung saan lalabas ang page
   (Home o Login), habang nananatili ang Header at Footer.
   ============================================================ */
function PublicLayout() {
  return (
    <>
      <Header />

      <main>
        <Outlet />
      </main>

      <Footer />
    </>
  )
}

export default PublicLayout
