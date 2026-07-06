import { createAuthService, createDatabaseService } from '@nutrition/core'
import { supabase } from './supabase'

export const authService = createAuthService(supabase)
export const databaseService = createDatabaseService(supabase)
