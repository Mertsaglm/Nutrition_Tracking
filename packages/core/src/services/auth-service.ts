// ============================================================================
// Auth servisi — Supabase Auth sarmalayıcı (platformdan bağımsız)
// ============================================================================
import type { TypedSupabaseClient } from '../supabase/client'
import type { Database, UserProfile } from '../supabase/database.types'

type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']

export interface SignUpData {
  email: string
  password: string
  name: string
}

export interface SignInData {
  email: string
  password: string
}

export function createAuthService(supabase: TypedSupabaseClient) {
  return {
    /**
     * Kayıt. Profil oluşturmayı DB trigger'ına (on_auth_user_created) bırakır —
     * eski koddaki kırılgan setTimeout + manuel insert kaldırıldı.
     */
    async signUp({ email, password, name }: SignUpData) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (error) throw error
      return data
    },

    async signIn({ email, password }: SignInData) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data
    },

    async signOut() {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },

    async getSession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()
      if (error) throw error
      return session
    },

    async getCurrentUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (error) throw error
      return user
    },

    async getUserProfile(userId: string): Promise<UserProfile> {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      return data
    },

    async updateUserProfile(
      userId: string,
      updates: UserProfileUpdate
    ): Promise<UserProfile> {
      // updated_at, DB trigger'ı (update_user_profiles_updated_at) tarafından set edilir.
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()
      if (error) throw error
      return data
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
