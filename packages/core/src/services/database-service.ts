// ============================================================================
// Database servisi — web + mobil metodlarının birleşimi (tek kaynak)
// ============================================================================
import { toLocalDateStr } from '../date'
import type { TypedSupabaseClient } from '../supabase/client'
import type { MealLog, NutritionPlan, WeightLog } from '../supabase/database.types'
import type { FoodItem, MealEntry, NutritionData } from '../types'

const PGRST_NO_ROWS = 'PGRST116'

/** meal_logs satırını UI'daki MealEntry'ye çevirir (iki app de aynısını yapıyordu). */
export function mealLogToEntry(row: MealLog): MealEntry {
  return {
    id: row.id,
    mealType: row.meal_type,
    description: row.description ?? '',
    foods: (row.food_items as FoodItem[]) ?? [],
    totalNutrition: {
      calories: row.total_calories ?? 0,
      protein: row.total_protein_g ?? 0,
      carbs: row.total_carbs_g ?? 0,
      fat: row.total_fat_g ?? 0,
    },
    timestamp: new Date(row.created_at),
    aiAnalysis: row.ai_analysis ?? undefined,
    suggestions: row.ai_suggestions ?? undefined,
  }
}

export function createDatabaseService(supabase: TypedSupabaseClient) {
  return {
    // ---- MEAL LOGS ----
    async saveMealLog(userId: string, meal: MealEntry): Promise<MealLog> {
      const { data, error } = await supabase
        .from('meal_logs')
        .insert({
          user_id: userId,
          date: toLocalDateStr(meal.timestamp),
          meal_type: meal.mealType,
          description: meal.description,
          food_items: meal.foods,
          total_calories: meal.totalNutrition.calories,
          total_protein_g: meal.totalNutrition.protein,
          total_carbs_g: meal.totalNutrition.carbs,
          total_fat_g: meal.totalNutrition.fat,
          ai_analysis: meal.aiAnalysis ?? null,
          ai_suggestions: meal.suggestions ?? null,
          confidence_score: null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },

    async getMealLogs(userId: string, date: string): Promise<MealLog[]> {
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },

    /** Son benzersiz öğünler (hızlı ekle için); aynı açıklamadan tek kayıt. */
    async getRecentMeals(userId: string, limit = 5): Promise<MealLog[]> {
      const today = toLocalDateStr(new Date())
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', userId)
        .lt('date', today)
        .order('created_at', { ascending: false })
        .limit(limit * 4)
      if (error) throw error
      const seen = new Set<string>()
      const unique: MealLog[] = []
      for (const row of data ?? []) {
        if (seen.has(row.description)) continue
        seen.add(row.description)
        unique.push(row)
        if (unique.length >= limit) break
      }
      return unique
    },

    async deleteMealLog(mealLogId: string): Promise<void> {
      const { error } = await supabase.from('meal_logs').delete().eq('id', mealLogId)
      if (error) throw error
    },

    // ---- DAILY PROGRESS / İSTATİSTİK ----
    /** Ardışık hedef-tutturma serisi (streak). */
    async getCurrentStreak(userId: string): Promise<number> {
      const { data, error } = await supabase
        .from('daily_progress')
        .select('date, goal_met')
        .eq('user_id', userId)
        .eq('goal_met', true)
        .order('date', { ascending: false })
        .limit(60)
      if (error || !data || data.length === 0) return 0

      let streak = 0
      const today = new Date()
      for (let i = 0; i < data.length; i++) {
        const expected = new Date(today)
        expected.setDate(today.getDate() - i)
        if (data[i].date === toLocalDateStr(expected)) streak++
        else break
      }
      return streak
    },

    /** Son 7 günün günlük kalori tüketimi (grafik için). */
    async getWeeklyCalories(userId: string): Promise<{ date: string; calories: number }[]> {
      const days: { date: string; calories: number }[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push({ date: toLocalDateStr(d), calories: 0 })
      }
      const { data, error } = await supabase
        .from('daily_progress')
        .select('date, calories_consumed')
        .eq('user_id', userId)
        .gte('date', days[0].date)
        .lte('date', days[6].date)
      if (error) return days
      return days.map((d) => {
        const found = data?.find((r) => r.date === d.date)
        return { date: d.date, calories: found ? found.calories_consumed : 0 }
      })
    },

    // ---- NUTRITION PLANS ----
    async getActiveNutritionPlan(userId: string): Promise<NutritionPlan | null> {
      const { data, error } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (error && error.code !== PGRST_NO_ROWS) throw error
      return data
    },

    async createNutritionPlan(
      userId: string,
      targets: NutritionData & { fiber?: number },
      planName?: string
    ): Promise<NutritionPlan> {
      // Önce mevcut aktif planları pasifleştir
      await supabase
        .from('nutrition_plans')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true)

      const { data, error } = await supabase
        .from('nutrition_plans')
        .insert({
          user_id: userId,
          daily_calories: targets.calories,
          protein_g: targets.protein,
          carbs_g: targets.carbs,
          fat_g: targets.fat,
          fiber_g: targets.fiber ?? null,
          is_active: true,
          plan_name: planName ?? null,
          notes: null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },

    // ---- WEIGHT LOGS ----
    async saveWeightLog(
      userId: string,
      date: string,
      weightKg: number,
      notes?: string
    ): Promise<WeightLog> {
      const { data, error } = await supabase
        .from('weight_logs')
        .upsert(
          { user_id: userId, date, weight_kg: weightKg, notes: notes ?? null },
          { onConflict: 'user_id,date' }
        )
        .select()
        .single()
      if (error) throw error
      return data
    },

    async getWeightLogs(userId: string, limit = 30): Promise<WeightLog[]> {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data ?? []
    },
  }
}

export type DatabaseService = ReturnType<typeof createDatabaseService>
