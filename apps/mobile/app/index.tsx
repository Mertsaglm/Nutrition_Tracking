import { useEffect } from 'react'
import { Redirect } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { THEME } from '../lib/constants'

export default function Index() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setIsLoggedIn(false)
        return
      }

      // Profil kontrolü (onboarding tamamlandı mı?)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('goal, height_cm, current_weight_kg')
        .eq('id', session.user.id)
        .single()

      setIsLoggedIn(true)
      setHasProfile(!!(profile?.goal && profile?.height_cm && profile?.current_weight_kg))
    } catch {
      setIsLoggedIn(false)
    }
  }

  if (isLoggedIn === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.colors.bg }}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    )
  }

  if (!isLoggedIn) return <Redirect href="/(auth)/login" />
  if (!hasProfile) return <Redirect href="/onboarding" />
  return <Redirect href="/(tabs)" />
}
