// ============================================================================
// ai/parse.ts — AI'ın ham metin yanıtını tipli sonuca çevirir.
//
// AI yanıtı GÜVENİLMEZ bir girdidir: bazen ```json çitiyle sarılı gelir, bazen
// alan eksiktir, bazen tamamen bozuktur. Parser'ın tek görevi ASLA ÇÖKMEMEK ve
// her durumda geçerli şekilde bir sonuç döndürmektir. Fallback davranışı
// kaldırılırsa kullanıcı beyaz ekran/çökme görür.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { EMPTY_NUTRITION, parseMealAnalysis, parseSampleMealPlan } from '@nutrition/core'

const VALID_ANALYSIS = {
  foods: [
    { name: 'Tavuk göğsü (pişmiş)', amount: 150, unit: 'g', nutrition: { calories: 248, protein: 46, carbs: 0, fat: 5 } },
  ],
  totalNutrition: { calories: 248, protein: 46, carbs: 0, fat: 5 },
  analysis: 'Yüksek proteinli bir öğün.',
  suggestions: 'Yanına sebze ekle.',
  confidence: 0.85,
}

/** Parser'ın çökmemesi gereken bozuk girdiler. */
const GARBAGE_INPUTS = [
  '',
  '   ',
  'null',
  'undefined',
  '[]',
  '{}',
  '"sadece metin"',
  '42',
  'Merhaba, bugün ne yediniz?',
  '{ "foods": ',
  '```json\n{ bozuk }\n```',
  '<html><body>502 Bad Gateway</body></html>',
  '{"foods": null, "totalNutrition": null}',
]

describe('parseMealAnalysis', () => {
  it('geçerli JSON yanıtını çözer', () => {
    expect(parseMealAnalysis(JSON.stringify(VALID_ANALYSIS))).toEqual(VALID_ANALYSIS)
  })

  it('```json çitini temizler', () => {
    const fenced = '```json\n' + JSON.stringify(VALID_ANALYSIS) + '\n```'
    expect(parseMealAnalysis(fenced)).toEqual(VALID_ANALYSIS)
  })

  it('çit ve boşluk karışımını tolere eder', () => {
    const messy = '  ```json\n\n' + JSON.stringify(VALID_ANALYSIS) + '\n\n```  '
    expect(parseMealAnalysis(messy).foods).toHaveLength(1)
  })

  it('bilinmeyen ek alanları yok sayar', () => {
    const withExtra = { ...VALID_ANALYSIS, model: 'gemini', tokens: 1234 }
    expect(parseMealAnalysis(JSON.stringify(withExtra))).toEqual(VALID_ANALYSIS)
  })

  it('eksik analiz/öneri alanlarına varsayılan metin koyar', () => {
    const partial = { foods: [], totalNutrition: EMPTY_NUTRITION }
    const result = parseMealAnalysis(JSON.stringify(partial))
    expect(result.analysis).toBe('Analiz yapılamadı')
    expect(result.suggestions).toBe('Öneri bulunamadı')
  })

  describe('güven skoru normalizasyonu', () => {
    const parseWithConfidence = (confidence: unknown) =>
      parseMealAnalysis(JSON.stringify({ ...VALID_ANALYSIS, confidence })).confidence

    it.each([
      ['normal değer', 0.7, 0.7],
      ['üst sınırı aşan', 1.5, 1],
      ['tam 1', 1, 1],
      ['negatif', -0.5, 0],
      ['tam 0', 0, 0],
      ['metin', 'yüksek', 0.5],
      ['null', null, 0.5],
      ['boolean', true, 0.5],
      ['nesne', { value: 1 }, 0.5],
    ])('%s → %s', (_label, input, expected) => {
      expect(parseWithConfidence(input)).toBe(expected)
    })

    it('alan hiç yoksa 0.5 varsayar', () => {
      const { confidence, ...withoutConfidence } = VALID_ANALYSIS
      expect(parseMealAnalysis(JSON.stringify(withoutConfidence)).confidence).toBe(0.5)
    })

    it('her zaman [0, 1] aralığında kalır (DB CHECK kısıtı)', () => {
      // schema.sql: confidence_score DECIMAL(3,2) CHECK (>= 0 AND <= 1)
      for (const value of [-100, -1, 0, 0.5, 1, 2, 1000, Number.NaN]) {
        const confidence = parseWithConfidence(value)
        expect(confidence, String(value)).toBeGreaterThanOrEqual(0)
        expect(confidence, String(value)).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('güvenli fallback', () => {
    it('foods alanı yoksa fallback döner', () => {
      const result = parseMealAnalysis(JSON.stringify({ totalNutrition: EMPTY_NUTRITION }))
      expect(result.confidence).toBe(0)
      expect(result.foods).toEqual([])
    })

    it('totalNutrition alanı yoksa fallback döner', () => {
      const result = parseMealAnalysis(JSON.stringify({ foods: [] }))
      expect(result.confidence).toBe(0)
    })

    it('fallback kullanıcıya ne yapması gerektiğini söyler', () => {
      const result = parseMealAnalysis('bozuk')
      expect(result.analysis).toContain('tekrar dene')
      expect(result.suggestions).toContain('Miktarları')
      expect(result.confidence).toBe(0)
    })

    it.each(GARBAGE_INPUTS)('bozuk girdide (%j) çökmez ve geçerli şekil döner', (input) => {
      const result = parseMealAnalysis(input)
      expect(Array.isArray(result.foods)).toBe(true)
      expect(result.totalNutrition).toEqual(EMPTY_NUTRITION)
      expect(typeof result.analysis).toBe('string')
      expect(typeof result.suggestions).toBe('string')
      expect(result.confidence).toBe(0)
    })

    it('fallback, paylaşılan EMPTY_NUTRITION nesnesini döndürmez', () => {
      // Aksi halde bir çağıranın mutasyonu tüm uygulamayı bozar.
      const result = parseMealAnalysis('bozuk')
      expect(result.totalNutrition).not.toBe(EMPTY_NUTRITION)
      result.totalNutrition.calories = 999
      expect(EMPTY_NUTRITION.calories).toBe(0)
    })

    it('iki ayrı fallback birbirini etkilemez', () => {
      const first = parseMealAnalysis('bozuk')
      const second = parseMealAnalysis('yine bozuk')
      first.totalNutrition.protein = 42
      expect(second.totalNutrition.protein).toBe(0)
    })
  })

  it('her zaman beş alanı da içerir', () => {
    for (const input of [JSON.stringify(VALID_ANALYSIS), ...GARBAGE_INPUTS]) {
      expect(Object.keys(parseMealAnalysis(input)).sort()).toEqual([
        'analysis',
        'confidence',
        'foods',
        'suggestions',
        'totalNutrition',
      ])
    }
  })
})

describe('parseSampleMealPlan', () => {
  const VALID_PLAN = {
    meals: [
      {
        name: 'Kahvaltı',
        time: '08:00',
        foods: [{ name: 'Yumurta', amount: '2 adet', calories: 140, protein: 12, carbs: 1, fat: 10 }],
        totals: { calories: 300, protein: 18, carbs: 31, fat: 12 },
      },
    ],
    dailyTotals: { calories: 2000, protein: 150, carbs: 200, fat: 70 },
    note: 'Bol su içmeyi unutma!',
  }

  it('geçerli planı çözer', () => {
    expect(parseSampleMealPlan(JSON.stringify(VALID_PLAN))).toEqual(VALID_PLAN)
  })

  it('```json çitini temizler', () => {
    const fenced = '```json\n' + JSON.stringify(VALID_PLAN) + '\n```'
    expect(parseSampleMealPlan(fenced)).toEqual(VALID_PLAN)
  })

  it('eksik alanlara güvenli varsayılan verir', () => {
    const result = parseSampleMealPlan('{}')
    expect(result).toEqual({ meals: [], dailyTotals: EMPTY_NUTRITION, note: '' })
  })

  it('sadece note eksikse boş metin kullanır', () => {
    const { note, ...withoutNote } = VALID_PLAN
    expect(parseSampleMealPlan(JSON.stringify(withoutNote)).note).toBe('')
  })

  it.each(GARBAGE_INPUTS)('bozuk girdide (%j) boş plan döner', (input) => {
    const result = parseSampleMealPlan(input)
    expect(Array.isArray(result.meals)).toBe(true)
    expect(result.dailyTotals).toEqual(EMPTY_NUTRITION)
    expect(typeof result.note).toBe('string')
  })

  it('boş plan, paylaşılan EMPTY_NUTRITION nesnesini döndürmez', () => {
    const result = parseSampleMealPlan('bozuk')
    expect(result.dailyTotals).not.toBe(EMPTY_NUTRITION)
    result.dailyTotals.calories = 999
    expect(EMPTY_NUTRITION.calories).toBe(0)
  })

  it('her zaman üç alanı da içerir', () => {
    for (const input of [JSON.stringify(VALID_PLAN), ...GARBAGE_INPUTS]) {
      expect(Object.keys(parseSampleMealPlan(input)).sort()).toEqual([
        'dailyTotals',
        'meals',
        'note',
      ])
    }
  })
})
