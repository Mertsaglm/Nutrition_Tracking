// ============================================================================
// @nutrition/tokens — tek kaynak tasarım sistemi.
//
// Web (Tailwind preset) ve mobil (JS teması) AYNI palette.json'dan beslenir.
// Bir yerde sabit kodlanmış renk kullanılırsa ya da tema anahtarları ayrışırsa
// iki platform görsel olarak birbirinden kopar — bu derleme hatası vermez.
// ============================================================================
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  THEME,
  darkTheme,
  fontSize,
  fontWeight,
  lightTheme,
  macroColors,
  palette,
  radius,
  spacing,
  statusColors,
  type Theme,
} from '@nutrition/tokens'

// Tailwind preset CommonJS'tir; Node'un require'ı ile okunur.
const require_ = createRequire(import.meta.url)
const tailwindPreset = require_('../src/tailwind-preset.js') as {
  theme: { extend: { colors: Record<string, unknown>; fontFamily: unknown; borderRadius: unknown } }
}

const HEX = /^#[0-9a-f]{6}$/i

/** İç içe palet nesnesindeki tüm renkleri düzleştirir. */
function flattenColors(obj: Record<string, unknown>, prefix = ''): [string, string][] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value] as [string, string]]
      : flattenColors(value as Record<string, unknown>, `${prefix}${key}.`)
  )
}

describe('palette.json', () => {
  it('beklenen renk gruplarını içerir', () => {
    expect(Object.keys(palette).sort()).toEqual(['accent', 'brand', 'macro', 'neutral', 'status'])
  })

  it('tüm renkler geçerli 6 haneli hex kodudur', () => {
    for (const [name, value] of flattenColors(palette as unknown as Record<string, unknown>)) {
      expect(value, name).toMatch(HEX)
    }
  })

  it('brand ve accent skalaları 50–900 arası tam adımlıdır', () => {
    const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
    expect(Object.keys(palette.brand)).toEqual(steps)
    expect(Object.keys(palette.accent)).toEqual(steps)
  })

  it('neutral skalası 950 tonunu da içerir', () => {
    expect(Object.keys(palette.neutral)).toContain('950')
  })

  it('makro renkleri beş temel besin ögesini kapsar', () => {
    for (const key of ['protein', 'carbs', 'fat', 'fiber', 'water']) {
      expect(palette.macro, key).toHaveProperty(key)
    }
  })

  it('durum renkleri dört seviyeyi kapsar', () => {
    expect(Object.keys(palette.status).sort()).toEqual(['danger', 'info', 'success', 'warning'])
  })

  it('makro renkleri birbirinden ayırt edilebilir', () => {
    // Aynı renk iki makroya atanırsa grafikler okunamaz hale gelir.
    const values = Object.values(palette.macro)
    expect(new Set(values).size).toBeGreaterThanOrEqual(values.length - 1)
  })

  it('semantik kısayollar palete bağlıdır', () => {
    expect(macroColors).toBe(palette.macro)
    expect(statusColors).toBe(palette.status)
  })
})

describe('temalar', () => {
  const themes: [string, Theme][] = [
    ['darkTheme', darkTheme],
    ['lightTheme', lightTheme],
  ]

  it('iki tema da doğru modu bildirir', () => {
    expect(darkTheme.mode).toBe('dark')
    expect(lightTheme.mode).toBe('light')
  })

  it('iki tema AYNI renk anahtarlarına sahiptir', () => {
    // Ayrışırlarsa bir platformda `theme.colors.x` undefined olur ve stil bozulur.
    expect(Object.keys(darkTheme.colors).sort()).toEqual(Object.keys(lightTheme.colors).sort())
  })

  it('arayüzün ihtiyaç duyduğu tüm anahtarları içerir', () => {
    const required = [
      'bg',
      'bgCard',
      'bgCardAlt',
      'border',
      'primary',
      'primaryDark',
      'accent',
      'success',
      'warning',
      'danger',
      'text',
      'textSecondary',
      'textMuted',
      'protein',
      'carbs',
      'fat',
      'fiber',
      'water',
    ]
    for (const [name, theme] of themes) {
      expect(Object.keys(theme.colors).sort(), name).toEqual([...required].sort())
    }
  })

  it.each(themes)('%s içindeki tüm renkler geçerli hex kodudur', (name, theme) => {
    for (const [key, value] of Object.entries(theme.colors)) {
      expect(value, `${name}.${key}`).toMatch(HEX)
    }
  })

  it('makro renkleri iki temada da paletle aynıdır', () => {
    for (const [name, theme] of themes) {
      expect(theme.colors.protein, name).toBe(palette.macro.protein)
      expect(theme.colors.carbs, name).toBe(palette.macro.carbs)
      expect(theme.colors.fat, name).toBe(palette.macro.fat)
      expect(theme.colors.fiber, name).toBe(palette.macro.fiber)
      expect(theme.colors.water, name).toBe(palette.macro.water)
    }
  })

  it('durum renkleri iki temada da paletle aynıdır', () => {
    for (const [name, theme] of themes) {
      expect(theme.colors.success, name).toBe(palette.status.success)
      expect(theme.colors.warning, name).toBe(palette.status.warning)
      expect(theme.colors.danger, name).toBe(palette.status.danger)
    }
  })

  it('koyu tema arka planı, açık temadan koyudur', () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    expect(luminance(darkTheme.colors.bg)).toBeLessThan(luminance(lightTheme.colors.bg))
    expect(luminance(darkTheme.colors.text)).toBeGreaterThan(luminance(lightTheme.colors.text))
  })

  it('THEME kısayolu koyu temadır (mobil varsayılanı)', () => {
    expect(THEME).toBe(darkTheme)
  })
})

describe('ölçekler', () => {
  it('spacing değerleri artan sırada ve 4’ün katıdır', () => {
    const values = Object.values(spacing)
    expect(values).toEqual([...values].sort((a, b) => a - b))
    for (const value of values) {
      expect(value % 4, String(value)).toBe(0)
    }
  })

  it('radius değerleri artan sıradadır', () => {
    const values = [radius.sm, radius.md, radius.lg, radius.xl, radius['2xl']]
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(radius.full).toBeGreaterThan(radius['2xl'])
  })

  it('fontSize değerleri artan sıradadır', () => {
    const values = Object.values(fontSize)
    expect(values).toEqual([...values].sort((a, b) => a - b))
  })

  it('fontSize okunabilirlik sınırının üstündedir', () => {
    // 11 px altı mobilde okunamaz.
    for (const [key, value] of Object.entries(fontSize)) {
      expect(value, key).toBeGreaterThanOrEqual(11)
    }
  })

  it('fontWeight değerleri React Native uyumlu metinlerdir', () => {
    for (const [key, value] of Object.entries(fontWeight)) {
      expect(typeof value, key).toBe('string')
      expect(value, key).toMatch(/^[1-9]00$/)
    }
  })
})

describe('Tailwind preset (web)', () => {
  const colors = tailwindPreset.theme.extend.colors

  it('renk skalalarını doğrudan paletten alır', () => {
    expect(colors.brand).toEqual(palette.brand)
    expect(colors.accent).toEqual(palette.accent)
    expect(colors.neutral).toEqual(palette.neutral)
  })

  it('makro ve durum renklerini semantik adlarla açar', () => {
    expect(colors.protein).toBe(palette.macro.protein)
    expect(colors.carbs).toBe(palette.macro.carbs)
    expect(colors.fat).toBe(palette.macro.fat)
    expect(colors.fiber).toBe(palette.macro.fiber)
    expect(colors.water).toBe(palette.macro.water)
    expect(colors.success).toBe(palette.status.success)
    expect(colors.warning).toBe(palette.status.warning)
    expect(colors.danger).toBe(palette.status.danger)
    expect(colors.info).toBe(palette.status.info)
  })

  it('sabit kodlanmış hex değeri içermez', () => {
    // Renkler yalnızca palette.json’dan gelmeli.
    const source = require_('node:fs').readFileSync(
      new URL('../src/tailwind-preset.js', import.meta.url),
      'utf8'
    ) as string
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('animasyon ve yazı tipi tanımlarını sağlar', () => {
    expect(tailwindPreset.theme.extend.fontFamily).toHaveProperty('sans')
    expect(tailwindPreset.theme.extend.borderRadius).toHaveProperty('2xl')
  })
})
