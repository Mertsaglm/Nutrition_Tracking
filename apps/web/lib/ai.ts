import { createAINutritionClient } from '@nutrition/core'

// Same-origin: web kendi Next.js API route'larını çağırır (baseUrl boş).
export const aiClient = createAINutritionClient()
