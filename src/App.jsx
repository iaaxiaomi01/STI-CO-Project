import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'

/* Ito ang layout ng buong site.
   Ang Header at Footer ay nasa labas ng <Routes>, kaya
   lalabas sila sa LAHAT ng pages. Ang nasa loob ng <Routes>
   lang ang nagpapalit depende sa URL. */
function App() {
  return (
    <>
      <Header />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          {/* Kapag may bagong page ka na, dagdagan mo lang dito:
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />  */}
        </Routes>
      </main>

      <Footer />
    </>
  )
}

export default App
