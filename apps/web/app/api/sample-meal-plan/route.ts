import type { NextRequest } from 'next/server'
import type { SampleMealPlanParams } from '@nutrition/core'
import { generateSampleMealPlan } from '@/lib/gemini.server'
import { apiCatch, apiError, apiOptions, apiSuccess } from '@/lib/api'
import { getUserIdFromRequest } from '@/lib/auth.server'

export const runtime = 'nodejs'

export function OPTIONS() {
  return apiOptions()
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return apiError('Bu işlem için giriş yapmalısınız', 401)

    const body = await request.json()
    const { dailyCalories, protein, carbs, fat, mealCount, goal } = body
    if (!dailyCalories || !protein || !carbs || !fat || !mealCount || !goal) {
      return apiError('Eksik parametreler', 400)
    }

    const params: SampleMealPlanParams = {
      dailyCalories: Number(dailyCalories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      mealCount: Number(mealCount),
      dietaryPreferences: Array.isArray(body.dietaryPreferences) ? body.dietaryPreferences : [],
      allergies: Array.isArray(body.allergies) ? body.allergies : [],
      goal: String(goal),
    }

    const data = await generateSampleMealPlan(params)
    return apiSuccess(data)
  } catch (error) {
    return apiCatch(error)
  }
}
