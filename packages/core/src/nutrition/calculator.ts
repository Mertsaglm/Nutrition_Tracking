// ============================================================================
// Beslenme hesaplama motoru (saf fonksiyonlar)
// BMR: Mifflin-St Jeor · TDEE: aktivite çarpanı · Makro: hedefe göre dağılım
// ============================================================================
import { MEAL_TYPES, NUTRITION_RULES, type MealTypeConfig } from '../config'
import type {
  FullNutritionPlan,
  Goal,
  MealPlan,
  NutritionTargets,
  UserPhysicalData,
} from '../types'

const ACTIVITY_MULTIPLIERS: Record<UserPhysicalData['activity_level'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

/** Hedefe göre makro oranları (protein / karb / yağ). */
const MACRO_RATIOS: Record<Goal, { protein: number; carbs: number; fat: number }> = {
  lose_weight: { protein: 0.35, carbs: 0.35, fat: 0.3 },
  gain_weight: { protein: 0.25, carbs: 0.5, fat: 0.25 },
  build_muscle: { protein: 0.3, carbs: 0.45, fat: 0.25 },
  maintain: { protein: 0.25, carbs: 0.45, fat: 0.3 },
}

/**
 * Olası öğünler — TEK KAYNAK `config.ts` içindeki MEAL_TYPES'tır.
 * (Eskiden burada ayrı bir liste tutuluyordu; ikisi ayrışınca arayüzdeki öğün
 * seçimi plan öğünleriyle eşleşmiyordu.)
 */
const ALL_MEALS: MealTypeConfig[] = Object.values(MEAL_TYPES)

/** Öğün sayısına göre hangi öğünlerin seçileceği (hedeften bağımsız). */
function mealIndices(mealCount: number): number[] {
  switch (mealCount) {
    case 4:
      return [0, 2, 3, 4]
    case 5:
      return [0, 1, 2, 3, 4]
    case 6:
      return [0, 1, 2, 3, 4, 5]
    case 3:
    default:
      return [0, 2, 4]
  }
}

/** Seçilen öğünler arasındaki kalori dağılım oranları (hedefe göre değişir). */
function mealRatios(mealCount: number, goal: Goal): number[] {
  switch (mealCount) {
    case 4:
      return goal === 'lose_weight' ? [0.3, 0.35, 0.15, 0.2] : [0.25, 0.35, 0.15, 0.25]
    case 5:
      return goal === 'build_muscle'
        ? [0.25, 0.15, 0.25, 0.15, 0.2]
        : [0.25, 0.1, 0.3, 0.15, 0.2]
    case 6:
      return [0.2, 0.15, 0.25, 0.1, 0.2, 0.1]
    case 3:
    default:
      return goal === 'lose_weight' ? [0.35, 0.4, 0.25] : [0.3, 0.4, 0.3]
  }
}

/**
 * Bir öğün sayısı için kullanılacak öğün türleri.
 *
 * Plan (createMealPlan), web'deki öğün seçici ve mobil bildirim hatırlatmaları
 * AYNI listeyi kullanmalıdır; aksi halde kullanıcı planında olmayan bir öğün
 * seçer ya da yanlış saatte hatırlatma alır.
 */
export function selectMealTypes(mealCount: number): MealTypeConfig[] {
  return mealIndices(mealCount).map((index) => ALL_MEALS[index])
}

/** BMR — Mifflin-St Jeor. */
export function calculateBMR(data: UserPhysicalData): number {
  const base = 10 * data.current_weight_kg + 6.25 * data.height_cm - 5 * data.age
  if (data.gender === 'male') return base + 5
  if (data.gender === 'female') return base - 161
  return base - 78 // "other" için ortalama
}

/** TDEE — BMR × aktivite çarpanı. */
export function calculateTDEE(data: UserPhysicalData): number {
  return Math.round(calculateBMR(data) * ACTIVITY_MULTIPLIERS[data.activity_level])
}

/** Hedef günlük kalori — TDEE + kilo değişim farkı (güvenlik sınırlı). */
export function calculateTargetCalories(data: UserPhysicalData): number {
  const tdee = calculateTDEE(data)
  const weightDiff = data.target_weight_kg - data.current_weight_kg

  let rate: number = NUTRITION_RULES.healthyWeeklyRate[data.goal]
  // Hedef yönü ile kilo hedefi çelişiyorsa yönü düzelt
  if (data.goal === 'lose_weight' && weightDiff > 0) {
    rate = NUTRITION_RULES.healthyWeeklyRate.gain_weight
  } else if (data.goal === 'gain_weight' && weightDiff < 0) {
    rate = NUTRITION_RULES.healthyWeeklyRate.lose_weight
  }

  // Kullanıcı bir hedef süre belirttiyse gereken haftalık hızı ondan türet ve
  // sağlıklı bir üst sınıra kırp (yön otomatik doğru gelir). "maintain" hariç.
  if (data.goal !== 'maintain' && data.target_weeks && data.target_weeks > 0 && weightDiff !== 0) {
    const requiredRate = weightDiff / data.target_weeks
    const maxRate = NUTRITION_RULES.maxWeeklyRate
    rate = Math.max(-maxRate, Math.min(maxRate, requiredRate))
  }

  const dailyDiff = (rate * NUTRITION_RULES.kcalPerKg) / 7
  const minCalories = NUTRITION_RULES.minCalories[data.gender]
  const maxCalories = tdee * 1.3

  return Math.round(Math.max(minCalories, Math.min(maxCalories, tdee + dailyDiff)))
}

/** Günlük lif hedefi (g) — 14 g / 1000 kcal. */
export function recommendFiber(targetCalories: number): number {
  return Math.round((targetCalories / 1000) * 14)
}

/** Günlük su hedefi (L) — 35 ml / kg. */
export function recommendWaterLiters(currentWeightKg: number): number {
  return Math.round((currentWeightKg * 35) / 100) / 10
}

/** Makro besin hedefleri — hedefe göre oran + minimum protein + su/lif. */
export function calculateMacros(
  data: UserPhysicalData,
  targetCalories: number
): NutritionTargets {
  const ratios = MACRO_RATIOS[data.goal]

  const ratioProtein = Math.round((targetCalories * ratios.protein) / 4)
  const minProteinPerKg =
    data.goal === 'build_muscle'
      ? NUTRITION_RULES.minProteinPerKg.build_muscle
      : NUTRITION_RULES.minProteinPerKg.default
  const protein = Math.max(ratioProtein, Math.round(data.current_weight_kg * minProteinPerKg))

  // Protein tabanı devreye girip toplam kaloriyi hedefin üstüne çıkarmasın diye,
  // kalan kaloriyi karb/yağ arasında orijinal oranlarına göre paylaştır.
  // (Taban devrede değilken bu, eski oran-bazlı sonucun aynısını üretir.)
  const remainingCalories = Math.max(0, targetCalories - protein * 4)
  const carbFatRatio = ratios.carbs + ratios.fat
  const carbs = Math.round((remainingCalories * (ratios.carbs / carbFatRatio)) / 4)
  const fat = Math.round((remainingCalories * (ratios.fat / carbFatRatio)) / 9)

  return {
    calories: targetCalories,
    protein,
    carbs,
    fat,
    fiber: recommendFiber(targetCalories),
    water_liters: recommendWaterLiters(data.current_weight_kg),
  }
}

/** Öğün planı — öğün sayısı ve hedeflere göre öğün dağılımı. */
export function createMealPlan(
  mealCount: number,
  targets: NutritionTargets,
  goal: Goal
): MealPlan {
  const meals = selectMealTypes(mealCount)
  const ratios = mealRatios(mealCount, goal)
  const mealPlanMeals = meals.map((meal, i) => {
    const ratio = ratios[i] ?? 0
    return {
      name: meal.name,
      time: meal.time,
      calories: Math.round(targets.calories * ratio),
      protein: Math.round(targets.protein * ratio),
      carbs: Math.round(targets.carbs * ratio),
      fat: Math.round(targets.fat * ratio),
    }
  })
  return { meal_count: mealPlanMeals.length, meals: mealPlanMeals }
}

/** Hedefe göre önerilen öğün sayısı. */
export function recommendMealCount(goal: Goal): number {
  switch (goal) {
    case 'gain_weight':
    case 'build_muscle':
      return 5
    case 'maintain':
      return 4
    case 'lose_weight':
    default:
      return 3
  }
}

/** Sağlıklı ve gerçekçi hedef süre (hafta) — haftada 0.5 kg baz. */
export function recommendTargetWeeks(data: UserPhysicalData): number {
  const weightDiff = Math.abs(data.target_weight_kg - data.current_weight_kg)
  const weeks = Math.ceil(weightDiff / 0.5)
  return Math.max(4, Math.min(52, weeks))
}

/** Anlamlı sayılan en küçük haftalık değişim (kg/hafta). Altı "değişim yok". */
const MIN_MEANINGFUL_WEEKLY_RATE = 0.01

/**
 * Tüm hesaplamaları birleştiren ana fonksiyon.
 *
 * `weeklyWeightChange` ve `recommendedWeeks`, kullanıcının İSTEDİĞİNİ değil,
 * planın GERÇEKTEN sağlayacağını bildirir: kalori hedefi güvenlik sınırlarıyla
 * (haftalık hız kırpması, cinsiyete göre minimum kalori, TDEE × 1.3 tavanı)
 * budandığı için, "2 haftada 5 kg" isteği fiilen daha uzun sürer. Bu alanlar
 * o gerçeği yansıtır; `paceLimited` ise arayüzün kullanıcıyı uyarabilmesi için
 * isteğin kırpıldığını bildirir.
 */
export function createFullNutritionPlan(
  data: UserPhysicalData,
  mealCount?: number
): FullNutritionPlan {
  const tdee = calculateTDEE(data)
  const targetCalories = calculateTargetCalories(data)
  const targets = calculateMacros(data, targetCalories)
  const finalMealCount = mealCount ?? recommendMealCount(data.goal)
  const mealPlan = createMealPlan(finalMealCount, targets, data.goal)

  const weightDiff = data.target_weight_kg - data.current_weight_kg
  // Planın fiilen sağladığı haftalık değişim: kalori farkı → kg (1 kg ≈ 7700 kcal).
  const weeklyWeightChange = ((targetCalories - tdee) * 7) / NUTRITION_RULES.kcalPerKg

  const requestedWeeks =
    data.target_weeks && data.target_weeks > 0 ? Math.ceil(data.target_weeks) : null

  // Hedefe bu hızla kaç haftada ulaşılır? Hız anlamsızsa (koruma hedefi ya da
  // minimum kalori tabanı yönü tersine çevirdiyse) süre hesaplanamaz.
  const rateIsUsable =
    Math.abs(weeklyWeightChange) >= MIN_MEANINGFUL_WEEKLY_RATE &&
    Math.sign(weeklyWeightChange) === Math.sign(weightDiff)
  const achievableWeeks = rateIsUsable
    ? Math.ceil(Math.abs(weightDiff) / Math.abs(weeklyWeightChange))
    : null

  const recommendedWeeks = achievableWeeks ?? requestedWeeks ?? recommendTargetWeeks(data)

  return {
    targets,
    mealPlan,
    bmr: Math.round(calculateBMR(data)),
    tdee,
    recommendedWeeks,
    weeklyWeightChange,
    paceLimited: requestedWeeks !== null && recommendedWeeks > requestedWeeks,
  }
}
