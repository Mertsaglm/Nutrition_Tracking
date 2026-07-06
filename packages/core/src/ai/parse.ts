// ============================================================================
// Gemini ham metin yanıtlarını tipli sonuçlara çeviren saf parser'lar
// ============================================================================
import { EMPTY_NUTRITION } from '../config'
import type { MealAnalysisResult, SampleMealPlan } from '../types'

/** ```json ... ``` sarmalını temizler. */
function stripCodeFences(text: string): string {
  return text.replace(/```json\n?|\n?```/g, '').trim()
}

/** Öğün analizi yanıtını parse eder; başarısızsa güvenli fallback döner. */
export function parseMealAnalysis(text: string): MealAnalysisResult {
  try {
    const parsed = JSON.parse(stripCodeFences(text))
    if (!parsed.foods || !parsed.totalNutrition) {
      throw new Error('Geçersiz yanıt formatı')
    }
    return {
      foods: parsed.foods ?? [],
      totalNutrition: parsed.totalNutrition ?? { ...EMPTY_NUTRITION },
      analysis: parsed.analysis ?? 'Analiz yapılamadı',
      suggestions: parsed.suggestions ?? 'Öneri bulunamadı',
      confidence: parsed.confidence ?? 50,
    }
  } catch {
    return {
      foods: [],
      totalNutrition: { ...EMPTY_NUTRITION },
      analysis: 'Otomatik analiz yapılamadı. Lütfen daha detaylı açıklama ile tekrar deneyin.',
      suggestions: 'Miktarları (gram, adet, dilim) belirterek tekrar dene.',
      confidence: 0,
    }
  }
}

/** Örnek plan yanıtını parse eder. */
export function parseSampleMealPlan(text: string): SampleMealPlan {
  const parsed = JSON.parse(stripCodeFences(text))
  return {
    meals: parsed.meals ?? [],
    dailyTotals: parsed.dailyTotals ?? { ...EMPTY_NUTRITION },
    note: parsed.note ?? '',
  }
}
