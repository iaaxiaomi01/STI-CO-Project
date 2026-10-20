import { supabase } from './supabaseClient.js'

/* ============================================================
   ORGANIZATION HEALTH — lahat ng pakikipag-usap sa database

   Tingnan ang supabase/ORG_HEALTH.sql para sa buong paliwanag.
   Sa maikling salita, ang DATABASE ang nagkukuwenta ng lahat,
   mula sa LAHAT ng natapos na event ng org:

     Attendance Rate    = may Time In at Time Out ÷ nag-Join × 100
     Participation Rate = member na naka-attend sa kahit isang
                          event ÷ aktibong member × 100
     Health Score       = average ng dalawa

     Adviser           → fetchOrgHealth()     sariling org
     SAO, School Head  → fetchAllOrgHealth()  lahat ng org
   ============================================================ */

/* SAO (4) at School Head (6) ang may listahan ng lahat ng org.
   KAPAREHO ng pagsusuri sa org_health_all() sa ORG_HEALTH.sql. */
export function seesAllOrgHealth(profile) {
  return profile?.role_id === 4 || profile?.role_id === 6
}

/* ---------- KLASIPIKASYON ----------
   KAPAREHO ng mga hangganan sa ORG_HEALTH.sql. Ang database ang
   nagbibigay ng classification; para lang ito sa kulay at
   paliwanag sa page. */
export const HEALTH_LEVELS = [
  { name: 'Healthy', tone: 'healthy', rule: '80 and above' },
  { name: 'Needs Attention', tone: 'attention', rule: '60 to below 80' },
  { name: 'Critical', tone: 'critical', rule: 'Below 60' },
]

export function toneOf(classification) {
  return HEALTH_LEVELS.find((l) => l.name === classification)?.tone ?? 'none'
}

/* ---------- DATABASE ---------- */

/* Adviser: health ng sariling org.
   SAO/School Head: ipasa ang orgId. */
export async function fetchOrgHealth(orgId = null) {
  const { data, error } = await supabase.rpc('org_health', { p_org: orgId })
  if (error) throw error
  return data
}

/* SAO/School Head: health ng LAHAT ng aktibong org (iisang tawag) */
export async function fetchAllOrgHealth() {
  const { data, error } = await supabase.rpc('org_health_all')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

/* Critical muna (pinakamababang score), saka ang walang sapat
   na data sa dulo — para makita agad kung sino ang kailangang
   tulungan. */
export function sortByConcern(list) {
  return [...list].sort((a, b) => {
    const as = a.score == null ? Infinity : Number(a.score)
    const bs = b.score == null ? Infinity : Number(b.score)
    if (as !== bs) return as - bs
    return String(a.organization_name).localeCompare(String(b.organization_name))
  })
}

/* ---------- FORMAT ---------- */

/* 72.5 → "72.5%", 80 → "80%", null → "—" */
export function formatRate(n) {
  if (n == null) return '—'
  const v = Number(n)
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`
}

export function formatScore(n) {
  if (n == null) return '—'
  const v = Number(n)
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export function orgHealthErrorMessage(err) {
  /* Galing sa "raise exception" — nakasulat na sa Tagalog */
  if (err?.code === 'P0001' && err.message) return err.message
  return 'There was a problem connecting to the database. Please try again later.'
}
