// ============================================================================
// store/nutrition-store.ts — günlük ilerleme durumu (zustand + persist).
//
// Bu store, kullanıcının o günkü öğünlerinin ve tüketilen makroların tek
// kaynağıdır. İki kural hayatidir:
//   1) `consumed` HER ZAMAN `meals` toplamıdır (elle set edilmez).
//   2) `initializeDay` aynı gün için çağrıldığında mevcut öğünleri SİLMEZ.
// İkincisi bozulursa kullanıcı sayfayı yenilediğinde öğünleri kaybolur.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { EMPTY_NUTRITION, createNutritionStore, sumNutrition } from '@nutrition/core'
import { createMemoryStorage, makeMealEntry } from '../../../tests/helpers/fixtures'

const STORAGE_KEY = 'nutrition-storage'

function setupStore() {
  const storage = createMemoryStorage()
  return { store: createNutritionStore(storage), storage }
}

describe('sumNutrition', () => {
  it('boş listede sıfır döner', () => {
    expect(sumNutrition([])).toEqual(EMPTY_NUTRITION)
  })

  it('tek öğünün makrolarını döner', () => {
    const meal = makeMealEntry({ totalNutrition: { calories: 500, protein: 30, carbs: 50, fat: 20 } })
    expect(sumNutrition([meal])).toEqual({ calories: 500, protein: 30, carbs: 50, fat: 20 })
  })

  it('birden fazla öğünü toplar', () => {
    const meals = [
      makeMealEntry({ id: '1', totalNutrition: { calories: 500, protein: 30, carbs: 50, fat: 20 } }),
      makeMealEntry({ id: '2', totalNutrition: { calories: 300, protein: 20, carbs: 25, fat: 10 } }),
      makeMealEntry({ id: '3', totalNutrition: { calories: 120.5, protein: 5.5, carbs: 12, fat: 3 } }),
    ]
    expect(sumNutrition(meals)).toEqual({
      calories: 920.5,
      protein: 55.5,
      carbs: 87,
      fat: 33,
    })
  })

  it('paylaşılan EMPTY_NUTRITION nesnesini bozmaz', () => {
    // Başlangıç değeri `{ ...EMPTY_NUTRITION }` olmalı; referans verilirse
    // her toplama işlemi global sabiti kalıcı olarak bozar.
    sumNutrition([makeMealEntry({ totalNutrition: { calories: 999, protein: 1, carbs: 1, fat: 1 } })])
    expect(EMPTY_NUTRITION).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })

  it('girdi listesini ve öğünleri değiştirmez', () => {
    const meals = [makeMealEntry()]
    const snapshot = JSON.parse(JSON.stringify(meals))
    sumNutrition(meals)
    expect(JSON.parse(JSON.stringify(meals))).toEqual(snapshot)
  })

  it('her zaman dört makroyu da içerir', () => {
    expect(Object.keys(sumNutrition([])).sort()).toEqual(['calories', 'carbs', 'fat', 'protein'])
  })
})

describe('createNutritionStore', () => {
  describe('başlangıç durumu', () => {
    it('varsayılan değerlerle başlar', () => {
      const { store } = setupStore()
      const state = store.getState()
      expect(state.dailyProgress).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(state.fiberTarget).toBe(25)
      expect(state.waterTarget).toBe(2.5)
    })
  })

  describe('initializeDay', () => {
    it('boş bir gün oluşturur', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')

      expect(store.getState().dailyProgress).toEqual({
        date: '2026-03-15',
        consumed: EMPTY_NUTRITION,
        target: EMPTY_NUTRITION,
        meals: [],
      })
    })

    it('AYNI gün için tekrar çağrılınca mevcut öğünleri korur', () => {
      // Regresyon koruması: her sayfa açılışında initializeDay çağrılır.
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().addMealEntry(makeMealEntry())
      store.getState().initializeDay('2026-03-15')

      expect(store.getState().dailyProgress?.meals).toHaveLength(1)
      expect(store.getState().dailyProgress?.consumed.calories).toBe(500)
    })

    it('FARKLI gün için durumu sıfırlar', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().addMealEntry(makeMealEntry())
      store.getState().initializeDay('2026-03-16')

      expect(store.getState().dailyProgress).toEqual({
        date: '2026-03-16',
        consumed: EMPTY_NUTRITION,
        target: EMPTY_NUTRITION,
        meals: [],
      })
    })

    it('aynı gün çağrısında hedefleri de korur', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().setDailyTargets({ calories: 2200, protein: 165, carbs: 220, fat: 73 })
      store.getState().initializeDay('2026-03-15')

      expect(store.getState().dailyProgress?.target.calories).toBe(2200)
    })
  })

  describe('setDailyTargets', () => {
    it('hedefleri yazar', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      const targets = { calories: 2200, protein: 165, carbs: 220, fat: 73 }
      store.getState().setDailyTargets(targets)

      expect(store.getState().dailyProgress?.target).toEqual(targets)
    })

    it('gün başlatılmadan çağrılırsa hiçbir şey yapmaz', () => {
      const { store } = setupStore()
      store.getState().setDailyTargets({ calories: 2200, protein: 165, carbs: 220, fat: 73 })
      expect(store.getState().dailyProgress).toBeNull()
    })

    it('öğünlere dokunmaz', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().addMealEntry(makeMealEntry())
      store.getState().setDailyTargets({ calories: 2200, protein: 165, carbs: 220, fat: 73 })

      expect(store.getState().dailyProgress?.meals).toHaveLength(1)
      expect(store.getState().dailyProgress?.consumed.calories).toBe(500)
    })
  })

  describe('addMealEntry', () => {
    it('öğünü ekler ve tüketimi yeniden hesaplar', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().addMealEntry(makeMealEntry({ id: 'a' }))
      store.getState().addMealEntry(
        makeMealEntry({ id: 'b', totalNutrition: { calories: 300, protein: 20, carbs: 25, fat: 10 } })
      )

      const progress = store.getState().dailyProgress
      expect(progress?.meals.map((m) => m.id)).toEqual(['a', 'b'])
      expect(progress?.consumed).toEqual({ calories: 800, protein: 50, carbs: 75, fat: 30 })
    })

    it('ekleme sırasını korur', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      for (const id of ['1', '2', '3']) store.getState().addMealEntry(makeMealEntry({ id }))
      expect(store.getState().dailyProgress?.meals.map((m) => m.id)).toEqual(['1', '2', '3'])
    })

    it('gün başlatılmadan çağrılırsa hiçbir şey yapmaz', () => {
      const { store } = setupStore()
      store.getState().addMealEntry(makeMealEntry())
      expect(store.getState().dailyProgress).toBeNull()
    })
  })

  describe('deleteMealEntry', () => {
    it('öğünü siler ve tüketimi yeniden hesaplar', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().addMealEntry(makeMealEntry({ id: 'a' }))
      store.getState().addMealEntry(
        makeMealEntry({ id: 'b', totalNutrition: { calories: 300, protein: 20, carbs: 25, fat: 10 } })
      )
      store.getState().deleteMealEntry('a')

      const progress = store.getState().dailyProgress
      expect(progress?.meals.map((m) => m.id)).toEqual(['b'])
      expect(progress?.consumed).toEqual({ calories: 300, protein: 20, carbs: 25, fat: 10 })
    })

    it('son öğün silinince tüketim sıfırlanır', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().addMealEntry(makeMealEntry({ id: 'a' }))
      store.getState().deleteMealEntry('a')
      expect(store.getState().dailyProgress?.consumed).toEqual(EMPTY_NUTRITION)
    })

    it('olmayan id ile çağrılırsa durum değişmez', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().addMealEntry(makeMealEntry({ id: 'a' }))
      const before = store.getState().dailyProgress
      store.getState().deleteMealEntry('yok-böyle-bir-id')
      expect(store.getState().dailyProgress?.meals).toHaveLength(1)
      expect(store.getState().dailyProgress?.consumed).toEqual(before?.consumed)
    })

    it('boş id ile öğün silmez', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().addMealEntry(makeMealEntry({ id: 'a' }))
      store.getState().deleteMealEntry('')
      expect(store.getState().dailyProgress?.meals).toHaveLength(1)
    })

    it('gün başlatılmadan çağrılırsa hiçbir şey yapmaz', () => {
      const { store } = setupStore()
      expect(() => store.getState().deleteMealEntry('a')).not.toThrow()
      expect(store.getState().dailyProgress).toBeNull()
    })
  })

  describe('setMeals', () => {
    it('listeyi değiştirir ve tüketimi yeniden hesaplar', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().addMealEntry(makeMealEntry({ id: 'eski' }))
      store.getState().setMeals([
        makeMealEntry({ id: 'yeni', totalNutrition: { calories: 100, protein: 10, carbs: 5, fat: 2 } }),
      ])

      expect(store.getState().dailyProgress?.meals.map((m) => m.id)).toEqual(['yeni'])
      expect(store.getState().dailyProgress?.consumed.calories).toBe(100)
    })

    it('boş liste tüketimi sıfırlar (DB’den senkronizasyon)', () => {
      const { store } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().addMealEntry(makeMealEntry())
      store.getState().setMeals([])

      expect(store.getState().dailyProgress?.meals).toEqual([])
      expect(store.getState().dailyProgress?.consumed).toEqual(EMPTY_NUTRITION)
    })

    it('gün başlatılmadan çağrılırsa hiçbir şey yapmaz', () => {
      const { store } = setupStore()
      store.getState().setMeals([makeMealEntry()])
      expect(store.getState().dailyProgress).toBeNull()
    })
  })

  describe('setFiberWaterTargets', () => {
    it('lif ve su hedeflerini günceller', () => {
      const { store } = setupStore()
      store.getState().setFiberWaterTargets(31, 2.8)
      expect(store.getState().fiberTarget).toBe(31)
      expect(store.getState().waterTarget).toBe(2.8)
    })

    it('gün başlatılmasa da çalışır (günlük ilerlemeden bağımsız)', () => {
      const { store } = setupStore()
      store.getState().setFiberWaterTargets(30, 3)
      expect(store.getState().dailyProgress).toBeNull()
      expect(store.getState().fiberTarget).toBe(30)
    })
  })

  describe('kalıcılık (persist)', () => {
    it('durumu beklenen anahtarla saklar', () => {
      const { store, storage } = setupStore()
      store.getState().initializeDay('2026-03-15')
      expect(storage.map.has(STORAGE_KEY)).toBe(true)
    })

    it('yalnızca kalıcı olması gereken alanları yazar', () => {
      const { store, storage } = setupStore()
      store.getState().initializeDay('2026-03-15')
      store.getState().setFiberWaterTargets(31, 2.8)

      const persisted = JSON.parse(storage.map.get(STORAGE_KEY)!)
      expect(Object.keys(persisted.state).sort()).toEqual([
        'dailyProgress',
        'fiberTarget',
        'waterTarget',
      ])
      // Geçici UI durumu diske yazılmamalı.
      expect(persisted.state).not.toHaveProperty('isLoading')
    })

    it('fonksiyonlar diske yazılmaz', () => {
      const { store, storage } = setupStore()
      store.getState().initializeDay('2026-03-15')
      const raw = storage.map.get(STORAGE_KEY)!
      expect(raw).not.toContain('addMealEntry')
    })

    it('aynı depodan yeni bir store durumu geri yükler', () => {
      const storage = createMemoryStorage()
      const first = createNutritionStore(storage)
      first.getState().initializeDay('2026-03-15')
      first.getState().addMealEntry(makeMealEntry({ id: 'kalıcı' }))
      first.getState().setFiberWaterTargets(31, 2.8)

      const second = createNutritionStore(storage)
      expect(second.getState().dailyProgress?.date).toBe('2026-03-15')
      expect(second.getState().dailyProgress?.meals.map((m) => m.id)).toEqual(['kalıcı'])
      expect(second.getState().fiberTarget).toBe(31)
      expect(second.getState().waterTarget).toBe(2.8)
    })

    it('geri yüklenen öğünlerde timestamp METİNDİR (Date değil)', () => {
      // JSON serileştirmesi Date’i metne çevirir. Arayüz bu alanı kullanırken
      // `new Date(meal.timestamp)` demek zorundadır — doğrudan .getTime() çağıran
      // bir kod çöker. Bu davranış bilinçli olarak belgelenmiştir.
      const storage = createMemoryStorage()
      const first = createNutritionStore(storage)
      first.getState().initializeDay('2026-03-15')
      first.getState().addMealEntry(makeMealEntry())

      const second = createNutritionStore(storage)
      const restored = second.getState().dailyProgress?.meals[0]
      expect(typeof restored?.timestamp).toBe('string')
      expect(() => new Date(restored!.timestamp).toISOString()).not.toThrow()
    })

    it('bozuk depo içeriğinde çökmez', () => {
      const storage = createMemoryStorage()
      storage.map.set(STORAGE_KEY, '{bozuk json')
      expect(() => createNutritionStore(storage)).not.toThrow()
    })

    it('farklı depolar birbirinden bağımsızdır', () => {
      const a = setupStore()
      const b = setupStore()
      a.store.getState().initializeDay('2026-03-15')

      expect(b.store.getState().dailyProgress).toBeNull()
    })
  })

  describe('abonelik', () => {
    it('durum değişiminde dinleyicileri tetikler', () => {
      const { store } = setupStore()
      const seen: (string | undefined)[] = []
      const unsubscribe = store.subscribe((state) => seen.push(state.dailyProgress?.date))

      store.getState().initializeDay('2026-03-15')
      store.getState().addMealEntry(makeMealEntry())
      unsubscribe()
      store.getState().initializeDay('2026-03-16')

      expect(seen).toEqual(['2026-03-15', '2026-03-15'])
    })
  })
})
