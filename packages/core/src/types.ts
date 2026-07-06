// ============================================================================
// Domain tipleri — tüm platformlarda (web + mobil) tek kaynak
// ============================================================================

export type Gender = 'male' | 'female' | 'other'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'

export type Goal = 'lose_weight' | 'gain_weight' | 'build_muscle' | 'maintain'

/** Bir öğün/yiyecek için makro besin değerleri. */
export interface NutritionData {
  calories: number
  protein: number
  carbs: number
  fat: number
}

/** Tespit edilmiş tek bir yiyecek kalemi. */
export interface FoodItem {
  name: string
  amount: number
  unit: string
  nutrition: NutritionData
}

/** Kullanıcının kaydettiği bir öğün. */
export interface MealEntry {
  id: string
  mealType: string
  description: string
  foods: FoodItem[]
  totalNutrition: NutritionData
  timestamp: Date
  aiAnalysis?: string
  suggestions?: string
}

/** Günlük ilerleme (store'da tutulan). */
export interface DailyProgress {
  date: string
  consumed: NutritionData
  target: NutritionData
  meals: MealEntry[]
}

/** Öğün zaman çizelgesi öğesi. */
export interface MealSchedule {
  name: string
  time: string
  target_calories: number
}

// ----------------------------------------------------------------------------
// Hesaplama tipleri
// ----------------------------------------------------------------------------

export interface UserPhysicalData {
  age: number
  gender: Gender
  height_cm: number
  current_weight_kg: number
  target_weight_kg: number
  activity_level: ActivityLevel
  goal: Goal
  /** Hedefe ulaşmak için hedeflenen hafta sayısı (opsiyonel). */
  target_weeks?: number
}

export interface NutritionTargets extends NutritionData {
  fiber?: number
  water_liters?: number
}

export interface MealPlanMeal {
  name: string
  time: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface MealPlan {
  meal_count: number
  meals: MealPlanMeal[]
}

export interface FullNutritionPlan {
  targets: NutritionTargets
  mealPlan: MealPlan
  bmr: number
  tdee: number
  recommendedWeeks: number
  weeklyWeightChange: number
}

// ----------------------------------------------------------------------------
// AI tipleri
// ----------------------------------------------------------------------------

/** Öğün analizi AI sonucu. */
export interface MealAnalysisResult {
  foods: FoodItem[]
  totalNutrition: NutritionData
  analysis: string
  suggestions: string
  confidence: number
}

export interface SampleMealFood {
  name: string
  amount: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface SampleMeal {
  name: string
  time: string
  foods: SampleMealFood[]
  totals: NutritionData
}

export interface SampleMealPlan {
  meals: SampleMeal[]
  dailyTotals: NutritionData
  note: string
}

/** AI'a örnek plan üretmesi için gönderilen parametreler. */
export interface SampleMealPlanParams {
  dailyCalories: number
  protein: number
  carbs: number
  fat: number
  mealCount: number
  dietaryPreferences: string[]
  allergies: string[]
  goal: string
}
