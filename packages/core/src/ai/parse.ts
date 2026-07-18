// ============================================================================
// Gemini ham metin yanıtlarını tipli sonuçlara çeviren saf parser'lar
// ============================================================================
import { EMPTY_NUTRITION } from '../config'
import type { MealAnalysisResult, SampleMealPlan } from '../types'

/** ```json ... ``` sarmalını temizler. */
function stripCodeFences(text: string): string {
  return text.replace(/```json\n?|\n?```/g, '').trim()
}

/** Güven skorunu [0,1] aralığına normalize eder (DB kontrolü 0..1 bekler). */
function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5
  return Math.max(0, Math.min(1, value))
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
      confidence: normalizeConfidence(parsed.confidence),
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

/** Örnek plan yanıtını parse eder; başarısızsa güvenli boş plan döner. */
export function parseSampleMealPlan(text: string): SampleMealPlan {
  try {
    const parsed = JSON.parse(stripCodeFences(text))
    return {
      meals: parsed.meals ?? [],
      dailyTotals: parsed.dailyTotals ?? { ...EMPTY_NUTRITION },
      note: parsed.note ?? '',
    }
  } catch {
    return { meals: [], dailyTotals: { ...EMPTY_NUTRITION }, note: '' }
  }
}
