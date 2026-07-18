import { createAINutritionClient } from '@nutrition/core'
import { supabase } from './supabase'

// Same-origin: web kendi Next.js API route'larını çağırır (baseUrl boş).
// AI route'ları artık kimlik doğrulaması istiyor; her istekte oturum token'ı gönderilir.
export const aiClient = createAINutritionClient({
  getAuthToken: async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  },
})
