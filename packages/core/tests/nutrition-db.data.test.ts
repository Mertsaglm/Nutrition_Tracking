// ============================================================================
// data/nutrition-db.json — besin veritabanı VERİ BÜTÜNLÜĞÜ.
//
// Bu JSON, AI'ın referans aldığı tek gerçek kaynak. Elle (veya bir yapay zeka
// tarafından) düzenlenirken bozulması çok kolay: eksik alan, metne dönmüş sayı,
// çift anahtar, saçma kalori değeri... Bunlar derleme hatası vermez ama AI'ın
// ürettiği besin değerlerini sessizce bozar.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { allFoods } from '@nutrition/core'
import rawDb from '../src/data/nutrition-db.json'

const foods = allFoods()
const entries = Object.entries(foods).flatMap(([category, items]) =>
  Object.entries(items).map(([key, macros]) => ({ category, key, macros }))
)

describe('veritabanı yapısı', () => {
  it('beklenen üst düzey bölümleri içerir', () => {
    expect(Object.keys(rawDb).sort()).toEqual([
      'daily_targets',
      'foods',
      'meal_schedule',
      'metadata',
    ])
  })

  it('metadata birim ve kaynak bilgisini taşır', () => {
    const metadata = rawDb.metadata as Record<string, unknown>
    expect(metadata.version).toBeTruthy()
    expect(String(metadata.note)).toContain('100g')
    expect(Array.isArray(metadata.sources)).toBe(true)
  })

  it('yeterli sayıda kategori ve besin içerir', () => {
    expect(Object.keys(foods).length).toBeGreaterThanOrEqual(25)
    expect(entries.length).toBeGreaterThanOrEqual(350)
  })

  it('boş kategori yoktur', () => {
    for (const [category, items] of Object.entries(foods)) {
      expect(Object.keys(items).length, category).toBeGreaterThan(0)
    }
  })
})

describe('anahtar biçimi', () => {
  it('kategori adları küçük harf ve alt çizgilidir', () => {
    for (const category of Object.keys(foods)) {
      expect(category, category).toMatch(/^[a-zçğıöşü0-9_]+$/)
    }
  })

  it('besin anahtarları küçük harf, boşluksuz ve alt çizgilidir', () => {
    // Anahtar → etiket dönüşümü `key.replace(/_/g, ' ')`; boşluk/büyük harf
    // içeren bir anahtar seçim ve eşleştirme mantığını bozar.
    for (const { category, key } of entries) {
      expect(key, `${category}.${key}`).toMatch(/^[a-zçğıöşü0-9_]+$/)
      expect(key, `${category}.${key}`).not.toMatch(/^_|_$|__/)
    }
  })

  it('aynı besin anahtarı iki kategoride tekrarlanmaz', () => {
    // Tekrar eden anahtar, seçim sonucunda birbirinin üstüne yazar (sessiz veri kaybı).
    const seen = new Map<string, string>()
    const duplicates: string[] = []
    for (const { category, key } of entries) {
      const previous = seen.get(key)
      if (previous) duplicates.push(`${key} (${previous} + ${category})`)
      else seen.set(key, category)
    }
    expect(duplicates).toEqual([])
  })
})

describe('makro değerleri', () => {
  it('her besinde dört zorunlu makro alanı vardır', () => {
    for (const { category, key, macros } of entries) {
      for (const field of ['calories', 'protein', 'carbs', 'fat'] as const) {
        expect(typeof macros[field], `${category}.${key}.${field}`).toBe('number')
        expect(Number.isFinite(macros[field]), `${category}.${key}.${field}`).toBe(true)
      }
    }
  })

  it('hiçbir değer negatif değildir', () => {
    for (const { category, key, macros } of entries) {
      for (const [field, value] of Object.entries(macros)) {
        expect(value as number, `${category}.${key}.${field}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('kalori değerleri 100g için makul aralıktadır', () => {
    // Saf yağ ~900 kcal/100g üst sınırdır; üstü veri hatasıdır.
    for (const { category, key, macros } of entries) {
      expect(macros.calories, `${category}.${key}`).toBeLessThanOrEqual(950)
    }
  })

  it('makro toplamı 100g sınırını aşırı aşmaz', () => {
    // Toz baharatlarda su kaybı nedeniyle 100 g'ı biraz aşabilir; 130 g fizik dışıdır.
    for (const { category, key, macros } of entries) {
      const sum = macros.protein + macros.carbs + macros.fat
      expect(sum, `${category}.${key} (${sum} g)`).toBeLessThanOrEqual(130)
    }
  })

  it('opsiyonel alanlar (kolesterol, lif) sayı ise geçerlidir', () => {
    for (const { category, key, macros } of entries) {
      for (const field of ['cholesterol', 'fiber'] as const) {
        if (macros[field] === undefined) continue
        expect(typeof macros[field], `${category}.${key}.${field}`).toBe('number')
        expect(Number.isFinite(macros[field] as number), `${category}.${key}.${field}`).toBe(true)
      }
    }
  })

  it('bilinen referans besinler beklenen değerleri korur', () => {
    // ai/prompts.ts içindeki çiğ/pişmiş kuralları bu sayılara atıfta bulunur.
    expect(foods.kanatlilar.tavuk_gogus.calories).toBe(104) // çiğ tavuk göğsü
    expect(foods.tahillar.pirinc.calories).toBe(363) // çiğ pirinç
    expect(foods.tahillar.bulgur.calories).toBe(350) // çiğ bulgur
    expect(foods.makarna_urunleri.makarna.calories).toBe(390) // kuru makarna
    expect(foods.yaglar.zeytinyagi.calories).toBe(884)
  })

  it('veritabanı değerleri ÇİĞ/KURU haldedir', () => {
    // ÖNEMLİ: "pilav" ve "bulgur_pilavi" anahtarları pişmiş yemeği çağrıştırsa da
    // değerleri kuru tahıl seviyesindedir. Prompt (ai/prompts.ts) AI'a pişmiş
    // pilavın ~120 kcal/100g olduğunu ayrıca söyler; çelişkiyi AI çözer.
    // Bu test, birinin değerleri "düzeltirim" diye tek taraflı değiştirip
    // prompt kurallarıyla uyumu bozmasını fark ettirir.
    expect(foods.tahillar.pilav.calories).toBe(368)
    expect(foods.tahillar.bulgur_pilavi.calories).toBe(357)
  })

  it('yağ oranı yüksek besinlerin kalorisi de yüksektir (tutarlılık)', () => {
    for (const { category, key, macros } of entries) {
      if (macros.fat >= 50) {
        expect(macros.calories, `${category}.${key}`).toBeGreaterThan(400)
      }
    }
  })
})

describe('yardımcı bölümler', () => {
  it('daily_targets dört makroyu içerir', () => {
    const targets = rawDb.daily_targets as Record<string, number>
    for (const field of ['calories', 'protein', 'carbs', 'fat']) {
      expect(typeof targets[field], field).toBe('number')
      expect(targets[field], field).toBeGreaterThan(0)
    }
  })

  it('meal_schedule öğün adı, saat ve hedef kalori taşır', () => {
    const schedule = rawDb.meal_schedule as { name: string; time: string; target_calories: number }[]
    expect(Array.isArray(schedule)).toBe(true)
    expect(schedule.length).toBeGreaterThan(0)
    for (const meal of schedule) {
      expect(meal.name.length).toBeGreaterThan(0)
      expect(meal.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
      expect(meal.target_calories).toBeGreaterThan(0)
    }
  })
})
