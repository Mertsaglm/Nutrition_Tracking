// ============================================================================
// AI prompt üreticileri (saf) — sunucu tarafı Gemini çağrısı bunları kullanır
// ============================================================================
import { selectRelevantFoods } from '../nutrition/food-db'
import type { SampleMealPlanParams } from '../types'

const GOAL_TEXT: Record<string, string> = {
  lose_weight: 'kilo verme',
  gain_weight: 'kilo alma',
  build_muscle: 'kas yapma',
  maintain: 'kiloyu koruma',
}

/** Öğün analizi prompt'u — sadece açıklamayla ilgili besinleri gömer. */
export function buildMealAnalysisPrompt(
  description: string,
  mealType: string,
  targetCalories: number
): string {
  const relevantFoods = selectRelevantFoods(description)

  return `Sen bir beslenme uzmanısın. Kullanıcının yemek açıklamasını analiz et.

İLGİLİ BESİN VERİTABANI (100g başına, referans için):
${JSON.stringify(relevantFoods)}

ÇOK ÖNEMLİ - ÇİĞ vs PİŞMİŞ KURALLARI:
1. Kullanıcı "pişmiş", "haşlanmış", "kızartılmış" demezse, yemek genellikle PİŞMİŞ haldedir.
2. Tahıllar ve baklagiller pişince 2-3 kat şişer, kalori yoğunluğu düşer:
   - Pirinç (çiğ) 363 → Pilav (pişmiş) ~120 kcal/100g
   - Makarna (kuru) 390 → (pişmiş) ~130 kcal/100g
   - Bulgur (çiğ) 350 → (pişmiş) ~120 kcal/100g
   - Mercimek/Nohut/Fasulye (kuru ~350) → (pişmiş) ~115 kcal/100g
3. Etler pişince su kaybeder, kalori yoğunluğu artar:
   - Tavuk göğsü (çiğ) 104 → (pişmiş) ~165 kcal/100g
   - Dana eti (çiğ) 156 → (pişmiş) ~250 kcal/100g
4. Sebzeler pişince kalori değişimi minimaldir.
5. Kullanıcı "çiğ", "kuru", "ham" derse çiğ değerleri kullan.

KULLANICI:
Öğün: ${mealType}
Hedef: ${targetCalories} kcal
Açıklama: "${description}"

GÖREV: Yiyecekleri tespit et, PİŞMİŞ/ÇİĞ durumunu belirle, miktarları hesapla, toplam besin değerlerini bul.

ÇIKTI KURALI: "name" alanında Türkçe, kullanıcı dostu isimler kullan (ör. "Tam yumurta (haşlanmış)", "Tam buğday ekmeği"). Alt çizgili teknik isimler (tavuk_gogus) KULLANMA.

ÇIKTI (yalnızca JSON, açıklama yazma):
{
  "foods": [{"name": "Kullanıcı dostu isim", "amount": 100, "unit": "g", "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}}],
  "totalNutrition": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0},
  "analysis": "Kısa analiz",
  "suggestions": "Kısa öneri",
  "confidence": 0.8
}`
}

/** Örnek 1 günlük beslenme programı prompt'u. */
export function buildSampleMealPlanPrompt(params: SampleMealPlanParams): string {
  const goalText = GOAL_TEXT[params.goal] || 'sağlıklı beslenme'
  const prefs =
    params.dietaryPreferences.length > 0
      ? `\n- Diyet Tercihleri: ${params.dietaryPreferences.join(', ')}`
      : ''
  const allergies =
    params.allergies.length > 0
      ? `\n- ALERJİLER (ASLA KULLANMA): ${params.allergies.join(', ')}`
      : ''

  return `Sen bir beslenme uzmanısın. Aşağıdaki hedeflere göre SADECE 1 GÜNLÜK örnek beslenme programı oluştur.

HEDEFLER:
- Günlük Kalori: ${params.dailyCalories} kcal
- Protein: ${params.protein}g
- Karbonhidrat: ${params.carbs}g
- Yağ: ${params.fat}g
- Öğün Sayısı: ${params.mealCount}
- Amaç: ${goalText}${prefs}${allergies}

ÖNEMLİ KURALLAR:
1. Alerjik besinleri ASLA kullanma.
2. Diyet tercihlerine uy (vejetaryen ise et yok, vegan ise hayvansal ürün yok).
3. Türk mutfağına uygun, gerçekçi öğünler.
4. Her öğün için besin değerlerini hesapla.
5. Toplam günlük hedeflere yakın ol.

ÇIKTI (yalnızca JSON, açıklama yazma):
{
  "meals": [
    {
      "name": "Kahvaltı",
      "time": "08:00",
      "foods": [
        {"name": "Tam yumurta (haşlanmış)", "amount": "2 adet", "calories": 140, "protein": 12, "carbs": 1, "fat": 10}
      ],
      "totals": {"calories": 300, "protein": 18, "carbs": 31, "fat": 12}
    }
  ],
  "dailyTotals": {"calories": ${params.dailyCalories}, "protein": ${params.protein}, "carbs": ${params.carbs}, "fat": ${params.fat}},
  "note": "Kısa motivasyon notu"
}`
}
