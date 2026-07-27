// ============================================================================
// jsdom ortamı için test kurulumu (web-ui projesi).
// - jest-dom eşleştiricileri (toBeInTheDocument, toHaveTextContent, ...)
// - her testten sonra DOM temizliği
// ============================================================================
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom bu API'leri sağlamaz; bileşenler kullanırsa test çökmesin.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

if (!window.scrollTo) {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
}

// ----------------------------------------------------------------------------
// localStorage: bu jsdom kurulumunda `window.localStorage` işlevsiz bir nesne
// olarak geliyor. Web store'u (lib/store.ts) gerçek localStorage arayüzünü
// kullandığı için bellek içi, spesifikasyona uygun bir Storage yerleştiriyoruz.
// Böylece store MOCK'LANMADAN, gerçek adaptörüyle test edilebiliyor.
// ----------------------------------------------------------------------------
function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
  } as Storage
}

if (typeof window.localStorage?.setItem !== 'function') {
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  })
}
