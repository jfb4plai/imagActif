import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const cleAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !cleAnon) throw new Error('Variables Supabase manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')

export const supabase = createClient(url, cleAnon)
