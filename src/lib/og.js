import { supabase } from './supabaseClient.js'
import { checkImageFile, extensionFor, ImageError, resizeToSquare } from './image.js'
import { toTitleCase } from './profile.js'
import { getRoleConfig, roleKeyFromId } from '../config/roles.js'

/* ============================================================
   ORGANIZATION GEMS (OG) — lahat ng pakikipag-usap sa database

   Tingnan ang OG_REWARDS_SHOP.sql para sa buong paliwanag.
   Sa maikling salita:

     Officer → og_reward sa Proposal Form (ilang OG bawat dadalo).
               Kusang nakokopya sa event kapag ginawa na ang event.
     KUSA    → releaseDueOg() / pg_cron: pagsara ng attendance,
               nare-release ang OG sa Member at Officer na may
               Time In AT Time Out (OG_REWARD_FROM_PROPOSAL.sql)
     Adviser → saveShopItem()      mga item sa shop ng org
     Member/Officer → redeemItem() bawas agad + claim code
     Officer/Adviser → claimRedemption(code)  naibigay na ang item
     May-ari o Officer/Adviser → cancelRedemption()  ibalik ang OG

   Walang "balance" column. Ang balance ay suma ng og_transactions
   (ledger) ng tao sa org niya. Mga function lang sa database ang
   sumusulat dito — hindi ito mababago mula sa browser.

   Ang mga function dito na "can..." ay para lang itago o ipakita
   ang mga button. Ang database ang totoong nagbabantay.
   ============================================================ */

const BUCKET = 'og-shop-images'
const ITEM_IMAGE_SIZE = 640

export const OG_REWARD_MAX = 1000
export const ITEM_NAME_MAX = 100
export const ITEM_DESCRIPTION_MAX = 1000
export const ITEM_PRICE_MAX = 100000
export const CANCEL_REASON_MAX = 300

/* ---------- SINO ANG PWEDE (para sa mga button lang) ---------- */

/* Member at Officer — sila ang kumikita at bumibili */
export function canEarnOg(profile) {
  return Boolean(profile?.is_active && (profile.role_id === 1 || profile.role_id === 2))
}

/* Adviser — namamahala ng shop */
export function canManageOgShop(profile) {
  return Boolean(profile?.is_active && profile.role_id === 3)
}

/* Officer at Adviser — nagbibigay ng item (claim) */
export function canHandOutItems(profile) {
  return Boolean(profile?.is_active && (profile.role_id === 2 || profile.role_id === 3))
}

/* ---------- MENSAHE ---------- */

export function ogErrorMessage(err) {
  if (err instanceof ImageError) return err.message
  /* Galing sa "raise exception" ng database — malinaw na ang mensahe */
  if (err?.code === 'P0001' && err.message) return err.message
  if (err?.code === '23514') return 'Some of your input is invalid. Please check the fields.'
  if (err?.code === '42501' || err?.message === 'not-allowed') {
    return "You don't have permission to do this."
  }
  /* Ibang error galing sa database (may code, hal. 42883) — hindi ito
     problema sa internet, kaya ipinapakita ang code para madaling
     hanapin ang sanhi */
  if (err?.code && /^[0-9A-Z]{5}$/.test(err.code)) {
    return `Something went wrong in the database (error ${err.code}). Please try again later or tell your IT Admin.`
  }
  return 'There was a connection problem. Please try again.'
}

/* "1,250" */
export function formatOg(n) {
  return Number(n || 0).toLocaleString('en-PH')
}

/* "Sep 30, 2026, 12:30 AM" */
export function formatOgDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function personLabel(name, roleId) {
  return {
    name: toTitleCase(name ?? ''),
    role: getRoleConfig(roleKeyFromId(roleId)).label,
  }
}

/* ============================================================
   BALANCE AT HISTORY
   ============================================================ */

/* ============================================================
   KUSANG RELEASE
   I-release ang OG ng mga event sa org mo na sarado na ang
   attendance. Ligtas tawagin nang paulit-ulit — isang beses lang
   nare-release ang bawat event. Pang-backup ito ng pg_cron, kaya
   hindi kritikal kapag pumalya.
   ============================================================ */
export async function releaseDueOg() {
  try {
    const { error } = await supabase.rpc('release_due_event_og')
    if (error) throw error
  } catch (err) {
    console.warn('Hindi na-check ang OG na dapat i-release:', err)
  }
}

export async function fetchMyBalance() {
  await releaseDueOg()
  const { data, error } = await supabase.rpc('my_og_balance')
  if (error) throw error
  return Number(data) || 0
}

/* Sariling ledger sa org ngayon, pinakabago muna */
export async function fetchMyTransactions(profileId, orgId) {
  const { data, error } = await supabase
    .from('og_transactions')
    .select('id, amount, kind, description, event_id, redemption_id, created_at')
    .eq('profile_id', profileId)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return data ?? []
}

/* Adviser: OG ng bawat aktibong Member at Officer */
export async function fetchOrgBalances() {
  const { data, error } = await supabase.rpc('org_og_balances')
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...r,
    balance: Number(r.balance) || 0,
    earned: Number(r.earned) || 0,
  }))
}

/* ============================================================
   REWARD BAWAT EVENT
   ============================================================ */

/* { [event_id]: row } — lahat ng reward sa org mo (RLS) */
export async function fetchEventRewards() {
  await releaseDueOg()
  const { data, error } = await supabase
    .from('event_og_rewards')
    .select(
      'event_id, amount, set_at, released_at, released_by_name, recipients, total_released',
    )

  if (error) throw error
  const map = {}
  ;(data ?? []).forEach((r) => {
    map[r.event_id] = r
  })
  return map
}

/* ============================================================
   SHOP
   ============================================================ */

const ITEM_COLUMNS = `
  id, organization_id, name, description, image_url, price, stock,
  limit_per_member, is_active, created_at, updated_at
`

/* Member/Officer: aktibong items lang · Adviser: kasama ang nakatago (RLS) */
export async function fetchShopItems() {
  const { data, error } = await supabase
    .from('og_shop_items')
    .select(ITEM_COLUMNS)
    .order('is_active', { ascending: false })
    .order('price', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

/* og-shop-images/<org id>/<timestamp>.webp */
async function uploadItemImage(orgId, file) {
  checkImageFile(file)
  const blob = await resizeToSquare(file, ITEM_IMAGE_SIZE, 'cover')
  const path = `${orgId}/${Date.now()}.${extensionFor(blob)}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, publicUrl }
}

/* Ang path sa loob ng bucket mula sa public URL */
function pathOfUrl(url) {
  const marker = `/object/public/${BUCKET}/`
  const i = url?.indexOf(marker) ?? -1
  return i === -1 ? null : url.slice(i + marker.length)
}

/* Hindi kritikal kapag pumalya — lumang file lang ang maiiwan */
async function removeImage(url) {
  const path = pathOfUrl(url)
  if (!path) return
  try {
    await supabase.storage.from(BUCKET).remove([path])
  } catch (err) {
    console.warn('Hindi nabura ang larawan ng item:', err)
  }
}

/* "" → null, "5" → 5 */
function toLimit(value) {
  const s = String(value ?? '').trim()
  return s === '' ? null : Number(s)
}

function toItemRow(values) {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    price: Number(values.price),
    stock: toLimit(values.stock),
    limit_per_member: toLimit(values.limitPerMember),
    is_active: Boolean(values.isActive),
  }
}

/* Bago (item = null) o i-edit.
   options.imageFile   → bagong larawan
   options.removeImage → alisin ang kasalukuyang larawan */
export async function saveShopItem(orgId, item, values, { imageFile = null, removeImage: drop = false } = {}) {
  const row = toItemRow(values)

  let uploaded = null
  if (imageFile) {
    uploaded = await uploadItemImage(orgId, imageFile)
    row.image_url = uploaded.publicUrl
  } else if (drop) {
    row.image_url = null
  }

  const query = item
    ? supabase.from('og_shop_items').update(row).eq('id', item.id)
    : supabase.from('og_shop_items').insert(row)

  const { data, error } = await query.select(ITEM_COLUMNS)

  if (error || !data || data.length === 0) {
    if (uploaded) await removeImage(uploaded.publicUrl)
    if (error) throw error
    throw new Error('not-allowed')
  }

  /* Napalitan o inalis ang larawan → burahin ang luma */
  if (item?.image_url && (uploaded || drop)) await removeImage(item.image_url)
  return data[0]
}

/* Itago / ipakita ulit sa shop */
export async function setShopItemActive(item, isActive) {
  const { data, error } = await supabase
    .from('og_shop_items')
    .update({ is_active: isActive })
    .eq('id', item.id)
    .select(ITEM_COLUMNS)

  if (error) throw error
  if (!data || data.length === 0) throw new Error('not-allowed')
  return data[0]
}

/* Nananatili ang mga redemption (kopya ng pangalan at presyo) */
export async function deleteShopItem(item) {
  const { data, error } = await supabase
    .from('og_shop_items')
    .delete()
    .eq('id', item.id)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('not-allowed')
  if (item.image_url) await removeImage(item.image_url)
}

/* ============================================================
   REDEEM, CLAIM, CANCEL
   ============================================================ */

/* Ibinabalik: { id, claim_code, item_name, price, balance } */
export async function redeemItem(itemId) {
  const { data, error } = await supabase.rpc('redeem_og_item', { p_item: itemId })
  if (error) throw error
  return data
}

const REDEMPTION_COLUMNS = `
  id, profile_id, item_id, item_name, price, redeemer_name, redeemer_role_id,
  claim_code, status, created_at, claimed_at, claimed_by, claimed_by_name,
  cancelled_at, cancelled_by, cancelled_by_name, cancel_reason
`

export async function fetchMyRedemptions(profileId) {
  const { data, error } = await supabase
    .from('og_redemptions')
    .select(REDEMPTION_COLUMNS)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/* Officer/Adviser: lahat ng redemption sa org (RLS) */
export async function fetchOrgRedemptions() {
  const { data, error } = await supabase
    .from('og_redemptions')
    .select(REDEMPTION_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) throw error
  return data ?? []
}

/* Tinatanggap ang "OG-7KQ2MX", "og7kq2mx", "7KQ2MX" */
export async function claimRedemption(code) {
  const { data, error } = await supabase.rpc('claim_og_redemption', { p_code: code })
  if (error) throw error
  return data
}

/* Kailangan ng dahilan kapag Officer/Adviser ang nag-cancel */
export async function cancelRedemption(id, reason = '') {
  const { data, error } = await supabase.rpc('cancel_og_redemption', {
    p_id: id,
    p_reason: reason.trim() || null,
  })
  if (error) throw error
  return data
}

export const REDEMPTION_STATUSES = [
  { value: 'pending', label: 'To claim' },
  { value: 'claimed', label: 'Claimed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function redemptionStatusLabel(value) {
  return REDEMPTION_STATUSES.find((s) => s.value === value)?.label ?? value
}