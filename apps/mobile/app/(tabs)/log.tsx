import { useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { aiClient } from '../../lib/ai'
import { databaseService } from '../../lib/services'
import { useNutritionStore } from '../../lib/store'
import { THEME } from '@nutrition/tokens'
import { MEAL_TYPES as MEAL_TYPE_CONFIG, type MealAnalysisResult, type MealEntry } from '@nutrition/core'

const MEAL_TYPES = Object.keys(MEAL_TYPE_CONFIG) as string[]

type RecentMeal = {
  id: string
  meal_type: string
  description: string
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  food_items: any[]
  created_at: string
}

export default function LogScreen() {
  const [description, setDescription] = useState('')
  const [selectedMeal, setSelectedMeal] = useState(MEAL_TYPES[0])
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<MealAnalysisResult | null>(null)
  const [recentMeals, setRecentMeals] = useState<RecentMeal[]>([])
  const [quickSaving, setQuickSaving] = useState<string | null>(null)
  const { dailyProgress, addMealEntry } = useNutritionStore()

  const loadRecentMeals = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const recent = await databaseService.getRecentMeals(user.id, 5)
      setRecentMeals((recent || []) as RecentMeal[])
    } catch (err) {
      console.error('Son öğünler yüklenemedi:', err)
    }
  }, [])

  useFocusEffect(useCallback(() => {
    loadRecentMeals()
  }, []))

  const handleAnalyze = async () => {
    if (!description.trim() || description.length < 3) {
      Alert.alert('Uyarı', 'Lütfen yediğin yiyecekleri yaz (en az 3 karakter).')
      return
    }
    setAnalyzing(true)
    setResult(null)
    try {
      const targetCalories = dailyProgress?.target.calories || 2000
      const analysis = await aiClient.analyzeMeal(description, selectedMeal, targetCalories)
      setResult(analysis)
    } catch (error: any) {
      Alert.alert('Analiz Hatası', error.message || 'AI analizi yapılamadı.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Giriş yapman gerekiyor')

      const mealEntry: MealEntry = {
        id: Date.now().toString(),
        mealType: selectedMeal,
        description,
        foods: result.foods,
        totalNutrition: result.totalNutrition,
        timestamp: new Date(),
        aiAnalysis: result.analysis,
        suggestions: result.suggestions,
      }

      await databaseService.saveMealLog(user.id, mealEntry)
      addMealEntry(mealEntry)

      setDescription('')
      setResult(null)
      loadRecentMeals()
      Alert.alert('Kaydedildi! ✅', `${selectedMeal} öğünün kaydedildi.`, [
        { text: 'Ana Sayfa', onPress: () => router.push('/(tabs)') },
        { text: 'Devam Et' },
      ])
    } catch (error: any) {
      Alert.alert('Kayıt Hatası', error.message || 'Öğün kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const handleQuickAdd = async (recent: RecentMeal) => {
    setQuickSaving(recent.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Giriş yapman gerekiyor')

      const mealEntry: MealEntry = {
        id: Date.now().toString(),
        mealType: recent.meal_type,
        description: recent.description,
        foods: recent.food_items || [],
        totalNutrition: {
          calories: recent.total_calories,
          protein: recent.total_protein_g,
          carbs: recent.total_carbs_g,
          fat: recent.total_fat_g,
        },
        timestamp: new Date(),
        aiAnalysis: undefined,
        suggestions: undefined,
      }

      await databaseService.saveMealLog(user.id, mealEntry)
      addMealEntry(mealEntry)
      loadRecentMeals()
      Alert.alert('Eklendi! ✅', `${recent.meal_type} öğünü tekrar eklendi.`, [
        { text: 'Ana Sayfa', onPress: () => router.push('/(tabs)') },
        { text: 'Tamam' },
      ])
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Öğün eklenemedi.')
    } finally {
      setQuickSaving(null)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Öğün Ekle</Text>
            <Text style={styles.subtitle}>Ne yedin? AI analiz etsin</Text>
          </View>

          {/* Hızlı Ekle - Son Öğünler */}
          {recentMeals.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionLabel}>⚡ Hızlı Ekle</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.recentRow}>
                  {recentMeals.map((meal) => (
                    <TouchableOpacity
                      key={meal.id}
                      style={styles.recentCard}
                      onPress={() => handleQuickAdd(meal)}
                      disabled={quickSaving === meal.id}
                    >
                      {quickSaving === meal.id ? (
                        <ActivityIndicator size="small" color={THEME.colors.primary} />
                      ) : (
                        <>
                          <View style={styles.recentBadge}>
                            <Text style={styles.recentBadgeText}>{meal.meal_type}</Text>
                          </View>
                          <Text style={styles.recentDesc} numberOfLines={2}>{meal.description}</Text>
                          <View style={styles.recentMacros}>
                            <Text style={styles.recentCal}>{Math.round(meal.total_calories)} kcal</Text>
                            <Text style={styles.recentP}>P {Math.round(meal.total_protein_g)}g</Text>
                          </View>
                          <View style={styles.recentAddBtn}>
                            <Text style={styles.recentAddBtnText}>+ Tekrar Ekle</Text>
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Öğün Tipi Seçimi */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Öğün Türü</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.mealTypeRow}>
                {MEAL_TYPES.map((mt) => (
                  <TouchableOpacity
                    key={mt}
                    style={[styles.mealTypeChip, selectedMeal === mt && styles.mealTypeChipActive]}
                    onPress={() => setSelectedMeal(mt)}
                  >
                    <Text style={[styles.mealTypeChipText, selectedMeal === mt && styles.mealTypeChipTextActive]}>{mt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Yemek Açıklaması */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Ne yedin?</Text>
            <TextInput
              style={styles.textarea}
              placeholder="Örnek: 2 yumurta, 1 dilim tam buğday ekmeği, bir bardak süt..."
              placeholderTextColor={THEME.colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.hint}>💡 Ne kadar detaylı yazarsan o kadar doğru analiz</Text>
          </View>

          {/* Analiz Butonu */}
          <TouchableOpacity
            style={[styles.analyzeBtn, (!description.trim() || analyzing) && styles.analyzeBtnDisabled]}
            onPress={handleAnalyze}
            disabled={!description.trim() || analyzing}
          >
            {analyzing ? (
              <View style={styles.btnContent}>
                <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                <Text style={styles.analyzeBtnText}>AI Analiz Ediyor...</Text>
              </View>
            ) : (
              <Text style={styles.analyzeBtnText}>🤖 AI ile Analiz Et</Text>
            )}
          </TouchableOpacity>

          {/* Analiz Sonucu */}
          {result && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Analiz Sonucu</Text>

              <View style={styles.nutritionGrid}>
                <NutritionBox label="Kalori" value={Math.round(result.totalNutrition.calories)} unit="kcal" color={THEME.colors.accent} />
                <NutritionBox label="Protein" value={Math.round(result.totalNutrition.protein)} unit="g" color={THEME.colors.protein} />
                <NutritionBox label="Karb" value={Math.round(result.totalNutrition.carbs)} unit="g" color={THEME.colors.carbs} />
                <NutritionBox label="Yağ" value={Math.round(result.totalNutrition.fat)} unit="g" color={THEME.colors.fat} />
              </View>

              {result.foods.length > 0 && (
                <View style={styles.foodList}>
                  <Text style={styles.foodListTitle}>Tespit Edilenler:</Text>
                  {result.foods.map((food, i) => (
                    <View key={i} style={styles.foodItem}>
                      <Text style={styles.foodName}>{food.name}</Text>
                      <Text style={styles.foodAmount}>{food.amount} {food.unit} · {Math.round(food.nutrition.calories)} kcal</Text>
                    </View>
                  ))}
                </View>
              )}

              {result.analysis && (
                <View style={styles.analysisBox}>
                  <Text style={styles.analysisTitle}>💬 AI Yorumu</Text>
                  <Text style={styles.analysisText}>{result.analysis}</Text>
                </View>
              )}

              {result.suggestions && (
                <View style={styles.suggestionBox}>
                  <Text style={styles.suggestionTitle}>💡 Öneri</Text>
                  <Text style={styles.suggestionText}>{result.suggestions}</Text>
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>✓ Öğünü Kaydet</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.retryBtn} onPress={() => setResult(null)}>
                <Text style={styles.retryBtnText}>Yeniden Analiz Et</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function NutritionBox({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={[nStyles.box, { borderColor: color + '40' }]}>
      <Text style={[nStyles.value, { color }]}>{value}</Text>
      <Text style={nStyles.unit}>{unit}</Text>
      <Text style={nStyles.label}>{label}</Text>
    </View>
  )
}

const nStyles = StyleSheet.create({
  box: {
    flex: 1, alignItems: 'center', padding: 12,
    backgroundColor: THEME.colors.bgCardAlt,
    borderRadius: 12, borderWidth: 1
  },
  value: { fontSize: 22, fontWeight: '700' },
  unit: { fontSize: 11, color: THEME.colors.textMuted },
  label: { fontSize: 11, color: THEME.colors.textSecondary, marginTop: 2, fontWeight: '500' },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  scroll: { flex: 1 },
  header: { padding: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: THEME.colors.text },
  subtitle: { fontSize: 14, color: THEME.colors.textSecondary, marginTop: 4 },

  recentSection: { marginBottom: 8 },
  recentRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  recentCard: {
    width: 160, backgroundColor: THEME.colors.bgCard,
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: THEME.colors.border,
    minHeight: 110
  },
  recentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${THEME.colors.primary}20`,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6
  },
  recentBadgeText: { color: THEME.colors.primary, fontSize: 10, fontWeight: '600' },
  recentDesc: { fontSize: 12, color: THEME.colors.textSecondary, marginBottom: 6, lineHeight: 16 },
  recentMacros: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  recentCal: { fontSize: 11, color: THEME.colors.accent, fontWeight: '600' },
  recentP: { fontSize: 11, color: THEME.colors.textMuted },
  recentAddBtn: {
    backgroundColor: `${THEME.colors.primary}20`,
    borderRadius: 8, paddingVertical: 5, alignItems: 'center'
  },
  recentAddBtnText: { color: THEME.colors.primary, fontSize: 11, fontWeight: '600' },

  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 13, color: THEME.colors.textSecondary, fontWeight: '500', marginBottom: 10 },
  mealTypeRow: { flexDirection: 'row', gap: 8 },
  mealTypeChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: THEME.colors.bgCard,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  mealTypeChipActive: { backgroundColor: `${THEME.colors.primary}20`, borderColor: THEME.colors.primary },
  mealTypeChipText: { color: THEME.colors.textSecondary, fontSize: 13, fontWeight: '500' },
  mealTypeChipTextActive: { color: THEME.colors.primary },
  textarea: {
    backgroundColor: THEME.colors.bgCard,
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: 14, padding: 14,
    color: THEME.colors.text, fontSize: 15,
    minHeight: 100
  },
  hint: { fontSize: 12, color: THEME.colors.textMuted, marginTop: 8 },
  analyzeBtn: {
    marginHorizontal: 16, backgroundColor: THEME.colors.primary,
    borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16
  },
  analyzeBtnDisabled: { backgroundColor: THEME.colors.border },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnContent: { flexDirection: 'row', alignItems: 'center' },

  resultCard: {
    margin: 16, backgroundColor: THEME.colors.bgCard,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  resultTitle: { fontSize: 17, fontWeight: '700', color: THEME.colors.text, marginBottom: 16 },
  nutritionGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  foodList: { marginBottom: 14 },
  foodListTitle: { fontSize: 13, fontWeight: '600', color: THEME.colors.textSecondary, marginBottom: 8 },
  foodItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: THEME.colors.border
  },
  foodName: { fontSize: 13, color: THEME.colors.text, flex: 1 },
  foodAmount: { fontSize: 12, color: THEME.colors.textSecondary },
  analysisBox: {
    backgroundColor: `${THEME.colors.primary}10`,
    borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: `${THEME.colors.primary}30`
  },
  analysisTitle: { fontSize: 13, fontWeight: '600', color: THEME.colors.primary, marginBottom: 4 },
  analysisText: { fontSize: 13, color: THEME.colors.textSecondary, lineHeight: 18 },
  suggestionBox: {
    backgroundColor: `${THEME.colors.success}10`,
    borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: `${THEME.colors.success}30`
  },
  suggestionTitle: { fontSize: 13, fontWeight: '600', color: THEME.colors.success, marginBottom: 4 },
  suggestionText: { fontSize: 13, color: THEME.colors.textSecondary, lineHeight: 18 },
  saveBtn: {
    backgroundColor: THEME.colors.success,
    borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 10
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  retryBtn: {
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: 12, padding: 12, alignItems: 'center'
  },
  retryBtnText: { color: THEME.colors.textSecondary, fontSize: 14 },
})
