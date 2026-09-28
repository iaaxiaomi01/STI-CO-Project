import Hero from '../components/landing/Hero.jsx'
import AnnouncementBar from '../components/landing/AnnouncementBar.jsx'
import About from '../components/landing/About.jsx'
import Organizations from '../components/landing/Organizations.jsx'
import EventCalendar from '../components/landing/EventCalendar.jsx'

/* ============================================================
   HOME — landing page para sa hindi pa naka-login.

   Ang Header at Footer ay galing sa PublicLayout, kaya mga
   section lang ang nandito. Bawat section ay may sariling
   component at .module.css sa components/landing/.

   Para magdagdag, magtanggal, o mag-ayos ng section, dito
   lang sa listahang ito.
   ============================================================ */
function Home() {
  return (
    <>
      <Hero />
      <AnnouncementBar />
      <About />
      <Organizations />
      <EventCalendar />
    </>
  )
}

export default Home
