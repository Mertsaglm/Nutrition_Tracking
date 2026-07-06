// ============================================================================
// Beslenme hesaplama motoru (saf fonksiyonlar)
// BMR: Mifflin-St Jeor · TDEE: aktivite çarpanı · Makro: hedefe göre dağılım
// ============================================================================
import { NUTRITION_RULES } from '../config'
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

/** Olası öğünler (öncelik sırasıyla seçilir). */
const ALL_MEALS = [
  { name: 'Kahvaltı', time: '08:00' },
  { name: 'Kuşluk', time: '10:30' },
  { name: 'Öğle', time: '13:00' },
  { name: 'İkindi', time: '16:00' },
  { name: 'Akşam', time: '19:00' },
  { name: 'Gece', time: '21:30' },
] as const

/** Öğün sayısına göre seçilen öğün indeksleri + kalori dağılım oranları. */
function mealDistribution(
  mealCount: number,
  goal: Goal
): { indices: number[]; ratios: number[] } {
  switch (mealCount) {
    case 4:
      return {
        indices: [0, 2, 3, 4],
        ratios:
          goal === 'lose_weight' ? [0.3, 0.35, 0.15, 0.2] : [0.25, 0.35, 0.15, 0.25],
      }
    case 5:
      return {
        indices: [0, 1, 2, 3, 4],
        ratios:
          goal === 'build_muscle'
            ? [0.25, 0.15, 0.25, 0.15, 0.2]
            : [0.25, 0.1, 0.3, 0.15, 0.2],
      }
    case 6:
      return { indices: [0, 1, 2, 3, 4, 5], ratios: [0.2, 0.15, 0.25, 0.1, 0.2, 0.1] }
    case 3:
    default:
      return {
        indices: [0, 2, 4],
        ratios: goal === 'lose_weight' ? [0.35, 0.4, 0.25] : [0.3, 0.4, 0.3],
      }
  }
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

/** Hedef günlük kalori — TDEE + sağlıklı kilo değişim farkı (güvenlik sınırlı). */
export function calculateTargetCalories(data: UserPhysicalData): number {
  const tdee = calculateTDEE(data)
  const weightDiff = data.target_weight_kg - data.current_weight_kg

  let rate = NUTRITION_RULES.healthyWeeklyRate[data.goal]
  // Hedef yönü ile kilo hedefi çelişiyorsa yönü düzelt
  if (data.goal === 'lose_weight' && weightDiff > 0) {
    rate = NUTRITION_RULES.healthyWeeklyRate.gain_weight
  } else if (data.goal === 'gain_weight' && weightDiff < 0) {
    rate = NUTRITION_RULES.healthyWeeklyRate.lose_weight
  }

  const dailyDiff = (rate * NUTRITION_RULES.kcalPerKg) / 7
  const minCalories = NUTRITION_RULES.minCalories[data.gender]
  const maxCalories = tdee * 1.3

  return Math.round(Math.max(minCalories, Math.min(maxCalories, tdee + dailyDiff)))
}

/** Makro besin hedefleri — hedefe göre oran + minimum protein + su/lif. */
export function calculateMacros(
  data: UserPhysicalData,
  targetCalories: number
): NutritionTargets {
  const ratios = MACRO_RATIOS[data.goal]

  const protein = Math.round((targetCalories * ratios.protein) / 4)
  const carbs = Math.round((targetCalories * ratios.carbs) / 4)
  const fat = Math.round((targetCalories * ratios.fat) / 9)

  const minProteinPerKg =
    data.goal === 'build_muscle'
      ? NUTRITION_RULES.minProteinPerKg.build_muscle
      : NUTRITION_RULES.minProteinPerKg.default
  const finalProtein = Math.max(protein, Math.round(data.current_weight_kg * minProteinPerKg))

  return {
    calories: targetCalories,
    protein: finalProtein,
    carbs,
    fat,
    fiber: Math.round((targetCalories / 1000) * 14),
    water_liters: Math.round((data.current_weight_kg * 35) / 100) / 10,
  }
}

/** Öğün planı — öğün sayısı ve hedeflere göre öğün dağılımı. */
export function createMealPlan(
  mealCount: number,
  targets: NutritionTargets,
  goal: Goal
): MealPlan {
  const { indices, ratios } = mealDistribution(mealCount, goal)
  const meals = indices.map((mealIndex, i) => {
    const meal = ALL_MEALS[mealIndex]
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
  return { meal_count: indices.length, meals }
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

/** Tüm hesaplamaları birleştiren ana fonksiyon. */
export function createFullNutritionPlan(
  data: UserPhysicalData,
  mealCount?: number
): FullNutritionPlan {
  const targetCalories = calculateTargetCalories(data)
  const targets = calculateMacros(data, targetCalories)
  const finalMealCount = mealCount ?? recommendMealCount(data.goal)
  const mealPlan = createMealPlan(finalMealCount, targets, data.goal)
  const recommendedWeeks = recommendTargetWeeks(data)

  return {
    targets,
    mealPlan,
    bmr: Math.round(calculateBMR(data)),
    tdee: calculateTDEE(data),
    recommendedWeeks,
    weeklyWeightChange: (data.target_weight_kg - data.current_weight_kg) / recommendedWeeks,
  }
}
