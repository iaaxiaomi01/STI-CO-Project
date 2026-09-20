import { createClient } from '@supabase/supabase-js'

/* ============================================================
   SUPABASE CLIENT
   Isang client lang para sa buong app. Ito ang gagamitin mo
   para sa auth AT para sa database mamaya.

   TUNGKOL SA "ANON KEY":
   Hindi ito sikreto. Sinadya itong makita sa browser — iyon
   ang trabaho niya. Ang nagbabantay sa data mo ay ang Row
   Level Security (RLS) sa Supabase, hindi ang pagtatago ng key.

   Ang TOTOONG sikreto ay dalawa, at pareho silang HINDI dapat
   mapunta dito kailanman:
     - ang "service_role" key ng Supabase
     - ang client secret ng Microsoft app mo
   Sa dashboard lang ng Supabase nakatira ang Microsoft client
   secret. Walang bahagi nito ang dadaan sa code na ito.
   ============================================================ */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Kulang ang Supabase config. Gumawa ng .env.local sa root ng ' +
      'project na may VITE_SUPABASE_URL at VITE_SUPABASE_ANON_KEY, ' +
      'tapos i-restart ang dev server.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
