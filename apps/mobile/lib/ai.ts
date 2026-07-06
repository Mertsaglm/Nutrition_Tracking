import { createAINutritionClient } from '@nutrition/core'
import { ENV } from './env'

// Mobil, web'in AI route'larını uzaktan çağırır (Gemini anahtarı sunucuda kalır).
export const aiClient = createAINutritionClient({ baseUrl: ENV.apiUrl })
