import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'

/* ============================================================
   PROTECTED ROUTE

   Bantay sa mga page na para lang sa naka-sign in.
   Ganito ang gamit sa App.jsx:

     <Route
       path="/member"
       element={
         <ProtectedRoute>
           <Member />
         </ProtectedRoute>
       }
     />
   ============================================================ */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  /* MAHALAGA ITO.
     Pagkatapos mag-refresh, may sandaling hinahanap pa ng
     Supabase ang naka-save na session. Kung hindi natin
     hihintayin, mapapalabas ang user kahit naka-login siya. */
  if (loading) {
    return (
      <div style={{ padding: '6rem 1.25rem', textAlign: 'center' }}>
        Sinusuri ang iyong session…
      </div>
    )
  }

  /* Walang user? Balik sa login.
     replace: true — para hindi mabalik dito ng Back button. */
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
