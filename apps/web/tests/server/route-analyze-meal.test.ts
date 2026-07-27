// ============================================================================
// app/api/analyze-meal/route.ts — AI öğün analizi uç noktası.
//
// Bu route, projenin PARA HARCAYAN tek yüzeyi. İki koruma hayati:
//   1) Kimlik doğrulaması yoksa AI'a hiç gidilmez (401).
//   2) Anlamsız/boş açıklama AI'a gönderilmez (400).
// Bu kontrollerden biri kaldırılırsa uç nokta herkese açık bir Gemini
// proxy'sine dönüşür ve kota/fatura istismara açılır.
// ============================================================================
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@nutrition/core'

const analyzeMealMock = vi.fn()
const getUserIdFromRequestMock = vi.fn()

vi.mock('@/lib/gemini.server', () => ({
  analyzeMeal: (...args: unknown[]) => analyzeMealMock(...args),
  generateSampleMealPlan: vi.fn(),
}))

vi.mock('@/lib/auth.server', () => ({
  getUserIdFromRequest: (...args: unknown[]) => getUserIdFromRequestMock(...args),
}))

const { OPTIONS, POST } = await import('@/app/api/analyze-meal/route')

const AI_RESULT = {
  foods: [],
  totalNutrition: { calories: 260, protein: 18, carbs: 20, fat: 12 },
  analysis: 'ok',
  suggestions: 'ok',
  confidence: 0.9,
}

/** Gövdesi verilen minimal bir istek. */
function requestWith(body: unknown): NextRequest {
  return {
    headers: new Headers({ authorization: 'Bearer jwt' }),
    json: async () => body,
  } as unknown as NextRequest
}

async function bodyOf(response: Response) {
  return (await response.json()) as { success: boolean; data?: unknown; error?: string }
}

describe('OPTIONS (preflight)', () => {
  it('204 ve CORS başlıkları döner', () => {
    const response = OPTIONS()
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

describe('POST /api/analyze-meal', () => {
  beforeEach(() => {
    analyzeMealMock.mockReset().mockResolvedValue(AI_RESULT)
    getUserIdFromRequestMock.mockReset().mockResolvedValue('user-1')
  })

  describe('kimlik doğrulama', () => {
    it('oturum yoksa 401 döner', async () => {
      getUserIdFromRequestMock.mockResolvedValue(null)
      const response = await POST(requestWith({ description: '2 yumurta' }))

      expect(response.status).toBe(401)
      expect(await bodyOf(response)).toEqual({
        success: false,
        error: 'Bu işlem için giriş yapmalısınız',
      })
    })

    it('oturum yoksa AI’a HİÇ istek gitmez (maliyet koruması)', async () => {
      getUserIdFromRequestMock.mockResolvedValue(null)
      await POST(requestWith({ description: '2 yumurta ve peynir' }))
      expect(analyzeMealMock).not.toHaveBeenCalled()
    })

    it('kimlik kontrolü gövde ayrıştırmadan ÖNCE yapılır', async () => {
      getUserIdFromRequestMock.mockResolvedValue(null)
      const badRequest = {
        headers: new Headers(),
        json: async () => {
          throw new Error('gövde okunamadı')
        },
      } as unknown as NextRequest

      const response = await POST(badRequest)
      expect(response.status).toBe(401)
    })
  })

  describe('girdi doğrulama', () => {
    it.each([
      ['alan yok', {}],
      ['boş metin', { description: '' }],
      ['sadece boşluk', { description: '   ' }],
      ['çok kısa', { description: 'ab' }],
      ['metin değil', { description: 123 }],
      ['null', { description: null }],
      ['dizi', { description: ['yumurta'] }],
    ])('%s → 400', async (_label, body) => {
      const response = await POST(requestWith(body))

      expect(response.status).toBe(400)
      expect((await bodyOf(response)).error).toBe('Geçerli bir yemek açıklaması gerekli')
      expect(analyzeMealMock).not.toHaveBeenCalled()
    })

    it('tam 3 karakterlik açıklamayı kabul eder', async () => {
      const response = await POST(requestWith({ description: 'muz' }))
      expect(response.status).toBe(200)
    })

    it('açıklamanın baş/son boşluklarını kırpar', async () => {
      await POST(requestWith({ description: '  2 yumurta  ' }))
      expect(analyzeMealMock).toHaveBeenCalledWith('2 yumurta', expect.anything(), expect.anything())
    })
  })

  describe('varsayılanlar', () => {
    it('öğün türü verilmezse "Öğün" kullanır', async () => {
      await POST(requestWith({ description: '2 yumurta' }))
      expect(analyzeMealMock).toHaveBeenCalledWith('2 yumurta', 'Öğün', 2000)
    })

    it('öğün türü metin değilse varsayılana düşer', async () => {
      await POST(requestWith({ description: '2 yumurta', mealType: 42 }))
      expect(analyzeMealMock).toHaveBeenCalledWith('2 yumurta', 'Öğün', 2000)
    })

    it('hedef kalori verilmezse 2000 kullanır', async () => {
      await POST(requestWith({ description: '2 yumurta', mealType: 'Kahvaltı' }))
      expect(analyzeMealMock).toHaveBeenCalledWith('2 yumurta', 'Kahvaltı', 2000)
    })

    it.each([
      ['metin sayı', '450', 450],
      ['sayı', 450, 450],
      ['geçersiz metin', 'çok', 2000],
      ['sıfır', 0, 2000],
      ['null', null, 2000],
    ])('hedef kalori (%s) → %i', async (_label, input, expected) => {
      await POST(requestWith({ description: '2 yumurta', targetCalories: input }))
      expect(analyzeMealMock).toHaveBeenCalledWith('2 yumurta', 'Öğün', expected)
    })
  })

  describe('başarılı analiz', () => {
    it('AI sonucunu başarı zarfında döner', async () => {
      const response = await POST(
        requestWith({ description: '2 yumurta', mealType: 'Kahvaltı', targetCalories: 450 })
      )

      expect(response.status).toBe(200)
      expect(await bodyOf(response)).toEqual({ success: true, data: AI_RESULT })
      expect(analyzeMealMock).toHaveBeenCalledWith('2 yumurta', 'Kahvaltı', 450)
    })

    it('yanıtta CORS başlıkları bulunur (mobil istemci için)', async () => {
      const response = await POST(requestWith({ description: '2 yumurta' }))
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })

  describe('hata yönetimi', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('AI hatasında 500 ve kullanıcı dostu mesaj döner', async () => {
      analyzeMealMock.mockRejectedValue(new Error('429 rate limit exceeded'))
      const response = await POST(requestWith({ description: '2 yumurta' }))

      expect(response.status).toBe(500)
      expect((await bodyOf(response)).error).toBe(ERROR_MESSAGES.api.rateLimit)
    })

    it('teknik detay istemciye sızmaz', async () => {
      analyzeMealMock.mockRejectedValue(
        new Error('Invalid api key AIzaSyTEST at /app/lib/gemini.server.ts:29')
      )
      const response = await POST(requestWith({ description: '2 yumurta' }))
      const body = await bodyOf(response)

      expect(body.error).not.toContain('AIzaSy')
      expect(body.error).not.toContain('.ts:')
      expect(body.error).toBe(ERROR_MESSAGES.api.invalidKey)
    })

    it('bozuk JSON gövdesinde 500 döner, çökmez', async () => {
      const badRequest = {
        headers: new Headers({ authorization: 'Bearer jwt' }),
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input')
        },
      } as unknown as NextRequest

      const response = await POST(badRequest)
      expect(response.status).toBe(500)
      expect((await bodyOf(response)).success).toBe(false)
    })
  })
})
