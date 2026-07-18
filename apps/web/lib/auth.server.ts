// ============================================================================
// SUNUCU-ONLY: AI route'ları için istek kimlik doğrulama.
// İstemci, Supabase erişim token'ını Authorization başlığında gönderir; burada
// token doğrulanır. Böylece AI uç noktaları anonim çağrılara (kota/maliyet
// istismarı) kapatılır. Anon key public'tir; yalnızca token doğrulaması için kullanılır.
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * İstekteki Bearer token'ı doğrular. Geçerliyse kullanıcı id'sini, değilse
 * null döner. Yapılandırma eksikse (env yok) de null döner.
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null

  const header = request.headers.get('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}
