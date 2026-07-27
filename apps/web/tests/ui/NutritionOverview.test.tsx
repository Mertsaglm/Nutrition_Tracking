// ============================================================================
// components/NutritionOverview.tsx — günlük makro kartları.
//
// Kullanıcının uygulamada en çok baktığı ekran. Yüzde hesabı, "kalan" metni ve
// sıfıra bölme koruması burada. Hedef 0 iken NaN görünmesi ya da yüzdenin
// %100'ü aşması klasik regresyonlardır.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import NutritionOverview from '@/components/NutritionOverview'

const TARGET = { calories: 2000, protein: 150, carbs: 200, fat: 70 }

/** Etiketine göre bir makro kartını bulur. */
function card(label: string) {
  return screen.getByText(label).closest('div.card') as HTMLElement
}

describe('NutritionOverview', () => {
  it('dört makro kartını da gösterir', () => {
    render(<NutritionOverview consumed={{ calories: 0, protein: 0, carbs: 0, fat: 0 }} target={TARGET} />)

    for (const label of ['Kalori', 'Protein', 'Karbonhidrat', 'Yağ']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('tüketilen ve hedef değerleri birlikte gösterir', () => {
    render(
      <NutritionOverview
        consumed={{ calories: 1200, protein: 90, carbs: 130, fat: 40 }}
        target={TARGET}
      />
    )

    expect(within(card('Kalori')).getByText('1200')).toBeInTheDocument()
    expect(within(card('Kalori')).getByText('/ 2000 kcal')).toBeInTheDocument()
    expect(within(card('Protein')).getByText('/ 150 g')).toBeInTheDocument()
  })

  it('yüzdeyi doğru hesaplar', () => {
    render(
      <NutritionOverview
        consumed={{ calories: 1000, protein: 75, carbs: 50, fat: 7 }}
        target={TARGET}
      />
    )

    expect(within(card('Kalori')).getByText('%50')).toBeInTheDocument()
    expect(within(card('Protein')).getByText('%50')).toBeInTheDocument()
    expect(within(card('Karbonhidrat')).getByText('%25')).toBeInTheDocument()
    expect(within(card('Yağ')).getByText('%10')).toBeInTheDocument()
  })

  it('kalan miktarı gösterir', () => {
    render(
      <NutritionOverview
        consumed={{ calories: 1200, protein: 90, carbs: 130, fat: 40 }}
        target={TARGET}
      />
    )

    expect(within(card('Kalori')).getByText('800 kcal kaldı')).toBeInTheDocument()
    expect(within(card('Protein')).getByText('60 g kaldı')).toBeInTheDocument()
  })

  it('hedefe ulaşıldığında kutlama mesajı gösterir', () => {
    render(<NutritionOverview consumed={TARGET} target={TARGET} />)

    expect(within(card('Kalori')).getByText('Hedefe ulaşıldı 🎉')).toBeInTheDocument()
    expect(within(card('Kalori')).getByText('%100')).toBeInTheDocument()
  })

  describe('uç durumlar', () => {
    it('hedef aşıldığında yüzde %100’de kalır (çubuk taşmaz)', () => {
      render(
        <NutritionOverview
          consumed={{ calories: 3000, protein: 300, carbs: 400, fat: 140 }}
          target={TARGET}
        />
      )

      expect(within(card('Kalori')).getByText('%100')).toBeInTheDocument()
      expect(within(card('Kalori')).getByText('Hedefe ulaşıldı 🎉')).toBeInTheDocument()
    })

    it('hedef 0 iken NaN göstermez (sıfıra bölme koruması)', () => {
      const { container } = render(
        <NutritionOverview
          consumed={{ calories: 500, protein: 30, carbs: 50, fat: 20 }}
          target={{ calories: 0, protein: 0, carbs: 0, fat: 0 }}
        />
      )

      expect(container.textContent).not.toContain('NaN')
      expect(within(card('Kalori')).getByText('%0')).toBeInTheDocument()
      expect(within(card('Kalori')).getByText('Hedefe ulaşıldı 🎉')).toBeInTheDocument()
    })

    it('ondalıklı değerleri yuvarlar', () => {
      render(
        <NutritionOverview
          consumed={{ calories: 1234.7, protein: 89.4, carbs: 100.5, fat: 33.3 }}
          target={TARGET}
        />
      )

      expect(within(card('Kalori')).getByText('1235')).toBeInTheDocument()
      expect(within(card('Protein')).getByText('89')).toBeInTheDocument()
    })

    it('hiç tüketim yokken tüm kartlar %0 gösterir', () => {
      const { container } = render(
        <NutritionOverview consumed={{ calories: 0, protein: 0, carbs: 0, fat: 0 }} target={TARGET} />
      )

      expect(container.querySelectorAll('.card')).toHaveLength(4)
      expect(screen.getAllByText('%0')).toHaveLength(4)
    })

    it('negatif tüketimde bile çökmez', () => {
      const { container } = render(
        <NutritionOverview
          consumed={{ calories: -100, protein: -5, carbs: 0, fat: 0 }}
          target={TARGET}
        />
      )
      expect(container.textContent).not.toContain('NaN')
    })
  })

  it('makro renk sınıflarını uygular (tasarım sistemi bağlantısı)', () => {
    const { container } = render(
      <NutritionOverview consumed={{ calories: 500, protein: 30, carbs: 50, fat: 20 }} target={TARGET} />
    )

    const classes = container.innerHTML
    expect(classes).toContain('bg-protein')
    expect(classes).toContain('bg-carbs')
    expect(classes).toContain('bg-fat')
    expect(classes).toContain('bg-accent-500')
  })
})
