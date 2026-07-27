// ============================================================================
// supabase/client.ts — platformdan bağımsız Supabase istemci fabrikası.
//
// Web ve mobil aynı fabrikayı farklı ayarlarla kullanır:
//   web    → tarayıcı depolaması + detectSessionInUrl:true (OAuth callback)
//   mobil  → AsyncStorage        + detectSessionInUrl:false (URL yok)
// Bu varsayılanlar bozulursa web'de OAuth girişi, mobilde oturum kalıcılığı
// sessizce çalışmaz.
// ============================================================================
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.fn(() => ({ fake: 'client' }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...(args as [])),
}))

const { createSupabaseClient } = await import('@nutrition/core')

const URL = 'https://project.supabase.co'
const ANON_KEY = 'public-anon-key'

/** createClient’a geçirilen auth ayarları. */
function authOptions() {
  const [, , options] = createClientMock.mock.calls[0] as unknown as [
    string,
    string,
    { auth: Record<string, unknown> },
  ]
  return options.auth
}

describe('createSupabaseClient', () => {
  beforeEach(() => {
    createClientMock.mockClear()
  })

  it('URL ve anon anahtarı iletir', () => {
    createSupabaseClient({ url: URL, anonKey: ANON_KEY })
    expect(createClientMock.mock.calls[0][0]).toBe(URL)
    expect(createClientMock.mock.calls[0][1]).toBe(ANON_KEY)
  })

  it('oturumu kalıcı tutar ve token’ı otomatik yeniler', () => {
    createSupabaseClient({ url: URL, anonKey: ANON_KEY })
    expect(authOptions()).toMatchObject({ autoRefreshToken: true, persistSession: true })
  })

  it('createClient’ın döndürdüğü istemciyi aynen verir', () => {
    expect(createSupabaseClient({ url: URL, anonKey: ANON_KEY })).toEqual({ fake: 'client' })
  })

  describe('detectSessionInUrl varsayılanı', () => {
    it('depolama verilmezse açıktır (web: OAuth callback)', () => {
      createSupabaseClient({ url: URL, anonKey: ANON_KEY })
      expect(authOptions().detectSessionInUrl).toBe(true)
    })

    it('depolama verilirse kapalıdır (mobil: URL yok)', () => {
      const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      createSupabaseClient({ url: URL, anonKey: ANON_KEY, storage })
      expect(authOptions().detectSessionInUrl).toBe(false)
    })

    it('açıkça verilen değer varsayılanı ezer', () => {
      const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      createSupabaseClient({ url: URL, anonKey: ANON_KEY, storage, detectSessionInUrl: true })
      expect(authOptions().detectSessionInUrl).toBe(true)

      createClientMock.mockClear()
      createSupabaseClient({ url: URL, anonKey: ANON_KEY, detectSessionInUrl: false })
      expect(authOptions().detectSessionInUrl).toBe(false)
    })
  })

  describe('depolama enjeksiyonu', () => {
    it('verilen depolamayı iletir (AsyncStorage)', () => {
      const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      createSupabaseClient({ url: URL, anonKey: ANON_KEY, storage })
      expect(authOptions().storage).toBe(storage)
    })

    it('verilmezse storage anahtarını hiç eklemez (tarayıcı varsayılanı)', () => {
      createSupabaseClient({ url: URL, anonKey: ANON_KEY })
      expect(authOptions()).not.toHaveProperty('storage')
    })
  })

  it('her çağrıda yeni istemci üretir (paylaşılan global yok)', () => {
    createSupabaseClient({ url: URL, anonKey: ANON_KEY })
    createSupabaseClient({ url: URL, anonKey: ANON_KEY })
    expect(createClientMock).toHaveBeenCalledTimes(2)
  })
})
