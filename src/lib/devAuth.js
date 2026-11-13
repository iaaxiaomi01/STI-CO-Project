/* ============================================================
   DEVELOPER LOGIN — mga helper

   Hiwalay na login para sa developer (email + password), para
   makapag-test ng bawat role nang hindi kailangan ng STI
   Microsoft account.

   DALAWANG KONDISYON BAGO ITO GUMANA:
     1. import.meta.env.DEV  → "npm run dev" lang (Vite dev
        server). Sa "npm run build", false ito, kaya hindi
        kasama sa production ang DevLogin page.
     2. localhost lang       → localhost, 127.0.0.1 o [::1].
        Kahit naka-"npm run dev -- --host" ka at binuksan sa
        ibang device (hal. 192.168.x.x), hindi ito lalabas.

   Kailangan din sa Supabase: DEV_LOGIN.sql (ginagawa nito ang
   mga dev account at hinaharangan ang ibang password sign-up).
   ============================================================ */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function isLocalhost() {
  if (typeof window === 'undefined') return false
  return LOCAL_HOSTNAMES.has(window.location.hostname)
}

/* true lang kapag dev server AT localhost */
export function isDevLoginAllowed() {
  return Boolean(import.meta.env.DEV) && isLocalhost()
}

/* Ang mga dev account ay email + password (provider 'email').
   Ang totoong users ay laging 'azure' (Microsoft). */
export function isDevSessionUser(user) {
  return user?.app_metadata?.provider === 'email'
}

/* ------------------------------------------------------------
   MGA DEV ACCOUNT — isa bawat role

   Dapat TUGMA ang mga email dito sa listahan sa DEV_LOGIN.sql.
   Kapag pinalitan mo ang email doon, palitan mo rin dito.
   ------------------------------------------------------------ */
export const DEV_ACCOUNTS = [
  { email: 'dev.member@sti-co.local', role: 'Member' },
  { email: 'dev.officer@sti-co.local', role: 'Officer' },
  { email: 'dev.adviser@sti-co.local', role: 'Adviser' },
  { email: 'dev.sao@sti-co.local', role: 'SAO' },
  { email: 'dev.schoolhead@sti-co.local', role: 'School Head' },
  { email: 'dev.schooladmin@sti-co.local', role: 'School Administrator' },
]
