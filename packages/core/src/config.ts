// ============================================================================
// Uygulama sabitleri — web + mobil ortak
// ============================================================================
import type { NutritionData } from './types'

export const APP_CONFIG = {
  name: 'Beslenme Takip',
  description: 'AI destekli kişisel beslenme takip uygulaması',
  version: '1.0.0',
} as const

export const AI_CONFIG = {
  model: 'gemini-2.5-flash',
  maxRetries: 3,
  timeoutMs: 30_000,
} as const

/** Öğün türü tanımı: isim, saat ve günlük kalorinin varsayılan payı. */
export interface MealTypeConfig {
  name: string
  time: string
  targetRatio: number
}

export const MEAL_TYPES: Record<string, MealTypeConfig> = {
  Kahvaltı: { name: 'Kahvaltı', time: '08:00', targetRatio: 0.3 },
  Kuşluk: { name: 'Kuşluk', time: '10:30', targetRatio: 0.15 },
  Öğle: { name: 'Öğle', time: '13:00', targetRatio: 0.3 },
  İkindi: { name: 'İkindi', time: '16:00', targetRatio: 0.1 },
  Akşam: { name: 'Akşam', time: '19:00', targetRatio: 0.15 },
  Gece: { name: 'Gece', time: '21:30', targetRatio: 0.1 },
} as const

export const EMPTY_NUTRITION: NutritionData = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
}

/** Kilo değişimi / güvenlik sınırları — hesaplama motoru tarafından kullanılır. */
export const NUTRITION_RULES = {
  /** 1 kg yağ ≈ 7700 kcal. */
  kcalPerKg: 7700,
  /** Sağlıklı haftalık kilo değişim hızları (kg/hafta). */
  healthyWeeklyRate: {
    lose_weight: -0.5,
    gain_weight: 0.5,
    build_muscle: 0.3,
    maintain: 0,
  },
  minCalories: { male: 1500, female: 1200, other: 1350 },
  /** Vücut ağırlığı başına minimum protein (g/kg). */
  minProteinPerKg: { build_muscle: 2.0, default: 1.6 },
} as const

/** Onboarding / öğün formu doğrulama sınırları. */
export const VALIDATION_RULES = {
  age: { min: 10, max: 100 },
  height_cm: { min: 100, max: 250 },
  weight_kg: { min: 30, max: 300 },
  target_weeks: { min: 1, max: 104 },
  mealCount: { min: 3, max: 6 },
  meal: {
    description: { minLength: 3, maxLength: 500 },
  },
} as const

export const ERROR_MESSAGES = {
  api: {
    invalidKey: 'API bağlantısı kurulamadı. Lütfen ayarları kontrol edin.',
    rateLimit: 'Çok fazla istek gönderildi. Lütfen bekleyip tekrar deneyin.',
    quotaExceeded: 'Günlük kullanım limiti doldu. Yarın tekrar deneyin.',
    network: 'İnternet bağlantısı sorunu. Lütfen tekrar deneyin.',
    timeout: 'İstek zaman aşımına uğradı.',
    generic: 'Bir hata oluştu. Lütfen tekrar deneyin.',
  },
  validation: {
    required: 'Bu alan zorunludur',
    outOfRange: 'Değer geçerli aralık dışında',
    invalid: 'Geçersiz değer',
  },
} as const
