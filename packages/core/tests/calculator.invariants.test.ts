// ============================================================================
// Hesaplama motoru — DEĞİŞMEZLER (invariants).
//
// Tek tek örnek testler "bilinen girdiler" için doğruluğu korur. Bu dosya ise
// TÜM olası kullanıcı kombinasyonlarını (cinsiyet × hedef × aktivite × vücut)
// tarayıp bozulmaması gereken kuralları doğrular: negatif makro yok, NaN yok,
// güvenlik tabanının altına inilmiyor, makro kalorileri hedefe eşit...
//
// Bir refaktör örnek testlerden kaçabilir; bu 400+ kombinasyondan kaçamaz.
// ============================================================================
import { describe, expect, it } from 'vitest'
import {
  NUTRITION_RULES,
  VALIDATION_RULES,
  calculateBMR,
  calculateMacros,
  calculateTDEE,
  calculateTargetCalories,
  createFullNutritionPlan,
  type UserPhysicalData,
} from '@nutrition/core'
import {
  ALL_ACTIVITY_LEVELS,
  ALL_GENDERS,
  ALL_GOALS,
} from '../../../tests/helpers/fixtures'

/** Doğrulama sınırlarının uçlarını da kapsayan vücut profilleri. */
const BODIES = [
  { label: 'genç kadın/erkek', age: 18, height_cm: 160, current_weight_kg: 50 },
  { label: 'ortalama yetişkin', age: 30, height_cm: 180, current_weight_kg: 80 },
  { label: 'orta yaş, fazla kilolu', age: 45, height_cm: 170, current_weight_kg: 95 },
  { label: 'yaşlı, hafif', age: 65, height_cm: 155, current_weight_kg: 60 },
  { label: 'uzun ve ağır', age: 25, height_cm: 200, current_weight_kg: 120 },
  {
    label: 'alt sınır (validation min)',
    age: VALIDATION_RULES.age.min,
    height_cm: VALIDATION_RULES.height_cm.min,
    current_weight_kg: VALIDATION_RULES.weight_kg.min,
  },
  {
    label: 'üst sınır (validation max)',
    age: VALIDATION_RULES.age.max,
    height_cm: VALIDATION_RULES.height_cm.max,
    current_weight_kg: VALIDATION_RULES.weight_kg.max,
  },
]

/** Hedefe uygun bir hedef kilo üretir (yön tutarsızlığı olmadan). */
function targetWeightFor(goal: UserPhysicalData['goal'], current: number): number {
  if (goal === 'maintain') return current
  if (goal === 'lose_weight') return Math.max(VALIDATION_RULES.weight_kg.min, current - 5)
  return Math.min(VALIDATION_RULES.weight_kg.max, current + 5)
}

interface Combo {
  label: string
  user: UserPhysicalData
}

const ALL_COMBINATIONS: Combo[] = BODIES.flatMap((body) =>
  ALL_GENDERS.flatMap((gender) =>
    ALL_GOALS.flatMap((goal) =>
      ALL_ACTIVITY_LEVELS.map((activity_level) => ({
        label: `${body.label} · ${gender} · ${goal} · ${activity_level}`,
        user: {
          age: body.age,
          gender,
          height_cm: body.height_cm,
          current_weight_kg: body.current_weight_kg,
          target_weight_kg: targetWeightFor(goal, body.current_weight_kg),
          activity_level,
          goal,
        } satisfies UserPhysicalData,
      }))
    )
  )
)

/** Bir nesnedeki tüm sayısal alanların sonlu olduğunu doğrular. */
function collectNumbers(value: unknown, path = '', acc: [string, number][] = []): [string, number][] {
  if (typeof value === 'number') acc.push([path, value])
  else if (Array.isArray(value)) value.forEach((v, i) => collectNumbers(v, `${path}[${i}]`, acc))
  else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) collectNumbers(v, path ? `${path}.${key}` : key, acc)
  }
  return acc
}

describe('değişmezler — tüm kullanıcı kombinasyonları', () => {
  it('anlamlı sayıda kombinasyon taranır', () => {
    expect(ALL_COMBINATIONS.length).toBe(
      BODIES.length * ALL_GENDERS.length * ALL_GOALS.length * ALL_ACTIVITY_LEVELS.length
    )
    expect(ALL_COMBINATIONS.length).toBeGreaterThan(400)
  })

  it('BMR her zaman pozitif ve sonludur', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const bmr = calculateBMR(user)
      expect(Number.isFinite(bmr), label).toBe(true)
      expect(bmr, label).toBeGreaterThan(0)
    }
  })

  it('TDEE her zaman BMR üzerindedir ve tam sayıdır', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const tdee = calculateTDEE(user)
      expect(Number.isInteger(tdee), label).toBe(true)
      expect(tdee, label).toBeGreaterThanOrEqual(calculateBMR(user))
    }
  })

  it('hedef kalori asla güvenlik tabanının altına inmez', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const target = calculateTargetCalories(user)
      expect(target, label).toBeGreaterThanOrEqual(NUTRITION_RULES.minCalories[user.gender])
    }
  })

  it('hedef kalori üst sınırı aşmaz (taban devrede değilken TDEE × 1.3)', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const target = calculateTargetCalories(user)
      const ceiling = Math.max(
        NUTRITION_RULES.minCalories[user.gender],
        Math.ceil(calculateTDEE(user) * 1.3)
      )
      expect(target, label).toBeLessThanOrEqual(ceiling)
    }
  })

  it('hedef kalori her zaman tam sayıdır', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      expect(Number.isInteger(calculateTargetCalories(user)), label).toBe(true)
    }
  })

  it('makrolar negatif olamaz ve tam sayıdır', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const macros = calculateMacros(user, calculateTargetCalories(user))
      for (const key of ['protein', 'carbs', 'fat', 'fiber'] as const) {
        const value = macros[key] ?? 0
        expect(Number.isInteger(value), `${label} · ${key}`).toBe(true)
        expect(value, `${label} · ${key}`).toBeGreaterThanOrEqual(0)
      }
      expect(macros.water_liters, label).toBeGreaterThan(0)
    }
  })

  it('protein her zaman vücut ağırlığı tabanını karşılar', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const perKg =
        user.goal === 'build_muscle'
          ? NUTRITION_RULES.minProteinPerKg.build_muscle
          : NUTRITION_RULES.minProteinPerKg.default
      const macros = calculateMacros(user, calculateTargetCalories(user))
      expect(macros.protein, label).toBeGreaterThanOrEqual(
        Math.round(user.current_weight_kg * perKg)
      )
    }
  })

  it('makroların kalori toplamı hedefe eşittir (protein tabanı taşırmadıkça)', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const target = calculateTargetCalories(user)
      const macros = calculateMacros(user, target)
      const proteinCalories = macros.protein * 4

      if (proteinCalories > target) {
        // Uç durum: protein tabanı tek başına hedefi aşıyor → karb/yağ sıfırlanır.
        expect(macros.carbs, label).toBe(0)
        expect(macros.fat, label).toBe(0)
        continue
      }

      const total = proteinCalories + macros.carbs * 4 + macros.fat * 9
      // Üç ayrı yuvarlamanın toplam sapması ±7 kcal ile sınırlıdır.
      expect(Math.abs(total - target), `${label} (toplam ${total}, hedef ${target})`)
        .toBeLessThanOrEqual(10)
    }
  })

  it('tam plan hiçbir alanda NaN/Infinity üretmez', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const plan = createFullNutritionPlan(user)
      for (const [path, value] of collectNumbers(plan)) {
        expect(Number.isFinite(value), `${label} · ${path} = ${value}`).toBe(true)
      }
    }
  })

  it('öğün planı hedeflerle tutarlıdır', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const plan = createFullNutritionPlan(user)
      expect(plan.mealPlan.meals.length, label).toBe(plan.mealPlan.meal_count)

      const total = plan.mealPlan.meals.reduce((sum, meal) => sum + meal.calories, 0)
      expect(
        Math.abs(total - plan.targets.calories),
        `${label} (öğün toplamı ${total}, hedef ${plan.targets.calories})`
      ).toBeLessThanOrEqual(plan.mealPlan.meal_count)

      for (const meal of plan.mealPlan.meals) {
        expect(meal.calories, label).toBeGreaterThanOrEqual(0)
        expect(meal.name.length, label).toBeGreaterThan(0)
      }
    }
  })

  it('önerilen süre pozitif ve sonludur', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const plan = createFullNutritionPlan(user)
      expect(Number.isInteger(plan.recommendedWeeks), label).toBe(true)
      expect(plan.recommendedWeeks, label).toBeGreaterThan(0)
      expect(plan.recommendedWeeks, label).toBeLessThan(1000)
    }
  })

  it('süre × haftalık değişim ≈ hedeflenen kilo farkı (plan kendi içinde tutarlı)', () => {
    // Bu, planın "2 haftada 5 kg" gibi imkânsız bir vaadi kullanıcıya
    // göstermesini engelleyen temel değişmez.
    for (const { label, user } of ALL_COMBINATIONS) {
      const plan = createFullNutritionPlan(user)
      const weightDiff = user.target_weight_kg - user.current_weight_kg
      if (plan.weeklyWeightChange === 0) continue

      const projected = plan.weeklyWeightChange * plan.recommendedWeeks
      if (Math.sign(projected) !== Math.sign(weightDiff)) continue // taban yönü çevirmiş

      // Yukarı yuvarlama nedeniyle en fazla bir haftalık fazla olabilir.
      expect(Math.abs(projected), label).toBeGreaterThanOrEqual(Math.abs(weightDiff) - 0.001)
      expect(Math.abs(projected) - Math.abs(weightDiff), label).toBeLessThanOrEqual(
        Math.abs(plan.weeklyWeightChange) + 0.001
      )
    }
  })

  it('haftalık değişim, kalori farkından türer (güvenlik sınırları dahil)', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const plan = createFullNutritionPlan(user)
      const expected = ((plan.targets.calories - plan.tdee) * 7) / NUTRITION_RULES.kcalPerKg
      expect(plan.weeklyWeightChange, label).toBeCloseTo(expected, 6)
    }
  })

  it('haftalık değişim güvenli hız sınırını aşmaz', () => {
    for (const { label, user } of ALL_COMBINATIONS) {
      const plan = createFullNutritionPlan(user)
      expect(Math.abs(plan.weeklyWeightChange), label).toBeLessThanOrEqual(
        NUTRITION_RULES.maxWeeklyRate + 0.001
      )
    }
  })

  it('aynı girdi her zaman aynı çıktıyı verir', () => {
    for (const { label, user } of ALL_COMBINATIONS.slice(0, 60)) {
      expect(createFullNutritionPlan(user), label).toEqual(createFullNutritionPlan(user))
    }
  })
})

describe('değişmezler — hedef yönü', () => {
  const bodies = BODIES.filter((b) => !b.label.startsWith('alt sınır'))

  it('kilo verme ≤ koruma ≤ kilo alma (aynı vücut için)', () => {
    for (const body of bodies) {
      for (const gender of ALL_GENDERS) {
        for (const activity_level of ALL_ACTIVITY_LEVELS) {
          const base = { ...body, gender, activity_level } as unknown as UserPhysicalData
          const lose = calculateTargetCalories({
            ...base,
            goal: 'lose_weight',
            target_weight_kg: body.current_weight_kg - 5,
          })
          const maintain = calculateTargetCalories({
            ...base,
            goal: 'maintain',
            target_weight_kg: body.current_weight_kg,
          })
          const gain = calculateTargetCalories({
            ...base,
            goal: 'gain_weight',
            target_weight_kg: body.current_weight_kg + 5,
          })

          const label = `${body.label} · ${gender} · ${activity_level}`
          expect(lose, label).toBeLessThanOrEqual(maintain)
          expect(maintain, label).toBeLessThanOrEqual(gain)
        }
      }
    }
  })

  it('daha kısa hedef süre, daha agresif kalori hedefi demektir', () => {
    const user: UserPhysicalData = {
      age: 30,
      gender: 'male',
      height_cm: 180,
      current_weight_kg: 90,
      target_weight_kg: 80,
      activity_level: 'moderate',
      goal: 'lose_weight',
    }
    const weeks = [52, 40, 30, 20, 15, 10]
    const calories = weeks.map((target_weeks) => calculateTargetCalories({ ...user, target_weeks }))
    for (let i = 1; i < calories.length; i++) {
      expect(calories[i], `${weeks[i]} hafta`).toBeLessThanOrEqual(calories[i - 1])
    }
  })
})

describe('değişmezler — sayısal uç durumlar', () => {
  const base: UserPhysicalData = {
    age: 30,
    gender: 'male',
    height_cm: 180,
    current_weight_kg: 80,
    target_weight_kg: 75,
    activity_level: 'moderate',
    goal: 'lose_weight',
  }

  it.each([
    ['çok büyük hedef süre', { target_weeks: 10_000 }],
    ['ondalıklı hedef süre', { target_weeks: 7.5 }],
    ['aynı kilo hedefi', { target_weight_kg: 80 }],
    ['ondalıklı kilolar', { current_weight_kg: 80.4, target_weight_kg: 75.7 }],
    ['ondalıklı boy', { height_cm: 172.5 }],
  ])('%s ile plan yine geçerlidir', (_label, patch) => {
    const plan = createFullNutritionPlan({ ...base, ...patch })
    for (const [path, value] of collectNumbers(plan)) {
      expect(Number.isFinite(value), path).toBe(true)
    }
    expect(plan.targets.calories).toBeGreaterThanOrEqual(NUTRITION_RULES.minCalories.male)
  })
})
