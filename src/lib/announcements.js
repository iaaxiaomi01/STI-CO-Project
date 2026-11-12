import { supabase } from './supabaseClient.js'
import { getRoleConfig, isSchoolAdmin, roleKeyFromId } from '../config/roles.js'
import { toTitleCase } from './profile.js'
import { checkImageFile, extensionFor, ImageError, resizeToFit } from './image.js'

/* ============================================================
   ANNOUNCEMENTS — lahat ng pakikipag-usap sa database

   Walang .eq('organization_id', ...) sa pagkuha, at sinadya
   iyon. Ang RLS sa Supabase na ang nagsasala: announcements
   ng SARILI mong org + mga GLOBAL na post (is_global = true,
   galing sa org na may can_announce_all) ang ibabalik.
   Tingnan ang ANNOUNCE_ALL_ORGS.sql.

   Sa paggawa, dumadaan sa post_announcement() (RPC) para
   sabay na magawa ang post at ang mga piniling org. Title,
   message, type, picture at kung para kanino lang ang
   ipinapadala. Ang org, author, role at petsa ay itinatakda ng
   trigger sa database — hindi mapepeke mula sa browser.

   Picture (optional): announcement-images/<org id>/<timestamp>.webp
   PER ORG — sa folder ng org ng nag-post lang pwedeng mag-upload,
   at sinusuri ng trigger na galing doon ang image_url.
   Tingnan ang ANNOUNCEMENT_IMAGES.sql.

   SCHOOL ADMINISTRATOR (SA_REMOVE_ACTING_ORG.sql):
     Walang org ang SA, kaya ang post niya ay walang
     organization_id. Para lang ito sa LAHAT ng org o sa PILING
     org. Ang picture niya ay nasa announcement-images/school-admin/.
     Nakikita niya ang lahat ng announcement, pero ang SARILI
     niyang post lang ang naa-edit/nabubura niya
     (ANNOUNCEMENT_AUTHOR_ONLY.sql).
   ============================================================ */

const BUCKET = 'announcement-images'
const IMAGE_MAX_SIDE = 1600

/* Folder ng picture ng mga post ng School Administrator (walang org).
   Dapat tugma sa SA_REMOVE_ACTING_ORG.sql. */
const SCHOOL_ADMIN_FOLDER = 'school-admin'

/* Dapat tugma sa check constraint na announcements_type_valid */
export const ANNOUNCEMENT_TYPES = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'urgent', label: 'Urgent' },
]

export const TITLE_MAX = 150
export const MESSAGE_MAX = 5000

export function typeLabel(value) {
  return ANNOUNCEMENT_TYPES.find((t) => t.value === value)?.label ?? value
}

const COLUMNS = `
  id, organization_id, title, message, type, is_global, image_url,
  author_id, author_name, author_role_id,
  created_at, updated_at, updated_by,
  organizations!announcements_organization_id_fkey ( name ),
  announcement_orgs ( organizations ( name ) )
`

/* Para kanino ang post — "Post to" sa form.
   'selected' = may rows sa announcement_orgs
   Ang School Administrator ay walang 'own' (wala siyang org). */
export const AUDIENCES = [
  { value: 'own', label: 'My organization only' },
  { value: 'all', label: 'All organizations' },
  { value: 'selected', label: 'Selected organizations' },
]

/* Isinasalin ang error sa mensaheng maiintindihan */
export function announcementErrorMessage(err) {
  if (err instanceof ImageError) return err.message
  if (err?.message === 'not-allowed') {
    return "You don't have permission to change this announcement."
  }
  /* Galing sa "raise exception" ng trigger/RPC */
  if (err?.code === 'P0001' && err.message) return err.message
  return 'Could not save. Please try again.'
}

/* ============================================================
   ANNOUNCE SA LAHAT NG ORG

   Ang org na may organizations.can_announce_all = true (IT
   Admin ang nagse-set, sa database) ay kayang mag-post para sa
   LAHAT ng org — Officer at Adviser lang nito. Ang Member ay
   gaya pa rin ng ibang Member: hindi nakakapag-post.

   Para lang ito sa pagtatago/pagpapakita ng UI. Ang RLS pa rin
   ang totoong nagbabantay.
   ============================================================ */
export function orgCanAnnounceAll(profile) {
  return Boolean(profile?.is_active && profile?.organizations?.can_announce_all)
}

/* May "Post to: All organizations" ba sa form —
   Officer/Adviser (can.announce) ng special org, at ang School
   Administrator (laging lahat o piling org lang) */
export function canPostToAllOrgs(profile, can) {
  return Boolean(can?.announce) && (orgCanAnnounceAll(profile) || isSchoolAdmin(profile))
}

export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select(COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/* ---------- PICTURE ---------- */

/* folder = id ng org, o SCHOOL_ADMIN_FOLDER kapag walang org
   (post ng School Administrator) */
async function uploadImage(orgId, file) {
  const folder = orgId || SCHOOL_ADMIN_FOLDER
  checkImageFile(file)

  const blob = await resizeToFit(file, IMAGE_MAX_SIDE)
  const path = `${folder}/${Date.now()}.${extensionFor(blob)}`

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

/* ".../object/public/announcement-images/<org>/<file>" → "<org>/<file>" */
function pathFromUrl(url) {
  if (!url) return null
  const marker = `/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0])
}

/* Hindi kritikal kapag pumalya — lumang file lang ang maiiwan */
async function removeFiles(paths) {
  const clean = paths.filter(Boolean)
  if (clean.length === 0) return
  try {
    const { error } = await supabase.storage.from(BUCKET).remove(clean)
    if (error) throw error
  } catch (err) {
    console.warn('Hindi nabura ang larawan ng announcement:', err)
  }
}

/* ---------- GUMAWA / MAG-EDIT / MAG-BURA ---------- */

/* values:  { title, message, type, audience, orgIds }
     audience: 'own' | 'all' | 'selected'
     orgIds:   mga piniling org kapag 'selected' (hindi kasama ang
               sariling org — laging kasama na iyon)
   options: { orgId, imageFile }
     orgId:     org ng nag-post (folder ng picture); null = School
                Administrator
     imageFile: picture (optional) */
export async function createAnnouncement(
  { title, message, type, audience = 'own', orgIds = [] },
  { orgId = null, imageFile = null } = {},
) {
  let uploaded = null
  if (imageFile) {
    uploaded = await uploadImage(orgId, imageFile)
  }

  const { data: id, error } = await supabase.rpc('post_announcement', {
    p_title: title,
    p_message: message,
    p_type: type,
    p_is_global: audience === 'all',
    p_org_ids: audience === 'selected' ? orgIds : [],
    p_image_url: uploaded?.publicUrl ?? null,
  })
  if (error) {
    /* Hindi na-post → burahin ang na-upload para walang maiwang file */
    if (uploaded) await removeFiles([uploaded.path])
    throw error
  }

  const { data, error: readError } = await supabase
    .from('announcements')
    .select(COLUMNS)
    .eq('id', id)
    .single()

  if (readError) throw readError
  return data
}

/* Mga org na pwedeng piliin sa "Selected organizations":
   lahat ng aktibong org maliban sa sarili (ang School
   Administrator ay walang sariling org → lahat) */
export async function fetchTargetOrganizations(ownOrgId) {
  let query = supabase
    .from('organizations')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (ownOrgId) query = query.neq('id', ownOrgId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/* Hindi kasama kung para kanino — hindi na ito nababago
   pagkatapos i-post (ini-lock ng announcements_before_update at
   ng RLS ng announcement_orgs).

   options.imageFile   → bagong picture
   options.removeImage → alisin ang kasalukuyang picture */
export async function updateAnnouncement(
  announcement,
  { title, message, type },
  { imageFile = null, removeImage = false } = {},
) {
  const row = { title, message, type }

  let uploaded = null
  if (imageFile) {
    uploaded = await uploadImage(announcement.organization_id, imageFile)
    row.image_url = uploaded.publicUrl
  } else if (removeImage) {
    row.image_url = null
  }

  const { data, error } = await supabase
    .from('announcements')
    .update(row)
    .eq('id', announcement.id)
    .select(COLUMNS)

  if (error || !data || data.length === 0) {
    if (uploaded) await removeFiles([uploaded.path])
    if (error) throw error
    /* Walang row na bumalik = hinarang ng RLS (wala kang pahintulot) */
    throw new Error('not-allowed')
  }

  /* Napalitan o inalis → burahin ang lumang file */
  if ((uploaded || removeImage) && announcement.image_url) {
    await removeFiles([pathFromUrl(announcement.image_url)])
  }
  return data[0]
}

export async function deleteAnnouncement(announcement) {
  const { data, error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcement.id)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('not-allowed')

  await removeFiles([pathFromUrl(announcement.image_url)])
}

/* Ilang announcement ang lumabas sa nakaraang ilang araw —
   para sa stat tile sa Dashboard. */
export async function countRecentAnnouncements(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('announcements')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)

  if (error) throw error
  return count ?? 0
}

/* ============================================================
   SINO ANG PWEDENG MAG-EDIT / MAG-DELETE

   KAPAREHO ito ng can_manage_announcement() sa database. Dito,
   para lang itago ang mga button. Ang database pa rin ang
   totoong nagbabantay — kapag binago mo ang isa, baguhin
   mo rin ang isa (ANNOUNCEMENT_AUTHOR_ONLY.sql).

   ANG GUMAWA LANG. Walang ibang makakapag-edit/delete ng post
   mo — kahit Adviser o School Administrator.

     Officer / Adviser    → sariling post lang, at nasa org pa
                            rin siya na pinag-postan niya
     School Administrator → sariling post lang (walang org)

   Kapag hindi na Officer/Adviser ang gumawa (hal. naging Member)
   o lumipat na siya ng org, hindi na niya ito mae-edit/delete.
   ============================================================ */
export function canManageAnnouncement(announcement, profile) {
  if (!profile?.is_active) return false
  if (!announcement.author_id || announcement.author_id !== profile.id) return false

  /* Nagpapaskil pa rin: Officer, Adviser o School Administrator */
  if (![2, 3, 8].includes(profile.role_id)) return false

  /* Post ng org → nasa org na iyon ka pa rin.
     Post ng School Administrator → walang org (pareho ng profile niya). */
  return (announcement.organization_id ?? null) === (profile.organization_id ?? null)
}

/* Mga pangalan ng piniling org (walang laman = hindi 'selected') */
function targetNames(announcement) {
  return (announcement.announcement_orgs ?? [])
    .map((t) => t.organizations?.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

/* 'own' | 'all' | 'selected' */
export function audienceOf(announcement) {
  if (announcement.is_global) return 'all'
  if ((announcement.announcement_orgs ?? []).length > 0) return 'selected'
  return 'own'
}

/* "Student Council, Org A, Org B" — kasama ang org ng gumawa
   (wala kapag School Administrator ang gumawa).
   null kapag hindi 'selected'. */
export function selectedOrgsLabel(announcement) {
  if (audienceOf(announcement) !== 'selected') return null
  const own = announcement.organizations?.name
  return [own, ...targetNames(announcement)].filter(Boolean).join(', ')
}

/* "Juan Dela Cruz · Officer"
   Para sa ibang org: "Juan Dela Cruz · Officer · Student Council"
   School Administrator: "Juan Dela Cruz · School Administrator" */
export function authorLabel(announcement) {
  const name = toTitleCase(announcement.author_name)
  const role = getRoleConfig(roleKeyFromId(announcement.author_role_id)).label
  const org =
    audienceOf(announcement) !== 'own' ? announcement.organizations?.name : null
  return org ? `${name} · ${role} · ${org}` : `${name} · ${role}`
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/* Na-edit kung may nag-update pagkatapos gawin */
export function wasEdited(announcement) {
  return Boolean(announcement.updated_by)
}