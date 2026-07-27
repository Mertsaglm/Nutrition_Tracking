// ============================================================================
// components/ErrorBoundary.tsx — beyaz ekrana karşı son savunma hattı.
//
// Bir alt bileşen render sırasında hata fırlatırsa React tüm ağacı söker ve
// kullanıcı boş beyaz sayfa görür. Bu sınır, bunun yerine anlaşılır bir hata
// kartı ve kurtarma yolu gösterir.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

/** İstendiğinde render sırasında patlayan bileşen. */
function Boom({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error('bileşen patladı')
  return <p>sorunsuz içerik</p>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React ve bileşen hata log'lar; test çıktısını kirletmesin.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hata yokken çocukları normal render eder', () => {
    render(
      <ErrorBoundary>
        <p>sorunsuz içerik</p>
      </ErrorBoundary>
    )

    expect(screen.getByText('sorunsuz içerik')).toBeInTheDocument()
  })

  it('hata olduğunda kullanıcı dostu bir kart gösterir', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    expect(screen.getByText('Bir Hata Oluştu')).toBeInTheDocument()
    expect(screen.getByText(/beklenmedik bir hatayla karşılaştı/i)).toBeInTheDocument()
  })

  it('kurtarma seçenekleri sunar', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    expect(screen.getByRole('button', { name: /Tekrar Dene/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sayfayı Yenile/ })).toBeInTheDocument()
  })

  it('özel fallback verildiyse onu gösterir', () => {
    render(
      <ErrorBoundary fallback={<p>özel hata ekranı</p>}>
        <Boom />
      </ErrorBoundary>
    )

    expect(screen.getByText('özel hata ekranı')).toBeInTheDocument()
    expect(screen.queryByText('Bir Hata Oluştu')).not.toBeInTheDocument()
  })

  it('hatayı konsola bildirir (izlenebilirlik)', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    expect(console.error).toHaveBeenCalledWith(
      'ErrorBoundary caught an error:',
      expect.any(Error),
      expect.anything()
    )
  })

  it('"Tekrar Dene" durumu sıfırlar ve çocukları yeniden dener', () => {
    function Recoverable() {
      return <p>düzeldi</p>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.getByText('Bir Hata Oluştu')).toBeInTheDocument()

    // Hata kaynağı giderildikten sonra kullanıcı "Tekrar Dene" der.
    rerender(
      <ErrorBoundary>
        <Recoverable />
      </ErrorBoundary>
    )
    screen.getByRole('button', { name: /Tekrar Dene/ }).click()

    rerender(
      <ErrorBoundary>
        <Recoverable />
      </ErrorBoundary>
    )
    expect(screen.getByText('düzeldi')).toBeInTheDocument()
  })

  it('hata mesajını üretim kullanıcısına ham haliyle basmaz', () => {
    // NODE_ENV test ortamında "development" değildir; detay bloğu gizlidir.
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    expect(screen.queryByText('bileşen patladı')).not.toBeInTheDocument()
    expect(screen.queryByText(/Hata Detayları/)).not.toBeInTheDocument()
  })

  it('geliştirme modunda hata detaylarını gösterir', () => {
    vi.stubEnv('NODE_ENV', 'development')
    try {
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      )

      expect(screen.getByText(/Hata Detayları/)).toBeInTheDocument()
      // Mesaj hem "Hata:" satırında hem de stack içinde geçer.
      expect(screen.getAllByText(/bileşen patladı/).length).toBeGreaterThan(0)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
