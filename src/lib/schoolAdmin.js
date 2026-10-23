import { supabase } from './supabaseClient.js'

/* ============================================================
   SCHOOL ADMINISTRATOR — numero para sa Dashboard

   Iisang tawag lang: school_admin_overview() sa database
   (ADD_SCHOOL_ADMINISTRATOR.sql). Ang School Administrator
   (role_id 8) lang ang makakatawag nito.

   Ibinabalik:
     {
       proposals: { awaiting_you, on_the_way, approved, rejected, total },
       totals:    { organizations, members, officers }
     }

   Ang "proposals" ay ang may budget LANG — iyon lang ang dumadaan
   sa SA. Ang "members" ay aktibong Member + Officer na nasa
   aktibong org.
   ============================================================ */
export async function fetchSchoolAdminOverview() {
  const { data, error } = await supabase.rpc('school_admin_overview')
  if (error) throw error
  return data
}

/* Mga stat key sa config/roles.js → saan kukunin sa overview */
export const SCHOOL_ADMIN_STAT_KEYS = {
  saOnTheWay: (o) => o.proposals.on_the_way,
  saApproved: (o) => o.proposals.approved,
  saRejected: (o) => o.proposals.rejected,
  saOrganizations: (o) => o.totals.organizations,
  saMembers: (o) => o.totals.members,
  saOfficers: (o) => o.totals.officers,
}

export function isSchoolAdminStat(key) {
  return Object.hasOwn(SCHOOL_ADMIN_STAT_KEYS, key)
}

/* Ang numero ng isang stat, naka-format (hal. "1,204").
   null kapag wala pa ang overview. */
export function schoolAdminStatValue(overview, key) {
  if (!overview || !isSchoolAdminStat(key)) return null
  const value = SCHOOL_ADMIN_STAT_KEYS[key](overview)
  return typeof value === 'number' ? value.toLocaleString('en-PH') : '—'
}
