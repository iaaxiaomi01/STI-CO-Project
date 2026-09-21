/* ============================================================
   PROFILE HELPERS

   Iisang lugar para sa pagbuo ng pangalan, para pare-pareho
   ang lalabas sa Sidebar, Dashboard, Profile at Members.

   Naka-ALL CAPS ang karamihan ng pangalan sa student_records
   (hal. "DELA CRUZ"), kaya ginagawa muna itong Title Case.
   ============================================================ */

export function toTitleCase(text) {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase())
}

/* "Juan S. Dela Cruz" */
export function fullNameOf(profile) {
  if (!profile) return ''
  const first = toTitleCase(profile.first_name)
  const middle = profile.middle_name ? ` ${profile.middle_name.charAt(0).toUpperCase()}.` : ''
  const last = toTitleCase(profile.last_name)
  return `${first}${middle} ${last}`.trim()
}

/* Pangalang ipapakita: profile muna (database), tapos
   Microsoft account kung wala pa. */
export function displayNameOf(profile, user) {
  return (
    fullNameOf(profile) ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    'Member'
  )
}

export function firstNameOf(profile, user) {
  if (profile?.first_name) return toTitleCase(profile.first_name).split(' ')[0]
  return displayNameOf(profile, user).split(' ')[0]
}
