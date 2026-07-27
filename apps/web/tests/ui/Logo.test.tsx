// ============================================================================
// components/ui/Logo.tsx — marka işareti.
// Küçük ama her sayfada görünür; `withText` seçeneği dar alanlarda kullanılır.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Logo } from '@/components/ui/Logo'

describe('Logo', () => {
  it('varsayılan olarak uygulama adını gösterir', () => {
    render(<Logo />)
    expect(screen.getByText('Beslenme Takip')).toBeInTheDocument()
  })

  it('withText=false ile yalnızca simgeyi gösterir', () => {
    render(<Logo withText={false} />)
    expect(screen.queryByText('Beslenme Takip')).not.toBeInTheDocument()
  })

  it('marka rengini tasarım sisteminden alır', () => {
    const { container } = render(<Logo />)
    expect(container.innerHTML).toContain('bg-brand-600')
  })
})
