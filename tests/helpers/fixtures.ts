// ============================================================================
// Paylaşılan test verileri (fixture'lar).
// Testler bunları `makeUser({ goal: 'lose_weight' })` gibi kısmi override ile
// kullanır; böylece bir alanın eklenmesi tüm testleri kırmaz.
// ============================================================================
import type {
  ActivityLevel,
  FoodItem,
  Gender,
  Goal,
  MealEntry,
  MealLog,
  NutritionData,
  UserPhysicalData,
} from '@nutrition/core'

/** Referans kullanıcı: 30 yaşında, 80 kg, 180 cm, orta aktif erkek. */
export const BASE_USER: UserPhysicalData = {
  age: 30,
  gender: 'male',
  height_cm: 180,
  current_weight_kg: 80,
  target_weight_kg: 75,
  activity_level: 'moderate',
  goal: 'lose_weight',
}

export function makeUser(overrides: Partial<UserPhysicalData> = {}): UserPhysicalData {
  return { ...BASE_USER, ...overrides }
}

export const ALL_GENDERS: Gender[] = ['male', 'female', 'other']
export const ALL_GOALS: Goal[] = ['lose_weight', 'gain_weight', 'build_muscle', 'maintain']
export const ALL_ACTIVITY_LEVELS: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]

export function makeNutrition(overrides: Partial<NutritionData> = {}): NutritionData {
  return { calories: 500, protein: 30, carbs: 50, fat: 20, ...overrides }
}

export function makeFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    name: 'Tavuk göğsü (pişmiş)',
    amount: 150,
    unit: 'g',
    nutrition: { calories: 248, protein: 46, carbs: 0, fat: 5 },
    ...overrides,
  }
}

export function makeMealEntry(overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    id: 'meal-1',
    mealType: 'Öğle',
    description: '150g tavuk göğsü ve pilav',
    foods: [makeFood()],
    totalNutrition: makeNutrition(),
    timestamp: new Date('2026-03-15T12:30:00'),
    ...overrides,
  }
}

/** Supabase `meal_logs` satırı (DB'den dönen ham kayıt). */
export function makeMealLogRow(overrides: Partial<MealLog> = {}): MealLog {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    user_id: 'user-1',
    date: '2026-03-15',
    meal_type: 'Öğle',
    description: '150g tavuk göğsü ve pilav',
    food_items: [makeFood()],
    total_calories: 500,
    total_protein_g: 30,
    total_carbs_g: 50,
    total_fat_g: 20,
    ai_analysis: 'Dengeli bir öğün.',
    ai_suggestions: 'Yanına salata ekle.',
    confidence_score: 0.8,
    created_at: '2026-03-15T12:30:00.000Z',
    updated_at: '2026-03-15T12:30:00.000Z',
    ...overrides,
  }
}

/** Zustand `StateStorage` uyumlu bellek içi depo (persist testleri için). */
export function createMemoryStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
  }
}
