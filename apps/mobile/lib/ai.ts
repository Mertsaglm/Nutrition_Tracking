import { createAINutritionClient } from '@nutrition/core'
import { ENV } from './env'
import { supabase } from './supabase'

// Mobil, web'in AI route'larını uzaktan çağırır (Gemini anahtarı sunucuda kalır).
// AI route'ları kimlik doğrulaması istiyor; her istekte oturum token'ı gönderilir.
export const aiClient = createAINutritionClient({
  baseUrl: ENV.apiUrl,
  getAuthToken: async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  },
})
