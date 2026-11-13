/* ============================================================
   TOUR — tanda kung tapos na ang walkthrough

   Naka-save sa localStorage ng browser, HINDI sa database.
   Hiwalay ang tanda bawat user AT bawat role, kaya kapag naging
   Officer ang isang Member, makikita niya ulit ang tour (iba na
   kasi ang sidebar niya).

   Kapag nag-login sa ibang device o browser, lalabas ulit ang
   tour — pwedeng pindutin ang "Skip tour".

   Gusto mong ipakita ulit ang tour sa LAHAT? Palitan ang
   VERSION (hal. 'v2'). Gagawin nitong "hindi pa nakita" ang
   lahat ng lumang tanda.
   ============================================================ */

const VERSION = 'v1'

function keyFor(userId, role) {
  return `stico:tour:${VERSION}:${userId}:${role ?? 'none'}`
}

export function hasSeenTour(userId, role) {
  try {
    return window.localStorage.getItem(keyFor(userId, role)) === 'done'
  } catch {
    /* Naka-block ang storage (hal. private mode sa ibang browser).
       Ituring na "nakita na" para hindi lumabas ang tour bawat
       bukas ng page. Mapapanood pa rin gamit ang ? na button. */
    return true
  }
}

export function markTourSeen(userId, role) {
  try {
    window.localStorage.setItem(keyFor(userId, role), 'done')
  } catch {
    /* walang magagawa kung naka-block ang storage */
  }
}
