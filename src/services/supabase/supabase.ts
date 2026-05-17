import { createClient } from '@supabase/supabase-js'

const BACKEND_TYPE = import.meta.env.VITE_BACKEND_TYPE || 'supabase'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Only initialize Supabase client if backend type is supabase and credentials are provided
export const supabase = BACKEND_TYPE === 'supabase' && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
