// ============================================================================
// config.ts — uygulama sabitleri.
// Bu sabitler hem hesaplama motorunu hem de UI'yi besler. Buradaki bir değişiklik
// sessizce yanlış kalori/makro hedefleri üretebilir; o yüzden değerler ve
// aralarındaki mantıksal ilişkiler kilitlenmiştir.
// ============================================================================
import { describe, expect, it } from 'vitest'
import {
  AI_CONFIG,
  APP_CONFIG,
  EMPTY_NUTRITION,
  ERROR_MESSAGES,
  MEAL_TYPES,
  NUTRITION_RULES,
  VALIDATION_RULES,
} from '@nutrition/core'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

describe('APP_CONFIG', () => {
  it('uygulama kimliğini taşır', () => {
    expect(APP_CONFIG.name).toBe('Beslenme Takip')
    expect(APP_CONFIG.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(APP_CONFIG.description.length).toBeGreaterThan(10)
  })
})

describe('AI_CONFIG', () => {
  it('bir Gemini modeli kullanır', () => {
    expect(AI_CONFIG.model).toMatch(/^gemini-/)
  })

  it('makul yeniden deneme ve zaman aşımı değerleri taşır', () => {
    expect(AI_CONFIG.maxRetries).toBeGreaterThanOrEqual(1)
    expect(AI_CONFIG.maxRetries).toBeLessThanOrEqual(5)
    // Çok kısa: yavaş bağlantıda her istek düşer. Çok uzun: kullanıcı kilitlenir.
    expect(AI_CONFIG.timeoutMs).toBeGreaterThanOrEqual(5_000)
    expect(AI_CONFIG.timeoutMs).toBeLessThanOrEqual(120_000)
  })
})

describe('MEAL_TYPES', () => {
  const entries = Object.entries(MEAL_TYPES)

  it('altı öğün türü tanımlar', () => {
    expect(entries).toHaveLength(6)
    expect(Object.keys(MEAL_TYPES)).toEqual([
      'Kahvaltı',
      'Kuşluk',
      'Öğle',
      'İkindi',
      'Akşam',
      'Gece',
    ])
  })

  it('her anahtar kendi `name` alanıyla aynıdır', () => {
    // UI bazı yerlerde anahtarı, bazı yerlerde name'i kullanıyor; ayrışırlarsa
    // seçilen öğün eşleşmez ve hedef kalori 0'a düşer.
    for (const [key, meal] of entries) {
      expect(meal.name).toBe(key)
    }
  })

  it('saatler HH:MM biçimindedir ve kronolojik sıradadır', () => {
    const minutes = entries.map(([, meal]) => {
      expect(meal.time).toMatch(HHMM)
      const [h, m] = meal.time.split(':').map(Number)
      return h * 60 + m
    })
    const sorted = [...minutes].sort((a, b) => a - b)
    expect(minutes).toEqual(sorted)
  })

  it('oranlar 0 ile 1 arasındadır', () => {
    for (const [, meal] of entries) {
      expect(meal.targetRatio).toBeGreaterThan(0)
      expect(meal.targetRatio).toBeLessThan(1)
    }
  })
})

describe('EMPTY_NUTRITION', () => {
  it('tüm makroları sıfırdır', () => {
    expect(EMPTY_NUTRITION).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })

  it('yalnızca bu dört alanı içerir', () => {
    // Alan eklenirse `{ ...EMPTY_NUTRITION }` kullanan her yer sessizce değişir.
    expect(Object.keys(EMPTY_NUTRITION).sort()).toEqual(['calories', 'carbs', 'fat', 'protein'])
  })
})

describe('NUTRITION_RULES', () => {
  it('1 kg yağ ≈ 7700 kcal kabulünü korur', () => {
    expect(NUTRITION_RULES.kcalPerKg).toBe(7700)
  })

  it('haftalık hız işaretleri hedeflerle tutarlıdır', () => {
    const rates = NUTRITION_RULES.healthyWeeklyRate
    expect(rates.lose_weight).toBeLessThan(0)
    expect(rates.gain_weight).toBeGreaterThan(0)
    expect(rates.build_muscle).toBeGreaterThan(0)
    expect(rates.maintain).toBe(0)
    // Kas yapmak, kilo almaktan daha yavaş olmalı (yağlanmayı sınırlar).
    expect(rates.build_muscle).toBeLessThan(rates.gain_weight)
  })

  it('maksimum hız, sağlıklı hızların hepsinden büyüktür', () => {
    const rates = Object.values(NUTRITION_RULES.healthyWeeklyRate)
    for (const rate of rates) {
      expect(NUTRITION_RULES.maxWeeklyRate).toBeGreaterThanOrEqual(Math.abs(rate))
    }
    // Haftada 1 kg'dan hızlı değişim güvenli değildir.
    expect(NUTRITION_RULES.maxWeeklyRate).toBeLessThanOrEqual(1.0)
  })

  it('minimum kalori tabanları güvenli aralıktadır', () => {
    const { male, female, other } = NUTRITION_RULES.minCalories
    expect(female).toBeGreaterThanOrEqual(1200)
    expect(male).toBeGreaterThanOrEqual(1500)
    expect(male).toBeGreaterThan(female)
    // "other" iki değerin arasında kalmalı (ortalama yaklaşımı).
    expect(other).toBeGreaterThanOrEqual(female)
    expect(other).toBeLessThanOrEqual(male)
  })

  it('kas yapma hedefinde protein tabanı daha yüksektir', () => {
    expect(NUTRITION_RULES.minProteinPerKg.build_muscle).toBeGreaterThan(
      NUTRITION_RULES.minProteinPerKg.default
    )
    expect(NUTRITION_RULES.minProteinPerKg.default).toBeGreaterThanOrEqual(1.2)
    // 2.5 g/kg üzeri gereksiz; böbrek yükü tartışmalı ve maliyetli.
    expect(NUTRITION_RULES.minProteinPerKg.build_muscle).toBeLessThanOrEqual(2.5)
  })
})

describe('VALIDATION_RULES', () => {
  it('her sayısal aralıkta min < max', () => {
    const ranges = [
      VALIDATION_RULES.age,
      VALIDATION_RULES.height_cm,
      VALIDATION_RULES.weight_kg,
      VALIDATION_RULES.target_weeks,
      VALIDATION_RULES.mealCount,
    ]
    for (const range of ranges) {
      expect(range.min).toBeLessThan(range.max)
      expect(range.min).toBeGreaterThan(0)
    }
  })

  it('öğün sayısı 3-6 aralığındadır (DB CHECK kısıtıyla aynı)', () => {
    // supabase/schema.sql: meal_count INTEGER CHECK (meal_count >= 3 AND meal_count <= 6)
    expect(VALIDATION_RULES.mealCount).toEqual({ min: 3, max: 6 })
  })

  it('fiziksel değer aralıkları gerçekçidir', () => {
    expect(VALIDATION_RULES.age).toEqual({ min: 10, max: 100 })
    expect(VALIDATION_RULES.height_cm).toEqual({ min: 100, max: 250 })
    expect(VALIDATION_RULES.weight_kg).toEqual({ min: 30, max: 300 })
    expect(VALIDATION_RULES.target_weeks).toEqual({ min: 1, max: 104 })
  })

  it('öğün açıklaması sınırları AI için anlamlıdır', () => {
    const { minLength, maxLength } = VALIDATION_RULES.meal.description
    expect(minLength).toBeGreaterThanOrEqual(3)
    expect(maxLength).toBeGreaterThan(minLength)
    // Prompt maliyetini kontrol altında tutar.
    expect(maxLength).toBeLessThanOrEqual(2000)
  })
})

describe('ERROR_MESSAGES', () => {
  const flatten = (obj: Record<string, unknown>, prefix = ''): [string, string][] =>
    Object.entries(obj).flatMap(([key, value]) =>
      typeof value === 'string'
        ? [[`${prefix}${key}`, value] as [string, string]]
        : flatten(value as Record<string, unknown>, `${prefix}${key}.`)
    )

  const messages = flatten(ERROR_MESSAGES as unknown as Record<string, unknown>)

  it('tüm mesajlar dolu ve kullanıcıya gösterilebilir', () => {
    expect(messages.length).toBeGreaterThan(0)
    for (const [key, message] of messages) {
      expect(message.trim(), key).not.toBe('')
      // Teknik detay/stack sızıntısı olmamalı.
      expect(message, key).not.toMatch(/undefined|\[object|Error:|at .*\(/)
    }
  })

  it('beklenen API hata anahtarlarını içerir', () => {
    expect(Object.keys(ERROR_MESSAGES.api).sort()).toEqual([
      'generic',
      'invalidKey',
      'network',
      'quotaExceeded',
      'rateLimit',
      'timeout',
    ])
  })
})
