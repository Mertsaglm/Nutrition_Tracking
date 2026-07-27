// ============================================================================
// components/DashboardHeader.tsx — panelin üst özeti.
//
// Kullanıcının ilk gördüğü sayı burada. Türkçe tarih/sayı biçimlendirmesi,
// yüzde sınırı ve "kalan kalori" hesabı doğru olmalı; hedef 0 iken NaN ya da
// sonsuz genişlikte bir ilerleme çubuğu çıkmamalı.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardHeader from '@/components/DashboardHeader'

const DATE = new Date(2026, 2, 15, 12, 0) // 15 Mart 2026, Pazar

/** İlerleme çubuğunun genişliği (stil değeri). */
function progressWidth(container: HTMLElement): string {
  return (container.querySelector('.bg-brand-500') as HTMLElement).style.width
}

describe('DashboardHeader', () => {
  it('tarihi Türkçe biçimde gösterir', () => {
    render(<DashboardHeader date={DATE} totalCalories={0} targetCalories={2000} />)
    expect(screen.getByText(/15 Mart 2026/)).toBeInTheDocument()
  })

  it('tüketilen ve hedef kaloriyi gösterir', () => {
    render(<DashboardHeader date={DATE} totalCalories={1250} targetCalories={2200} />)
    expect(screen.getByText('1.250')).toBeInTheDocument()
    expect(screen.getByText('/ 2.200 kcal')).toBeInTheDocument()
  })

  it('Türkçe binlik ayracı kullanır', () => {
    render(<DashboardHeader date={DATE} totalCalories={1000} targetCalories={2000} />)
    // tr-TR: 1.000 (nokta), 1,000 DEĞİL.
    expect(screen.getByText('1.000')).toBeInTheDocument()
  })

  it('kalan kaloriyi gösterir', () => {
    render(<DashboardHeader date={DATE} totalCalories={1200} targetCalories={2000} />)
    expect(screen.getByText('800 kcal kaldı')).toBeInTheDocument()
  })

  it('hedefe ulaşınca kutlama mesajı gösterir', () => {
    render(<DashboardHeader date={DATE} totalCalories={2000} targetCalories={2000} />)
    expect(screen.getByText('Günlük hedefe ulaştın 🎉')).toBeInTheDocument()
  })

  it('hedef aşıldığında da kutlama mesajı kalır', () => {
    render(<DashboardHeader date={DATE} totalCalories={2500} targetCalories={2000} />)
    expect(screen.getByText('Günlük hedefe ulaştın 🎉')).toBeInTheDocument()
  })

  describe('ilerleme çubuğu', () => {
    it('yüzdeyi doğru hesaplar', () => {
      const { container } = render(
        <DashboardHeader date={DATE} totalCalories={1000} targetCalories={2000} />
      )
      expect(progressWidth(container)).toBe('50%')
    })

    it('%100’ü aşmaz', () => {
      const { container } = render(
        <DashboardHeader date={DATE} totalCalories={5000} targetCalories={2000} />
      )
      expect(progressWidth(container)).toBe('100%')
    })

    it('hedef 0 iken NaN üretmez', () => {
      const { container } = render(
        <DashboardHeader date={DATE} totalCalories={500} targetCalories={0} />
      )
      expect(progressWidth(container)).toBe('0%')
      expect(container.textContent).not.toContain('NaN')
    })
  })

  describe('seri (streak) rozeti', () => {
    it('seri yokken gösterilmez', () => {
      render(<DashboardHeader date={DATE} totalCalories={0} targetCalories={2000} />)
      expect(screen.queryByText('günlük seri')).not.toBeInTheDocument()
    })

    it('seri 0 verildiğinde de gösterilmez', () => {
      render(<DashboardHeader date={DATE} totalCalories={0} targetCalories={2000} streak={0} />)
      expect(screen.queryByText('günlük seri')).not.toBeInTheDocument()
    })

    it('seri varken gün sayısını gösterir', () => {
      render(<DashboardHeader date={DATE} totalCalories={0} targetCalories={2000} streak={7} />)
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText('günlük seri')).toBeInTheDocument()
    })
  })

  it('ondalıklı kalori değerlerini yuvarlar', () => {
    render(<DashboardHeader date={DATE} totalCalories={1234.6} targetCalories={2000} />)
    expect(screen.getByText('1.235')).toBeInTheDocument()
  })
})
