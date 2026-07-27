// ============================================================================
// lib/gemini.server.ts — SUNUCU-ONLY Gemini çağrıları.
//
// GÜVENLİK: `GEMINI_API_KEY` yalnızca burada okunur ve asla yanıt gövdesine,
// prompt'a veya istemciye geçmez. Anahtar yoksa istek, anlaşılır bir AppError
// ile reddedilmelidir (sessizce boş sonuç DÖNMEMELİ).
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_CONFIG } from '@nutrition/core'

const generateContentMock = vi.fn()
const getGenerativeModelMock = vi.fn(() => ({ generateContent: generateContentMock }))
const GoogleGenerativeAIMock = vi.fn(() => ({ getGenerativeModel: getGenerativeModelMock }))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: function (this: unknown, ...args: unknown[]) {
    return GoogleGenerativeAIMock(...(args as []))
  },
}))

/** Modülü sıfırdan yükler (model modül düzeyinde önbelleklenir). */
async function loadGeminiModule() {
  vi.resetModules()
  return import('@/lib/gemini.server')
}

/** Gemini'nin döndürdüğü yanıtı taklit eder. */
function respondWith(text: string) {
  generateContentMock.mockResolvedValue({ response: { text: () => text } })
}

const ANALYSIS_JSON = JSON.stringify({
  foods: [
    {
      name: 'Tam yumurta (haşlanmış)',
      amount: 100,
      unit: 'g',
      nutrition: { calories: 155, protein: 13, carbs: 1, fat: 11 },
    },
  ],
  totalNutrition: { calories: 155, protein: 13, carbs: 1, fat: 11 },
  analysis: 'Proteinli bir seçim.',
  suggestions: 'Yanına sebze ekle.',
  confidence: 0.9,
})

const PLAN_PARAMS = {
  dailyCalories: 2200,
  protein: 165,
  carbs: 220,
  fat: 73,
  mealCount: 4,
  dietaryPreferences: [],
  allergies: ['fıstık'],
  goal: 'lose_weight',
}

describe('gemini.server', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-api-key')
    generateContentMock.mockReset()
    getGenerativeModelMock.mockClear()
    GoogleGenerativeAIMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  describe('API anahtarı', () => {
    it('anahtar yoksa AppError(INVALID_API_KEY) fırlatır', async () => {
      vi.stubEnv('GEMINI_API_KEY', '')
      const { analyzeMeal } = await loadGeminiModule()

      // NOT: `resetModules` çekirdek paketi yeniden yüklediği için `instanceof`
      // yerine sınıfın imzası (name + code) doğrulanır.
      await expect(analyzeMeal('2 yumurta', 'Kahvaltı', 400)).rejects.toMatchObject({
        name: 'AppError',
        code: 'INVALID_API_KEY',
      })
      await expect(analyzeMeal('2 yumurta', 'Kahvaltı', 400)).rejects.toThrow(/GEMINI_API_KEY/)
    })

    it('anahtar yoksa AI’a hiç istek gitmez', async () => {
      vi.stubEnv('GEMINI_API_KEY', '')
      const { analyzeMeal } = await loadGeminiModule()

      await expect(analyzeMeal('2 yumurta', 'Kahvaltı', 400)).rejects.toThrow()
      expect(generateContentMock).not.toHaveBeenCalled()
    })

    it('anahtarı SDK’ya geçirir', async () => {
      respondWith(ANALYSIS_JSON)
      const { analyzeMeal } = await loadGeminiModule()
      await analyzeMeal('2 yumurta', 'Kahvaltı', 400)

      expect(GoogleGenerativeAIMock).toHaveBeenCalledWith('test-api-key')
    })

    it('anahtarı prompt’a sızdırmaz', async () => {
      respondWith(ANALYSIS_JSON)
      const { analyzeMeal } = await loadGeminiModule()
      await analyzeMeal('2 yumurta', 'Kahvaltı', 400)

      expect(generateContentMock.mock.calls[0][0]).not.toContain('test-api-key')
    })
  })

  describe('model', () => {
    it('AI_CONFIG’teki modeli kullanır', async () => {
      respondWith(ANALYSIS_JSON)
      const { analyzeMeal } = await loadGeminiModule()
      await analyzeMeal('2 yumurta', 'Kahvaltı', 400)

      expect(getGenerativeModelMock).toHaveBeenCalledWith({ model: AI_CONFIG.model })
    })

    it('modeli önbelleğe alır (her istekte yeniden kurmaz)', async () => {
      respondWith(ANALYSIS_JSON)
      const { analyzeMeal, generateSampleMealPlan } = await loadGeminiModule()

      await analyzeMeal('2 yumurta', 'Kahvaltı', 400)
      await analyzeMeal('1 muz', 'Kuşluk', 200)
      await generateSampleMealPlan(PLAN_PARAMS)

      expect(GoogleGenerativeAIMock).toHaveBeenCalledTimes(1)
      expect(getGenerativeModelMock).toHaveBeenCalledTimes(1)
      expect(generateContentMock).toHaveBeenCalledTimes(3)
    })
  })

  describe('analyzeMeal', () => {
    it('kullanıcı girdisini prompt’a taşır', async () => {
      respondWith(ANALYSIS_JSON)
      const { analyzeMeal } = await loadGeminiModule()
      await analyzeMeal('2 haşlanmış yumurta', 'Kahvaltı', 450)

      const prompt = generateContentMock.mock.calls[0][0] as string
      expect(prompt).toContain('2 haşlanmış yumurta')
      expect(prompt).toContain('Kahvaltı')
      expect(prompt).toContain('450')
    })

    it('yanıtı tipli sonuca çevirir', async () => {
      respondWith(ANALYSIS_JSON)
      const { analyzeMeal } = await loadGeminiModule()

      const result = await analyzeMeal('2 yumurta', 'Kahvaltı', 400)
      expect(result.totalNutrition.calories).toBe(155)
      expect(result.confidence).toBe(0.9)
      expect(result.foods).toHaveLength(1)
    })

    it('```json çitli yanıtı da çözer', async () => {
      respondWith('```json\n' + ANALYSIS_JSON + '\n```')
      const { analyzeMeal } = await loadGeminiModule()

      await expect(analyzeMeal('2 yumurta', 'Kahvaltı', 400)).resolves.toMatchObject({
        confidence: 0.9,
      })
    })

    it('bozuk yanıtta çökmez, güvenli sonuca düşer', async () => {
      respondWith('Üzgünüm, bu isteği yerine getiremiyorum.')
      const { analyzeMeal } = await loadGeminiModule()

      const result = await analyzeMeal('anlaşılmaz', 'Öğle', 600)
      expect(result.confidence).toBe(0)
      expect(result.foods).toEqual([])
    })

    it('SDK hatası yukarı taşınır (route apiCatch ile karşılar)', async () => {
      generateContentMock.mockRejectedValue(new Error('429 rate limit exceeded'))
      const { analyzeMeal } = await loadGeminiModule()

      await expect(analyzeMeal('2 yumurta', 'Kahvaltı', 400)).rejects.toThrow('429')
    })
  })

  describe('generateSampleMealPlan', () => {
    const PLAN_JSON = JSON.stringify({
      meals: [{ name: 'Kahvaltı', time: '08:00', foods: [], totals: {} }],
      dailyTotals: { calories: 2200, protein: 165, carbs: 220, fat: 73 },
      note: 'Bol su iç.',
    })

    it('hedefleri ve alerjileri prompt’a taşır', async () => {
      respondWith(PLAN_JSON)
      const { generateSampleMealPlan } = await loadGeminiModule()
      await generateSampleMealPlan(PLAN_PARAMS)

      const prompt = generateContentMock.mock.calls[0][0] as string
      expect(prompt).toContain('2200 kcal')
      expect(prompt).toContain('ALERJİLER (ASLA KULLANMA): fıstık')
    })

    it('planı tipli sonuca çevirir', async () => {
      respondWith(PLAN_JSON)
      const { generateSampleMealPlan } = await loadGeminiModule()

      const result = await generateSampleMealPlan(PLAN_PARAMS)
      expect(result.meals).toHaveLength(1)
      expect(result.dailyTotals.calories).toBe(2200)
      expect(result.note).toBe('Bol su iç.')
    })

    it('bozuk yanıtta boş plan döner', async () => {
      respondWith('<html>502</html>')
      const { generateSampleMealPlan } = await loadGeminiModule()

      await expect(generateSampleMealPlan(PLAN_PARAMS)).resolves.toEqual({
        meals: [],
        dailyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        note: '',
      })
    })
  })

  it('yalnızca iki işlem dışa aktarılır', async () => {
    const module = await loadGeminiModule()
    expect(Object.keys(module).sort()).toEqual(['analyzeMeal', 'generateSampleMealPlan'])
  })
})
