// ============================================================================
// SUNUCU-ONLY Gemini çağrıları. Anahtar (GEMINI_API_KEY) yalnızca burada okunur;
// istemciye asla gönderilmez. Prompt/parse mantığı @nutrition/core'dan gelir.
// ============================================================================
import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import {
  AI_CONFIG,
  AppError,
  buildMealAnalysisPrompt,
  buildSampleMealPlanPrompt,
  parseMealAnalysis,
  parseSampleMealPlan,
  type MealAnalysisResult,
  type SampleMealPlan,
  type SampleMealPlanParams,
} from '@nutrition/core'

let cachedModel: GenerativeModel | null = null

function getModel(): GenerativeModel {
  if (cachedModel) return cachedModel
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new AppError(
      'INVALID_API_KEY',
      'GEMINI_API_KEY sunucu ortam değişkeni ayarlı değil.'
    )
  }
  cachedModel = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: AI_CONFIG.model })
  return cachedModel
}

async function generate(prompt: string): Promise<string> {
  const result = await getModel().generateContent(prompt)
  return result.response.text()
}

export async function analyzeMeal(
  description: string,
  mealType: string,
  targetCalories: number
): Promise<MealAnalysisResult> {
  const text = await generate(buildMealAnalysisPrompt(description, mealType, targetCalories))
  return parseMealAnalysis(text)
}

export async function generateSampleMealPlan(
  params: SampleMealPlanParams
): Promise<SampleMealPlan> {
  const text = await generate(buildSampleMealPlanPrompt(params))
  return parseSampleMealPlan(text)
}
