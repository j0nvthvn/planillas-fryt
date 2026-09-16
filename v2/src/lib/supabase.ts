import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { fetchConTimeout } from './fetchConTimeout'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (ver .env.example)')
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: { headers: { 'x-client-info': 'frytcontrol-v2' }, fetch: fetchConTimeout },
})

export const SUPABASE_URL = url
