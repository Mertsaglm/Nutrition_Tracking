import { createNutritionStore } from '@nutrition/core'
import type { StateStorage } from 'zustand/middleware'

// SSR-güvenli localStorage adaptörü (sunucuda window yok).
const webStorage: StateStorage = {
  getItem: (key) => (typeof window !== 'undefined' ? window.localStorage.getItem(key) : null),
  setItem: (key, value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key)
  },
}

export const useNutritionStore = createNutritionStore(webStorage)
