import { createSupabaseClient } from '@nutrition/core'
import { ENV } from './env'

// Tarayıcı client'ı — varsayılan storage + OAuth callback için URL oturum tespiti açık.
export const supabase = createSupabaseClient({
  url: ENV.supabaseUrl,
  anonKey: ENV.supabaseAnonKey,
  detectSessionInUrl: true,
})
