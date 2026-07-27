// ============================================================================
// ai/prompts.ts — Gemini'ye gönderilen talimatlar.
//
// Prompt'lar kodun "gizli sözleşmesi": buradan çıkarılan bir kural (ör. çiğ/
// pişmiş dönüşümü ya da alerji yasağı) hiçbir testi kırmadan AI çıktısını
// bozar. Bu dosya o kuralların prompt'ta kalmasını garanti eder.
// ============================================================================
import { describe, expect, it } from 'vitest'
import {
  buildMealAnalysisPrompt,
  buildSampleMealPlanPrompt,
  selectRelevantFoods,
  type SampleMealPlanParams,
} from '@nutrition/core'

/** "ÇIKTI (yalnızca JSON...)" başlığından sonraki JSON şablonunu ayıklar. */
function outputTemplate(prompt: string): string {
  return prompt.slice(prompt.indexOf('{', prompt.indexOf('ÇIKTI (')))
}

describe('buildMealAnalysisPrompt', () => {
  const prompt = buildMealAnalysisPrompt('200g tavuk göğsü ve 150g pilav', 'Öğle', 700)

  it('kullanıcı girdisini prompt’a taşır', () => {
    expect(prompt).toContain('200g tavuk göğsü ve 150g pilav')
    expect(prompt).toContain('Öğle')
    expect(prompt).toContain('700')
  })

  it('AI’ı beslenme uzmanı rolüne oturtur', () => {
    expect(prompt).toContain('beslenme uzmanısın')
  })

  describe('gömülü besin veritabanı', () => {
    const embedded = prompt.match(/\{"[^\n]*?\}\}(?=\n)/)?.[0]

    it('prompt’a geçerli JSON olarak gömülür', () => {
      expect(embedded).toBeDefined()
      expect(() => JSON.parse(embedded!)).not.toThrow()
    })

    it('açıklamayla ilgili besinleri içerir', () => {
      const parsed = JSON.parse(embedded!)
      expect(parsed).toHaveProperty(['tavuk gogus'])
      expect(parsed).toHaveProperty(['pilav'])
    })

    it('selectRelevantFoods çıktısıyla birebir aynıdır', () => {
      expect(JSON.parse(embedded!)).toEqual(
        selectRelevantFoods('200g tavuk göğsü ve 150g pilav')
      )
    })

    it('100g referansı olduğunu belirtir', () => {
      expect(prompt).toContain('100g başına')
    })
  })

  describe('çiğ/pişmiş kuralları (doğruluğun temeli)', () => {
    it.each([
      'ÇİĞ vs PİŞMİŞ',
      'Pirinç (çiğ) 363',
      'Pilav (pişmiş) ~120',
      'Makarna (kuru) 390',
      'Bulgur (çiğ) 350',
      'Tavuk göğsü (çiğ) 104',
      'Dana eti (çiğ) 156',
    ])('%j kuralını içerir', (rule) => {
      expect(prompt).toContain(rule)
    })

    it('tahılların pişince şiştiğini açıklar', () => {
      expect(prompt).toMatch(/pişince 2-3 kat şişer/)
    })

    it('etlerin pişince yoğunlaştığını açıklar', () => {
      expect(prompt).toMatch(/Etler pişince su kaybeder/)
    })

    it('kullanıcı "çiğ" derse çiğ değerlerin kullanılacağını söyler', () => {
      expect(prompt).toMatch(/"çiğ".*çiğ değerleri kullan/s)
    })
  })

  describe('çıktı sözleşmesi', () => {
    it('yalnızca JSON istenir', () => {
      expect(prompt).toContain('yalnızca JSON')
    })

    it('parse.ts’in beklediği alanları şablonda gösterir', () => {
      for (const field of ['foods', 'totalNutrition', 'analysis', 'suggestions', 'confidence']) {
        expect(prompt).toContain(`"${field}"`)
      }
    })

    it('besin kalemi şablonu name/amount/unit/nutrition içerir', () => {
      for (const field of ['name', 'amount', 'unit', 'nutrition']) {
        expect(prompt).toContain(`"${field}"`)
      }
    })

    it('Türkçe, kullanıcı dostu isim ister ve teknik anahtarları yasaklar', () => {
      expect(prompt).toContain('Türkçe, kullanıcı dostu isimler')
      expect(prompt).toContain('KULLANMA')
      expect(prompt).toContain('tavuk_gogus')
    })

    it('şablondaki JSON iskeleti ayrıştırılabilir', () => {
      expect(() => JSON.parse(outputTemplate(prompt))).not.toThrow()
    })
  })

  describe('dayanıklılık', () => {
    it('aynı girdi için aynı prompt üretir', () => {
      expect(buildMealAnalysisPrompt('yulaf ezmesi', 'Kahvaltı', 500)).toBe(
        buildMealAnalysisPrompt('yulaf ezmesi', 'Kahvaltı', 500)
      )
    })

    it.each([
      ['tırnak işaretli', 'yarım "porsiyon" pilav'],
      ['satır sonlu', '2 yumurta\n1 dilim ekmek'],
      ['süslü parantezli', '{"foods": []}'],
      ['emoji', '🍗 tavuk 🍚 pilav'],
      ['çok uzun', 'tavuk '.repeat(200)],
    ])('%s açıklamada da prompt üretir', (_label, description) => {
      const result = buildMealAnalysisPrompt(description, 'Akşam', 600)
      expect(result).toContain('ÇIKTI')
      expect(result.length).toBeGreaterThan(500)
    })

    it('prompt boyutu maliyet açısından sınırlı kalır', () => {
      // Regresyon: biri veritabanının TAMAMINI gömerse istek maliyeti patlar.
      const heavy = buildMealAnalysisPrompt(
        'tavuk pilav ekmek yumurta peynir yoğurt makarna mercimek nohut muz elma',
        'Öğle',
        800
      )
      expect(heavy.length).toBeLessThan(25_000)
    })
  })
})

describe('buildSampleMealPlanPrompt', () => {
  const baseParams: SampleMealPlanParams = {
    dailyCalories: 2200,
    protein: 165,
    carbs: 220,
    fat: 73,
    mealCount: 4,
    dietaryPreferences: [],
    allergies: [],
    goal: 'lose_weight',
  }

  it('hedef değerleri prompt’a yazar', () => {
    const prompt = buildSampleMealPlanPrompt(baseParams)
    expect(prompt).toContain('2200 kcal')
    expect(prompt).toContain('165g')
    expect(prompt).toContain('220g')
    expect(prompt).toContain('73g')
    expect(prompt).toContain('Öğün Sayısı: 4')
  })

  it('yalnızca 1 günlük plan ister', () => {
    expect(buildSampleMealPlanPrompt(baseParams)).toContain('SADECE 1 GÜNLÜK')
  })

  describe('hedef metni', () => {
    it.each([
      ['lose_weight', 'kilo verme'],
      ['gain_weight', 'kilo alma'],
      ['build_muscle', 'kas yapma'],
      ['maintain', 'kiloyu koruma'],
    ])('%s → "%s"', (goal, expected) => {
      expect(buildSampleMealPlanPrompt({ ...baseParams, goal })).toContain(expected)
    })

    it('bilinmeyen hedefte genel ifadeye düşer', () => {
      expect(buildSampleMealPlanPrompt({ ...baseParams, goal: 'uzaya_gitmek' })).toContain(
        'sağlıklı beslenme'
      )
    })
  })

  describe('alerjiler (güvenlik)', () => {
    it('alerji listesi varsa güçlü bir yasak ifadesiyle eklenir', () => {
      const prompt = buildSampleMealPlanPrompt({
        ...baseParams,
        allergies: ['fıstık', 'deniz ürünleri'],
      })
      expect(prompt).toContain('ALERJİLER (ASLA KULLANMA)')
      expect(prompt).toContain('fıstık, deniz ürünleri')
      expect(prompt).toContain('Alerjik besinleri ASLA kullanma')
    })

    it('alerji yoksa bölüm hiç eklenmez', () => {
      expect(buildSampleMealPlanPrompt(baseParams)).not.toContain('ALERJİLER')
    })

    it('tek alerji de listelenir', () => {
      expect(buildSampleMealPlanPrompt({ ...baseParams, allergies: ['süt'] })).toContain('süt')
    })
  })

  describe('diyet tercihleri', () => {
    it('tercih varsa eklenir', () => {
      const prompt = buildSampleMealPlanPrompt({
        ...baseParams,
        dietaryPreferences: ['vejetaryen', 'glutensiz'],
      })
      expect(prompt).toContain('Diyet Tercihleri: vejetaryen, glutensiz')
    })

    it('tercih yoksa bölüm hiç eklenmez', () => {
      expect(buildSampleMealPlanPrompt(baseParams)).not.toContain('Diyet Tercihleri')
    })

    it('vejetaryen/vegan kuralını açıkça belirtir', () => {
      expect(buildSampleMealPlanPrompt(baseParams)).toContain('vejetaryen ise et yok')
    })
  })

  describe('çıktı sözleşmesi', () => {
    const prompt = buildSampleMealPlanPrompt(baseParams)

    it('yalnızca JSON istenir', () => {
      expect(prompt).toContain('yalnızca JSON')
    })

    it('parse.ts’in beklediği alanları içerir', () => {
      for (const field of ['meals', 'dailyTotals', 'note', 'totals', 'foods']) {
        expect(prompt).toContain(`"${field}"`)
      }
    })

    it('şablondaki dailyTotals gerçek hedeflerle doldurulur', () => {
      expect(prompt).toContain('"dailyTotals": {"calories": 2200, "protein": 165')
    })

    it('şablon JSON’u ayrıştırılabilir', () => {
      expect(() => JSON.parse(outputTemplate(prompt))).not.toThrow()
    })

    it('Türk mutfağına uygun öğün ister', () => {
      expect(prompt).toContain('Türk mutfağına uygun')
    })
  })

  it('aynı parametrelerle aynı prompt üretir', () => {
    expect(buildSampleMealPlanPrompt(baseParams)).toBe(buildSampleMealPlanPrompt(baseParams))
  })
})
