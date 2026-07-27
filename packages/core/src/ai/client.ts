// ============================================================================
// AI HTTP client — web ve mobil bunu kullanarak sunucudaki AI route'larını çağırır.
// Gemini anahtarı istemcide DEĞİL; yalnızca sunucu env'inde tutulur.
// ============================================================================
import { AI_CONFIG } from '../config'
import { AppError, toAppError } from '../errors'
import type { MealAnalysisResult, SampleMealPlan, SampleMealPlanParams } from '../types'

export interface AINutritionClientConfig {
  /** API kök adresi. Web'de boş (same-origin), mobilde tam URL. */
  baseUrl?: string
  timeoutMs?: number
  /**
   * İstek başına Supabase erişim token'ı sağlar. Sunucudaki AI route'ları bu
   * token ile kimlik doğrular; böylece uç noktalar anonim çağrılara kapalıdır.
   */
  getAuthToken?: () => Promise<string | null> | string | null
}

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
}

export interface AINutritionClient {
  analyzeMeal(
    description: string,
    mealType: string,
    targetCalories: number
  ): Promise<MealAnalysisResult>
  generateSampleMealPlan(params: SampleMealPlanParams): Promise<SampleMealPlan>
}

export function createAINutritionClient(
  config: AINutritionClientConfig = {}
): AINutritionClient {
  const base = (config.baseUrl ?? '').replace(/\/$/, '')
  const timeoutMs = config.timeoutMs ?? AI_CONFIG.timeoutMs

  async function post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController()
    // NOT: `DOMException` yalnızca web'de global olarak var; React Native (Hermes)
    // ortamında tanımsız. Bu yüzden abort'u hata tipiyle değil, yerel bir bayrakla
    // tespit ediyoruz — böylece kod her iki platformda da güvenle çalışır.
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const token = config.getAuthToken ? await config.getAuthToken() : null
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const json = (await res.json()) as ApiEnvelope<T>
      if (!res.ok || !json.success || json.data === undefined) {
        throw new AppError('API_ERROR', json.error || `İstek başarısız (${res.status})`)
      }
      return json.data
    } catch (error) {
      if (timedOut) {
        throw new AppError('TIMEOUT', 'İstek zaman aşımına uğradı.')
      }
      throw toAppError(error)
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    analyzeMeal(description, mealType, targetCalories) {
      return post<MealAnalysisResult>('/api/analyze-meal', {
        description,
        mealType,
        targetCalories,
      })
    },
    generateSampleMealPlan(params) {
      return post<SampleMealPlan>('/api/sample-meal-plan', params)
    },
  }
}
