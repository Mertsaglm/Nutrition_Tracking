// ============================================================================
// nutrition/calculator.ts — hesaplama motoru (projenin kalbi).
//
// Buradaki bir regresyon kullanıcıya YANLIŞ KALORİ HEDEFİ verir ve bu hata
// arayüzde "çalışıyor" gibi görünür. Bu yüzden testler beklenen sayıları elle
// hesaplanmış referans değerlerle KİLİTLER (Mifflin-St Jeor + aktivite çarpanı).
//
// Referans kullanıcı: 30 yaş, erkek, 180 cm, 80 kg, orta aktif
//   BMR  = 10*80 + 6.25*180 - 5*30 + 5      = 1780
//   TDEE = 1780 * 1.55 (moderate)           = 2759
// ============================================================================
import { describe, expect, it } from 'vitest'
import {
  NUTRITION_RULES,
  calculateBMR,
  calculateMacros,
  calculateTDEE,
  calculateTargetCalories,
  createFullNutritionPlan,
  createMealPlan,
  recommendFiber,
  recommendMealCount,
  recommendTargetWeeks,
  recommendWaterLiters,
  selectMealTypes,
} from '@nutrition/core'
import { makeUser } from '../../../tests/helpers/fixtures'

describe('calculateBMR (Mifflin-St Jeor)', () => {
  it('erkek için +5 sabiti uygular', () => {
    expect(calculateBMR(makeUser({ gender: 'male' }))).toBe(1780)
  })

  it('kadın için -161 sabiti uygular', () => {
    expect(calculateBMR(makeUser({ gender: 'female' }))).toBe(1614)
  })

  it('"other" için iki değerin ortasında bir sabit (-78) uygular', () => {
    const other = calculateBMR(makeUser({ gender: 'other' }))
    expect(other).toBe(1697)
    expect(other).toBeLessThan(calculateBMR(makeUser({ gender: 'male' })))
    expect(other).toBeGreaterThan(calculateBMR(makeUser({ gender: 'female' })))
  })

  it('ondalıklı sonucu yuvarlamaz (yuvarlama üst katmanın işi)', () => {
    // 10*70 + 6.25*175 - 5*25 + 5 = 1673.75
    expect(calculateBMR(makeUser({ current_weight_kg: 70, height_cm: 175, age: 25 }))).toBe(1673.75)
  })

  it('kiloyla artar, yaşla azalır, boyla artar', () => {
    const base = calculateBMR(makeUser())
    expect(calculateBMR(makeUser({ current_weight_kg: 90 }))).toBeGreaterThan(base)
    expect(calculateBMR(makeUser({ age: 50 }))).toBeLessThan(base)
    expect(calculateBMR(makeUser({ height_cm: 190 }))).toBeGreaterThan(base)
  })

  it('hedef kilodan bağımsızdır (mevcut kiloyu kullanır)', () => {
    expect(calculateBMR(makeUser({ target_weight_kg: 60 }))).toBe(
      calculateBMR(makeUser({ target_weight_kg: 100 }))
    )
  })
})

describe('calculateTDEE', () => {
  it.each([
    ['sedentary', 1.2, 2136],
    ['light', 1.375, 2448],
    ['moderate', 1.55, 2759],
    ['active', 1.725, 3071],
    ['very_active', 1.9, 3382],
  ] as const)('%s çarpanı %s → %i kcal', (level, _multiplier, expected) => {
    expect(calculateTDEE(makeUser({ activity_level: level }))).toBe(expected)
  })

  it('aktivite arttıkça monoton artar', () => {
    const values = (['sedentary', 'light', 'moderate', 'active', 'very_active'] as const).map(
      (level) => calculateTDEE(makeUser({ activity_level: level }))
    )
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(new Set(values).size).toBe(values.length)
  })

  it('tam sayı döner', () => {
    expect(Number.isInteger(calculateTDEE(makeUser({ height_cm: 175, age: 25 })))).toBe(true)
  })
})

describe('calculateTargetCalories', () => {
  it('kilo verme hedefinde günlük 550 kcal açık verir', () => {
    // 0.5 kg/hafta × 7700 kcal/kg ÷ 7 gün = 550 kcal/gün
    expect(calculateTargetCalories(makeUser({ goal: 'lose_weight' }))).toBe(2759 - 550)
  })

  it('kilo alma hedefinde günlük 550 kcal fazla verir', () => {
    const user = makeUser({ goal: 'gain_weight', current_weight_kg: 80, target_weight_kg: 85 })
    expect(calculateTargetCalories(user)).toBe(2759 + 550)
  })

  it('kas yapma hedefinde daha ölçülü bir fazla verir (0.3 kg/hafta)', () => {
    const user = makeUser({ goal: 'build_muscle', target_weight_kg: 84 })
    expect(calculateTargetCalories(user)).toBe(2759 + 330)
  })

  it('koruma hedefinde TDEE ile aynıdır', () => {
    const user = makeUser({ goal: 'maintain', target_weight_kg: 80 })
    expect(calculateTargetCalories(user)).toBe(2759)
  })

  it('tam sayı döner', () => {
    expect(Number.isInteger(calculateTargetCalories(makeUser({ height_cm: 175 })))).toBe(true)
  })

  describe('güvenlik sınırları', () => {
    it('cinsiyete göre minimum kalorinin altına inmez', () => {
      // Küçük yapılı, hareketsiz kadın: açık sonrası 809 kcal çıkardı.
      const user = makeUser({
        gender: 'female',
        age: 25,
        height_cm: 155,
        current_weight_kg: 45,
        target_weight_kg: 40,
        activity_level: 'sedentary',
        goal: 'lose_weight',
      })
      expect(calculateTargetCalories(user)).toBe(NUTRITION_RULES.minCalories.female)
    })

    it('erkekler için minimum taban daha yüksektir', () => {
      const user = makeUser({
        gender: 'male',
        age: 25,
        height_cm: 160,
        current_weight_kg: 45,
        target_weight_kg: 40,
        activity_level: 'sedentary',
        goal: 'lose_weight',
      })
      expect(calculateTargetCalories(user)).toBe(NUTRITION_RULES.minCalories.male)
    })

    it('TDEE × 1.3 üst sınırını aşmaz', () => {
      // 1 haftada 10 kg alma isteği → hız 1.0 kg/hafta'ya kırpılır (+1100 kcal),
      // ama toplam yine de TDEE × 1.3 ile sınırlanır.
      const user = makeUser({
        goal: 'gain_weight',
        height_cm: 175,
        current_weight_kg: 60,
        target_weight_kg: 70,
        activity_level: 'sedentary',
        target_weeks: 1,
      })
      const tdee = calculateTDEE(user)
      expect(calculateTargetCalories(user)).toBe(Math.round(tdee * 1.3))
    })
  })

  describe('hedef yönü tutarsızlığının düzeltilmesi', () => {
    it('"kilo ver" seçilip hedef kilo daha yüksekse fazla verir', () => {
      // Kullanıcı hedefi yanlış seçmiş olabilir; kilo hedefi belirleyicidir.
      const user = makeUser({ goal: 'lose_weight', current_weight_kg: 70, target_weight_kg: 80 })
      expect(calculateTargetCalories(user)).toBeGreaterThan(calculateTDEE(user))
    })

    it('"kilo al" seçilip hedef kilo daha düşükse açık verir', () => {
      const user = makeUser({ goal: 'gain_weight', current_weight_kg: 90, target_weight_kg: 80 })
      expect(calculateTargetCalories(user)).toBeLessThan(calculateTDEE(user))
    })
  })

  describe('kullanıcının verdiği hedef süre (target_weeks)', () => {
    it('gereken haftalık hızı süreden türetir', () => {
      // 5 kg / 50 hafta = 0.1 kg/hafta → günlük 110 kcal açık
      const user = makeUser({ goal: 'lose_weight', target_weeks: 50 })
      expect(calculateTargetCalories(user)).toBe(2759 - 110)
    })

    it('sağlıklı hızla aynıysa varsayılanla aynı sonucu verir', () => {
      // 5 kg / 10 hafta = 0.5 kg/hafta (varsayılan sağlıklı hız)
      expect(calculateTargetCalories(makeUser({ target_weeks: 10 }))).toBe(
        calculateTargetCalories(makeUser())
      )
    })

    it('aşırı hızlı hedefi maksimum hıza kırpar (1 kg/hafta)', () => {
      const aggressive = calculateTargetCalories(makeUser({ target_weeks: 1 }))
      const clipped = calculateTargetCalories(makeUser({ target_weeks: 5 }))
      // 5 kg / 5 hafta = 1.0 kg/hafta → tam sınırda; 1 hafta ise kırpılır.
      expect(aggressive).toBe(clipped)
      expect(clipped).toBe(2759 - 1100)
    })

    it('koruma hedefinde yok sayılır', () => {
      const user = makeUser({ goal: 'maintain', target_weeks: 2 })
      expect(calculateTargetCalories(user)).toBe(calculateTDEE(user))
    })

    it('kilo farkı sıfırsa yok sayılır (0/n = 0 tuzağı)', () => {
      // Aksi halde hız 0 olur ve "kilo ver" hedefi sessizce korumaya döner.
      const user = makeUser({ current_weight_kg: 80, target_weight_kg: 80, target_weeks: 10 })
      expect(calculateTargetCalories(user)).toBe(2759 - 550)
    })

    it('0 veya negatif süre yok sayılır', () => {
      expect(calculateTargetCalories(makeUser({ target_weeks: 0 }))).toBe(
        calculateTargetCalories(makeUser())
      )
      expect(calculateTargetCalories(makeUser({ target_weeks: -5 }))).toBe(
        calculateTargetCalories(makeUser())
      )
    })
  })
})

describe('recommendFiber', () => {
  it('1000 kcal başına 14 g önerir', () => {
    expect(recommendFiber(1000)).toBe(14)
    expect(recommendFiber(2000)).toBe(28)
    expect(recommendFiber(2209)).toBe(31)
  })

  it('tam sayı döner ve 0 kcal için 0 verir', () => {
    expect(recommendFiber(0)).toBe(0)
    expect(Number.isInteger(recommendFiber(2345))).toBe(true)
  })
})

describe('recommendWaterLiters', () => {
  it('kilogram başına 35 ml önerir', () => {
    expect(recommendWaterLiters(80)).toBe(2.8)
    expect(recommendWaterLiters(60)).toBe(2.1)
    expect(recommendWaterLiters(100)).toBe(3.5)
  })

  it('bir ondalık basamağa yuvarlar', () => {
    expect(recommendWaterLiters(72.5)).toBe(2.5)
    expect(String(recommendWaterLiters(83))).toMatch(/^\d+(\.\d)?$/)
  })
})

describe('calculateMacros', () => {
  it('kilo verme hedefinde oran bazlı dağıtır (35/35/30)', () => {
    const macros = calculateMacros(makeUser({ goal: 'lose_weight' }), 2209)
    expect(macros).toEqual({
      calories: 2209,
      protein: 193,
      carbs: 193,
      fat: 74,
      fiber: 31,
      water_liters: 2.8,
    })
  })

  it('makroların kalori toplamı hedefe eşittir', () => {
    const macros = calculateMacros(makeUser(), 2209)
    const total = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9
    expect(total).toBeCloseTo(2209, -1)
  })

  it('hedef kaloriyi olduğu gibi taşır', () => {
    expect(calculateMacros(makeUser(), 1873).calories).toBe(1873)
  })

  it('lif ve su hedeflerini de içerir', () => {
    const macros = calculateMacros(makeUser({ current_weight_kg: 60 }), 2000)
    expect(macros.fiber).toBe(28)
    expect(macros.water_liters).toBe(2.1)
  })

  describe('minimum protein tabanı', () => {
    it('oran bazlı protein düşük kalırsa vücut ağırlığı tabanı devreye girer', () => {
      // 100 kg × 1.6 = 160 g taban; 1600 kcal'de oran bazlı protein 100 g olurdu.
      const macros = calculateMacros(
        makeUser({ goal: 'maintain', current_weight_kg: 100 }),
        1600
      )
      expect(macros.protein).toBe(160)
    })

    it('kas yapma hedefinde taban 2.0 g/kg olur', () => {
      const macros = calculateMacros(
        makeUser({ goal: 'build_muscle', current_weight_kg: 100 }),
        2400
      )
      expect(macros.protein).toBe(200)
    })

    it('taban devreye girdiğinde toplam kalori hedefi AŞMAZ', () => {
      // Regresyon: eskiden protein tabanı eklenip karb/yağ oranı sabit kalınca
      // toplam kalori hedefin üstüne çıkıyordu.
      const macros = calculateMacros(
        makeUser({ goal: 'build_muscle', current_weight_kg: 100 }),
        2400
      )
      const total = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9
      expect(total).toBeLessThanOrEqual(2400 + 10)
      expect(total).toBeGreaterThanOrEqual(2400 - 10)
    })

    it('taban devrede değilken oran bazlı sonuç değişmez', () => {
      // Hafif kullanıcı + yüksek kalori: taban asla devreye girmez.
      const light = makeUser({ goal: 'lose_weight', current_weight_kg: 50 })
      const macros = calculateMacros(light, 2600)
      expect(macros.protein).toBe(Math.round((2600 * 0.35) / 4))
    })
  })

  describe('hedefe göre makro oranları', () => {
    it.each([
      ['lose_weight', 0.35],
      ['gain_weight', 0.25],
      ['build_muscle', 0.3],
      ['maintain', 0.25],
    ] as const)('%s → protein oranı %s', (goal, ratio) => {
      // Taban devreye girmesin diye hafif bir kullanıcı seçilir.
      const macros = calculateMacros(makeUser({ goal, current_weight_kg: 50 }), 2600)
      expect(macros.protein).toBe(Math.round((2600 * ratio) / 4))
    })

    it('kilo verme hedefi en yüksek protein oranını kullanır', () => {
      const user = (goal: 'lose_weight' | 'gain_weight' | 'maintain') =>
        calculateMacros(makeUser({ goal, current_weight_kg: 50 }), 2600).protein
      expect(user('lose_weight')).toBeGreaterThan(user('gain_weight'))
      expect(user('lose_weight')).toBeGreaterThan(user('maintain'))
    })
  })

  describe('uç durumlar', () => {
    it('protein tek başına hedefi aşsa bile karb/yağ negatife düşmez', () => {
      // 300 kg × 1.6 = 480 g protein = 1920 kcal > 1500 kcal hedef.
      const macros = calculateMacros(
        makeUser({ goal: 'maintain', current_weight_kg: 300 }),
        1500
      )
      expect(macros.carbs).toBe(0)
      expect(macros.fat).toBe(0)
      expect(macros.protein).toBeGreaterThan(0)
    })

    it('sıfır kalori hedefinde tüm makrolar sıfırdır', () => {
      const macros = calculateMacros(makeUser({ current_weight_kg: 0 }), 0)
      expect(macros).toMatchObject({ calories: 0, protein: 0, carbs: 0, fat: 0 })
    })

    it('tüm makrolar tam sayıdır', () => {
      const macros = calculateMacros(makeUser(), 2137)
      expect(Number.isInteger(macros.protein)).toBe(true)
      expect(Number.isInteger(macros.carbs)).toBe(true)
      expect(Number.isInteger(macros.fat)).toBe(true)
      expect(Number.isInteger(macros.fiber)).toBe(true)
    })
  })
})

describe('createMealPlan', () => {
  const targets = { calories: 2000, protein: 150, carbs: 200, fat: 70 }

  it('3 öğünde kahvaltı/öğle/akşamı seçer', () => {
    const plan = createMealPlan(3, targets, 'maintain')
    expect(plan.meal_count).toBe(3)
    expect(plan.meals.map((m) => m.name)).toEqual(['Kahvaltı', 'Öğle', 'Akşam'])
    expect(plan.meals.map((m) => m.time)).toEqual(['08:00', '13:00', '19:00'])
  })

  it('4 öğünde ikindiyi ekler', () => {
    const plan = createMealPlan(4, targets, 'maintain')
    expect(plan.meals.map((m) => m.name)).toEqual(['Kahvaltı', 'Öğle', 'İkindi', 'Akşam'])
  })

  it('5 öğünde kuşluğu ekler', () => {
    const plan = createMealPlan(5, targets, 'maintain')
    expect(plan.meals.map((m) => m.name)).toEqual([
      'Kahvaltı',
      'Kuşluk',
      'Öğle',
      'İkindi',
      'Akşam',
    ])
  })

  it('6 öğünde gece öğününü de ekler', () => {
    const plan = createMealPlan(6, targets, 'maintain')
    expect(plan.meals.map((m) => m.name)).toEqual([
      'Kahvaltı',
      'Kuşluk',
      'Öğle',
      'İkindi',
      'Akşam',
      'Gece',
    ])
  })

  it.each([3, 4, 5, 6])('%i öğünde kalori toplamı hedefe eşittir', (count) => {
    const plan = createMealPlan(count, targets, 'maintain')
    const total = plan.meals.reduce((sum, meal) => sum + meal.calories, 0)
    expect(Math.abs(total - targets.calories)).toBeLessThanOrEqual(count)
  })

  it.each([3, 4, 5, 6])('%i öğünde makro toplamları da hedefe eşittir', (count) => {
    const plan = createMealPlan(count, targets, 'maintain')
    for (const macro of ['protein', 'carbs', 'fat'] as const) {
      const total = plan.meals.reduce((sum, meal) => sum + meal[macro], 0)
      expect(Math.abs(total - targets[macro])).toBeLessThanOrEqual(count)
    }
  })

  it('kilo verme hedefinde 3 öğün dağılımı farklıdır (kahvaltı ağırlıklı)', () => {
    const lose = createMealPlan(3, targets, 'lose_weight')
    const maintain = createMealPlan(3, targets, 'maintain')
    expect(lose.meals[0].calories).toBeGreaterThan(maintain.meals[0].calories)
  })

  it('kas yapma hedefinde 5 öğün dağılımı farklıdır', () => {
    const muscle = createMealPlan(5, targets, 'build_muscle')
    const maintain = createMealPlan(5, targets, 'maintain')
    expect(muscle.meals.map((m) => m.calories)).not.toEqual(
      maintain.meals.map((m) => m.calories)
    )
  })

  it.each([0, 1, 2, 7, 10, -3, 3.5, Number.NaN])(
    'geçersiz öğün sayısında (%s) 3 öğüne düşer',
    (count) => {
      const plan = createMealPlan(count, targets, 'maintain')
      expect(plan.meal_count).toBe(3)
      expect(plan.meals).toHaveLength(3)
    }
  )

  it('her öğünde ad, saat ve dört makro bulunur', () => {
    for (const meal of createMealPlan(6, targets, 'maintain').meals) {
      expect(Object.keys(meal).sort()).toEqual([
        'calories',
        'carbs',
        'fat',
        'name',
        'protein',
        'time',
      ])
      expect(meal.time).toMatch(/^\d{2}:\d{2}$/)
    }
  })

  it('öğün saatleri kronolojik sıradadır', () => {
    const times = createMealPlan(6, targets, 'maintain').meals.map((m) => m.time)
    expect(times).toEqual([...times].sort())
  })

  it('tüm değerler negatif olmayan tam sayıdır', () => {
    for (const meal of createMealPlan(5, targets, 'build_muscle').meals) {
      for (const value of [meal.calories, meal.protein, meal.carbs, meal.fat]) {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('selectMealTypes', () => {
  it.each([
    [3, ['Kahvaltı', 'Öğle', 'Akşam']],
    [4, ['Kahvaltı', 'Öğle', 'İkindi', 'Akşam']],
    [5, ['Kahvaltı', 'Kuşluk', 'Öğle', 'İkindi', 'Akşam']],
    [6, ['Kahvaltı', 'Kuşluk', 'Öğle', 'İkindi', 'Akşam', 'Gece']],
  ] as const)('%i öğün → %j', (count, expected) => {
    expect(selectMealTypes(count).map((meal) => meal.name)).toEqual(expected)
  })

  it('öğün planıyla BİREBİR aynı listeyi verir', () => {
    // Arayüzdeki öğün seçici ve mobil bildirimler bu fonksiyonu kullanır;
    // plandan ayrışırsa kullanıcı planında olmayan bir öğün seçebilir.
    const targets = { calories: 2000, protein: 150, carbs: 200, fat: 70 }
    for (const count of [3, 4, 5, 6]) {
      expect(selectMealTypes(count).map((meal) => meal.name)).toEqual(
        createMealPlan(count, targets, 'maintain').meals.map((meal) => meal.name)
      )
    }
  })

  it('saat bilgisini de taşır', () => {
    expect(selectMealTypes(3).map((meal) => meal.time)).toEqual(['08:00', '13:00', '19:00'])
  })

  it('öğün oranını taşır (arayüz öğün hedefini bununla hesaplar)', () => {
    for (const meal of selectMealTypes(6)) {
      expect(meal.targetRatio).toBeGreaterThan(0)
      expect(meal.targetRatio).toBeLessThan(1)
    }
  })

  it.each([0, 1, 2, 7, -3, Number.NaN])('geçersiz sayıda (%s) 3 öğüne düşer', (count) => {
    expect(selectMealTypes(count)).toHaveLength(3)
  })

  it('hedeften bağımsızdır (yalnızca oranlar hedefe göre değişir)', () => {
    const targets = { calories: 2000, protein: 150, carbs: 200, fat: 70 }
    expect(createMealPlan(3, targets, 'lose_weight').meals.map((m) => m.name)).toEqual(
      selectMealTypes(3).map((m) => m.name)
    )
  })
})

describe('recommendMealCount', () => {
  it.each([
    ['lose_weight', 3],
    ['maintain', 4],
    ['gain_weight', 5],
    ['build_muscle', 5],
  ] as const)('%s → %i öğün', (goal, expected) => {
    expect(recommendMealCount(goal)).toBe(expected)
  })

  it('önerilen değerler DB kısıtı (3-6) içindedir', () => {
    for (const goal of ['lose_weight', 'gain_weight', 'build_muscle', 'maintain'] as const) {
      const count = recommendMealCount(goal)
      expect(count).toBeGreaterThanOrEqual(3)
      expect(count).toBeLessThanOrEqual(6)
    }
  })
})

describe('recommendTargetWeeks', () => {
  it('haftada 0.5 kg baz alır', () => {
    expect(recommendTargetWeeks(makeUser({ current_weight_kg: 80, target_weight_kg: 75 }))).toBe(10)
  })

  it('yukarı yuvarlar', () => {
    expect(recommendTargetWeeks(makeUser({ current_weight_kg: 80, target_weight_kg: 77.4 }))).toBe(6)
  })

  it('kilo alma yönünde de aynı çalışır (mutlak fark)', () => {
    expect(recommendTargetWeeks(makeUser({ current_weight_kg: 75, target_weight_kg: 80 }))).toBe(10)
  })

  it('en az 4 hafta önerir', () => {
    expect(recommendTargetWeeks(makeUser({ current_weight_kg: 80, target_weight_kg: 79.5 }))).toBe(4)
    expect(recommendTargetWeeks(makeUser({ current_weight_kg: 80, target_weight_kg: 80 }))).toBe(4)
  })

  it('en fazla 52 hafta önerir', () => {
    expect(recommendTargetWeeks(makeUser({ current_weight_kg: 150, target_weight_kg: 60 }))).toBe(52)
  })

  it('her zaman tam sayı döner', () => {
    expect(
      Number.isInteger(recommendTargetWeeks(makeUser({ target_weight_kg: 73.3 })))
    ).toBe(true)
  })
})

describe('createFullNutritionPlan', () => {
  it('tüm hesaplamaları tutarlı biçimde birleştirir', () => {
    const plan = createFullNutritionPlan(makeUser())
    expect(plan).toMatchObject({
      bmr: 1780,
      tdee: 2759,
      recommendedWeeks: 10,
      weeklyWeightChange: -0.5,
    })
    expect(plan.targets.calories).toBe(2209)
    expect(plan.mealPlan.meal_count).toBe(3)
  })

  it('BMR alanını yuvarlar', () => {
    const plan = createFullNutritionPlan(makeUser({ height_cm: 175, age: 25 }))
    expect(Number.isInteger(plan.bmr)).toBe(true)
    expect(plan.bmr).toBe(1774) // 10*80 + 6.25*175 - 5*25 + 5 = 1773.75 → 1774
  })

  it('öğün sayısı verilmezse hedefe göre önerileni kullanır', () => {
    expect(createFullNutritionPlan(makeUser({ goal: 'build_muscle' })).mealPlan.meal_count).toBe(5)
    expect(createFullNutritionPlan(makeUser({ goal: 'maintain' })).mealPlan.meal_count).toBe(4)
  })

  it('öğün sayısı verildiyse ona uyar', () => {
    expect(createFullNutritionPlan(makeUser(), 6).mealPlan.meal_count).toBe(6)
  })

  it('kullanıcının hedef süresi varsa onu gösterir', () => {
    const plan = createFullNutritionPlan(makeUser({ target_weeks: 20 }))
    expect(plan.recommendedWeeks).toBe(20)
    expect(plan.weeklyWeightChange).toBeCloseTo(-0.25, 5)
  })

  it('hedef süre yoksa sağlıklı bir süre önerir', () => {
    expect(createFullNutritionPlan(makeUser()).recommendedWeeks).toBe(10)
  })

  it('koruma hedefinde haftalık değişim sıfırdır', () => {
    const plan = createFullNutritionPlan(
      makeUser({ goal: 'maintain', current_weight_kg: 80, target_weight_kg: 80 })
    )
    expect(plan.weeklyWeightChange).toBe(0)
  })

  it('kilo alma hedefinde haftalık değişim pozitiftir', () => {
    const plan = createFullNutritionPlan(
      makeUser({ goal: 'gain_weight', current_weight_kg: 70, target_weight_kg: 80 })
    )
    expect(plan.weeklyWeightChange).toBeGreaterThan(0)
  })

  describe('güvenlik sınırının süreye yansıması', () => {
    // Kullanıcı "2 haftada 5 kg" isterse kalori hedefi 1 kg/hafta'ya kırpılır.
    // Plan bu gerçeği saklamaz: haftalık değişim ve süre, kırpılmış hıza göre
    // bildirilir; `paceLimited` ile de arayüz kullanıcıyı uyarabilir.
    const aggressive = makeUser({
      goal: 'lose_weight',
      current_weight_kg: 80,
      target_weight_kg: 75,
      target_weeks: 2,
    })

    it('haftalık değişim, planın FİİLEN sağladığı hızdır', () => {
      const plan = createFullNutritionPlan(aggressive)
      expect(plan.targets.calories).toBe(2759 - 1100) // hız 1.0 kg/hafta'ya kırpıldı
      expect(plan.weeklyWeightChange).toBeCloseTo(-1, 6)
    })

    it('süre, o hızla hedefe ulaşmak için gereken gerçek süredir', () => {
      // 5 kg ÷ 1 kg/hafta = 5 hafta (kullanıcı 2 hafta istemişti).
      expect(createFullNutritionPlan(aggressive).recommendedWeeks).toBe(5)
    })

    it('kırpma yapıldığında paceLimited true olur', () => {
      expect(createFullNutritionPlan(aggressive).paceLimited).toBe(true)
    })

    it('istek güvenli sınırlar içindeyse paceLimited false kalır', () => {
      expect(createFullNutritionPlan(makeUser({ target_weeks: 20 })).paceLimited).toBe(false)
      expect(createFullNutritionPlan(makeUser()).paceLimited).toBe(false)
    })

    it('minimum kalori tabanı devreye girdiğinde de süre gerçekçi olur', () => {
      // Küçük yapılı kadın: açık, 1200 kcal tabanı yüzünden küçülür → süre uzar.
      const user = makeUser({
        gender: 'female',
        age: 25,
        height_cm: 155,
        current_weight_kg: 45,
        target_weight_kg: 40,
        activity_level: 'sedentary',
        goal: 'lose_weight',
        target_weeks: 10,
      })
      const plan = createFullNutritionPlan(user)

      expect(plan.targets.calories).toBe(1200)
      expect(Math.abs(plan.weeklyWeightChange)).toBeLessThan(0.5)
      expect(plan.recommendedWeeks).toBeGreaterThan(10)
      expect(plan.paceLimited).toBe(true)
    })
  })

  it('süre × haftalık değişim, hedeflenen kilo farkını karşılar', () => {
    const plan = createFullNutritionPlan(makeUser())
    expect(plan.recommendedWeeks * plan.weeklyWeightChange).toBeCloseTo(-5, 6)
  })

  it('öğün planı, hesaplanan hedeflerden türetilir', () => {
    const plan = createFullNutritionPlan(makeUser(), 3)
    const total = plan.mealPlan.meals.reduce((sum, meal) => sum + meal.calories, 0)
    expect(Math.abs(total - plan.targets.calories)).toBeLessThanOrEqual(3)
  })

  it('aynı girdi için her zaman aynı sonucu üretir (saf fonksiyon)', () => {
    const user = makeUser({ goal: 'build_muscle', target_weeks: 12 })
    expect(createFullNutritionPlan(user)).toEqual(createFullNutritionPlan(user))
  })

  it('girdi nesnesini değiştirmez', () => {
    const user = makeUser()
    const snapshot = { ...user }
    createFullNutritionPlan(user)
    expect(user).toEqual(snapshot)
  })
})
