import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { DEV_ROLE } from '../config/roles.js'
import { AuthContext } from './AuthContext.js'

/* ============================================================
   AUTH PROVIDER

   Dalawa ang trabaho nito:
   1. Sa unang load, tanungin ang Supabase kung may naka-save
      nang session (para manatiling naka-login kahit mag-refresh)
   2. Makinig sa mga pagbabago — login, logout, token refresh
   ============================================================ */

function AuthProvider({ children }) {
  const [session, setSession] = useState(null)

  /* loading = sinusuri pa kung may session.
     Kailangan ito para hindi mapalabas ang user habang
     naghihintay pa — kung wala nito, sandaling "walang user"
     ang lalabas kahit naka-login siya. */
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    /* Pinipigilan nito ang pag-set ng state kung naalis na
       ang component bago pa bumalik ang sagot. */
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    /* Tumatakbo ito tuwing may pagbabago sa auth: pagkatapos
       bumalik galing Microsoft, pagka-logout, o kapag
       kusang nag-refresh ang token. */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    /* Cleanup — tumatakbo kapag naalis ang component.
       Kung kakalimutan mo ito, madadagdagan ng listener
       kada render at mag-le-leak ng memory. */
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = {
    session,
    user: session?.user ?? null,

    /* Ang role ay galing sa config, hindi sa database.
       Pansamantala ito — tingnan ang DEV_ROLE sa
       src/config/roles.js para sa paliwanag.

       Kapag may profiles table na, dito papasok ang
       totoong role ng naka-login. Ito lang ang linyang
       magbabago; ang lahat ng component ay patuloy na
       kukunin ito sa pamamagitan ng useAuth(). */
    role: DEV_ROLE,

    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
