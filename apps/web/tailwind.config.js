const tokensPreset = require('@nutrition/tokens/tailwind-preset')

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [tokensPreset],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
}
