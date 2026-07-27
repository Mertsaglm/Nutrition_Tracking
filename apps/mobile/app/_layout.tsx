import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { View, ActivityIndicator, LogBox } from 'react-native'
import { THEME } from '@nutrition/tokens'

// expo-notifications, SDK 53+ ile Expo Go'da UZAK push desteğini kaldırdı ve her
// açılışta kırmızı LogBox uyarısı basıyor. Yerel öğün hatırlatmaları Expo Go'da
// çalışmaya devam ediyor; bu bilinen uyarıyı sadece dev overlay'inde gizliyoruz.
// (Gerçek push için Expo Go yerine development build gerekir.)
LogBox.ignoreLogs([/expo-notifications.*(Expo Go|development build)/])

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.colors.bg }}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen
          name="food-search"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  )
}
