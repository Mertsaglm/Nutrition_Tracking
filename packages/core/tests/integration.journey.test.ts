// ============================================================================
// UÇTAN UCA (iş mantığı) — gerçek kullanıcı yolculuğu.
//
// Modüller tek tek doğru çalışırken ARALARINDAKİ SÖZLEŞME bozulabilir:
// hesaplama motorunun ürettiği alan adı, DB servisinin beklediğiyle uyuşmaz;
// AI'ın döndürdüğü şekil, store'un beklediğine oturmaz. Bu dosya tam da o
// birleşim noktalarını, gerçek bir günün akışını taklit ederek doğrular.
//
// Akış: onboarding → plan → gün başlat → AI analizi → DB kaydı → store → silme
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateMacros,
  calculateTargetCalories,
  createAuthService,
  createDatabaseService,
  createFullNutritionPlan,
  createNutritionStore,
  mealLogToEntry,
  parseMealAnalysis,
  toLocalDateStr,
  validateMealDescription,
  validateOnboarding,
  type MealEntry,
  type UserPhysicalData,
} from '@nutrition/core'
import {
  type RecordedQuery,
  createFakeSupabase,
  ok,
} from '../../../tests/helpers/fake-supabase'
import { createMemoryStorage, makeMealLogRow } from '../../../tests/helpers/fixtures'

/** Formdan geldiği haliyle (metin) onboarding girdisi. */
const FORM_INPUT = {
  age: '30',
  height_cm: '180',
  current_weight_kg: '80',
  target_weight_kg: '75',
  target_weeks: '20',
}

describe('kullanıcı yolculuğu', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 9, 0)) // 15 Mart 2026, 09:00
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('onboarding → plan → gün → öğün → silme akışı baştan sona çalışır', async () => {
    // --- 1. Onboarding formu doğrulanır --------------------------------------
    const validation = validateOnboarding(FORM_INPUT)
    expect(validation.ok).toBe(true)

    const user: UserPhysicalData = {
      age: Number(FORM_INPUT.age),
      gender: 'male',
      height_cm: Number(FORM_INPUT.height_cm),
      current_weight_kg: Number(FORM_INPUT.current_weight_kg),
      target_weight_kg: Number(FORM_INPUT.target_weight_kg),
      activity_level: 'moderate',
      goal: 'lose_weight',
      target_weeks: Number(FORM_INPUT.target_weeks),
    }

    // --- 2. Beslenme planı hesaplanır ---------------------------------------
    const plan = createFullNutritionPlan(user)
    expect(plan.targets.calories).toBeGreaterThan(1500)
    expect(plan.recommendedWeeks).toBe(20)
    expect(plan.mealPlan.meals).toHaveLength(3)

    // --- 3. Plan veritabanına yazılır ---------------------------------------
    const fake = createFakeSupabase({
      respond: (query: RecordedQuery) => {
        if (query.table === 'nutrition_plans' && query.has('insert')) {
          return ok({ id: 'plan-1', daily_calories: plan.targets.calories })
        }
        if (query.table === 'meal_logs' && query.has('insert')) {
          return ok(
            makeMealLogRow({
              id: 'db-meal-1',
              date: '2026-03-15',
              meal_type: 'Kahvaltı',
              description: '2 haşlanmış yumurta ve 1 dilim tam buğday ekmeği',
              total_calories: 260,
              total_protein_g: 18,
              total_carbs_g: 20,
              total_fat_g: 12,
            })
          )
        }
        return ok([])
      },
    })
    const db = createDatabaseService(fake.client)
    const auth = createAuthService(fake.client)

    const savedPlan = await db.createNutritionPlan('user-1', plan.targets, 'İlk plan')
    expect(savedPlan.daily_calories).toBe(plan.targets.calories)

    const planInsert = fake.queriesFor('nutrition_plans').find((q) => q.has('insert'))!
    expect(planInsert.payload).toMatchObject({
      daily_calories: plan.targets.calories,
      protein_g: plan.targets.protein,
      carbs_g: plan.targets.carbs,
      fat_g: plan.targets.fat,
      fiber_g: plan.targets.fiber,
      is_active: true,
    })

    // --- 4. Store bugünü başlatır ve hedefleri alır --------------------------
    const storage = createMemoryStorage()
    const store = createNutritionStore(storage)
    const today = toLocalDateStr()
    expect(today).toBe('2026-03-15')

    store.getState().initializeDay(today)
    store.getState().setDailyTargets(plan.targets)
    store.getState().setFiberWaterTargets(plan.targets.fiber!, plan.targets.water_liters!)

    expect(store.getState().dailyProgress?.target.calories).toBe(plan.targets.calories)
    expect(store.getState().dailyProgress?.consumed.calories).toBe(0)

    // --- 5. Kullanıcı öğün girer; AI yanıtı ayrıştırılır ---------------------
    const description = '2 haşlanmış yumurta ve 1 dilim tam buğday ekmeği'
    expect(validateMealDescription(description).ok).toBe(true)

    // Gemini'nin tipik yanıtı: ```json çitiyle sarılı.
    const geminiResponse = [
      '```json',
      JSON.stringify({
        foods: [
          {
            name: 'Tam yumurta (haşlanmış)',
            amount: 100,
            unit: 'g',
            nutrition: { calories: 155, protein: 13, carbs: 1, fat: 11 },
          },
          {
            name: 'Tam buğday ekmeği',
            amount: 40,
            unit: 'g',
            nutrition: { calories: 105, protein: 5, carbs: 19, fat: 1 },
          },
        ],
        totalNutrition: { calories: 260, protein: 18, carbs: 20, fat: 12 },
        analysis: 'Proteinden zengin bir kahvaltı.',
        suggestions: 'Yanına bir porsiyon meyve ekleyebilirsin.',
        confidence: 0.9,
      }),
      '```',
    ].join('\n')

    const analysis = parseMealAnalysis(geminiResponse)
    expect(analysis.confidence).toBe(0.9)
    expect(analysis.foods).toHaveLength(2)

    // --- 6. Öğün veritabanına yazılır, dönen kayıt store'a eklenir -----------
    const draft: MealEntry = {
      id: '', // DB üretecek
      mealType: 'Kahvaltı',
      description,
      foods: analysis.foods,
      totalNutrition: analysis.totalNutrition,
      timestamp: new Date(),
      aiAnalysis: analysis.analysis,
      suggestions: analysis.suggestions,
    }

    const savedMeal = await db.saveMealLog('user-1', draft)
    const entry = mealLogToEntry(savedMeal)
    store.getState().addMealEntry(entry)

    // Kaydedilen tarih kullanıcının yerel günüdür.
    const mealInsert = fake.queriesFor('meal_logs').find((q) => q.has('insert'))!
    expect(mealInsert.payload!.date).toBe('2026-03-15')

    // Store, DB'nin ürettiği gerçek id'yi tutar (silme bu id ile eşleşir).
    expect(store.getState().dailyProgress?.meals[0].id).toBe('db-meal-1')
    expect(store.getState().dailyProgress?.consumed).toEqual({
      calories: 260,
      protein: 18,
      carbs: 20,
      fat: 12,
    })

    // --- 7. Kalan hedef hesaplanır ------------------------------------------
    const remaining = plan.targets.calories - store.getState().dailyProgress!.consumed.calories
    expect(remaining).toBe(plan.targets.calories - 260)
    expect(remaining).toBeGreaterThan(0)

    // --- 8. Kullanıcı öğünü siler -------------------------------------------
    await db.deleteMealLog(entry.id)
    store.getState().deleteMealEntry(entry.id)

    expect(store.getState().dailyProgress?.meals).toEqual([])
    expect(store.getState().dailyProgress?.consumed.calories).toBe(0)

    const deleteQuery = fake.queriesFor('meal_logs').find((q) => q.has('delete'))!
    expect(deleteQuery.filterValue('eq', 'id')).toBe('db-meal-1')

    // --- 9. Durum diske yazıldı ---------------------------------------------
    const persisted = JSON.parse(storage.map.get('nutrition-storage')!)
    expect(persisted.state.dailyProgress.date).toBe('2026-03-15')
    expect(persisted.state.fiberTarget).toBe(plan.targets.fiber)

    // Kimlik servisi bu akışta hiçbir profil yazması yapmadı.
    expect(fake.queriesFor('user_profiles')).toHaveLength(0)
    expect(auth).toBeDefined()
  })

  it('gün içinde plandaki üç öğün girilince hedefe ulaşılır', () => {
    const user: UserPhysicalData = {
      age: 30,
      gender: 'male',
      height_cm: 180,
      current_weight_kg: 80,
      target_weight_kg: 75,
      activity_level: 'moderate',
      goal: 'lose_weight',
    }
    const plan = createFullNutritionPlan(user)

    const storage = createMemoryStorage()
    const store = createNutritionStore(storage)
    store.getState().initializeDay('2026-03-15')
    store.getState().setDailyTargets(plan.targets)

    // Kullanıcı planındaki her öğünü tam hedefinde yer.
    plan.mealPlan.meals.forEach((meal, index) => {
      store.getState().addMealEntry({
        id: `meal-${index}`,
        mealType: meal.name,
        description: `${meal.name} öğünü`,
        foods: [],
        totalNutrition: {
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
        },
        timestamp: new Date(),
      })
    })

    const consumed = store.getState().dailyProgress!.consumed
    expect(Math.abs(consumed.calories - plan.targets.calories)).toBeLessThanOrEqual(3)
    expect(Math.abs(consumed.protein - plan.targets.protein)).toBeLessThanOrEqual(3)

    // DB trigger'ı "hedefin %80'i" kuralıyla goal_met hesaplar (schema.sql).
    expect(consumed.calories).toBeGreaterThanOrEqual(plan.targets.calories * 0.8)
  })

  it('AI yanıtı bozuk gelse bile akış çökmez, kullanıcı bilgilendirilir', async () => {
    const fake = createFakeSupabase({ respond: () => ok(makeMealLogRow({ total_calories: 0 })) })
    const db = createDatabaseService(fake.client)

    const analysis = parseMealAnalysis('Üzgünüm, bu isteği yerine getiremiyorum.')
    expect(analysis.confidence).toBe(0)
    expect(analysis.foods).toEqual([])
    expect(analysis.analysis).toContain('tekrar dene')

    // Sıfır değerlerle de kayıt akışı tip güvenli çalışır.
    const saved = await db.saveMealLog('user-1', {
      id: '',
      mealType: 'Öğle',
      description: 'anlaşılmayan bir şey',
      foods: analysis.foods,
      totalNutrition: analysis.totalNutrition,
      timestamp: new Date(),
    })
    expect(mealLogToEntry(saved).totalNutrition.calories).toBe(0)
  })

  it('kullanıcı hedefini değiştirince plan yeniden hesaplanır', () => {
    const base: UserPhysicalData = {
      age: 30,
      gender: 'male',
      height_cm: 180,
      current_weight_kg: 80,
      target_weight_kg: 75,
      activity_level: 'moderate',
      goal: 'lose_weight',
    }

    const losing = createFullNutritionPlan(base)
    const building = createFullNutritionPlan({
      ...base,
      goal: 'build_muscle',
      target_weight_kg: 84,
    })

    expect(building.targets.calories).toBeGreaterThan(losing.targets.calories)
    expect(building.mealPlan.meal_count).toBe(5)
    expect(losing.mealPlan.meal_count).toBe(3)
    // Kas yapmada protein tabanı 2.0 g/kg.
    expect(building.targets.protein).toBeGreaterThanOrEqual(160)
  })

  it('geçersiz onboarding girdisi plan hesaplamasına ulaşmaz', () => {
    const invalid = validateOnboarding({
      age: '5', // min 10
      height_cm: '180',
      current_weight_kg: '80',
      target_weight_kg: '75',
    })

    expect(invalid.ok).toBe(false)
    expect(invalid.errors.age).toBeDefined()
    // Doğrulama geçilmediği için hesaplama çağrılmamalı; yine de motorun
    // saçma girdide bile güvenli davrandığını doğrulayalım.
    const target = calculateTargetCalories({
      age: 5,
      gender: 'male',
      height_cm: 180,
      current_weight_kg: 80,
      target_weight_kg: 75,
      activity_level: 'moderate',
      goal: 'lose_weight',
    })
    expect(target).toBeGreaterThanOrEqual(1500)
    expect(calculateMacros({
      age: 5,
      gender: 'male',
      height_cm: 180,
      current_weight_kg: 80,
      target_weight_kg: 75,
      activity_level: 'moderate',
      goal: 'lose_weight',
    }, target).protein).toBeGreaterThan(0)
  })
})
