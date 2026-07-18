// ============================================================================
// @nutrition/core — platformdan bağımsız iş mantığı (tek kaynak)
// ============================================================================

// Tipler
export type * from './types'

// Sabitler & config
export {
  APP_CONFIG,
  AI_CONFIG,
  MEAL_TYPES,
  EMPTY_NUTRITION,
  NUTRITION_RULES,
  VALIDATION_RULES,
  ERROR_MESSAGES,
} from './config'
export type { MealTypeConfig } from './config'

// Hatalar
export { AppError, toAppError } from './errors'
export type { AppErrorCode } from './errors'

// Doğrulama
export {
  validateNumber,
  validateOnboarding,
  validateMealDescription,
} from './validation'
export type { FieldResult, OnboardingInput } from './validation'

// Tarih yardımcıları
export { toLocalDateStr } from './date'

// Hesaplama
export {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  calculateMacros,
  recommendFiber,
  recommendWaterLiters,
  createMealPlan,
  recommendMealCount,
  recommendTargetWeeks,
  createFullNutritionPlan,
} from './nutrition/calculator'

// Besin veritabanı
export { selectRelevantFoods, allFoods } from './nutrition/food-db'
export type { FoodMacros, FoodSelection } from './nutrition/food-db'

// AI (prompt + parse: sunucu; client: uygulamalar)
export { buildMealAnalysisPrompt, buildSampleMealPlanPrompt } from './ai/prompts'
export { parseMealAnalysis, parseSampleMealPlan } from './ai/parse'
export { createAINutritionClient } from './ai/client'
export type { AINutritionClient, AINutritionClientConfig } from './ai/client'

// Supabase
export { createSupabaseClient } from './supabase/client'
export type {
  SupabaseConfig,
  SupabaseStorage,
  TypedSupabaseClient,
} from './supabase/client'
export type {
  Database,
  UserProfile,
  NutritionPlan,
  MealLog,
  DailyProgressRow,
  WeightLog,
} from './supabase/database.types'

// Servisler
export { createAuthService } from './services/auth-service'
export type { AuthService, SignUpData, SignInData } from './services/auth-service'
export { createDatabaseService, mealLogToEntry } from './services/database-service'
export type { DatabaseService } from './services/database-service'

// Store
export { createNutritionStore, sumNutrition } from './store/nutrition-store'
export type { NutritionStore, NutritionStoreState } from './store/nutrition-store'
