import { createContext, useContext } from 'react'

/* ============================================================
   AUTH CONTEXT

   Ang Context ay paraan para maipasa ang isang bagay sa LAHAT
   ng component nang hindi kailangang ipasa-pasa bilang props
   sa bawat antas.

   Ang mga ipinapasa dito:
     user         — sino ang naka-login (galing sa Microsoft)
     profile      — ang row niya sa public.profiles (database)
     role         — ano ang kaya niyang gawin (galing sa profile)
     accessDenied — naka-login pero wala sa student_records
     loading      — sinusuri pa ba ang session at profile

   MAHALAGA: ito ang "kontrata" sa pagitan ng auth at ng buong
   app. Ang mga component ay humihingi lang ng user at role —
   wala silang pakialam kung saan galing.

   Kaya kapag dumating na ang database, ang AuthProvider lang
   ang magbabago. Ang kontratang ito ay mananatiling pareho.
   ============================================================ */

export const AuthContext = createContext({
  session: null,
  user: null,
  profile: null,
  role: null,
  accessDenied: false,
  profileError: null,
  refreshProfile: () => {},
  loading: true,
})

/* Shortcut para hindi mo na kailangang i-import ang AuthContext
   at useContext sa bawat component. Ganito lang ang gamit:

     const { user, profile, role, loading } = useAuth()
*/
export function useAuth() {
  return useContext(AuthContext)
}
