// ============================================================================
// components/MealLogger.tsx — öğün ekleme akışı (uygulamanın ana işlevi).
//
// Bu bileşen dört sistemi birbirine bağlar: doğrulama, AI istemcisi, veritabanı
// ve store. Testler özellikle iki geçmiş hatayı kilitler:
//   1) Öğün hedef kalorisi her zaman 0 gönderiliyordu → AI yanlış porsiyon
//      varsayıyordu. Artık günlük hedef × öğün oranı gönderilir.
//   2) Store'a Date.now() ile üretilen sahte id ekleniyordu → silme işlemi
//      DB kaydıyla eşleşmiyordu. Artık DB'nin döndürdüğü UUID kullanılır.
// ============================================================================
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const analyzeMealMock = vi.fn()
const saveMealLogMock = vi.fn()
const getCurrentUserMock = vi.fn()

vi.mock('@/lib/ai', () => ({
  aiClient: {
    analyzeMeal: (...args: unknown[]) => analyzeMealMock(...args),
    generateSampleMealPlan: vi.fn(),
  },
}))

vi.mock('@/lib/services', () => ({
  databaseService: { saveMealLog: (...args: unknown[]) => saveMealLogMock(...args) },
  authService: { getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args) },
}))

const { useNutritionStore } = await import('@/lib/store')
const { ToastProvider } = await import('@/components/ui/Toast')
const MealLogger = (await import('@/components/MealLogger')).default

const AI_RESULT = {
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
  suggestions: 'Yanına meyve ekleyebilirsin.',
  confidence: 0.9,
}

const SAVED_ROW = {
  id: 'db-uuid-1',
  user_id: 'user-1',
  date: '2026-03-15',
  meal_type: 'Kahvaltı',
  description: '2 haşlanmış yumurta',
  food_items: AI_RESULT.foods,
  total_calories: 260,
  total_protein_g: 18,
  total_carbs_g: 20,
  total_fat_g: 12,
  ai_analysis: AI_RESULT.analysis,
  ai_suggestions: AI_RESULT.suggestions,
  confidence_score: 0.9,
  created_at: '2026-03-15T08:30:00.000Z',
  updated_at: '2026-03-15T08:30:00.000Z',
}

function renderLogger(props: { userMealCount?: number } = {}) {
  return render(
    <ToastProvider>
      <MealLogger {...props} />
    </ToastProvider>
  )
}

/** Formu açar, öğün türünü seçer ve açıklamayı yazar. */
async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { meal = 'Kahvaltı', description = '2 haşlanmış yumurta' } = {}
) {
  await user.click(screen.getByRole('button', { name: /Yeni Öğün Ekle/ }))
  await user.click(screen.getByRole('button', { name: new RegExp(meal) }))
  await user.type(screen.getByRole('textbox'), description)
}

describe('MealLogger', () => {
  beforeEach(() => {
    analyzeMealMock.mockReset().mockResolvedValue(AI_RESULT)
    saveMealLogMock.mockReset().mockResolvedValue(SAVED_ROW)
    getCurrentUserMock.mockReset().mockResolvedValue({ id: 'user-1' })
    useNutritionStore.setState({ dailyProgress: null })
    window.localStorage.clear()
  })

  describe('kapalı durum', () => {
    it('yalnızca ekleme butonunu gösterir', () => {
      renderLogger()
      expect(screen.getByRole('button', { name: /Yeni Öğün Ekle/ })).toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('butona basınca form açılır', async () => {
      const user = userEvent.setup()
      renderLogger()

      await user.click(screen.getByRole('button', { name: /Yeni Öğün Ekle/ }))

      expect(screen.getByText('Yeni Öğün')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('öğün türü seçenekleri', () => {
    it('varsayılan olarak 3 öğün gösterir (kahvaltı/öğle/akşam)', async () => {
      const user = userEvent.setup()
      renderLogger()
      await user.click(screen.getByRole('button', { name: /Yeni Öğün Ekle/ }))

      expect(screen.getByRole('button', { name: /Kahvaltı/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Öğle/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Akşam/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Kuşluk/ })).not.toBeInTheDocument()
    })

    it('5 öğünlük kullanıcıya ara öğünleri de gösterir', async () => {
      const user = userEvent.setup()
      renderLogger({ userMealCount: 5 })
      await user.click(screen.getByRole('button', { name: /Yeni Öğün Ekle/ }))

      expect(screen.getByRole('button', { name: /Kuşluk/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /İkindi/ })).toBeInTheDocument()
    })

    it('6 öğünlük kullanıcıya gece öğününü de gösterir', async () => {
      const user = userEvent.setup()
      renderLogger({ userMealCount: 6 })
      await user.click(screen.getByRole('button', { name: /Yeni Öğün Ekle/ }))

      expect(screen.getByRole('button', { name: /Gece/ })).toBeInTheDocument()
    })

    it('geçersiz öğün sayısında 3 öğüne düşer', async () => {
      const user = userEvent.setup()
      renderLogger({ userMealCount: 99 })
      await user.click(screen.getByRole('button', { name: /Yeni Öğün Ekle/ }))

      expect(screen.queryByRole('button', { name: /Kuşluk/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Kahvaltı/ })).toBeInTheDocument()
    })

    it('öğün saatlerini ve hedef kaloriyi gösterir', async () => {
      const user = userEvent.setup()
      renderLogger()
      await user.click(screen.getByRole('button', { name: /Yeni Öğün Ekle/ }))

      // Günlük hedef yokken 2000 kcal varsayılır; kahvaltı payı %30 → 600 kcal.
      expect(screen.getByRole('button', { name: /Kahvaltı/ })).toHaveTextContent('600 kcal · 08:00')
    })

    it('günlük hedef varsa öğün hedefini ondan türetir', async () => {
      useNutritionStore.getState().initializeDay('2026-03-15')
      useNutritionStore
        .getState()
        .setDailyTargets({ calories: 3000, protein: 200, carbs: 300, fat: 100 })

      const user = userEvent.setup()
      renderLogger()
      await user.click(screen.getByRole('button', { name: /Yeni Öğün Ekle/ }))

      expect(screen.getByRole('button', { name: /Kahvaltı/ })).toHaveTextContent('900 kcal')
    })
  })

  describe('analiz', () => {
    it('öğün türü seçilmeden analiz butonu pasiftir', async () => {
      const user = userEvent.setup()
      renderLogger()
      await user.click(screen.getByRole('button', { name: /Yeni Öğün Ekle/ }))
      await user.type(screen.getByRole('textbox'), '2 yumurta')

      expect(screen.getByRole('button', { name: /AI ile Analiz Et/ })).toBeDisabled()
    })

    it('açıklama boşken analiz butonu pasiftir', async () => {
      const user = userEvent.setup()
      renderLogger()
      await user.click(screen.getByRole('button', { name: /Yeni Öğün Ekle/ }))
      await user.click(screen.getByRole('button', { name: /Kahvaltı/ }))

      expect(screen.getByRole('button', { name: /AI ile Analiz Et/ })).toBeDisabled()
    })

    it('çok kısa açıklamada AI çağrılmaz, uyarı gösterilir', async () => {
      const user = userEvent.setup()
      renderLogger()
      await fillForm(user, { description: 'ab' })
      await user.click(screen.getByRole('button', { name: /AI ile Analiz Et/ }))

      expect(await screen.findByText('Lütfen en az 3 karakter yaz')).toBeInTheDocument()
      expect(analyzeMealMock).not.toHaveBeenCalled()
    })

    it('AI’a açıklama, öğün türü ve ÖĞÜN hedef kalorisini gönderir', async () => {
      const user = userEvent.setup()
      renderLogger()
      await fillForm(user)
      await user.click(screen.getByRole('button', { name: /AI ile Analiz Et/ }))

      // Regresyon: bu değer eskiden hep 0 gidiyordu.
      await waitFor(() =>
        expect(analyzeMealMock).toHaveBeenCalledWith('2 haşlanmış yumurta', 'Kahvaltı', 600)
      )
    })

    it('seçilen öğüne göre hedef kalori değişir', async () => {
      const user = userEvent.setup()
      renderLogger()
      await fillForm(user, { meal: 'Akşam' })
      await user.click(screen.getByRole('button', { name: /AI ile Analiz Et/ }))

      // Akşam payı %15 → 2000 × 0.15 = 300 kcal
      await waitFor(() =>
        expect(analyzeMealMock).toHaveBeenCalledWith(expect.anything(), 'Akşam', 300)
      )
    })

    it('sonuçları ekranda gösterir', async () => {
      const user = userEvent.setup()
      renderLogger()
      await fillForm(user)
      await user.click(screen.getByRole('button', { name: /AI ile Analiz Et/ }))

      expect(await screen.findByText('260')).toBeInTheDocument()
      expect(screen.getByText('Tespit edilenler')).toBeInTheDocument()
      expect(screen.getByText(/Tam yumurta \(haşlanmış\)/)).toBeInTheDocument()
      expect(screen.getByText('Proteinden zengin bir kahvaltı.')).toBeInTheDocument()
      expect(screen.getByText('Yanına meyve ekleyebilirsin.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Öğünü Kaydet' })).toBeInTheDocument()
    })

    it('AI hatasında kullanıcıya bilgi verir ve kaydetme çıkmaz', async () => {
      analyzeMealMock.mockRejectedValue(new Error('İnternet bağlantısı sorunu.'))
      const user = userEvent.setup()
      renderLogger()
      await fillForm(user)
      await user.click(screen.getByRole('button', { name: /AI ile Analiz Et/ }))

      expect(await screen.findByText('İnternet bağlantısı sorunu.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Öğünü Kaydet' })).not.toBeInTheDocument()
    })

    it('analiz sırasında butonu kilitler', async () => {
      let resolveAnalysis: (value: unknown) => void = () => {}
      analyzeMealMock.mockReturnValue(new Promise((resolve) => (resolveAnalysis = resolve)))

      const user = userEvent.setup()
      renderLogger()
      await fillForm(user)
      await user.click(screen.getByRole('button', { name: /AI ile Analiz Et/ }))

      expect(await screen.findByText(/Analiz ediliyor/)).toBeInTheDocument()

      resolveAnalysis(AI_RESULT)
      await screen.findByRole('button', { name: 'Öğünü Kaydet' })
    })
  })

  describe('kaydetme', () => {
    async function analyzeThenSave(user: ReturnType<typeof userEvent.setup>) {
      await fillForm(user)
      await user.click(screen.getByRole('button', { name: /AI ile Analiz Et/ }))
      await user.click(await screen.findByRole('button', { name: 'Öğünü Kaydet' }))
    }

    it('öğünü veritabanına yazar', async () => {
      const user = userEvent.setup()
      renderLogger()
      await analyzeThenSave(user)

      await waitFor(() => expect(saveMealLogMock).toHaveBeenCalledTimes(1))
      const [userId, entry] = saveMealLogMock.mock.calls[0]

      expect(userId).toBe('user-1')
      expect(entry).toMatchObject({
        mealType: 'Kahvaltı',
        description: '2 haşlanmış yumurta',
        totalNutrition: AI_RESULT.totalNutrition,
        aiAnalysis: AI_RESULT.analysis,
        suggestions: AI_RESULT.suggestions,
      })
      expect(entry.timestamp).toBeInstanceOf(Date)
    })

    it('istemci id üretmez (DB’nin UUID’si kullanılır)', async () => {
      useNutritionStore.getState().initializeDay('2026-03-15')
      const user = userEvent.setup()
      renderLogger()
      await analyzeThenSave(user)

      await waitFor(() => expect(saveMealLogMock).toHaveBeenCalled())
      expect(saveMealLogMock.mock.calls[0][1].id).toBe('')

      await waitFor(() =>
        expect(useNutritionStore.getState().dailyProgress?.meals[0]?.id).toBe('db-uuid-1')
      )
    })

    it('store’daki tüketimi günceller', async () => {
      useNutritionStore.getState().initializeDay('2026-03-15')
      const user = userEvent.setup()
      renderLogger()
      await analyzeThenSave(user)

      await waitFor(() =>
        expect(useNutritionStore.getState().dailyProgress?.consumed).toEqual({
          calories: 260,
          protein: 18,
          carbs: 20,
          fat: 12,
        })
      )
    })

    it('başarı mesajı gösterip formu kapatır', async () => {
      const user = userEvent.setup()
      renderLogger()
      await analyzeThenSave(user)

      expect(await screen.findByText('Kahvaltı öğünü kaydedildi')).toBeInTheDocument()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Yeni Öğün Ekle/ })).toBeInTheDocument()
      )
    })

    it('oturum yoksa kaydetmez ve giriş yapmayı söyler', async () => {
      getCurrentUserMock.mockResolvedValue(null)
      const user = userEvent.setup()
      renderLogger()
      await analyzeThenSave(user)

      expect(await screen.findByText('Öğünü kaydetmek için giriş yapmalısın')).toBeInTheDocument()
      expect(saveMealLogMock).not.toHaveBeenCalled()
    })

    it('DB hatasında formu kapatmaz (veri kaybolmaz)', async () => {
      saveMealLogMock.mockRejectedValue(new Error('Öğün kaydedilemedi'))
      const user = userEvent.setup()
      renderLogger()
      await analyzeThenSave(user)

      expect(await screen.findByText('Öğün kaydedilemedi')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Öğünü Kaydet' })).toBeInTheDocument()
      expect(useNutritionStore.getState().dailyProgress?.meals ?? []).toEqual([])
    })
  })

  describe('formu kapatma', () => {
    it('X butonu formu sıfırlar', async () => {
      const user = userEvent.setup()
      renderLogger()
      await fillForm(user)

      const closeButton = screen
        .getAllByRole('button')
        .find((button) => button.className.includes('text-neutral-400'))!
      await user.click(closeButton)

      expect(screen.getByRole('button', { name: /Yeni Öğün Ekle/ })).toBeInTheDocument()
    })

    it('yeniden açıldığında eski açıklama kalmaz', async () => {
      const user = userEvent.setup()
      renderLogger()
      await fillForm(user)

      const closeButton = screen
        .getAllByRole('button')
        .find((button) => button.className.includes('text-neutral-400'))!
      await user.click(closeButton)
      await user.click(screen.getByRole('button', { name: /Yeni Öğün Ekle/ }))

      expect(screen.getByRole('textbox')).toHaveValue('')
    })
  })
})
