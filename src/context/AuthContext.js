import { createContext, useContext } from 'react'

/* ============================================================
   AUTH CONTEXT

   Ang Context ay paraan para maipasa ang isang bagay sa LAHAT
   ng component nang hindi kailangang ipasa-pasa bilang props
   sa bawat antas.

   Tatlong bagay ang ipinapasa dito:
     user    — sino ang naka-login (galing sa Microsoft)
     role    — ano ang kaya niyang gawin
     loading — sinusuri pa ba ang session

   MAHALAGA: ito ang "kontrata" sa pagitan ng auth at ng buong
   app. Ang mga component ay humihingi lang ng user at role —
   wala silang pakialam kung saan galing.

   Kaya kapag dumating na ang database, ang AuthProvider lang
   ang magbabago. Ang kontratang ito ay mananatiling pareho.
   ============================================================ */

export const AuthContext = createContext({
  session: null,
  user: null,
  role: null,
  loading: true,
})

/* Shortcut para hindi mo na kailangang i-import ang AuthContext
   at useContext sa bawat component. Ganito lang ang gamit:

     const { user, role, loading } = useAuth()
*/
export function useAuth() {
  return useContext(AuthContext)
}
