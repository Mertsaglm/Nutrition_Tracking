// ============================================================================
// Supabase Database tipleri — supabase/schema.sql ile hizalı (tek kaynak)
// Not: supabase-js'in GenericSchema kısıtını karşılamak için her tabloda
// `Relationships: []` ve şema düzeyinde Views/Functions bulunmalıdır.
// ============================================================================
import type { ActivityLevel, Gender, Goal } from '../types'

type Timestamp = string
type DateStr = string

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          age: number | null
          gender: Gender | null
          height_cm: number | null
          current_weight_kg: number | null
          target_weight_kg: number | null
          activity_level: ActivityLevel | null
          goal: Goal | null
          dietary_preferences: string[] | null
          allergies: string[] | null
          meal_count: number
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: Omit<
          Database['public']['Tables']['user_profiles']['Row'],
          'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
        Relationships: []
      }
      nutrition_plans: {
        Row: {
          id: string
          user_id: string
          daily_calories: number
          protein_g: number
          carbs_g: number
          fat_g: number
          fiber_g: number | null
          is_active: boolean
          plan_name: string | null
          notes: string | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: Omit<
          Database['public']['Tables']['nutrition_plans']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['nutrition_plans']['Insert']>
        Relationships: []
      }
      meal_logs: {
        Row: {
          id: string
          user_id: string
          date: DateStr
          meal_type: string
          description: string
          food_items: unknown
          total_calories: number
          total_protein_g: number | null
          total_carbs_g: number | null
          total_fat_g: number | null
          ai_analysis: string | null
          ai_suggestions: string | null
          confidence_score: number | null
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: Omit<
          Database['public']['Tables']['meal_logs']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['meal_logs']['Insert']>
        Relationships: []
      }
      daily_progress: {
        Row: {
          id: string
          user_id: string
          date: DateStr
          calories_consumed: number
          protein_consumed_g: number
          carbs_consumed_g: number
          fat_consumed_g: number
          calories_target: number | null
          protein_target_g: number | null
          carbs_target_g: number | null
          fat_target_g: number | null
          goal_met: boolean
          meal_count: number
          created_at: Timestamp
          updated_at: Timestamp
        }
        Insert: Omit<
          Database['public']['Tables']['daily_progress']['Row'],
          'id' | 'created_at' | 'updated_at'
        >
        Update: Partial<Database['public']['Tables']['daily_progress']['Insert']>
        Relationships: []
      }
      weight_logs: {
        Row: {
          id: string
          user_id: string
          date: DateStr
          weight_kg: number
          notes: string | null
          created_at: Timestamp
        }
        Insert: Omit<Database['public']['Tables']['weight_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['weight_logs']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type NutritionPlan = Database['public']['Tables']['nutrition_plans']['Row']
export type MealLog = Database['public']['Tables']['meal_logs']['Row']
export type DailyProgressRow = Database['public']['Tables']['daily_progress']['Row']
export type WeightLog = Database['public']['Tables']['weight_logs']['Row']
