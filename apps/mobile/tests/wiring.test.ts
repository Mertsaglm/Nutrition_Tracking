// ============================================================================
// lib/{supabase,services,ai,store}.ts — MOBİL platform bağlantıları.
//
// Mobilde web'den farklı üç kritik ayar var:
//   1) Oturum AsyncStorage'da saklanır (yoksa her açılışta çıkış yapılır).
//   2) URL'den oturum tespiti KAPALIDIR (mobilde adres çubuğu yok).
//   3) AI çağrıları uzak sunucuya (EXPO_PUBLIC_API_URL) gider — Gemini anahtarı
//      cihazda tutulmaz.
// Bu ayarlardan biri kayarsa uygulama "çalışıyor" görünür ama oturum ya da AI
// sessizce bozulur.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const createClientMock = vi.fn(() => ({ auth: { getSession: getSessionMock } }))

const asyncStorageMock = {
  getItem: vi.fn().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...(args as [])),
}))

vi.mock('react-native-url-polyfill/auto', () => ({}))

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}))

function clientOptions() {
  const [url, anonKey, options] = createClientMock.mock.calls[0] as unknown as [
    string,
    string,
    { auth: Record<string, unknown> },
  ]
  return { url, anonKey, auth: options.auth }
}

describe('mobil kablolaması', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://project.supabase.co')
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-key')
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://app.example.com')
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
      await import('../lib/supabase')
      const { url, anonKey } = clientOptions()
      expect(url).toBe('https://project.supabase.co')
      expect(anonKey).toBe('public-anon-key')
    })

    it('oturumu AsyncStorage’da saklar', async () => {
      await import('../lib/supabase')
      expect(clientOptions().auth.storage).toBe(asyncStorageMock)
    })

    it('URL’den oturum tespiti KAPALIDIR', async () => {
      await import('../lib/supabase')
      expect(clientOptions().auth.detectSessionInUrl).toBe(false)
    })

    it('oturumu kalıcı tutar ve token’ı yeniler', async () => {
      await import('../lib/supabase')
      expect(clientOptions().auth).toMatchObject({
        persistSession: true,
        autoRefreshToken: true,
      })
    })
  })

  describe('servisler', () => {
    it('tek bir istemci üzerinden kurulur', async () => {
      const { authService, databaseService } = await import('../lib/services')

      expect(typeof authService.signIn).toBe('function')
      expect(typeof databaseService.saveMealLog).toBe('function')
      expect(createClientMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('AI istemcisi', () => {
    async function callAnalyze() {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const { aiClient } = await import('../lib/ai')
      await aiClient.analyzeMeal('2 yumurta', 'Kahvaltı', 400)
      return fetchMock
    }

    it('uzak sunucuya (EXPO_PUBLIC_API_URL) gider', async () => {
      const fetchMock = await callAnalyze()
      expect(fetchMock.mock.calls[0][0]).toBe('https://app.example.com/api/analyze-meal')
    })

    it('oturum token’ını gönderir', async () => {
      getSessionMock.mockResolvedValue({ data: { session: { access_token: 'jwt-mobile' } } })
      const fetchMock = await callAnalyze()

      const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer jwt-mobile')
    })

    it('istek gövdesinde AI anahtarı taşımaz', async () => {
      const fetchMock = await callAnalyze()
      const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string
      expect(body.toUpperCase()).not.toContain('GEMINI')
      expect(body).not.toMatch(/AIza/)
    })
  })

  describe('store', () => {
    it('AsyncStorage ile kurulur ve kullanılabilir', async () => {
      const { useNutritionStore } = await import('../lib/store')

      expect(typeof useNutritionStore.getState).toBe('function')
      expect(useNutritionStore.getState().fiberTarget).toBe(25)
      expect(() => useNutritionStore.getState().initializeDay('2026-03-15')).not.toThrow()
      expect(useNutritionStore.getState().dailyProgress?.date).toBe('2026-03-15')
    })
  })
})
