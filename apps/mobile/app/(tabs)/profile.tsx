import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { authService } from '../../lib/auth'
import { databaseService } from '../../lib/database-service'
import { notificationService } from '../../lib/notification-service'
import { THEME } from '../../lib/constants'

type Profile = {
  name: string | null
  email: string
  age: number | null
  gender: string | null
  height_cm: number | null
  current_weight_kg: number | null
  target_weight_kg: number | null
  goal: string | null
  activity_level: string | null
  meal_count: number
  dietary_preferences: string[] | null
  allergies: string[] | null
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Kilo Vermek',
  gain_weight: 'Kilo Almak',
  build_muscle: 'Kas Yapmak',
  maintain: 'Kiloyu Korumak',
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Hareketsiz',
  light: 'Hafif Aktif',
  moderate: 'Orta Aktif',
  active: 'Aktif',
  very_active: 'Çok Aktif',
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)

  useEffect(() => {
    loadProfile()
    checkNotificationStatus()
  }, [])

  const checkNotificationStatus = async () => {
    const count = await notificationService.getScheduledCount()
    setNotificationsEnabled(count > 0)
  }

  const handleNotificationToggle = async (value: boolean) => {
    setNotifLoading(true)
    try {
      if (value) {
        const granted = await notificationService.requestPermission()
        if (!granted) {
          Alert.alert('İzin Gerekli', 'Bildirimler için ayarlardan izin vermen gerekiyor.')
          setNotifLoading(false)
          return
        }
        await notificationService.scheduleAllMealReminders(profile?.meal_count || 3)
        await notificationService.sendTestNotification()
        setNotificationsEnabled(true)
        Alert.alert('Bildirimler Açıldı ✅', 'Her öğün saatinde hatırlatma alacaksın.')
      } else {
        await notificationService.cancelAllMealReminders()
        setNotificationsEnabled(false)
      }
    } catch (err) {
      Alert.alert('Hata', 'Bildirim ayarı değiştirilemedi.')
    } finally {
      setNotifLoading(false)
    }
  }

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [profileData, planData] = await Promise.all([
        authService.getUserProfile(user.id),
        databaseService.getActiveNutritionPlan(user.id),
      ])
      setProfile({ ...profileData, email: user.email! })
      setPlan(planData)
    } catch (error) {
      console.error('Profil yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert('Çıkış Yap', 'Hesabından çıkmak istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap', style: 'destructive',
        onPress: async () => {
          await authService.signOut()
          router.replace('/(auth)/login')
        }
      }
    ])
  }

  const handleResetOnboarding = () => {
    Alert.alert('Profili Güncelle', 'Bilgilerini yeniden girmek ister misin?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Evet', onPress: () => router.push('/onboarding') }
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const bmi = profile?.height_cm && profile?.current_weight_kg
    ? (profile.current_weight_kg / ((profile.height_cm / 100) ** 2)).toFixed(1)
    : null

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <Text style={styles.name}>{profile?.name || 'Kullanıcı'}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>

        {/* Beslenme Planı */}
        {plan && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Günlük Hedefin</Text>
            <View style={styles.planGrid}>
              <PlanStat value={plan.daily_calories} unit="kcal" label="Kalori" color={THEME.colors.accent} />
              <PlanStat value={plan.protein_g} unit="g" label="Protein" color={THEME.colors.protein} />
              <PlanStat value={plan.carbs_g} unit="g" label="Karb" color={THEME.colors.carbs} />
              <PlanStat value={plan.fat_g} unit="g" label="Yağ" color={THEME.colors.fat} />
            </View>
          </View>
        )}

        {/* Kişisel Bilgiler */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Kişisel Bilgiler</Text>
          <InfoRow icon="🎯" label="Hedef" value={GOAL_LABELS[profile?.goal || ''] || '-'} />
          <InfoRow icon="⚡" label="Aktivite" value={ACTIVITY_LABELS[profile?.activity_level || ''] || '-'} />
          <InfoRow icon="📏" label="Boy" value={profile?.height_cm ? `${profile.height_cm} cm` : '-'} />
          <InfoRow icon="⚖️" label="Mevcut Kilo" value={profile?.current_weight_kg ? `${profile.current_weight_kg} kg` : '-'} />
          <InfoRow icon="🏆" label="Hedef Kilo" value={profile?.target_weight_kg ? `${profile.target_weight_kg} kg` : '-'} />
          {bmi && <InfoRow icon="📊" label="BMI" value={bmi} />}
          <InfoRow icon="🍽️" label="Günlük Öğün" value={`${profile?.meal_count || 3} öğün`} />
          {(profile?.dietary_preferences?.length ?? 0) > 0 && (
            <InfoRow icon="🥗" label="Diyet" value={profile!.dietary_preferences!.join(', ')} />
          )}
          {(profile?.allergies?.length ?? 0) > 0 && (
            <InfoRow icon="⚠️" label="Alerjiler" value={profile!.allergies!.join(', ')} />
          )}
        </View>

        {/* Eylemler */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚙️ Ayarlar</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={handleResetOnboarding}>
            <Text style={styles.actionBtnIcon}>✏️</Text>
            <Text style={styles.actionBtnText}>Profili Güncelle</Text>
            <Text style={styles.actionBtnArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { marginTop: 4 }]} onPress={() => router.push('/food-search' as any)}>
            <Text style={styles.actionBtnIcon}>🔍</Text>
            <Text style={styles.actionBtnText}>Besin Veritabanı</Text>
            <Text style={styles.actionBtnArrow}>→</Text>
          </TouchableOpacity>
          <View style={[styles.actionBtn, { marginTop: 4 }]}>
            <Text style={styles.actionBtnIcon}>🔔</Text>
            <Text style={[styles.actionBtnText, { flex: 1 }]}>Öğün Hatırlatıcı</Text>
            {notifLoading
              ? <ActivityIndicator size="small" color={THEME.colors.primary} />
              : <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationToggle}
                  trackColor={{ false: THEME.colors.border, true: THEME.colors.primary }}
                  thumbColor="#fff"
                />
            }
          </View>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Çıkış Yap</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Beslenme Takip v1.0.0</Text>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function PlanStat({ value, unit, label, color }: { value: number; unit: string; label: string; color: string }) {
  return (
    <View style={pStyles.stat}>
      <Text style={[pStyles.statVal, { color }]}>{Math.round(value)}</Text>
      <Text style={pStyles.statUnit}>{unit}</Text>
      <Text style={pStyles.statLabel}>{label}</Text>
    </View>
  )
}

const pStyles = StyleSheet.create({
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '700' },
  statUnit: { fontSize: 11, color: THEME.colors.textMuted },
  statLabel: { fontSize: 11, color: THEME.colors.textSecondary, marginTop: 2 },
})

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={iStyles.row}>
      <Text style={iStyles.icon}>{icon}</Text>
      <Text style={iStyles.label}>{label}</Text>
      <Text style={iStyles.value}>{value}</Text>
    </View>
  )
}

const iStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  icon: { fontSize: 16, marginRight: 10, width: 24 },
  label: { flex: 1, fontSize: 14, color: THEME.colors.textSecondary },
  value: { fontSize: 14, color: THEME.colors.text, fontWeight: '500' },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', padding: 24, paddingBottom: 16 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${THEME.colors.primary}30`,
    borderWidth: 2, borderColor: THEME.colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: THEME.colors.primary },
  name: { fontSize: 22, fontWeight: '700', color: THEME.colors.text, marginBottom: 4 },
  email: { fontSize: 13, color: THEME.colors.textSecondary },
  card: {
    margin: 16, marginBottom: 8,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: THEME.colors.textSecondary, marginBottom: 14 },
  planGrid: { flexDirection: 'row' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  actionBtnIcon: { fontSize: 16, marginRight: 10 },
  actionBtnText: { flex: 1, fontSize: 14, color: THEME.colors.text },
  actionBtnArrow: { fontSize: 14, color: THEME.colors.textMuted },
  signOutBtn: {
    margin: 16, marginTop: 8,
    borderWidth: 1, borderColor: THEME.colors.danger + '50',
    borderRadius: 14, padding: 14, alignItems: 'center',
    backgroundColor: `${THEME.colors.danger}10`
  },
  signOutText: { color: THEME.colors.danger, fontSize: 15, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12, color: THEME.colors.textMuted, marginTop: 8 },
})
