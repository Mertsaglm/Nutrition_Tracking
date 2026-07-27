// ============================================================================
// components/ui/Toast.tsx — kullanıcı geri bildirim sistemi.
//
// Uygulamadaki TÜM hata ve başarı mesajları buradan geçer. Provider kalkarsa
// ya da otomatik kapanma bozulursa kullanıcı ya hiç geri bildirim almaz ya da
// ekran mesajlarla dolar.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/ui/Toast'

/** Butonlara basınca toast tetikleyen yardımcı bileşen. */
function Trigger() {
  const { toast } = useToast()
  return (
    <div>
      <button onClick={() => toast('success', 'Kaydedildi')}>başarı</button>
      <button onClick={() => toast('error', 'Bir hata oluştu')}>hata</button>
      <button onClick={() => toast('warning', 'Dikkat et')}>uyarı</button>
      <button onClick={() => toast('info', 'Bilgilendirme')}>bilgi</button>
    </div>
  )
}

function click(name: string) {
  act(() => {
    screen.getByRole('button', { name }).click()
  })
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('çocuk bileşenleri normal şekilde render eder', () => {
    render(
      <ToastProvider>
        <p>içerik</p>
      </ToastProvider>
    )
    expect(screen.getByText('içerik')).toBeInTheDocument()
  })

  it('başlangıçta hiç mesaj göstermez', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each([
    ['başarı', 'Kaydedildi'],
    ['hata', 'Bir hata oluştu'],
    ['uyarı', 'Dikkat et'],
    ['bilgi', 'Bilgilendirme'],
  ])('%s mesajını gösterir', (button, message) => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    )

    click(button)
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it('mesajları ekran okuyucular için role="status" ile sunar', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    )

    click('başarı')
    expect(screen.getByRole('status')).toHaveTextContent('Kaydedildi')
  })

  it('birden fazla mesajı aynı anda gösterir', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    )

    click('başarı')
    click('hata')

    expect(screen.getAllByRole('status')).toHaveLength(2)
  })

  it('4 saniye sonra mesajı otomatik kapatır', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    )

    click('başarı')
    expect(screen.getByText('Kaydedildi')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3_999)
    })
    expect(screen.getByText('Kaydedildi')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(screen.queryByText('Kaydedildi')).not.toBeInTheDocument()
  })

  it('her mesaj kendi süresine göre kapanır', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    )

    click('başarı')
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    click('hata')

    act(() => {
      vi.advanceTimersByTime(2_100)
    })
    // İlk mesaj kapandı, ikincisi hâlâ ekranda.
    expect(screen.queryByText('Kaydedildi')).not.toBeInTheDocument()
    expect(screen.getByText('Bir hata oluştu')).toBeInTheDocument()
  })

  it('mesaj türüne göre farklı stil uygular', () => {
    const { container } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    )

    click('başarı')
    expect(container.innerHTML).toContain('border-l-brand-500')

    click('hata')
    expect(container.innerHTML).toContain('border-l-danger')
  })
})

describe('useToast (provider dışında)', () => {
  it('provider olmadan da çökmez (no-op)', () => {
    // Bazı bileşenler test/izole render'da provider'sız kullanılabilir.
    expect(() =>
      render(
        <div>
          <Trigger />
        </div>
      )
    ).not.toThrow()

    expect(() => screen.getByRole('button', { name: 'başarı' }).click()).not.toThrow()
  })
})
