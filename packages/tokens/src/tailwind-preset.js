// @nutrition/tokens — Tailwind preset. palette.json tek renk kaynağıdır.
const palette = require('./palette.json')

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: palette.brand,
        accent: palette.accent,
        neutral: palette.neutral,
        protein: palette.macro.protein,
        carbs: palette.macro.carbs,
        fat: palette.macro.fat,
        fiber: palette.macro.fiber,
        water: palette.macro.water,
        success: palette.status.success,
        warning: palette.status.warning,
        danger: palette.status.danger,
        info: palette.status.info,
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.35s ease-out',
      },
    },
  },
}
