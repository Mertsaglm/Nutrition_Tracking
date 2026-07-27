// ============================================================================
// app/api/sample-meal-plan/route.ts — AI örnek beslenme programı uç noktası.
//
// analyze-meal ile aynı iki koruma geçerlidir (401 kimlik, 400 eksik parametre).
// Ek olarak alerji/diyet listeleri güvenli biçimde normalize edilmelidir:
// dizi olmayan bir değer AI prompt'una girerse alerji uyarısı bozulabilir.
// ============================================================================
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@nutrition/core'

const generateSampleMealPlanMock = vi.fn()
const getUserIdFromRequestMock = vi.fn()

vi.mock('@/lib/gemini.server', () => ({
  analyzeMeal: vi.fn(),
  generateSampleMealPlan: (...args: unknown[]) => generateSampleMealPlanMock(...args),
}))

vi.mock('@/lib/auth.server', () => ({
  getUserIdFromRequest: (...args: unknown[]) => getUserIdFromRequestMock(...args),
}))

const { OPTIONS, POST } = await import('@/app/api/sample-meal-plan/route')

const PLAN_RESULT = {
  meals: [],
  dailyTotals: { calories: 2200, protein: 165, carbs: 220, fat: 73 },
  note: 'Bol su iç.',
}

const VALID_BODY = {
  dailyCalories: 2200,
  protein: 165,
  carbs: 220,
  fat: 73,
  mealCount: 4,
  goal: 'lose_weight',
}

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
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})

describe('POST /api/sample-meal-plan', () => {
  beforeEach(() => {
    generateSampleMealPlanMock.mockReset().mockResolvedValue(PLAN_RESULT)
    getUserIdFromRequestMock.mockReset().mockResolvedValue('user-1')
  })

  describe('kimlik doğrulama', () => {
    it('oturum yoksa 401 döner ve AI çağrılmaz', async () => {
      getUserIdFromRequestMock.mockResolvedValue(null)
      const response = await POST(requestWith(VALID_BODY))

      expect(response.status).toBe(401)
      expect((await bodyOf(response)).error).toBe('Bu işlem için giriş yapmalısınız')
      expect(generateSampleMealPlanMock).not.toHaveBeenCalled()
    })
  })

  describe('parametre doğrulama', () => {
    it.each(['dailyCalories', 'protein', 'carbs', 'fat', 'mealCount', 'goal'])(
      '%s eksikse 400 döner',
      async (field) => {
        const body = { ...VALID_BODY } as Record<string, unknown>
        delete body[field]

        const response = await POST(requestWith(body))
        expect(response.status).toBe(400)
        expect((await bodyOf(response)).error).toBe('Eksik parametreler')
        expect(generateSampleMealPlanMock).not.toHaveBeenCalled()
      }
    )

    it('sıfır değerler de eksik sayılır (anlamsız plan üretilmez)', async () => {
      const response = await POST(requestWith({ ...VALID_BODY, protein: 0 }))
      expect(response.status).toBe(400)
    })

    it('boş gövdede 400 döner', async () => {
      expect((await POST(requestWith({}))).status).toBe(400)
    })
  })

  describe('parametre normalizasyonu', () => {
    it('metin sayıları sayıya çevirir', async () => {
      await POST(
        requestWith({
          dailyCalories: '2200',
          protein: '165',
          carbs: '220',
          fat: '73',
          mealCount: '4',
          goal: 'maintain',
        })
      )

      expect(generateSampleMealPlanMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dailyCalories: 2200,
          protein: 165,
          carbs: 220,
          fat: 73,
          mealCount: 4,
        })
      )
    })

    it('hedefi metne çevirir', async () => {
      await POST(requestWith({ ...VALID_BODY, goal: 'build_muscle' }))
      expect(generateSampleMealPlanMock).toHaveBeenCalledWith(
        expect.objectContaining({ goal: 'build_muscle' })
      )
    })

    it('diyet tercihleri ve alerjileri iletir', async () => {
      await POST(
        requestWith({
          ...VALID_BODY,
          dietaryPreferences: ['vejetaryen'],
          allergies: ['fıstık', 'süt'],
        })
      )

      expect(generateSampleMealPlanMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dietaryPreferences: ['vejetaryen'],
          allergies: ['fıstık', 'süt'],
        })
      )
    })

    it.each([
      ['verilmezse', undefined],
      ['metin gelirse', 'fıstık'],
      ['nesne gelirse', { a: 1 }],
      ['null gelirse', null],
    ])('alerji/tercih listesi %s boş diziye düşer', async (_label, value) => {
      await POST(requestWith({ ...VALID_BODY, allergies: value, dietaryPreferences: value }))

      expect(generateSampleMealPlanMock).toHaveBeenCalledWith(
        expect.objectContaining({ allergies: [], dietaryPreferences: [] })
      )
    })

    it('AI’a yalnızca beklenen alanlar gider', async () => {
      await POST(requestWith({ ...VALID_BODY, gizliAlan: 'sızmasın' }))
      const params = generateSampleMealPlanMock.mock.calls[0][0] as Record<string, unknown>

      expect(Object.keys(params).sort()).toEqual([
        'allergies',
        'carbs',
        'dailyCalories',
        'dietaryPreferences',
        'fat',
        'goal',
        'mealCount',
        'protein',
      ])
    })
  })

  describe('başarılı yanıt', () => {
    it('planı başarı zarfında döner', async () => {
      const response = await POST(requestWith(VALID_BODY))
      expect(response.status).toBe(200)
      expect(await bodyOf(response)).toEqual({ success: true, data: PLAN_RESULT })
    })

    it('CORS başlıklarını içerir', async () => {
      const response = await POST(requestWith(VALID_BODY))
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })

  describe('hata yönetimi', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('AI hatasında 500 ve kullanıcı dostu mesaj döner', async () => {
      generateSampleMealPlanMock.mockRejectedValue(new Error('quota exceeded'))
      const response = await POST(requestWith(VALID_BODY))

      expect(response.status).toBe(500)
      expect((await bodyOf(response)).error).toBe(ERROR_MESSAGES.api.quotaExceeded)
    })

    it('bozuk gövdede çökmez', async () => {
      const badRequest = {
        headers: new Headers({ authorization: 'Bearer jwt' }),
        json: async () => {
          throw new SyntaxError('bozuk JSON')
        },
      } as unknown as NextRequest

      expect((await POST(badRequest)).status).toBe(500)
    })
  })
})
