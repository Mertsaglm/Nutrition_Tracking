// ============================================================================
// ALAN TUTARLILIĞI — aynı bilginin birden fazla yerde kullanıldığı noktalar.
//
// Öğün adları/saatleri ve "kaç öğün → hangi öğünler" bilgisi TEK KAYNAKTAN
// gelir: `config.ts` (MEAL_TYPES) + `calculator.ts` (selectMealTypes).
// Web'deki öğün seçici ve mobil bildirim hatırlatmaları bu kaynağı tüketir.
// Biri kendi listesini yeniden tanımlarsa arayüz plandan sessizce ayrışır
// (kullanıcı planında olmayan öğünü seçer, yanlış saatte hatırlatma alır).
//
// Besin kategorisi etiketleri de veritabanı anahtarlarıyla eşleşmelidir.
// Bu testler ayrışmayı derleme değil, TEST zamanında yakalar.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { MEAL_TYPES, allFoods, createMealPlan, selectMealTypes } from '@nutrition/core'
import { readRepoFile } from '../helpers/source-scan'

const MEAL_LIST = Object.values(MEAL_TYPES)
const TARGETS = { calories: 2000, protein: 150, carbs: 200, fat: 70 }

describe('öğün tanımları: config.ts ↔ calculator.ts', () => {
  it('6 öğünlük plan MEAL_TYPES ile birebir aynı adları kullanır', () => {
    // calculator.ts öğün listesini MEAL_TYPES'tan türetir; bu bağ koparsa
    // arayüzdeki öğün seçimi plan öğünleriyle eşleşmez ve hedef kalori 0'a düşer.
    const plan = createMealPlan(6, TARGETS, 'maintain')
    expect(plan.meals.map((meal) => meal.name)).toEqual(MEAL_LIST.map((meal) => meal.name))
  })

  it('6 öğünlük plan MEAL_TYPES ile birebir aynı saatleri kullanır', () => {
    const plan = createMealPlan(6, TARGETS, 'maintain')
    expect(plan.meals.map((meal) => meal.time)).toEqual(MEAL_LIST.map((meal) => meal.time))
  })

  it.each([3, 4, 5, 6])('%i öğünlük planın adları MEAL_TYPES kümesinden gelir', (count) => {
    const known = new Set(MEAL_LIST.map((meal) => meal.name))
    for (const meal of createMealPlan(count, TARGETS, 'maintain').meals) {
      expect(known.has(meal.name), meal.name).toBe(true)
    }
  })
})

describe('öğün seçici: web arayüzü ↔ plan', () => {
  const source = readRepoFile('apps/web/components/MealLogger.tsx')

  it('öğün listesini çekirdekten alır (kendi tablosunu tutmaz)', () => {
    expect(source).toContain('selectMealTypes')
    // Regresyon: eskiden burada MEAL_INDICES adında ayrı bir eşleme vardı.
    expect(source).not.toContain('MEAL_INDICES')
  })

  it('öğün sayısını prop olarak alır ve doğrudan çekirdeğe geçirir', () => {
    expect(source).toMatch(/selectMealTypes\(userMealCount\)/)
  })

  it.each([3, 4, 5, 6])('%i öğün için plan ve arayüz aynı listeyi görür', (count) => {
    expect(selectMealTypes(count).map((meal) => meal.name)).toEqual(
      createMealPlan(count, TARGETS, 'maintain').meals.map((meal) => meal.name)
    )
  })

  it('seçilen öğünler MEAL_TYPES kümesinden gelir', () => {
    const known = new Set(MEAL_LIST.map((meal) => meal.name))
    for (const count of [3, 4, 5, 6]) {
      for (const meal of selectMealTypes(count)) {
        expect(known.has(meal.name), `${count} öğün → ${meal.name}`).toBe(true)
      }
    }
  })
})

describe('bildirim hatırlatmaları: mobil ↔ plan', () => {
  const source = readRepoFile('apps/mobile/lib/notification-service.ts')

  it('öğün listesini çekirdekten alır', () => {
    expect(source).toContain('selectMealTypes')
    // Regresyon: eskiden `Object.values(MEAL_TYPES).slice(0, mealCount)` idi ve
    // 3 öğünlük planda Akşam yerine Kuşluk için hatırlatma kuruluyordu.
    expect(source).not.toContain('slice(0, mealCount)')
  })

  it('saatleri sabit kodlamaz, öğün tanımından okur', () => {
    expect(source).toMatch(/meal\.time\.split/)
    expect(source).not.toMatch(/hour:\s*\d+/)
  })

  it.each([3, 4, 5, 6])('%i öğünde hatırlatma öğünleri planla aynıdır', (count) => {
    expect(selectMealTypes(count).map((meal) => meal.name)).toEqual(
      createMealPlan(count, TARGETS, 'maintain').meals.map((meal) => meal.name)
    )
  })
})

describe('besin kategorileri: nutrition-db.json ↔ mobil food-search', () => {
  /** food-search ekranındaki kategori etiketlerinin anahtarlarını okur. */
  function parseCategoryLabels(): string[] {
    const source = readRepoFile('apps/mobile/app/food-search.tsx')
    const start = source.indexOf('CATEGORY_LABELS')
    const block = source.slice(start, source.indexOf('}', start))
    return [...block.matchAll(/^\s{2}([a-z_]+):/gm)].map((match) => match[1])
  }

  const labelKeys = parseCategoryLabels()
  const dbCategories = new Set(Object.keys(allFoods()))

  it('etiket tablosu okunabildi', () => {
    expect(labelKeys.length).toBeGreaterThan(10)
  })

  it('her etiket anahtarı veritabanında gerçekten vardır', () => {
    // Regresyon: 6 anahtar (ekmekler, baklagiller, kuruyemisler, seker_tatlilar,
    // hazir_yiyecekler, diger) veritabanıyla eşleşmiyordu ve ölü kayıttı.
    const unmatched = labelKeys.filter((key) => !dbCategories.has(key))
    expect(unmatched, 'veritabanında olmayan kategori etiketi').toEqual([])
  })

  it('veritabanındaki her kategorinin bir etiketi vardır', () => {
    // Eksik etiket → ekranda ham anahtar ("bakliyat_kuru") görünür.
    const missing = [...dbCategories].filter((category) => !labelKeys.includes(category))
    expect(missing, 'etiketi olmayan kategori').toEqual([])
  })

  it('etiketler kullanıcı dostudur (ham anahtar değil)', () => {
    const source = readRepoFile('apps/mobile/app/food-search.tsx')
    const block = source.slice(source.indexOf('CATEGORY_LABELS'), source.indexOf('}', source.indexOf('CATEGORY_LABELS')))
    const labels = [...block.matchAll(/^\s{2}[a-z_]+: '([^']+)'/gm)].map((m) => m[1])

    expect(labels.length).toBe(labelKeys.length)
    for (const label of labels) {
      expect(label, label).not.toMatch(/_/)
      expect(label.length, label).toBeGreaterThan(2)
    }
  })

  it('ekran, kategori bulunamazsa çökmez (ham anahtara düşer)', () => {
    const source = readRepoFile('apps/mobile/app/food-search.tsx')
    expect(source).toMatch(/CATEGORY_LABELS\[\w+\]\s*\|\|/)
  })
})

describe('hata mesajları: config.ts ↔ kullanım', () => {
  it('API hata mesajları tek kaynaktan gelir', () => {
    const errorsSource = readRepoFile('packages/core/src/errors.ts')
    expect(errorsSource).toContain("from './config'")
    // Mesaj metinleri errors.ts içine kopyalanmamalı.
    expect(errorsSource).not.toMatch(/'Bir hata oluştu/)
  })

  it('API katmanı kullanıcı mesajını AppError üzerinden üretir', () => {
    const apiSource = readRepoFile('apps/web/lib/api.ts')
    expect(apiSource).toContain('toAppError')
    expect(apiSource).toContain('userMessage')
  })
})
