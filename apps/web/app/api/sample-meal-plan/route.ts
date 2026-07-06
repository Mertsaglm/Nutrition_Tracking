import { NextRequest, NextResponse } from 'next/server'
import { geminiService } from '@/lib/gemini-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      dailyCalories,
      protein,
      carbs,
      fat,
      mealCount,
      dietaryPreferences = [],
      allergies = [],
      goal
    } = body

    // Validasyon
    if (!dailyCalories || !protein || !carbs || !fat || !mealCount || !goal) {
      return NextResponse.json(
        { success: false, error: 'Eksik parametreler' },
        { status: 400 }
      )
    }

    // Gemini ile örnek program oluştur
    const samplePlan = await geminiService.generateSampleDayMealPlan({
      dailyCalories,
      protein,
      carbs,
      fat,
      mealCount,
      dietaryPreferences,
      allergies,
      goal
    })

    return NextResponse.json({
      success: true,
      data: samplePlan
    })
  } catch (error) {
    console.error('Örnek program API hatası:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      },
      { status: 500 }
    )
  }
}
