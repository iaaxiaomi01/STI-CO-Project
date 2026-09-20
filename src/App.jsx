import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Member from './pages/Member.jsx'

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

          {/* Protektado — kailangang naka-sign in bago makapasok */}
          <Route
            path="/member"
            element={
              <ProtectedRoute>
                <Member />
              </ProtectedRoute>
            }
          />

          {/* Kapag may bagong page ka na, dagdagan mo lang dito.
              Ilagay sa loob ng <ProtectedRoute> kung para lang
              siya sa naka-sign in na user. */}
        </Routes>
      </main>

      <Footer />
    </>
  )
}

export default App
