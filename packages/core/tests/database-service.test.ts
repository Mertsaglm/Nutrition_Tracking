// ============================================================================
// services/database-service.ts — Supabase okuma/yazma katmanı.
//
// Testler yalnızca dönen veriyi değil, ÜRETİLEN SORGUYU da doğrular: tablo adı,
// kolon adları, filtreler, sıralama, limit. Çünkü bu katmandaki bir yazım hatası
// (ör. `total_protein` yerine `total_protein_g`) tip hatası vermez; sadece veri
// sessizce kaybolur. Şema ile hizalama için: supabase/schema.sql
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabaseService, mealLogToEntry } from '@nutrition/core'
import {
  NO_ROWS,
  type QueryResult,
  type RecordedQuery,
  createFakeSupabase,
  fail,
  ok,
} from '../../../tests/helpers/fake-supabase'
import { makeMealEntry, makeMealLogRow } from '../../../tests/helpers/fixtures'

function setup(respond?: (query: RecordedQuery) => QueryResult | undefined) {
  const fake = createFakeSupabase({ respond })
  return { fake, service: createDatabaseService(fake.client) }
}

describe('mealLogToEntry', () => {
  it('DB satırını arayüz modeline çevirir', () => {
    const entry = mealLogToEntry(makeMealLogRow())

    expect(entry).toMatchObject({
      id: '11111111-2222-3333-4444-555555555555',
      mealType: 'Öğle',
      description: '150g tavuk göğsü ve pilav',
      totalNutrition: { calories: 500, protein: 30, carbs: 50, fat: 20 },
      aiAnalysis: 'Dengeli bir öğün.',
      suggestions: 'Yanına salata ekle.',
    })
    expect(entry.timestamp).toBeInstanceOf(Date)
  })

  it('DB’nin ürettiği id’yi kullanır (istemci id üretmez)', () => {
    // Regresyon: eskiden Date.now() ile id üretiliyordu ve silme işlemi DB’deki
    // kayıtla eşleşmiyordu.
    const entry = mealLogToEntry(makeMealLogRow({ id: 'db-uuid' }))
    expect(entry.id).toBe('db-uuid')
  })

  it('null makroları sıfıra çevirir', () => {
    const entry = mealLogToEntry(
      makeMealLogRow({ total_protein_g: null, total_carbs_g: null, total_fat_g: null })
    )
    expect(entry.totalNutrition).toEqual({ calories: 500, protein: 0, carbs: 0, fat: 0 })
  })

  it('null açıklama ve besin listesini güvenli varsayılana çevirir', () => {
    const entry = mealLogToEntry(makeMealLogRow({ description: null as never, food_items: null }))
    expect(entry.description).toBe('')
    expect(entry.foods).toEqual([])
  })

  it('null AI alanlarını undefined yapar (opsiyonel alan sözleşmesi)', () => {
    const entry = mealLogToEntry(makeMealLogRow({ ai_analysis: null, ai_suggestions: null }))
    expect(entry.aiAnalysis).toBeUndefined()
    expect(entry.suggestions).toBeUndefined()
  })

  it('created_at metnini Date’e çevirir', () => {
    const entry = mealLogToEntry(makeMealLogRow({ created_at: '2026-03-15T09:30:00.000Z' }))
    expect(entry.timestamp.toISOString()).toBe('2026-03-15T09:30:00.000Z')
  })
})

describe('saveMealLog', () => {
  it('meal_logs tablosuna beklenen kolonlarla yazar', async () => {
    const row = makeMealLogRow()
    const { fake, service } = setup(() => ok(row))

    const result = await service.saveMealLog('user-1', makeMealEntry())

    const query = fake.onlyQuery()
    expect(query.table).toBe('meal_logs')
    expect(query.methods).toEqual(['insert', 'select', 'single'])
    expect(Object.keys(query.payload!).sort()).toEqual([
      'ai_analysis',
      'ai_suggestions',
      'confidence_score',
      'date',
      'description',
      'food_items',
      'meal_type',
      'total_calories',
      'total_carbs_g',
      'total_fat_g',
      'total_protein_g',
      'user_id',
    ])
    expect(result).toBe(row)
  })

  it('makroları doğru kolonlara yerleştirir', async () => {
    const { fake, service } = setup(() => ok(makeMealLogRow()))
    await service.saveMealLog(
      'user-1',
      makeMealEntry({ totalNutrition: { calories: 640, protein: 48, carbs: 55, fat: 18 } })
    )

    expect(fake.onlyQuery().payload).toMatchObject({
      user_id: 'user-1',
      total_calories: 640,
      total_protein_g: 48,
      total_carbs_g: 55,
      total_fat_g: 18,
    })
  })

  it('tarihi öğünün YEREL gününden türetir (UTC değil)', async () => {
    // 15 Mart 22:30 UTC = 16 Mart 01:30 (UTC+3) → kullanıcı için 16 Mart.
    const { fake, service } = setup(() => ok(makeMealLogRow()))
    await service.saveMealLog(
      'user-1',
      makeMealEntry({ timestamp: new Date('2026-03-15T22:30:00Z') })
    )

    expect(fake.onlyQuery().payload!.date).toBe('2026-03-16')
  })

  it('AI alanları yoksa null yazar (undefined DB’ye gitmez)', async () => {
    const { fake, service } = setup(() => ok(makeMealLogRow()))
    await service.saveMealLog(
      'user-1',
      makeMealEntry({ aiAnalysis: undefined, suggestions: undefined })
    )

    const payload = fake.onlyQuery().payload!
    expect(payload.ai_analysis).toBeNull()
    expect(payload.ai_suggestions).toBeNull()
    expect(payload.confidence_score).toBeNull()
  })

  it('istemci id göndermez (DB gen_random_uuid üretir)', async () => {
    const { fake, service } = setup(() => ok(makeMealLogRow()))
    await service.saveMealLog('user-1', makeMealEntry({ id: 'istemci-id' }))
    expect(fake.onlyQuery().payload).not.toHaveProperty('id')
  })

  it('hata durumunda fırlatır', async () => {
    const { service } = setup(() => fail('permission denied'))
    await expect(service.saveMealLog('user-1', makeMealEntry())).rejects.toMatchObject({
      message: 'permission denied',
    })
  })
})

describe('getMealLogs', () => {
  it('kullanıcı ve tarihe göre filtreler, yeniden eskiye sıralar', async () => {
    const rows = [makeMealLogRow()]
    const { fake, service } = setup(() => ok(rows))

    const result = await service.getMealLogs('user-1', '2026-03-15')

    const query = fake.onlyQuery()
    expect(query.table).toBe('meal_logs')
    expect(query.argsOf('select')).toEqual(['*'])
    expect(query.filterValue('eq', 'user_id')).toBe('user-1')
    expect(query.filterValue('eq', 'date')).toBe('2026-03-15')
    expect(query.argsOf('order')).toEqual(['created_at', { ascending: false }])
    expect(result).toBe(rows)
  })

  it('veri yoksa boş dizi döner', async () => {
    const { service } = setup(() => ok(null))
    await expect(service.getMealLogs('user-1', '2026-03-15')).resolves.toEqual([])
  })

  it('hata durumunda fırlatır', async () => {
    const { service } = setup(() => fail('bağlantı hatası'))
    await expect(service.getMealLogs('user-1', '2026-03-15')).rejects.toBeTruthy()
  })
})

describe('getRecentMeals', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('BUGÜNDEN önceki öğünleri getirir', async () => {
    const { fake, service } = setup(() => ok([]))
    await service.getRecentMeals('user-1')

    const query = fake.onlyQuery()
    expect(query.filterValue('lt', 'date')).toBe('2026-03-15')
    expect(query.filterValue('eq', 'user_id')).toBe('user-1')
  })

  it('aynı açıklamalı öğünleri teke indirir', async () => {
    const rows = [
      makeMealLogRow({ id: '1', description: 'yulaf ezmesi' }),
      makeMealLogRow({ id: '2', description: 'yulaf ezmesi' }),
      makeMealLogRow({ id: '3', description: 'mercimek çorbası' }),
      makeMealLogRow({ id: '4', description: 'yulaf ezmesi' }),
    ]
    const { service } = setup(() => ok(rows))

    const result = await service.getRecentMeals('user-1')
    expect(result.map((r) => r.id)).toEqual(['1', '3'])
  })

  it('limit kadar benzersiz öğün döner', async () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeMealLogRow({ id: String(i), description: `öğün ${i}` })
    )
    const { service } = setup(() => ok(rows))

    await expect(service.getRecentMeals('user-1', 3)).resolves.toHaveLength(3)
  })

  it('tekilleştirme payı bırakmak için limitin katını sorgular', async () => {
    const { fake, service } = setup(() => ok([]))
    await service.getRecentMeals('user-1', 5)
    expect(fake.onlyQuery().argsOf('limit')).toEqual([20])
  })

  it('varsayılan limit 5’tir', async () => {
    const { fake, service } = setup(() => ok([]))
    await service.getRecentMeals('user-1')
    expect(fake.onlyQuery().argsOf('limit')).toEqual([20])
  })

  it('veri yoksa boş dizi döner', async () => {
    const { service } = setup(() => ok(null))
    await expect(service.getRecentMeals('user-1')).resolves.toEqual([])
  })

  it('hata durumunda fırlatır', async () => {
    const { service } = setup(() => fail('hata'))
    await expect(service.getRecentMeals('user-1')).rejects.toBeTruthy()
  })
})

describe('getCurrentStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0)) // 15 Mart 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('yalnızca hedefi tutturulan günleri sorgular', async () => {
    const { fake, service } = setup(() => ok([]))
    await service.getCurrentStreak('user-1')

    const query = fake.onlyQuery()
    expect(query.table).toBe('daily_progress')
    expect(query.filterValue('eq', 'goal_met')).toBe(true)
    expect(query.argsOf('order')).toEqual(['date', { ascending: false }])
  })

  it('bugünden geriye kesintisiz günleri sayar', async () => {
    const { service } = setup(() =>
      ok([
        { date: '2026-03-15', goal_met: true },
        { date: '2026-03-14', goal_met: true },
        { date: '2026-03-13', goal_met: true },
      ])
    )
    await expect(service.getCurrentStreak('user-1')).resolves.toBe(3)
  })

  it('boşluk görünce sayımı durdurur', async () => {
    const { service } = setup(() =>
      ok([
        { date: '2026-03-15', goal_met: true },
        { date: '2026-03-13', goal_met: true }, // 14 Mart eksik
        { date: '2026-03-12', goal_met: true },
      ])
    )
    await expect(service.getCurrentStreak('user-1')).resolves.toBe(1)
  })

  it('bugün tutturulmadıysa seri 0’dır', async () => {
    const { service } = setup(() =>
      ok([
        { date: '2026-03-14', goal_met: true },
        { date: '2026-03-13', goal_met: true },
      ])
    )
    await expect(service.getCurrentStreak('user-1')).resolves.toBe(0)
  })

  it('ay sınırını doğru geçer', async () => {
    vi.setSystemTime(new Date(2026, 2, 2, 12, 0)) // 2 Mart 2026
    const { service } = setup(() =>
      ok([
        { date: '2026-03-02', goal_met: true },
        { date: '2026-03-01', goal_met: true },
        { date: '2026-02-28', goal_met: true },
      ])
    )
    await expect(service.getCurrentStreak('user-1')).resolves.toBe(3)
  })

  it('kayıt yoksa 0 döner', async () => {
    const { service } = setup(() => ok([]))
    await expect(service.getCurrentStreak('user-1')).resolves.toBe(0)
  })

  it('hata durumunda FIRLATMAZ, 0 döner (arayüzü kilitlemez)', async () => {
    const { service } = setup(() => fail('bağlantı yok'))
    await expect(service.getCurrentStreak('user-1')).resolves.toBe(0)
  })
})

describe('getWeeklyCalories', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('bugünle biten 7 günü sıralı döner', async () => {
    const { service } = setup(() => ok([]))
    const result = await service.getWeeklyCalories('user-1')

    expect(result.map((d) => d.date)).toEqual([
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
      '2026-03-15',
    ])
  })

  it('sorguyu 7 günlük aralıkla sınırlar', async () => {
    const { fake, service } = setup(() => ok([]))
    await service.getWeeklyCalories('user-1')

    const query = fake.onlyQuery()
    expect(query.filterValue('gte', 'date')).toBe('2026-03-09')
    expect(query.filterValue('lte', 'date')).toBe('2026-03-15')
  })

  it('kaydı olmayan günleri sıfırla doldurur', async () => {
    const { service } = setup(() =>
      ok([
        { date: '2026-03-13', calories_consumed: 1800 },
        { date: '2026-03-15', calories_consumed: 2100 },
      ])
    )
    const result = await service.getWeeklyCalories('user-1')

    expect(result.map((d) => d.calories)).toEqual([0, 0, 0, 0, 1800, 0, 2100])
  })

  it('hata durumunda sıfırlarla dolu 7 gün döner', async () => {
    const { service } = setup(() => fail('bağlantı yok'))
    const result = await service.getWeeklyCalories('user-1')

    expect(result).toHaveLength(7)
    expect(result.every((d) => d.calories === 0)).toBe(true)
  })
})

describe('getActiveNutritionPlan', () => {
  it('aktif planı getirir', async () => {
    const plan = { id: 'plan-1', daily_calories: 2200 }
    const { fake, service } = setup(() => ok(plan))

    const result = await service.getActiveNutritionPlan('user-1')

    const query = fake.onlyQuery()
    expect(query.table).toBe('nutrition_plans')
    expect(query.filterValue('eq', 'user_id')).toBe('user-1')
    expect(query.filterValue('eq', 'is_active')).toBe(true)
    expect(query.argsOf('limit')).toEqual([1])
    expect(result).toBe(plan)
  })

  it('plan yoksa (PGRST116) null döner — hata fırlatmaz', async () => {
    const { service } = setup(() => fail('no rows', NO_ROWS))
    await expect(service.getActiveNutritionPlan('user-1')).resolves.toBeNull()
  })

  it('başka bir hatada fırlatır', async () => {
    const { service } = setup(() => fail('izin yok', '42501'))
    await expect(service.getActiveNutritionPlan('user-1')).rejects.toMatchObject({
      code: '42501',
    })
  })
})

describe('createNutritionPlan', () => {
  const targets = { calories: 2200, protein: 165, carbs: 220, fat: 73, fiber: 31 }

  it('önce eski planları pasifleştirir, sonra yenisini ekler', async () => {
    const { fake, service } = setup((query) =>
      query.has('insert') ? ok({ id: 'yeni-plan' }) : ok(null)
    )

    await service.createNutritionPlan('user-1', targets, 'Kilo Verme Planı')

    expect(fake.queries).toHaveLength(2)
    const [deactivate, insert] = fake.queries

    expect(deactivate.table).toBe('nutrition_plans')
    expect(deactivate.payload).toEqual({ is_active: false })
    expect(deactivate.filterValue('eq', 'user_id')).toBe('user-1')
    expect(deactivate.filterValue('eq', 'is_active')).toBe(true)

    expect(insert.methods).toEqual(['insert', 'select', 'single'])
    expect(insert.payload).toMatchObject({
      user_id: 'user-1',
      daily_calories: 2200,
      protein_g: 165,
      carbs_g: 220,
      fat_g: 73,
      fiber_g: 31,
      is_active: true,
      plan_name: 'Kilo Verme Planı',
    })
  })

  it('plan adı verilmezse null yazar', async () => {
    const { fake, service } = setup((query) => (query.has('insert') ? ok({ id: 'p' }) : ok(null)))
    await service.createNutritionPlan('user-1', targets)
    expect(fake.queries[1].payload!.plan_name).toBeNull()
  })

  it('lif hedefi verilmezse null yazar', async () => {
    const { fake, service } = setup((query) => (query.has('insert') ? ok({ id: 'p' }) : ok(null)))
    await service.createNutritionPlan('user-1', {
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 70,
    })
    expect(fake.queries[1].payload!.fiber_g).toBeNull()
  })

  it('ekleme hatasında fırlatır', async () => {
    const { service } = setup((query) => (query.has('insert') ? fail('yazılamadı') : ok(null)))
    await expect(service.createNutritionPlan('user-1', targets)).rejects.toBeTruthy()
  })
})

describe('deleteMealLog', () => {
  it('id ile siler', async () => {
    const { fake, service } = setup(() => ok(null))
    await service.deleteMealLog('meal-9')

    const query = fake.onlyQuery()
    expect(query.table).toBe('meal_logs')
    expect(query.has('delete')).toBe(true)
    expect(query.filterValue('eq', 'id')).toBe('meal-9')
  })

  it('hata durumunda fırlatır', async () => {
    const { service } = setup(() => fail('silinemedi'))
    await expect(service.deleteMealLog('meal-9')).rejects.toBeTruthy()
  })
})

describe('saveWeightLog', () => {
  it('kullanıcı+tarih çakışmasında günceller (upsert)', async () => {
    const row = { id: 'w1', weight_kg: 79.5 }
    const { fake, service } = setup(() => ok(row))

    const result = await service.saveWeightLog('user-1', '2026-03-15', 79.5, 'sabah tartısı')

    const query = fake.onlyQuery()
    expect(query.table).toBe('weight_logs')
    expect(query.methods).toEqual(['upsert', 'select', 'single'])
    expect(query.payload).toEqual({
      user_id: 'user-1',
      date: '2026-03-15',
      weight_kg: 79.5,
      notes: 'sabah tartısı',
    })
    // schema.sql: UNIQUE(user_id, date)
    expect(query.argsOf('upsert')![1]).toEqual({ onConflict: 'user_id,date' })
    expect(result).toBe(row)
  })

  it('not verilmezse null yazar', async () => {
    const { fake, service } = setup(() => ok({}))
    await service.saveWeightLog('user-1', '2026-03-15', 79.5)
    expect(fake.onlyQuery().payload!.notes).toBeNull()
  })

  it('hata durumunda fırlatır', async () => {
    const { service } = setup(() => fail('kaydedilemedi'))
    await expect(service.saveWeightLog('user-1', '2026-03-15', 79.5)).rejects.toBeTruthy()
  })
})

describe('getWeightLogs', () => {
  it('tarihe göre yeniden eskiye sıralar', async () => {
    const rows = [{ id: 'w1' }]
    const { fake, service } = setup(() => ok(rows))

    const result = await service.getWeightLogs('user-1')

    const query = fake.onlyQuery()
    expect(query.table).toBe('weight_logs')
    expect(query.filterValue('eq', 'user_id')).toBe('user-1')
    expect(query.argsOf('order')).toEqual(['date', { ascending: false }])
    expect(query.argsOf('limit')).toEqual([30])
    expect(result).toBe(rows)
  })

  it('özel limiti kullanır', async () => {
    const { fake, service } = setup(() => ok([]))
    await service.getWeightLogs('user-1', 7)
    expect(fake.onlyQuery().argsOf('limit')).toEqual([7])
  })

  it('veri yoksa boş dizi döner', async () => {
    const { service } = setup(() => ok(null))
    await expect(service.getWeightLogs('user-1')).resolves.toEqual([])
  })

  it('hata durumunda fırlatır', async () => {
    const { service } = setup(() => fail('okunamadı'))
    await expect(service.getWeightLogs('user-1')).rejects.toBeTruthy()
  })
})

describe('servis yüzeyi', () => {
  it('beklenen metotları sunar', () => {
    const { service } = setup()
    expect(Object.keys(service).sort()).toEqual([
      'createNutritionPlan',
      'deleteMealLog',
      'getActiveNutritionPlan',
      'getCurrentStreak',
      'getMealLogs',
      'getRecentMeals',
      'getWeeklyCalories',
      'getWeightLogs',
      'saveMealLog',
      'saveWeightLog',
    ])
  })

  it('yalnızca şemada tanımlı tablolara erişir', async () => {
    // supabase/schema.sql içindeki tablolar.
    const allowed = new Set([
      'user_profiles',
      'nutrition_plans',
      'meal_logs',
      'daily_progress',
      'weight_logs',
    ])
    const { fake, service } = setup((query) => (query.has('insert') ? ok({}) : ok([])))

    await service.getMealLogs('u', '2026-03-15')
    await service.getRecentMeals('u')
    await service.deleteMealLog('m')
    await service.getCurrentStreak('u')
    await service.getWeeklyCalories('u')
    await service.getActiveNutritionPlan('u')
    await service.createNutritionPlan('u', { calories: 1, protein: 1, carbs: 1, fat: 1 })
    await service.saveWeightLog('u', '2026-03-15', 80)
    await service.getWeightLogs('u')
    await service.saveMealLog('u', makeMealEntry())

    for (const query of fake.queries) {
      expect(allowed.has(query.table), query.table).toBe(true)
    }
  })
})
