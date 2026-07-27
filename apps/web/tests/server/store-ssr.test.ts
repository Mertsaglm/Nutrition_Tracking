// ============================================================================
// lib/store.ts — SSR güvenliği.
//
// Next.js App Router bu modülü SUNUCUDA da yükler. `window` sunucuda yoktur;
// localStorage'a doğrudan erişen bir adaptör build'i "window is not defined"
// ile düşürür. Bu test, sunucu ortamında (window'suz) modülün sorunsuz
// yüklenip çalıştığını doğrular.
// ============================================================================
import { describe, expect, it } from 'vitest'

describe('web store — sunucu ortamı', () => {
  it('bu test gerçekten window olmadan koşar', () => {
    expect(typeof globalThis.window).toBe('undefined')
  })

  it('modül sunucuda hatasız yüklenir', async () => {
    await expect(import('@/lib/store')).resolves.toBeDefined()
  })

  it('store sunucuda oluşturulur ve kullanılabilir', async () => {
    const { useNutritionStore } = await import('@/lib/store')

    expect(typeof useNutritionStore.getState).toBe('function')
    expect(useNutritionStore.getState().dailyProgress).toBeNull()
    expect(useNutritionStore.getState().fiberTarget).toBe(25)
  })

  it('durum güncellemeleri sunucuda çökmez (yazma sessizce yok sayılır)', async () => {
    const { useNutritionStore } = await import('@/lib/store')

    expect(() => {
      useNutritionStore.getState().initializeDay('2026-03-15')
      useNutritionStore.getState().setDailyTargets({
        calories: 2200,
        protein: 165,
        carbs: 220,
        fat: 73,
      })
    }).not.toThrow()

    expect(useNutritionStore.getState().dailyProgress?.date).toBe('2026-03-15')
  })
})
