import { createContext, useContext } from 'react'

/* ============================================================
   AUTH CONTEXT

   Ang Context ay paraan para maipasa ang isang bagay sa LAHAT
   ng component nang hindi kailangang ipasa-pasa bilang props
   sa bawat antas. Dito, ang ipinapasa ay kung sino ang
   naka-login.

   Hiwalay ang file na ito sa AuthProvider.jsx dahil ang isang
   file na naglalaman ng component at hindi-component nang
   sabay ay nirereklamo ng eslint-plugin-react-refresh.
   ============================================================ */

export const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
})

/* Shortcut para hindi mo na kailangang i-import ang AuthContext
   at useContext sa bawat component. Ganito lang ang gamit:

     const { user, loading } = useAuth()
*/
export function useAuth() {
  return useContext(AuthContext)
}
