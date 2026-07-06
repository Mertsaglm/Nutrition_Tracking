// ============================================================================
// Günlük beslenme store'u (zustand) — storage platformdan enjekte edilir
// (web: localStorage · mobil: AsyncStorage)
// ============================================================================
import { create, type UseBoundStore, type StoreApi } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { EMPTY_NUTRITION } from '../config'
import type { DailyProgress, MealEntry, NutritionData } from '../types'

export interface NutritionStoreState {
  dailyProgress: DailyProgress | null
  isLoading: boolean
  fiberTarget: number
  waterTarget: number

  initializeDay: (date: string) => void
  setDailyTargets: (targets: NutritionData) => void
  setFiberWaterTargets: (fiber: number, water: number) => void
  addMealEntry: (entry: MealEntry) => void
  updateMealEntry: (id: string, updates: Partial<MealEntry>) => void
  deleteMealEntry: (id: string) => void
  setMeals: (meals: MealEntry[]) => void
  clearMeals: () => void
}

export type NutritionStore = UseBoundStore<StoreApi<NutritionStoreState>>

/** Öğün listesinden toplam tüketilen makroları hesaplar. */
export function sumNutrition(meals: MealEntry[]): NutritionData {
  return meals.reduce(
    (total, meal) => ({
      calories: total.calories + meal.totalNutrition.calories,
      protein: total.protein + meal.totalNutrition.protein,
      carbs: total.carbs + meal.totalNutrition.carbs,
      fat: total.fat + meal.totalNutrition.fat,
    }),
    { ...EMPTY_NUTRITION }
  )
}

export function createNutritionStore(storage: StateStorage): NutritionStore {
  return create<NutritionStoreState>()(
    persist(
      (set, get) => ({
        dailyProgress: null,
        isLoading: false,
        fiberTarget: 25,
        waterTarget: 2.5,

        initializeDay: (date) => {
          const existing = get().dailyProgress
          if (existing && existing.date === date) return
          set({
            dailyProgress: {
              date,
              consumed: { ...EMPTY_NUTRITION },
              target: { ...EMPTY_NUTRITION },
              meals: [],
            },
          })
        },

        setDailyTargets: (targets) => {
          const { dailyProgress } = get()
          if (!dailyProgress) return
          set({ dailyProgress: { ...dailyProgress, target: targets } })
        },

        setFiberWaterTargets: (fiber, water) => set({ fiberTarget: fiber, waterTarget: water }),

        addMealEntry: (entry) => {
          const { dailyProgress } = get()
          if (!dailyProgress) return
          const meals = [...dailyProgress.meals, entry]
          set({ dailyProgress: { ...dailyProgress, meals, consumed: sumNutrition(meals) } })
        },

        updateMealEntry: (id, updates) => {
          const { dailyProgress } = get()
          if (!dailyProgress) return
          const meals = dailyProgress.meals.map((m) => (m.id === id ? { ...m, ...updates } : m))
          set({ dailyProgress: { ...dailyProgress, meals, consumed: sumNutrition(meals) } })
        },

        deleteMealEntry: (id) => {
          const { dailyProgress } = get()
          if (!dailyProgress) return
          const meals = dailyProgress.meals.filter((m) => m.id !== id)
          set({ dailyProgress: { ...dailyProgress, meals, consumed: sumNutrition(meals) } })
        },

        setMeals: (meals) => {
          const { dailyProgress } = get()
          if (!dailyProgress) return
          set({ dailyProgress: { ...dailyProgress, meals, consumed: sumNutrition(meals) } })
        },

        clearMeals: () => {
          const { dailyProgress } = get()
          if (!dailyProgress) return
          set({
            dailyProgress: { ...dailyProgress, meals: [], consumed: { ...EMPTY_NUTRITION } },
          })
        },
      }),
      {
        name: 'nutrition-storage',
        storage: createJSONStorage(() => storage),
        partialize: (state) => ({
          dailyProgress: state.dailyProgress,
          fiberTarget: state.fiberTarget,
          waterTarget: state.waterTarget,
        }),
      }
    )
  )
}
