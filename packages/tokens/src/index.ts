// ============================================================================
// @nutrition/tokens — tek kaynak tasarım sistemi (web + mobil aynı marka)
// palette.json ham renk kaynağıdır; Tailwind preset de aynı dosyayı kullanır.
// ============================================================================
import palette from './palette.json'

export { palette }

/** Semantik makro renkleri (iki platformda aynı). */
export const macroColors = palette.macro
export const statusColors = palette.status

/** Boşluk skalası (px). */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const

/** Köşe yarıçapları (px). */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const

/** Font boyutları (px). */
export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 38,
} as const

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const

/** Uygulama boyunca kullanılan semantik tema tipi. */
export interface Theme {
  mode: 'light' | 'dark'
  colors: {
    bg: string
    bgCard: string
    bgCardAlt: string
    border: string
    primary: string
    primaryDark: string
    accent: string
    success: string
    warning: string
    danger: string
    text: string
    textSecondary: string
    textMuted: string
    protein: string
    carbs: string
    fat: string
    fiber: string
    water: string
  }
}

/** Mobil varsayılanı: koyu tema (native his). */
export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    bg: '#0b1220',
    bgCard: '#131c2b',
    bgCardAlt: '#1a2436',
    border: '#26324a',
    primary: palette.brand[500],
    primaryDark: palette.brand[600],
    accent: palette.accent[500],
    success: palette.status.success,
    warning: palette.status.warning,
    danger: palette.status.danger,
    text: '#e8edf4',
    textSecondary: palette.neutral[400],
    textMuted: palette.neutral[500],
    protein: palette.macro.protein,
    carbs: palette.macro.carbs,
    fat: palette.macro.fat,
    fiber: palette.macro.fiber,
    water: palette.macro.water,
  },
}

/** Web varsayılanı: aydınlık tema (geniş dashboard hissi). */
export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    bg: palette.neutral[50],
    bgCard: '#ffffff',
    bgCardAlt: palette.neutral[100],
    border: palette.neutral[200],
    primary: palette.brand[600],
    primaryDark: palette.brand[700],
    accent: palette.accent[500],
    success: palette.status.success,
    warning: palette.status.warning,
    danger: palette.status.danger,
    text: palette.neutral[900],
    textSecondary: palette.neutral[500],
    textMuted: palette.neutral[400],
    protein: palette.macro.protein,
    carbs: palette.macro.carbs,
    fat: palette.macro.fat,
    fiber: palette.macro.fiber,
    water: palette.macro.water,
  },
}

/** Mobil kısayolu (koyu tema). */
export const THEME = darkTheme
