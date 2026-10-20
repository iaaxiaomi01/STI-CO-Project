import { supabase } from './supabaseClient.js'

/* ============================================================
   OFFICER POSITIONS — President, Vice President, atbp.

   Kanya-kanyang listahan ng position BAWAT organisasyon
   (public.officer_positions). Ang Adviser ang gumagawa nito sa
   Org Profile, at siya rin ang nag-a-assign sa Members page.

   Ang database ang totoong bantay (OFFICER_POSITIONS.sql):
     - RLS: sariling org lang ang nakikita at nababago
     - trigger officer_positions_before_write: haba ng pangalan,
       hanggang 30 position, bawal gawing "iisa lang" kung
       marami pang may hawak
     - set_officer_position(): ang tanging paraan para mag-assign.
       May position → Officer. Tinanggal → Member. Automatic.

   Display lang ang position — walang permission na nakadepende
   rito. Pareho pa rin ang kaya ng lahat ng Officer.
   ============================================================ */

export const POSITION_NAME_MIN = 2
export const POSITION_NAME_MAX = 60
export const POSITION_LIMIT = 30

/* Mungkahing listahan para sa "Add common positions".
   multiple = pwedeng higit sa isang tao ang may hawak. */
export const COMMON_POSITIONS = [
  { name: 'President', multiple: false },
  { name: 'Vice President - Internal', multiple: false },
  { name: 'Vice President - External', multiple: false },
  { name: 'Secretary', multiple: false },
  { name: 'Treasurer', multiple: false },
  { name: 'Auditor', multiple: false },
  { name: 'Public Relations Officer', multiple: false },
  { name: 'Business Manager', multiple: false },
  { name: 'Year Representative', multiple: true },
]

const COLUMNS = 'id, organization_id, name, sort_order, allow_multiple, created_at'

/* Isinasalin ang error ng database sa mensaheng maiintindihan */
export function positionErrorMessage(err) {
  if (err?.code === '23505') return 'This organization already has a position with that name.'
  if (err?.code === '23503') {
    return 'Someone still holds this position. Remove them from it on the Members page first.'
  }
  if (err?.code === '42501' || err?.message === 'not-allowed') {
    return "You don't have permission to change this organization's positions."
  }
  /* Galing sa "raise exception" ng database — nakasulat na sa English */
  if (err?.code === 'P0001' && err.message) return err.message
  return 'Could not save. Please try again.'
}

/* Pagkakasunod-sunod: sort_order, tapos pangalan */
function byOrder(a, b) {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name)
}

/* orgId = null → lahat ng nakikita mo (RLS ang nagsasala:
   sariling org lang, o lahat kung SAO pataas / IT Admin) */
export async function fetchPositions(orgId = null) {
  let query = supabase.from('officer_positions').select(COLUMNS)
  if (orgId) query = query.eq('organization_id', orgId)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).sort(byOrder)
}

/* Mga officer ng org na may position, para makita sa Org Profile
   kung sino ang may hawak ng bawat isa */
export async function fetchPositionHolders(orgId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, middle_name, last_name, avatar_url, position_id')
    .eq('organization_id', orgId)
    .not('position_id', 'is', null)

  if (error) throw error
  return data ?? []
}

export async function createPosition(orgId, { name, allowMultiple = false }, sortOrder) {
  const { data, error } = await supabase
    .from('officer_positions')
    .insert({
      organization_id: orgId,
      name: name.trim(),
      allow_multiple: allowMultiple,
      sort_order: sortOrder,
    })
    .select(COLUMNS)
    .single()

  if (error) throw error
  return data
}

/* Idinadagdag ang mga nasa COMMON_POSITIONS na wala pa sa org,
   sa dulo ng listahan */
export async function addCommonPositions(orgId, existing) {
  const have = new Set(existing.map((p) => p.name.trim().toLowerCase()))
  const start = existing.reduce((max, p) => Math.max(max, p.sort_order), -1) + 1

  const rows = COMMON_POSITIONS.filter((p) => !have.has(p.name.toLowerCase()))
    .slice(0, Math.max(0, POSITION_LIMIT - existing.length))
    .map((p, i) => ({
      organization_id: orgId,
      name: p.name,
      allow_multiple: p.multiple,
      sort_order: start + i,
    }))

  if (rows.length === 0) return []

  const { data, error } = await supabase.from('officer_positions').insert(rows).select(COLUMNS)
  if (error) throw error
  return data ?? []
}

export async function updatePosition(id, values) {
  const { data, error } = await supabase
    .from('officer_positions')
    .update(values)
    .eq('id', id)
    .select(COLUMNS)

  if (error) throw error
  /* Walang row na bumalik = hinarang ng RLS */
  if (!data || data.length === 0) throw new Error('not-allowed')
  return data[0]
}

export function renamePosition(id, name) {
  return updatePosition(id, { name: name.trim() })
}

export function setAllowMultiple(id, allowMultiple) {
  return updatePosition(id, { allow_multiple: allowMultiple })
}

/* Inilalagay ulit ang sort_order ayon sa bagong pagkakasunod-sunod.
   Ang mga nagbago lang ang ina-update. */
export async function reorderPositions(ordered) {
  const changes = ordered
    .map((p, index) => ({ p, index }))
    .filter(({ p, index }) => p.sort_order !== index)

  const updated = await Promise.all(
    changes.map(({ p, index }) => updatePosition(p.id, { sort_order: index })),
  )

  const byId = new Map(updated.map((p) => [p.id, p]))
  return ordered.map((p, index) => byId.get(p.id) ?? { ...p, sort_order: index })
}

export async function deletePosition(id) {
  const { data, error } = await supabase.from('officer_positions').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('not-allowed')
}

/* ---------- PAG-ASSIGN (Members page) ----------

   positionId = id ng position → magiging Officer ang member
   positionId = null           → tatanggalin, magiging Member

   May notification na matatanggap ang member, at magbabago agad
   ang sidebar niya (tingnan ang AuthProvider). */
export async function setOfficerPosition(profileId, positionId) {
  const { error } = await supabase.rpc('set_officer_position', {
    p_profile: profileId,
    p_position: positionId,
  })
  if (error) throw error
}
