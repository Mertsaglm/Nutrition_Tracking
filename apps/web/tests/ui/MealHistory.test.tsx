// ============================================================================
// components/MealHistory.tsx — bugünkü öğünler listesi.
//
// Silme işlemi İYİMSER (optimistic): önce arayüzden kaldırılır, sonra DB'ye
// gidilir. Bu davranış bilinçlidir ve testlerle sabitlenmiştir — sıralamanın
// ters çevrilmesi (önce DB, sonra arayüz) kullanıcıya takılma hissi verir.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MealEntry } from '@nutrition/core'

const deleteMealLogMock = vi.fn()

vi.mock('@/lib/services', () => ({
  databaseService: {
    deleteMealLog: (...args: unknown[]) => deleteMealLogMock(...args),
  },
  authService: {},
}))

const { useNutritionStore } = await import('@/lib/store')
const { ToastProvider } = await import('@/components/ui/Toast')
const MealHistory = (await import('@/components/MealHistory')).default

function makeMeal(overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    id: 'meal-1',
    mealType: 'Kahvaltı',
    description: '2 haşlanmış yumurta ve tam buğday ekmeği',
    foods: [
      {
        name: 'Tam yumurta (haşlanmış)',
        amount: 100,
        unit: 'g',
        nutrition: { calories: 155, protein: 13, carbs: 1, fat: 11 },
      },
    ],
    totalNutrition: { calories: 260, protein: 18, carbs: 20, fat: 12 },
    timestamp: new Date(2026, 2, 15, 8, 30),
    aiAnalysis: 'Proteinden zengin bir kahvaltı.',
    suggestions: 'Yanına meyve ekleyebilirsin.',
    ...overrides,
  }
}

function renderHistory() {
  return render(
    <ToastProvider>
      <MealHistory />
    </ToastProvider>
  )
}

/** Store'u belirli öğünlerle hazırlar. */
function seedMeals(meals: MealEntry[]) {
  useNutritionStore.getState().initializeDay('2026-03-15')
  useNutritionStore.getState().setMeals(meals)
}

describe('MealHistory', () => {
  beforeEach(() => {
    deleteMealLogMock.mockReset().mockResolvedValue(undefined)
    useNutritionStore.setState({ dailyProgress: null })
    window.localStorage.clear()
  })

  afterEach(() => {
    useNutritionStore.setState({ dailyProgress: null })
  })

  describe('boş durum', () => {
    it('gün başlatılmamışsa yönlendirici mesaj gösterir', () => {
      renderHistory()
      expect(screen.getByText('Henüz öğün eklenmemiş')).toBeInTheDocument()
      expect(screen.getByText('İlk öğününü ekleyerek takibe başla')).toBeInTheDocument()
    })

    it('gün başlatılmış ama öğün yoksa da aynı mesajı gösterir', () => {
      seedMeals([])
      renderHistory()
      expect(screen.getByText('Henüz öğün eklenmemiş')).toBeInTheDocument()
    })
  })

  describe('öğün listesi', () => {
    beforeEach(() => {
      seedMeals([makeMeal()])
    })

    it('başlık ve öğün türünü gösterir', () => {
      renderHistory()
      expect(screen.getByText('Bugünkü Öğünler')).toBeInTheDocument()
      expect(screen.getByText('Kahvaltı')).toBeInTheDocument()
    })

    it('açıklamayı ve saati gösterir', () => {
      renderHistory()
      expect(screen.getByText('2 haşlanmış yumurta ve tam buğday ekmeği')).toBeInTheDocument()
      expect(screen.getByText('08:30')).toBeInTheDocument()
    })

    it('kalori ve makro özetini gösterir', () => {
      renderHistory()
      expect(screen.getByText('260')).toBeInTheDocument()
      expect(screen.getByText(/P 18/)).toBeInTheDocument()
      expect(screen.getByText(/K 20/)).toBeInTheDocument()
      expect(screen.getByText(/Y 12/)).toBeInTheDocument()
    })

    it('ondalıklı değerleri yuvarlar', () => {
      seedMeals([
        makeMeal({ totalNutrition: { calories: 259.6, protein: 17.5, carbs: 20.4, fat: 11.9 } }),
      ])
      renderHistory()
      expect(screen.getByText('260')).toBeInTheDocument()
    })

    it('birden fazla öğünü listeler', () => {
      seedMeals([
        makeMeal({ id: 'a', mealType: 'Kahvaltı' }),
        makeMeal({ id: 'b', mealType: 'Öğle', description: 'mercimek çorbası' }),
      ])
      renderHistory()

      expect(screen.getByText('Kahvaltı')).toBeInTheDocument()
      expect(screen.getByText('Öğle')).toBeInTheDocument()
      expect(screen.getAllByLabelText('Sil')).toHaveLength(2)
    })
  })

  describe('detay açma/kapama', () => {
    beforeEach(() => {
      seedMeals([makeMeal()])
    })

    it('başlangıçta detaylar gizlidir', () => {
      renderHistory()
      expect(screen.queryByText('Proteinden zengin bir kahvaltı.')).not.toBeInTheDocument()
    })

    it('detay butonuna basınca besinleri ve AI yorumunu gösterir', async () => {
      const user = userEvent.setup()
      renderHistory()

      await user.click(screen.getByLabelText('Detay'))

      expect(screen.getByText(/Tam yumurta \(haşlanmış\)/)).toBeInTheDocument()
      expect(screen.getByText('Proteinden zengin bir kahvaltı.')).toBeInTheDocument()
      expect(screen.getByText('Yanına meyve ekleyebilirsin.')).toBeInTheDocument()
    })

    it('ikinci basışta detayları kapatır', async () => {
      const user = userEvent.setup()
      renderHistory()

      await user.click(screen.getByLabelText('Detay'))
      await user.click(screen.getByLabelText('Detay'))

      expect(screen.queryByText('Proteinden zengin bir kahvaltı.')).not.toBeInTheDocument()
    })

    it('AI yorumu yoksa o bölümü hiç göstermez', async () => {
      seedMeals([makeMeal({ aiAnalysis: undefined, suggestions: undefined })])
      const user = userEvent.setup()
      renderHistory()

      await user.click(screen.getByLabelText('Detay'))
      expect(screen.queryByText('Proteinden zengin bir kahvaltı.')).not.toBeInTheDocument()
      // Besin listesi yine görünür.
      expect(screen.getByText(/Tam yumurta/)).toBeInTheDocument()
    })
  })

  describe('silme', () => {
    beforeEach(() => {
      seedMeals([makeMeal({ id: 'db-uuid-1' })])
    })

    it('öğünü hem arayüzden hem veritabanından siler', async () => {
      const user = userEvent.setup()
      renderHistory()

      await user.click(screen.getByLabelText('Sil'))

      expect(deleteMealLogMock).toHaveBeenCalledWith('db-uuid-1')
      expect(useNutritionStore.getState().dailyProgress?.meals).toEqual([])
      expect(await screen.findByText('Öğün silindi')).toBeInTheDocument()
    })

    it('silme sonrası tüketilen makrolar güncellenir', async () => {
      const user = userEvent.setup()
      renderHistory()

      expect(useNutritionStore.getState().dailyProgress?.consumed.calories).toBe(260)
      await user.click(screen.getByLabelText('Sil'))
      expect(useNutritionStore.getState().dailyProgress?.consumed.calories).toBe(0)
    })

    it('DB hatasında kullanıcıya bilgi verir', async () => {
      deleteMealLogMock.mockRejectedValue(new Error('bağlantı yok'))
      const user = userEvent.setup()
      renderHistory()

      await user.click(screen.getByLabelText('Sil'))

      expect(await screen.findByText('Öğün silinirken bir sorun oluştu')).toBeInTheDocument()
      // İYİMSER silme: hata olsa da satır arayüzden kalkmış olur.
      expect(useNutritionStore.getState().dailyProgress?.meals).toEqual([])
    })

    it('DB hatası ham mesajı kullanıcıya göstermez', async () => {
      deleteMealLogMock.mockRejectedValue(new Error('permission denied for table meal_logs'))
      const user = userEvent.setup()
      renderHistory()

      await user.click(screen.getByLabelText('Sil'))

      await waitFor(() => expect(deleteMealLogMock).toHaveBeenCalled())
      expect(screen.queryByText(/permission denied/)).not.toBeInTheDocument()
    })

    it('yalnızca seçilen öğünü siler', async () => {
      seedMeals([makeMeal({ id: 'a' }), makeMeal({ id: 'b', mealType: 'Öğle' })])
      const user = userEvent.setup()
      renderHistory()

      const secondCard = screen.getByText('Öğle').closest('div.card') as HTMLElement
      await user.click(within(secondCard).getByLabelText('Sil'))

      expect(deleteMealLogMock).toHaveBeenCalledWith('b')
      expect(useNutritionStore.getState().dailyProgress?.meals.map((m) => m.id)).toEqual(['a'])
    })
  })
})
