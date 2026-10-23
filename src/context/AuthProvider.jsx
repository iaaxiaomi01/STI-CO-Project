import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { roleKeyFromId } from '../config/roles.js'
import { isPositionNotification, subscribeToNotifications } from '../lib/notifications.js'
import { AuthContext } from './AuthContext.js'

/* ============================================================
   AUTH PROVIDER

   Tatlo na ang trabaho nito:
   1. Sa unang load, tanungin ang Supabase kung may naka-save
      nang session (para manatiling naka-login kahit mag-refresh)
   2. Makinig sa mga pagbabago — login, logout, token refresh
   3. Kunin ang PROFILE ng naka-login mula sa database
      (public.profiles) — dito galing ang role at organisasyon

   PAANO NAGKAKAROON NG PROFILE:
   Ang trigger na on_auth_user_created sa Supabase ang gumagawa
   nito sa unang login. Hinahanap nito ang email ng user sa
   student_records. Kung wala doon → walang profile → ipapakita
   ng App ang Access Denied page.
   ============================================================ */

/* Ang mga column na kukunin. Ang roles(...) at organizations(...)
   ay "join" — kinukuha ang kaugnay na row gamit ang foreign key. */
const PROFILE_COLUMNS = `
  id, student_id, email, last_name, first_name, middle_name,
  program, year_level, role_id, organization_id, is_active,
  avatar_url, created_at, position_id,
  roles ( id, name ),
  organizations ( id, name, department, can_announce_all ),
  officer_positions ( id, name )
`

function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)

  /* Kung kaninong user id galing ang profile na hawak natin.
     Kapag hindi pa tugma sa kasalukuyang user, loading pa. */
  const [loadedFor, setLoadedFor] = useState(null)

  /* ---------- 1 at 2: session ---------- */
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionLoading(false)
    })

    /* HUWAG tumawag ng ibang supabase query DITO SA LOOB ng
       callback — pwedeng mag-hang ang Supabase client. Kaya
       hiwalay na useEffect ang kumukuha ng profile (sa baba). */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setSessionLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id ?? null

  /* ---------- 3: profile galing database ---------- */
  const loadProfile = useCallback(async (id) => {
    /* maybeSingle(): null ang data kapag walang row, imbes na
       error. Walang row = wala sa student_records ang email. */
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Hindi makuha ang profile:', error)
      setProfileError(error)
      setProfile(null)
    } else {
      setProfileError(null)
      setProfile(data)
    }
    setLoadedFor(id)
  }, [])

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileError(null)
      setLoadedFor(null)
      return
    }
    loadProfile(userId)
  }, [userId, loadProfile])

  /* ---------- officer position ----------
     Kapag binigyan (o tinanggalan) ng Adviser ng officer position
     ang naka-login, may darating na notification na
     'position_update'. Kukunin ulit ang profile para magbago agad
     ang role, sidebar at mga route — hindi na kailangang
     mag-refresh o mag-logout. Member at Officer lang ang
     nakakatanggap nito. */
  const canGetPosition = profile?.role_id === 1 || profile?.role_id === 2

  useEffect(() => {
    if (!userId || !canGetPosition) return undefined
    return subscribeToNotifications(userId, {
      onInsert: (row) => {
        if (isPositionNotification(row)) loadProfile(userId)
      },
    })
  }, [userId, canGetPosition, loadProfile])

  /* Tinatawag ng mga page pagkatapos nilang baguhin ang
     profile (hal. pag-upload ng avatar). */
  const refreshProfile = useCallback(() => {
    if (userId) return loadProfile(userId)
  }, [userId, loadProfile])

  /* Habang may user pero hindi pa tapos kunin ang profile,
     loading pa rin — para hindi sumilip ang Access Denied. */
  const profileReady = userId === null || loadedFor === userId
  const loading = sessionLoading || !profileReady

  const value = {
    session,
    user: session?.user ?? null,

    /* Ang buong row mula sa public.profiles (o null) */
    profile,

    /* 'member', 'officer', 'adviser', 'sao', ... — galing sa
       profiles.role_id. Ito pa rin ang binabasa ng lahat ng
       component, kaya walang ibang file na nagbago ang gamit. */
    role: profile && profile.is_active ? roleKeyFromId(profile.role_id) : null,

    /* true kapag naka-login pero walang aktibong profile —
       ibig sabihin, wala sa student_records o na-deactivate. */
    accessDenied: Boolean(userId) && profileReady &&
      profileError === null && (!profile || !profile.is_active),

    profileError,
    refreshProfile,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
