import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseReady = Boolean(url && anonKey)

// Si el proyecto aún no tiene Supabase conectado, exportamos null y cada
// pantalla usa datos de ejemplo (src/data/mockData.js) en su lugar.
export const supabase = supabaseReady ? createClient(url, anonKey) : null
