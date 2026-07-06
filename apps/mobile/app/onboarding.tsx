import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Platform, KeyboardAvoidingView
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { authService } from '../lib/auth'
import { nutritionCalculator } from '../lib/nutrition-calculator'
import { databaseService } from '../lib/database-service'
import { geminiService, SampleMealPlan } from '../lib/gemini-service'
import { THEME } from '../lib/constants'
import type { UserPhysicalData } from '../lib/nutrition-calculator'

const TOTAL_STEPS = 6

type Goal = 'lose_weight' | 'gain_weight' | 'build_muscle' | 'maintain'
type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
type Gender = 'male' | 'female' | 'other'

const DIETARY_OPTIONS = [
  'Vejetaryen', 'Vegan', 'Glutensiz', 'Laktozsuz', 'Ketojenik', 'Akdeniz Diyeti'
]

export default function OnboardingScreen() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [planGenerating, setPlanGenerating] = useState(false)
  const [samplePlan, setSamplePlan] = useState<SampleMealPlan | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [height, setHeight] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [targetWeight, setTargetWeight] = useState('')
  const [goal, setGoal] = useState<Goal>('maintain')
  const [activity, setActivity] = useState<Activity>('moderate')
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([])
  const [allergies, setAllergies] = useState('')

  const toggleDietaryPref = (pref: string) => {
    setDietaryPreferences(prev =>
      prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]
    )
  }

  const getCalculatedPlan = () => {
    if (!height || !currentWeight || !age) return null
    const physicalData: UserPhysicalData = {
      age: parseInt(age),
      gender,
      height_cm: parseFloat(height),
      current_weight_kg: parseFloat(currentWeight),
      target_weight_kg: parseFloat(targetWeight) || parseFloat(currentWeight),
      activity_level: activity,
      goal,
    }
    return nutritionCalculator.createFullNutritionPlan(physicalData)
  }

  const handleGeneratePlan = async () => {
    const plan = getCalculatedPlan()
    if (!plan) return
    setPlanGenerating(true)
    try {
      const result = await geminiService.generateSampleMealPlan({
        dailyCalories: plan.targets.calories,
        protein: plan.targets.protein,
        carbs: plan.targets.carbs,
        fat: plan.targets.fat,
        mealCount: plan.mealCount,
        dietaryPreferences,
        allergies: allergies ? allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
        goal,
      })
      setSamplePlan(result)
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Plan oluşturulamadı. İnternet bağlantınızı kontrol edin.')
    } finally {
      setPlanGenerating(false)
    }
  }

  const handleComplete = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Kullanıcı bulunamadı')

      const physicalData: UserPhysicalData = {
        age: parseInt(age),
        gender,
        height_cm: parseFloat(height),
        current_weight_kg: parseFloat(currentWeight),
        target_weight_kg: parseFloat(targetWeight),
        activity_level: activity,
        goal,
      }

      const plan = nutritionCalculator.createFullNutritionPlan(physicalData)

      await authService.updateUserProfile(user.id, {
        name: name || user.user_metadata?.name,
        age: physicalData.age,
        gender,
        height_cm: physicalData.height_cm,
        current_weight_kg: physicalData.current_weight_kg,
        target_weight_kg: physicalData.target_weight_kg,
        activity_level: activity,
        goal,
        meal_count: plan.mealCount,
        dietary_preferences: dietaryPreferences,
        allergies: allergies ? allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
      })

      await databaseService.createNutritionPlan(user.id, {
        calories: plan.targets.calories,
        protein: plan.targets.protein,
        carbs: plan.targets.carbs,
        fat: plan.targets.fat,
      })

      router.replace('/(tabs)')
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Profil kaydedilemedi.')
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    if (step === 1) return name.length > 1 && age.length > 0
    if (step === 2) return height.length > 0 && currentWeight.length > 0 && targetWeight.length > 0
    return true
  }

  const calculatedPlan = step >= 6 ? getCalculatedPlan() : null

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Adım {step}/{TOTAL_STEPS}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` as any }]} />
          </View>
        </View>

        {/* Step 1: Kişisel Bilgiler */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Seni Tanıyalım</Text>
            <Text style={styles.stepSubtitle}>Kişisel bilgilerin beslenme planını özelleştirmemize yardımcı olur</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Adın</Text>
              <TextInput style={styles.input} placeholder="Adın" placeholderTextColor={THEME.colors.textMuted}
                value={name} onChangeText={setName} autoCapitalize="words" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Yaşın</Text>
              <TextInput style={styles.input} placeholder="25" placeholderTextColor={THEME.colors.textMuted}
                value={age} onChangeText={setAge} keyboardType="numeric" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cinsiyet</Text>
              <View style={styles.optionRow}>
                {([['male', 'Erkek'], ['female', 'Kadın'], ['other', 'Diğer']] as [Gender, string][]).map(([val, label]) => (
                  <TouchableOpacity key={val} style={[styles.optionChip, gender === val && styles.optionChipActive]}
                    onPress={() => setGender(val)}>
                    <Text style={[styles.optionChipText, gender === val && styles.optionChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Step 2: Vücut Ölçüleri */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Vücut Ölçülerin</Text>
            <Text style={styles.stepSubtitle}>Doğru kalori hesabı için gerekli</Text>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Boy (cm)</Text>
                <TextInput style={styles.input} placeholder="175" placeholderTextColor={THEME.colors.textMuted}
                  value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Mevcut Kilo (kg)</Text>
                <TextInput style={styles.input} placeholder="70" placeholderTextColor={THEME.colors.textMuted}
                  value={currentWeight} onChangeText={setCurrentWeight} keyboardType="decimal-pad" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hedef Kilo (kg)</Text>
              <TextInput style={styles.input} placeholder="65" placeholderTextColor={THEME.colors.textMuted}
                value={targetWeight} onChangeText={setTargetWeight} keyboardType="decimal-pad" />
            </View>
          </View>
        )}

        {/* Step 3: Hedef */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Hedefin Ne?</Text>
            <Text style={styles.stepSubtitle}>Beslenme planın buna göre optimize edilecek</Text>

            {([
              ['lose_weight', 'Kilo Ver', 'Yağ yakarak ideal kiloya ulaş', '🔥'],
              ['gain_weight', 'Kilo Al', 'Sağlıklı şekilde kilo kazan', '📈'],
              ['build_muscle', 'Kas Yap', 'Protein odaklı kas yapım planı', '💪'],
              ['maintain', 'Kilonu Koru', 'Mevcut kilonu dengede tut', '⚖️'],
            ] as [Goal, string, string, string][]).map(([val, label, desc, emoji]) => (
              <TouchableOpacity key={val} style={[styles.goalCard, goal === val && styles.goalCardActive]}
                onPress={() => setGoal(val)}>
                <Text style={styles.goalEmoji}>{emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.goalLabel, goal === val && styles.goalLabelActive]}>{label}</Text>
                  <Text style={styles.goalDesc}>{desc}</Text>
                </View>
                {goal === val && <View style={styles.goalCheck}><Text style={{ color: '#fff', fontSize: 12 }}>✓</Text></View>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 4: Aktivite */}
        {step === 4 && (
          <View>
            <Text style={styles.stepTitle}>Aktivite Sevien</Text>
            <Text style={styles.stepSubtitle}>Günlük kalori ihtiyacın için önemli</Text>

            {([
              ['sedentary', 'Hareketsiz', 'Masa başı iş, az yürüyüş'],
              ['light', 'Hafif Aktif', 'Haftada 1-3 gün egzersiz'],
              ['moderate', 'Orta Aktif', 'Haftada 3-5 gün egzersiz'],
              ['active', 'Aktif', 'Haftada 6-7 gün egzersiz'],
              ['very_active', 'Çok Aktif', 'Günde 2 kez veya fiziksel iş'],
            ] as [Activity, string, string][]).map(([val, label, desc]) => (
              <TouchableOpacity key={val} style={[styles.activityCard, activity === val && styles.activityCardActive]}
                onPress={() => setActivity(val)}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activityLabel, activity === val && styles.activityLabelActive]}>{label}</Text>
                  <Text style={styles.activityDesc}>{desc}</Text>
                </View>
                {activity === val && <View style={styles.goalCheck}><Text style={{ color: '#fff', fontSize: 12 }}>✓</Text></View>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 5: Diyet Tercihleri & Alerjiler */}
        {step === 5 && (
          <View>
            <Text style={styles.stepTitle}>Diyet Tercihleriniz</Text>
            <Text style={styles.stepSubtitle}>Bu bilgiler örnek beslenme planınızı kişiselleştirir (isteğe bağlı)</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Diyet Tercihleri</Text>
              <View style={styles.prefGrid}>
                {DIETARY_OPTIONS.map((pref) => (
                  <TouchableOpacity
                    key={pref}
                    style={[styles.prefChip, dietaryPreferences.includes(pref) && styles.prefChipActive]}
                    onPress={() => toggleDietaryPref(pref)}
                  >
                    <Text style={[styles.prefChipText, dietaryPreferences.includes(pref) && styles.prefChipTextActive]}>
                      {pref}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Alerjileriniz</Text>
              <Text style={styles.labelHint}>Virgülle ayırın (örn: fıstık, süt, deniz ürünleri)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                placeholder="Yok ise boş bırakabilirsiniz..."
                placeholderTextColor={THEME.colors.textMuted}
                value={allergies}
                onChangeText={setAllergies}
                multiline
              />
            </View>
          </View>
        )}

        {/* Step 6: Örnek Beslenme Planı */}
        {step === 6 && (
          <View>
            <Text style={styles.stepTitle}>Planın Hazır! 🎉</Text>
            <Text style={styles.stepSubtitle}>Günlük kalori ve makro hedefleriniz hesaplandı</Text>

            {calculatedPlan && (
              <View style={styles.planSummaryCard}>
                <View style={styles.planRow}>
                  <View style={styles.planStat}>
                    <Text style={[styles.planStatVal, { color: THEME.colors.accent }]}>
                      {Math.round(calculatedPlan.targets.calories)}
                    </Text>
                    <Text style={styles.planStatLabel}>kcal</Text>
                  </View>
                  <View style={styles.planStat}>
                    <Text style={[styles.planStatVal, { color: THEME.colors.protein }]}>
                      {Math.round(calculatedPlan.targets.protein)}g
                    </Text>
                    <Text style={styles.planStatLabel}>Protein</Text>
                  </View>
                  <View style={styles.planStat}>
                    <Text style={[styles.planStatVal, { color: THEME.colors.carbs }]}>
                      {Math.round(calculatedPlan.targets.carbs)}g
                    </Text>
                    <Text style={styles.planStatLabel}>Karb</Text>
                  </View>
                  <View style={styles.planStat}>
                    <Text style={[styles.planStatVal, { color: THEME.colors.fat }]}>
                      {Math.round(calculatedPlan.targets.fat)}g
                    </Text>
                    <Text style={styles.planStatLabel}>Yağ</Text>
                  </View>
                </View>
                <Text style={styles.planMealCount}>
                  Günde {calculatedPlan.mealCount} öğün önerilir
                </Text>
              </View>
            )}

            {!samplePlan && (
              <TouchableOpacity
                style={[styles.generateBtn, planGenerating && styles.nextBtnDisabled]}
                onPress={handleGeneratePlan}
                disabled={planGenerating}
              >
                {planGenerating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.nextBtnText}>AI Plan Oluşturuyor...</Text>
                  </View>
                ) : (
                  <Text style={styles.nextBtnText}>🍽️ Örnek Günlük Plan Oluştur</Text>
                )}
              </TouchableOpacity>
            )}

            {samplePlan && (
              <View style={styles.samplePlanContainer}>
                {samplePlan.note ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteText}>💬 {samplePlan.note}</Text>
                  </View>
                ) : null}

                {samplePlan.meals.map((meal, idx) => (
                  <View key={idx} style={styles.mealPlanCard}>
                    <View style={styles.mealPlanHeader}>
                      <Text style={styles.mealPlanName}>{meal.name}</Text>
                      <Text style={styles.mealPlanTime}>{meal.time}</Text>
                      <Text style={styles.mealPlanCal}>{Math.round(meal.totals.calories)} kcal</Text>
                    </View>
                    {meal.foods.map((food, fi) => (
                      <View key={fi} style={styles.mealPlanFood}>
                        <Text style={styles.mealPlanFoodName}>• {food.name}</Text>
                        <Text style={styles.mealPlanFoodAmount}>{food.amount}</Text>
                      </View>
                    ))}
                  </View>
                ))}

                <TouchableOpacity style={styles.regenBtn} onPress={() => { setSamplePlan(null) }}>
                  <Text style={styles.regenBtnText}>Yeniden Oluştur</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Buttons */}
        <View style={styles.btnRow}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
              <Text style={styles.backBtnText}>Geri</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled, step > 1 && { flex: 1 }]}
            onPress={() => {
              if (step < TOTAL_STEPS) setStep(s => s + 1)
              else handleComplete()
            }}
            disabled={!canProceed() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextBtnText}>
                {step === TOTAL_STEPS ? 'Başla 🚀' : step === 5 ? 'Devam Et' : 'Devam Et'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60 },
  progressContainer: { marginBottom: 32 },
  stepText: { color: THEME.colors.textSecondary, fontSize: 13, marginBottom: 8 },
  progressBar: { height: 4, backgroundColor: THEME.colors.border, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: THEME.colors.primary, borderRadius: 2 },
  stepTitle: { fontSize: 26, fontWeight: '700', color: THEME.colors.text, marginBottom: 8 },
  stepSubtitle: { fontSize: 14, color: THEME.colors.textSecondary, marginBottom: 24 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, color: THEME.colors.textSecondary, marginBottom: 8, fontWeight: '500' },
  labelHint: { fontSize: 11, color: THEME.colors.textMuted, marginBottom: 8 },
  input: {
    backgroundColor: THEME.colors.bgCard,
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: 12, padding: 14,
    color: THEME.colors.text, fontSize: 15
  },
  row: { flexDirection: 'row' },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionChip: {
    flex: 1, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.bgCard, alignItems: 'center'
  },
  optionChipActive: { borderColor: THEME.colors.primary, backgroundColor: `${THEME.colors.primary}20` },
  optionChipText: { color: THEME.colors.textSecondary, fontWeight: '500', fontSize: 14 },
  optionChipTextActive: { color: THEME.colors.primary },
  goalCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: THEME.colors.bgCard,
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: 14, padding: 16, marginBottom: 10
  },
  goalCardActive: { borderColor: THEME.colors.primary, backgroundColor: `${THEME.colors.primary}15` },
  goalEmoji: { fontSize: 28, marginRight: 14 },
  goalLabel: { fontSize: 15, fontWeight: '600', color: THEME.colors.text, marginBottom: 2 },
  goalLabelActive: { color: THEME.colors.primary },
  goalDesc: { fontSize: 12, color: THEME.colors.textMuted },
  goalCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center', alignItems: 'center'
  },
  activityCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: THEME.colors.bgCard,
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: 14, padding: 14, marginBottom: 8
  },
  activityCardActive: { borderColor: THEME.colors.primary, backgroundColor: `${THEME.colors.primary}15` },
  activityLabel: { fontSize: 14, fontWeight: '600', color: THEME.colors.text, marginBottom: 2 },
  activityLabelActive: { color: THEME.colors.primary },
  activityDesc: { fontSize: 12, color: THEME.colors.textMuted },
  // Step 5 - Diyet Tercihleri
  prefGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prefChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.bgCard,
  },
  prefChipActive: { borderColor: THEME.colors.primary, backgroundColor: `${THEME.colors.primary}20` },
  prefChipText: { fontSize: 13, color: THEME.colors.textSecondary, fontWeight: '500' },
  prefChipTextActive: { color: THEME.colors.primary },
  // Step 6 - Örnek Plan
  planSummaryCard: {
    backgroundColor: THEME.colors.bgCard,
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  planRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  planStat: { alignItems: 'center' },
  planStatVal: { fontSize: 22, fontWeight: '700' },
  planStatLabel: { fontSize: 11, color: THEME.colors.textSecondary, marginTop: 2 },
  planMealCount: { fontSize: 12, color: THEME.colors.textMuted, textAlign: 'center' },
  generateBtn: {
    backgroundColor: THEME.colors.success,
    borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16,
  },
  samplePlanContainer: { marginBottom: 8 },
  noteBox: {
    backgroundColor: `${THEME.colors.primary}15`,
    borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: `${THEME.colors.primary}30`,
  },
  noteText: { fontSize: 13, color: THEME.colors.textSecondary, lineHeight: 18 },
  mealPlanCard: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: THEME.colors.border,
  },
  mealPlanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mealPlanName: { fontSize: 14, fontWeight: '700', color: THEME.colors.text, flex: 1 },
  mealPlanTime: { fontSize: 12, color: THEME.colors.textMuted, marginRight: 8 },
  mealPlanCal: { fontSize: 13, fontWeight: '600', color: THEME.colors.accent },
  mealPlanFood: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  mealPlanFoodName: { fontSize: 13, color: THEME.colors.textSecondary, flex: 1 },
  mealPlanFoodAmount: { fontSize: 12, color: THEME.colors.textMuted },
  regenBtn: {
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 4,
  },
  regenBtnText: { color: THEME.colors.textSecondary, fontSize: 13 },
  // Buttons
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 32 },
  backBtn: {
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: 12, padding: 16, paddingHorizontal: 24, alignItems: 'center'
  },
  backBtnText: { color: THEME.colors.textSecondary, fontSize: 15, fontWeight: '500' },
  nextBtn: {
    flex: 1, backgroundColor: THEME.colors.primary,
    borderRadius: 12, padding: 16, alignItems: 'center'
  },
  nextBtnDisabled: { backgroundColor: THEME.colors.border },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
