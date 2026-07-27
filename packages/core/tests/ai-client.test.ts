// ============================================================================
// ai/client.ts — web ve mobilin AI uç noktalarını çağırdığı HTTP istemcisi.
//
// GÜVENLİK SÖZLEŞMESİ: Gemini anahtarı burada YOKTUR. İstemci yalnızca kendi
// sunucusundaki route'lara, Supabase oturum token'ıyla kimliklenerek gider.
// Token'ın gövdeye/URL'e taşınması ya da Authorization başlığının düşmesi,
// uç noktaları anonim kullanıma açar (kota ve maliyet istismarı).
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_CONFIG, AppError, createAINutritionClient } from '@nutrition/core'

/** Verilen zarfı döndüren sahte bir fetch. */
function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const SAMPLE_ANALYSIS = {
  foods: [],
  totalNutrition: { calories: 500, protein: 30, carbs: 50, fat: 20 },
  analysis: 'ok',
  suggestions: 'ok',
  confidence: 0.9,
}

const SAMPLE_PARAMS = {
  dailyCalories: 2000,
  protein: 150,
  carbs: 200,
  fat: 70,
  mealCount: 3,
  dietaryPreferences: ['vejetaryen'],
  allergies: ['fıstık'],
  goal: 'maintain',
}

/** İlk fetch çağrısının argümanları. */
function firstCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return { url, init, headers: init.headers as Record<string, string> }
}

describe('createAINutritionClient', () => {
  describe('istek şekli', () => {
    it('analyzeMeal doğru uç noktaya POST atar', async () => {
      const fetchMock = mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      await createAINutritionClient().analyzeMeal('2 yumurta', 'Kahvaltı', 500)

      const { url, init, headers } = firstCall(fetchMock)
      expect(url).toBe('/api/analyze-meal')
      expect(init.method).toBe('POST')
      expect(headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(init.body as string)).toEqual({
        description: '2 yumurta',
        mealType: 'Kahvaltı',
        targetCalories: 500,
      })
    })

    it('generateSampleMealPlan doğru uç noktaya POST atar', async () => {
      const fetchMock = mockFetchOnce({ success: true, data: { meals: [], dailyTotals: {}, note: '' } })
      await createAINutritionClient().generateSampleMealPlan(SAMPLE_PARAMS)

      const { url, init } = firstCall(fetchMock)
      expect(url).toBe('/api/sample-meal-plan')
      expect(JSON.parse(init.body as string)).toEqual(SAMPLE_PARAMS)
    })

    it('baseUrl verilmezse same-origin çağrı yapar (web)', async () => {
      const fetchMock = mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      await createAINutritionClient({}).analyzeMeal('yulaf', 'Kahvaltı', 400)
      expect(firstCall(fetchMock).url).toBe('/api/analyze-meal')
    })

    it('baseUrl verilirse tam adrese gider (mobil)', async () => {
      const fetchMock = mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      await createAINutritionClient({ baseUrl: 'https://app.example.com' }).analyzeMeal(
        'yulaf',
        'Kahvaltı',
        400
      )
      expect(firstCall(fetchMock).url).toBe('https://app.example.com/api/analyze-meal')
    })

    it('baseUrl sonundaki eğik çizgiyi temizler (çift // olmaz)', async () => {
      const fetchMock = mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      await createAINutritionClient({ baseUrl: 'https://app.example.com/' }).analyzeMeal(
        'yulaf',
        'Kahvaltı',
        400
      )
      expect(firstCall(fetchMock).url).toBe('https://app.example.com/api/analyze-meal')
    })

    it('iptal sinyali gönderir (zaman aşımı için gerekli)', async () => {
      const fetchMock = mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      await createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      expect(firstCall(fetchMock).init.signal).toBeDefined()
    })
  })

  describe('kimlik doğrulama', () => {
    it('token varsa Authorization başlığı ekler', async () => {
      const fetchMock = mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      const client = createAINutritionClient({ getAuthToken: async () => 'jwt-abc' })
      await client.analyzeMeal('yulaf', 'Kahvaltı', 400)
      expect(firstCall(fetchMock).headers['Authorization']).toBe('Bearer jwt-abc')
    })

    it('senkron token sağlayıcıyı da destekler', async () => {
      const fetchMock = mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      const client = createAINutritionClient({ getAuthToken: () => 'jwt-sync' })
      await client.analyzeMeal('yulaf', 'Kahvaltı', 400)
      expect(firstCall(fetchMock).headers['Authorization']).toBe('Bearer jwt-sync')
    })

    it('token null ise başlık eklenmez (sunucu 401 döner)', async () => {
      const fetchMock = mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      const client = createAINutritionClient({ getAuthToken: async () => null })
      await client.analyzeMeal('yulaf', 'Kahvaltı', 400)
      expect(firstCall(fetchMock).headers).not.toHaveProperty('Authorization')
    })

    it('sağlayıcı hiç verilmezse başlık eklenmez', async () => {
      const fetchMock = mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      await createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      expect(firstCall(fetchMock).headers).not.toHaveProperty('Authorization')
    })

    it('her istekte token yeniden istenir (yenilenen oturum)', async () => {
      mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      const getAuthToken = vi.fn().mockResolvedValue('jwt-1')
      const client = createAINutritionClient({ getAuthToken })
      await client.analyzeMeal('yulaf', 'Kahvaltı', 400)
      await client.analyzeMeal('muz', 'Kuşluk', 200)
      expect(getAuthToken).toHaveBeenCalledTimes(2)
    })

    it('token gövdeye veya URL’e ASLA yazılmaz', async () => {
      const fetchMock = mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      const client = createAINutritionClient({ getAuthToken: async () => 'gizli-token' })
      await client.analyzeMeal('yulaf', 'Kahvaltı', 400)

      const { url, init } = firstCall(fetchMock)
      expect(url).not.toContain('gizli-token')
      expect(init.body as string).not.toContain('gizli-token')
    })
  })

  describe('başarılı yanıt', () => {
    it('zarfın içindeki data alanını döner', async () => {
      mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      const result = await createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      expect(result).toEqual(SAMPLE_ANALYSIS)
    })
  })

  describe('hata yönetimi', () => {
    it('success:false ise sunucunun mesajıyla AppError fırlatır', async () => {
      mockFetchOnce({ success: false, error: 'Geçerli bir yemek açıklaması gerekli' })
      const client = createAINutritionClient()

      await expect(client.analyzeMeal('ab', 'Kahvaltı', 400)).rejects.toThrow(AppError)
      await expect(client.analyzeMeal('ab', 'Kahvaltı', 400)).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Geçerli bir yemek açıklaması gerekli',
      })
    })

    it('HTTP hatasında durum kodunu mesaja koyar', async () => {
      mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS }, { ok: false, status: 500 })
      await expect(
        createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      ).rejects.toMatchObject({ code: 'API_ERROR', message: expect.stringContaining('500') })
    })

    it('401 yanıtında sunucunun mesajını korur', async () => {
      mockFetchOnce({ success: false, error: 'Bu işlem için giriş yapmalısınız' }, { ok: false, status: 401 })
      await expect(
        createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      ).rejects.toMatchObject({ message: 'Bu işlem için giriş yapmalısınız' })
    })

    it('data alanı eksikse hata verir (sessizce undefined dönmez)', async () => {
      mockFetchOnce({ success: true })
      await expect(
        createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      ).rejects.toThrow(AppError)
    })

    it('ağ hatasını NETWORK_ERROR’a çevirir', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
      await expect(
        createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      ).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    })

    it('bozuk JSON yanıtında da AppError üretir', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON')
          },
        })
      )
      await expect(
        createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      ).rejects.toThrow(AppError)
    })

    it('fırlatılan her hata AppError’dur (ham hata sızmaz)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('beklenmedik')))
      await expect(
        createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      ).rejects.toBeInstanceOf(AppError)
    })
  })

  describe('zaman aşımı', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    /** Yalnızca abort sinyaliyle sonlanan bir fetch. */
    function hangingFetch() {
      const fetchMock = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new Error('The operation was aborted.'))
            )
          })
      )
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    it('varsayılan süre dolunca TIMEOUT hatası verir', async () => {
      hangingFetch()
      const promise = createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      const assertion = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' })
      await vi.advanceTimersByTimeAsync(AI_CONFIG.timeoutMs + 10)
      await assertion
    })

    it('özel timeoutMs değerine uyar', async () => {
      hangingFetch()
      const client = createAINutritionClient({ timeoutMs: 1_000 })
      const promise = client.analyzeMeal('yulaf', 'Kahvaltı', 400)
      const assertion = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' })
      await vi.advanceTimersByTimeAsync(1_100)
      await assertion
    })

    it('süre dolmadan iptal olmaz', async () => {
      const fetchMock = hangingFetch()
      const client = createAINutritionClient({ timeoutMs: 5_000 })
      const promise = client.analyzeMeal('yulaf', 'Kahvaltı', 400)
      const assertion = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' })

      await vi.advanceTimersByTimeAsync(4_000)
      expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(false)

      await vi.advanceTimersByTimeAsync(2_000)
      await assertion
    })

    it('başarılı istekte zamanlayıcı temizlenir (sızıntı olmaz)', async () => {
      mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
      await createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      expect(vi.getTimerCount()).toBe(0)
    })

    it('hatalı istekte de zamanlayıcı temizlenir', async () => {
      mockFetchOnce({ success: false, error: 'hata' })
      await expect(
        createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
      ).rejects.toThrow()
      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('platform uyumluluğu', () => {
    it('DOMException global olmadan da çalışır (React Native / Hermes)', async () => {
      // Hermes’te DOMException yok; iptal tespiti yerel bayrakla yapılmalı.
      const original = globalThis.DOMException
      // @ts-expect-error — test için global’i kaldırıyoruz
      delete globalThis.DOMException
      try {
        mockFetchOnce({ success: true, data: SAMPLE_ANALYSIS })
        await expect(
          createAINutritionClient().analyzeMeal('yulaf', 'Kahvaltı', 400)
        ).resolves.toEqual(SAMPLE_ANALYSIS)
      } finally {
        globalThis.DOMException = original
      }
    })
  })
})
