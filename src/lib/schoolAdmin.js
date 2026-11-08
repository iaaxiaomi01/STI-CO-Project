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

/* ============================================================
   SCHOOL ADMINISTRATOR BILANG SUPERADMIN
   (SCHOOL_ADMIN_SUPERADMIN.sql)

   Lahat ng pagbabago ay dumadaan sa mga RPC na ito — ang
   database ang sumusuri kung SA nga ang tumatawag.
   ============================================================ */

/* Pinaikling mensahe ng error ng database para sa UI */
export function adminErrorMessage(err) {
  const msg = err?.message ?? ''
  if (/row-level security|permission denied/i.test(msg)) {
    return 'You are not allowed to do this.'
  }
  if (/failed to fetch|network/i.test(msg)) {
    return 'Could not reach the server. Check your internet connection and try again.'
  }
  return msg || 'Something went wrong. Please try again.'
}

/* ---------- ACTING ORG ----------
   Ang org na hinahawakan ng SA ngayon (profiles.organization_id
   niya). null = wala. Pagkatapos nito, tawagin ang
   refreshProfile() para magbago ang buong app. */
export async function setActingOrg(orgId) {
  const { error } = await supabase.rpc('sa_set_acting_org', { p_org: orgId ?? null })
  if (error) throw error
}

/* Mga aktibong org para sa pagpili ng acting org */
export async function fetchActiveOrganizations() {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

/* ---------- ORGANIZATIONS ---------- */

/* Lahat ng org (pati inactive) na may bilang ng members,
   officers at advisers */
export async function fetchAllOrganizations() {
  const { data, error } = await supabase.rpc('sa_list_organizations')
  if (error) throw error
  return data ?? []
}

/* id = null → bagong org. Ibinabalik ang id.
   p_program — ADD_ORG_PROGRAM.sql */
export async function saveOrganization(id, values) {
  const { data, error } = await supabase.rpc('sa_save_organization', {
    p_id: id ?? null,
    p_name: values.name,
    p_department: values.department || null,
    p_program: values.program || null,
    p_description: values.description || null,
    p_is_active: values.isActive,
    p_can_announce_all: values.canAnnounceAll,
  })
  if (error) throw error
  return data
}

/* ---------- USERS ---------- */

/* Lahat ng student record. Kapag naka-login na ang tao
   (has_account), galing sa profile niya ang role, org at status. */
export async function fetchUsers() {
  const { data, error } = await supabase.rpc('sa_list_users')
  if (error) throw error
  return data ?? []
}

/* id = null → bagong record. Ibinabalik ang id ng record. */
export async function saveUser(id, values) {
  const { data, error } = await supabase.rpc('sa_save_user', {
    p_id: id ?? null,
    p_email: values.email,
    p_last_name: values.lastName,
    p_first_name: values.firstName,
    p_middle_name: values.middleName || null,
    p_student_id: values.studentId || null,
    p_program: values.program || null,
    p_year_level: values.yearLevel || null,
    p_role_id: Number(values.roleId),
    p_organization_id: values.organizationId || null,
    p_is_active: values.isActive,
  })
  if (error) throw error
  return data
}

/* Mga role na pwedeng piliin (galing sa public.roles) */
export async function fetchRoles() {
  const { data, error } = await supabase.from('roles').select('id, name').order('id')
  if (error) throw error
  return data ?? []
}

/* Member, Officer, Adviser — kailangan ng org. Ang staff ay wala. */
export function roleNeedsOrg(roleId) {
  return [1, 2, 3].includes(Number(roleId))
}