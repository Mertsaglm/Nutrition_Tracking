import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert
} from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { databaseService } from '../../lib/services'
import { authService } from '../../lib/services'
import { useNutritionStore } from '../../lib/store'
import { THEME } from '@nutrition/tokens'
import { MealEntry, recommendFiber, recommendWaterLiters, toLocalDateStr } from '@nutrition/core'
import { AnimatedCalorieBar, AnimatedProgressBar } from '../../components/AnimatedProgressBar'
import { FadeInView } from '../../components/FadeInView'

function MacroRing({ value, max, color, label, unit = 'g' }: {
  value: number; max: number; color: string; label: string; unit?: string
}) {
  const remaining = Math.max(0, max - value)
  return (
    <View style={styles.macroCard}>
      <AnimatedProgressBar value={value} max={max} color={color} height={4} />
      <View style={{ height: 8 }} />
      <Text style={[styles.macroValue, { color }]}>{Math.round(value)}{unit}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroRemaining}>{Math.round(remaining)}{unit} kaldı</Text>
    </View>
  )
}

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userName, setUserName] = useState('')
  const [streak, setStreak] = useState(0)
  const [nutritionTarget, setNutritionTarget] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [extraTargets, setExtraTargets] = useState({ fiber: 25, water: 2.5 })
  const { dailyProgress, initializeDay, setDailyTargets, setMeals, deleteMealEntry, setFiberWaterTargets } = useNutritionStore()

  const today = toLocalDateStr()

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const profile = await authService.getUserProfile(user.id)
      setUserName(profile?.name || 'Kullanıcı')

      const plan = await databaseService.getActiveNutritionPlan(user.id)
      const targets = plan
        ? { calories: plan.daily_calories, protein: plan.protein_g, carbs: plan.carbs_g, fat: plan.fat_g }
        : { calories: 2000, protein: 150, carbs: 250, fat: 67 }

      const fiber = plan?.fiber_g || recommendFiber(targets.calories)
      const water = profile?.current_weight_kg ? recommendWaterLiters(profile.current_weight_kg) : 2.5
      setExtraTargets({ fiber, water })
      setFiberWaterTargets(fiber, water)

      setNutritionTarget(targets)
      initializeDay(today)
      setDailyTargets(targets)

      const logs = await databaseService.getMealLogs(user.id, today)
      if (logs) {
        const meals: MealEntry[] = logs.map((log: any) => ({
          id: log.id,
          mealType: log.meal_type,
          description: log.description || '',
          foods: log.food_items || [],
          totalNutrition: {
            calories: log.total_calories || 0,
            protein: log.total_protein_g || 0,
            carbs: log.total_carbs_g || 0,
            fat: log.total_fat_g || 0,
          },
          timestamp: new Date(log.created_at),
          aiAnalysis: log.ai_analysis,
          suggestions: log.ai_suggestions,
        }))
        setMeals(meals)
      }

      // Streak hesapla
      const streakData = await databaseService.getCurrentStreak(user.id)
      setStreak(streakData)
    } catch (error) {
      console.error('Dashboard yükleme hatası:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const onRefresh = () => { setRefreshing(true); load() }

  const handleDeleteMeal = (meal: MealEntry) => {
    Alert.alert(
      'Öğünü Sil',
      `"${meal.mealType}" öğününü silmek istiyor musun?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.deleteMealLog(meal.id)
              deleteMealEntry(meal.id)
            } catch {
              Alert.alert('Hata', 'Öğün silinirken bir sorun oluştu.')
            }
          }
        }
      ]
    )
  }

  const consumed = dailyProgress?.consumed || { calories: 0, protein: 0, carbs: 0, fat: 0 }
  const caloriePct = nutritionTarget.calories > 0 ? Math.min(consumed.calories / nutritionTarget.calories, 1) : 0
  const calorieRemaining = Math.max(0, nutritionTarget.calories - consumed.calories)

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Merhaba, {userName.split(' ')[0]} 👋</Text>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {streak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 {streak}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(tabs)/log')}>
              <Text style={styles.addBtnText}>+ Öğün</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Kalori Kartı */}
        <FadeInView delay={100} slideUp>
        <View style={styles.calorieCard}>
          <View style={styles.calorieTop}>
            <View>
              <Text style={styles.calorieLabel}>Günlük Kalori</Text>
              <View style={styles.calorieRow}>
                <Text style={styles.calorieConsumed}>{Math.round(consumed.calories)}</Text>
                <Text style={styles.calorieOf}> / {nutritionTarget.calories}</Text>
                <Text style={styles.calorieUnit}> kcal</Text>
              </View>
            </View>
            <View style={styles.calorieCircle}>
              <Text style={styles.calorieCirclePct}>{Math.round(caloriePct * 100)}%</Text>
            </View>
          </View>

          {/* Progress bar */}
          <AnimatedCalorieBar consumed={consumed.calories} target={nutritionTarget.calories} />

          <Text style={styles.calorieRemaining}>
            {calorieRemaining > 0 ? `${Math.round(calorieRemaining)} kcal kaldı` : 'Günlük hedefe ulaştın! 🎉'}
          </Text>
        </View>
        </FadeInView>

        {/* Makrolar */}
        <FadeInView delay={200} slideUp>
        <Text style={styles.sectionTitle}>Makrolar</Text>
        <View style={styles.macroGrid}>
          <MacroRing value={consumed.protein} max={nutritionTarget.protein} color={THEME.colors.protein} label="Protein" />
          <MacroRing value={consumed.carbs} max={nutritionTarget.carbs} color={THEME.colors.carbs} label="Karb" />
          <MacroRing value={consumed.fat} max={nutritionTarget.fat} color={THEME.colors.fat} label="Yağ" />
        </View>
        </FadeInView>

        {/* Lif & Su */}
        <View style={styles.extraRow}>
          <View style={styles.extraCard}>
            <Text style={styles.extraEmoji}>🌿</Text>
            <View style={styles.extraInfo}>
              <Text style={styles.extraLabel}>Lif Hedefi</Text>
              <Text style={styles.extraValue}>{extraTargets.fiber}g / gün</Text>
            </View>
            <View style={[styles.extraDot, { backgroundColor: THEME.colors.fiber }]} />
          </View>
          <View style={styles.extraCard}>
            <Text style={styles.extraEmoji}>💧</Text>
            <View style={styles.extraInfo}>
              <Text style={styles.extraLabel}>Su Hedefi</Text>
              <Text style={styles.extraValue}>{extraTargets.water}L / gün</Text>
            </View>
            <View style={[styles.extraDot, { backgroundColor: THEME.colors.water }]} />
          </View>
        </View>

        {/* Öğünler */}
        <View style={styles.mealsHeader}>
          <Text style={styles.sectionTitle}>Bugünkü Öğünler</Text>
          <Text style={styles.mealCount}>{dailyProgress?.meals.length || 0} öğün</Text>
        </View>

        {dailyProgress?.meals.length === 0 ? (
          <TouchableOpacity style={styles.emptyMeals} onPress={() => router.push('/(tabs)/log')}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyText}>Henüz öğün eklemedin</Text>
            <Text style={styles.emptySubtext}>İlk öğününü ekle →</Text>
          </TouchableOpacity>
        ) : (
          dailyProgress?.meals.map((meal) => (
            <View key={meal.id} style={styles.mealCard}>
              <View style={styles.mealCardLeft}>
                <View style={styles.mealTypeBadge}>
                  <Text style={styles.mealTypeText}>{meal.mealType}</Text>
                </View>
                <Text style={styles.mealDesc} numberOfLines={1}>{meal.description}</Text>
                <View style={styles.mealMacros}>
                  <Text style={styles.mealMacroChip}>P {Math.round(meal.totalNutrition.protein)}g</Text>
                  <Text style={styles.mealMacroChip}>K {Math.round(meal.totalNutrition.carbs)}g</Text>
                  <Text style={styles.mealMacroChip}>Y {Math.round(meal.totalNutrition.fat)}g</Text>
                </View>
              </View>
              <View style={styles.mealCardRight}>
                <Text style={styles.mealCalories}>{Math.round(meal.totalNutrition.calories)}</Text>
                <Text style={styles.mealCaloriesUnit}>kcal</Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteMeal(meal)}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  greeting: { fontSize: 22, fontWeight: '700', color: THEME.colors.text },
  dateText: { fontSize: 13, color: THEME.colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakBadge: {
    backgroundColor: '#f3750a20',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#f3750a40'
  },
  streakText: { color: THEME.colors.accent, fontWeight: '700', fontSize: 14 },
  addBtn: { backgroundColor: THEME.colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  calorieCard: {
    margin: 16, marginTop: 4,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  calorieTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  calorieLabel: { fontSize: 12, color: THEME.colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  calorieRow: { flexDirection: 'row', alignItems: 'baseline' },
  calorieConsumed: { fontSize: 32, fontWeight: '700', color: THEME.colors.text },
  calorieOf: { fontSize: 18, color: THEME.colors.textSecondary },
  calorieUnit: { fontSize: 14, color: THEME.colors.textMuted },
  calorieCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: `${THEME.colors.primary}20`,
    borderWidth: 2, borderColor: THEME.colors.primary,
    justifyContent: 'center', alignItems: 'center'
  },
  calorieCirclePct: { color: THEME.colors.primary, fontWeight: '700', fontSize: 13 },
  calorieRemaining: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 8 },

  sectionTitle: { fontSize: 17, fontWeight: '600', color: THEME.colors.text, paddingHorizontal: 16, marginBottom: 12, marginTop: 4 },
  macroGrid: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 20 },
  macroCard: {
    flex: 1, backgroundColor: THEME.colors.bgCard,
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  macroValue: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  macroLabel: { fontSize: 11, color: THEME.colors.textSecondary, fontWeight: '500' },
  macroRemaining: { fontSize: 10, color: THEME.colors.textMuted, marginTop: 2 },

  extraRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 20 },
  extraCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  extraEmoji: { fontSize: 22 },
  extraInfo: { flex: 1 },
  extraLabel: { fontSize: 11, color: THEME.colors.textMuted },
  extraValue: { fontSize: 13, fontWeight: '600', color: THEME.colors.text, marginTop: 2 },
  extraDot: { width: 8, height: 8, borderRadius: 4 },
  mealsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  mealCount: { fontSize: 13, color: THEME.colors.textSecondary },

  emptyMeals: {
    margin: 16, backgroundColor: THEME.colors.bgCard,
    borderRadius: 16, padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: THEME.colors.border, borderStyle: 'dashed'
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: THEME.colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: THEME.colors.primary },

  mealCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  mealCardLeft: { flex: 1, marginRight: 12 },
  mealTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${THEME.colors.primary}20`,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4
  },
  mealTypeText: { color: THEME.colors.primary, fontSize: 11, fontWeight: '600' },
  mealDesc: { fontSize: 13, color: THEME.colors.textSecondary, marginBottom: 6 },
  mealMacros: { flexDirection: 'row', gap: 6 },
  mealMacroChip: { fontSize: 11, color: THEME.colors.textMuted },
  mealCardRight: { alignItems: 'flex-end' },
  mealCalories: { fontSize: 20, fontWeight: '700', color: THEME.colors.text },
  mealCaloriesUnit: { fontSize: 11, color: THEME.colors.textMuted, marginBottom: 6 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: `${THEME.colors.danger}20`,
    borderWidth: 1, borderColor: `${THEME.colors.danger}40`,
    justifyContent: 'center', alignItems: 'center'
  },
  deleteBtnText: { color: THEME.colors.danger, fontSize: 12, fontWeight: '700' },
})
