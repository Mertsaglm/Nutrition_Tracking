import AsyncStorage from '@react-native-async-storage/async-storage'
import { createNutritionStore } from '@nutrition/core'
import type { StateStorage } from 'zustand/middleware'

// AsyncStorage zaten StateStorage arayüzüyle uyumlu (async getItem/setItem/removeItem).
export const useNutritionStore = createNutritionStore(AsyncStorage as StateStorage)
