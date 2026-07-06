import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createSupabaseClient } from '@nutrition/core'
import { ENV } from './env'

export const supabase = createSupabaseClient({
  url: ENV.supabaseUrl,
  anonKey: ENV.supabaseAnonKey,
  storage: AsyncStorage,
  detectSessionInUrl: false,
})
