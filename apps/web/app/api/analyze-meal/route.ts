import type { NextRequest } from 'next/server'
import { analyzeMeal } from '@/lib/gemini.server'
import { apiCatch, apiError, apiOptions, apiSuccess } from '@/lib/api'
import { getUserIdFromRequest } from '@/lib/auth.server'

// Gemini SDK Node.js runtime gerektirir (edge değil).
export const runtime = 'nodejs'

export function OPTIONS() {
  return apiOptions()
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return apiError('Bu işlem için giriş yapmalısınız', 401)

    const body = await request.json()
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    if (description.length < 3) {
      return apiError('Geçerli bir yemek açıklaması gerekli', 400)
    }
    const mealType = typeof body.mealType === 'string' ? body.mealType : 'Öğün'
    const targetCalories = Number(body.targetCalories) || 2000

    const data = await analyzeMeal(description, mealType, targetCalories)
    return apiSuccess(data)
  } catch (error) {
    return apiCatch(error)
  }
}
