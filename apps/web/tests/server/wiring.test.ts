// ============================================================================
// lib/{supabase,services,ai}.ts — WEB platform bağlantıları.
//
// Bu dosyalar birkaç satırlık "kablolama" modülleri; ama platform farklarını
// tam olarak burada belirliyorlar (tarayıcı depolaması, OAuth callback tespiti,
// same-origin AI çağrısı, istek başına oturum token'ı). Bir satırlık yanlış
// ayar, hiçbir tip hatası vermeden girişi ya da AI'ı bozar.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const createClientMock = vi.fn(() => ({ auth: { getSession: getSessionMock } }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...(args as [])),
}))

/** createClient'a geçirilen seçenekler. */
function clientOptions() {
  const [url, anonKey, options] = createClientMock.mock.calls[0] as unknown as [
    string,
    string,
    { auth: Record<string, unknown> },
  ]
  return { url, anonKey, auth: options.auth }
}

describe('web kablolaması', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-key')
    createClientMock.mockClear()
    getSessionMock.mockReset().mockResolvedValue({ data: { session: null } })
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  describe('Supabase istemcisi', () => {
    it('env değerleriyle kurulur', async () => {
      await import('@/lib/supabase')
      const { url, anonKey } = clientOptions()
      expect(url).toBe('https://project.supabase.co')
      expect(anonKey).toBe('public-anon-key')
    })

    it('URL’den oturum tespiti AÇIKTIR (OAuth callback sayfası için)', async () => {
      await import('@/lib/supabase')
      expect(clientOptions().auth.detectSessionInUrl).toBe(true)
    })

    it('tarayıcı varsayılan depolamasını kullanır (storage geçilmez)', async () => {
      await import('@/lib/supabase')
      expect(clientOptions().auth).not.toHaveProperty('storage')
    })

    it('oturumu kalıcı tutar', async () => {
      await import('@/lib/supabase')
      expect(clientOptions().auth).toMatchObject({
        persistSession: true,
        autoRefreshToken: true,
      })
    })
  })

  describe('servisler', () => {
    it('auth ve database servisleri aynı istemciyi paylaşır', async () => {
      const { authService, databaseService } = await import('@/lib/services')

      expect(typeof authService.signIn).toBe('function')
      expect(typeof databaseService.saveMealLog).toBe('function')
      // Tek bir Supabase istemcisi kurulmuş olmalı (çift oturum olmasın).
      expect(createClientMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('AI istemcisi', () => {
    it('same-origin çağrı yapar (baseUrl yok)', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { aiClient } = await import('@/lib/ai')
      await aiClient.analyzeMeal('2 yumurta', 'Kahvaltı', 400)

      expect(fetchMock.mock.calls[0][0]).toBe('/api/analyze-meal')
    })

    it('her istekte oturum token’ını gönderir', async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: 'jwt-abc' } } })
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { aiClient } = await import('@/lib/ai')
      await aiClient.analyzeMeal('2 yumurta', 'Kahvaltı', 400)

      const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer jwt-abc')
    })

    it('oturum yoksa token göndermez (sunucu 401 döner)', async () => {
      getSessionMock.mockResolvedValue({ data: { session: null } })
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { aiClient } = await import('@/lib/ai')
      await aiClient.analyzeMeal('2 yumurta', 'Kahvaltı', 400)

      const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
      expect(headers).not.toHaveProperty('Authorization')
    })

    it('iki AI işlemini de sunar', async () => {
      const { aiClient } = await import('@/lib/ai')
      expect(typeof aiClient.analyzeMeal).toBe('function')
      expect(typeof aiClient.generateSampleMealPlan).toBe('function')
    })
  })
})
