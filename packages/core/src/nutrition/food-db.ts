// ============================================================================
// Besin veritabanı erişimi + "akıllı" besin seçimi
// Amaç: ~380 besinlik DB'yi her AI prompt'una gömmek yerine, kullanıcının
// açıklamasıyla eşleşen ~40 besini seçip göndermek (hız + maliyet + doğruluk).
// ============================================================================
import rawDb from '../data/nutrition-db.json'

export interface FoodMacros {
  protein: number
  carbs: number
  fat: number
  calories: number
  cholesterol?: number
  fiber?: number
}

interface RawDb {
  metadata: unknown
  daily_targets: unknown
  meal_schedule: unknown
  foods: Record<string, Record<string, FoodMacros>>
}

const db = rawDb as unknown as RawDb

/** Türkçe karakterleri sadeleştirip küçük harfe indirger. */
function normalize(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface FlatFood {
  /** Kullanıcı dostu etiket, ör. "tavuk gogus". */
  label: string
  category: string
  tokens: string[]
  macros: FoodMacros
}

/** DB'yi düz bir listeye çevirir (bir kez, modül yüklenirken). */
const FLAT_FOODS: FlatFood[] = Object.entries(db.foods).flatMap(([category, foods]) =>
  Object.entries(foods).map(([key, macros]) => {
    const label = key.replace(/_/g, ' ')
    return {
      label,
      category,
      tokens: normalize(label).split(' ').filter((t) => t.length >= 3),
      macros,
    }
  })
)

/** AI'ın her zaman görmesi gereken temel/sık besinler. */
const COMMON_KEYS = [
  'tavuk_gogus',
  // NOT: veritabanındaki anahtar `tavuk_yumurta_tam`; kısa "yumurta" anahtarı yok.
  'tavuk_yumurta_tam',
  'ekmek_beyaz',
  'bugday_ekmegi',
  'pirinc',
  'pilav',
  'bulgur',
  'makarna',
  'mercimek',
  'nohut',
  'inek_sutu_yagli',
  'yogurt_yagli',
  'beyaz_peynir_yagli',
  'zeytinyagi',
  'muz',
  'elma',
  'yulaf',
]

export type FoodSelection = Record<string, FoodMacros>

/**
 * Açıklamayla eşleşen besinleri seçer. Eşleşen kelime sayısına göre puanlar,
 * en iyi `limit` tanesini döner ve sık besinleri her zaman ekler.
 */
export function selectRelevantFoods(description: string, limit = 40): FoodSelection {
  const descTokens = new Set(
    normalize(description)
      .split(' ')
      .filter((t) => t.length >= 3)
  )

  const scored = FLAT_FOODS.map((food) => {
    let score = 0
    for (const token of food.tokens) {
      for (const dt of descTokens) {
        if (dt === token || dt.includes(token) || token.includes(dt)) {
          score += 1
          break
        }
      }
    }
    return { food, score }
  }).filter((s) => s.score > 0)

  scored.sort((a, b) => b.score - a.score)

  const selection: FoodSelection = {}
  for (const { food } of scored.slice(0, limit)) {
    selection[food.label] = food.macros
  }

  // Sık besinleri garanti et
  for (const key of COMMON_KEYS) {
    const label = key.replace(/_/g, ' ')
    if (selection[label]) continue
    const found = FLAT_FOODS.find((f) => f.label === label)
    if (found) selection[label] = found.macros
  }

  return selection
}

/** Ham DB'ye tam erişim (gerekirse). */
export function allFoods(): Record<string, Record<string, FoodMacros>> {
  return db.foods
}
