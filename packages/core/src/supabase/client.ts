// ============================================================================
// Supabase client fabrikası — storage platformdan enjekte edilir
// (web: tarayıcı varsayılanı · mobil: AsyncStorage)
// ============================================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/** Minimal storage arayüzü (AsyncStorage ile uyumlu). */
export interface SupabaseStorage {
  getItem(key: string): Promise<string | null> | string | null
  setItem(key: string, value: string): Promise<void> | void
  removeItem(key: string): Promise<void> | void
}

export interface SupabaseConfig {
  url: string
  anonKey: string
  /** Mobilde AsyncStorage geçilir; web'de verilmezse tarayıcı varsayılanı kullanılır. */
  storage?: SupabaseStorage
  /** URL'de oturum tespiti (web OAuth callback için true). */
  detectSessionInUrl?: boolean
}

export type TypedSupabaseClient = SupabaseClient<Database>

export function createSupabaseClient(config: SupabaseConfig): TypedSupabaseClient {
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: config.detectSessionInUrl ?? !config.storage,
      ...(config.storage ? { storage: config.storage } : {}),
    },
  })
}
