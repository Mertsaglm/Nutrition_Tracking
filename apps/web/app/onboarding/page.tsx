'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import {
  NUTRITION_RULES,
  createFullNutritionPlan,
  validateOnboarding,
  type ActivityLevel,
  type FullNutritionPlan,
  type Gender,
  type Goal,
  type SampleMealPlan,
} from '@nutrition/core'
import { authService, databaseService } from '@/lib/services'
import { aiClient } from '@/lib/ai'
import { Logo } from '@/components/ui/Logo'
import { useToast } from '@/components/ui/Toast'

type Step = 1 | 2 | 3 | 4 | 5

const GOALS: { value: Goal; label: string; emoji: string }[] = [
  { value: 'lose_weight', label: 'Kilo Ver', emoji: '📉' },
  { value: 'gain_weight', label: 'Kilo Al', emoji: '📈' },
  { value: 'build_muscle', label: 'Kas Yap', emoji: '💪' },
  { value: 'maintain', label: 'Koru', emoji: '⚖️' },
]

const ACTIVITIES: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedanter', desc: 'Hareketsiz, masa başı' },
  { value: 'light', label: 'Hafif Aktif', desc: 'Haftada 1-3 gün' },
  { value: 'moderate', label: 'Orta', desc: 'Haftada 3-5 gün' },
  { value: 'active', label: 'Aktif', desc: 'Haftada 6-7 gün' },
  { value: 'very_active', label: 'Çok Aktif', desc: 'Günde 2 kez / sporcu' },
]

const DIET_PREFS = ['Vejetaryen', 'Vegan', 'Glutensiz', 'Laktozsuz', 'Ketojenik', 'Akdeniz Diyeti']

const GOAL_LABEL: Record<Goal, string> = {
  lose_weight: 'Kilo Verme',
  gain_weight: 'Kilo Alma',
  build_muscle: 'Kas Yapma',
  maintain: 'Koruma',
}

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [age, setAge] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [height, setHeight] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')

  const [goal, setGoal] = useState<Goal>('maintain')
  const [targetWeight, setTargetWeight] = useState('')
  const [targetWeeks, setTargetWeeks] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')

  const [mealCount, setMealCount] = useState(3)
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([])
  const [allergies, setAllergies] = useState('')

  const [plan, setPlan] = useState<FullNutritionPlan | null>(null)
  const [samplePlan, setSamplePlan] = useState<SampleMealPlan | null>(null)
  const [loadingSample, setLoadingSample] = useState(false)

  useEffect(() => {
    authService
      .getCurrentUser()
      .then((user) => (user ? setUserId(user.id) : router.push('/auth/login')))
      .catch(() => router.push('/auth/login'))
  }, [router])

  const togglePref = (pref: string) =>
    setDietaryPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    )

  const calculatePlan = () => {
    const check = validateOnboarding({
      age,
      height_cm: height,
      current_weight_kg: currentWeight,
      target_weight_kg: targetWeight,
      target_weeks: targetWeeks,
    })
    if (!check.ok) {
      toast('warning', Object.values(check.errors)[0])
      return
    }
    const result = createFullNutritionPlan(
      {
        age: parseInt(age),
        gender,
        height_cm: parseInt(height),
        current_weight_kg: parseFloat(currentWeight),
        target_weight_kg: parseFloat(targetWeight),
        activity_level: activityLevel,
        goal,
        target_weeks: targetWeeks ? parseInt(targetWeeks) : undefined,
      },
      mealCount
    )
    setPlan(result)
    if (!targetWeeks) setTargetWeeks(result.recommendedWeeks.toString())
  }

  const generateSample = async () => {
    if (!plan) return
    setLoadingSample(true)
    try {
      const data = await aiClient.generateSampleMealPlan({
        dailyCalories: plan.targets.calories,
        protein: plan.targets.protein,
        carbs: plan.targets.carbs,
        fat: plan.targets.fat,
        mealCount,
        dietaryPreferences,
        allergies: allergies.split(',').map((a) => a.trim()).filter(Boolean),
        goal,
      })
      setSamplePlan(data)
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Örnek program oluşturulamadı')
    } finally {
      setLoadingSample(false)
    }
  }

  const handleSubmit = async () => {
    if (!userId || !plan) return
    setLoading(true)
    try {
      await authService.updateUserProfile(userId, {
        age: parseInt(age),
        gender,
        height_cm: parseInt(height),
        current_weight_kg: parseFloat(currentWeight),
        target_weight_kg: parseFloat(targetWeight),
        goal,
        activity_level: activityLevel,
        meal_count: mealCount,
        dietary_preferences: dietaryPreferences,
        allergies: allergies.split(',').map((a) => a.trim()).filter(Boolean),
      })
      await databaseService.createNutritionPlan(userId, plan.targets, `${GOAL_LABEL[goal]} Planı`)
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Bir hata oluştu')
      setLoading(false)
    }
  }

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    )
  }

  const canCalculate = age && height && currentWeight && targetWeight

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {/* İlerleme */}
        <div className="mb-6">
          <div className="mb-2 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-brand-500' : 'bg-neutral-200'}`}
              />
            ))}
          </div>
          <p className="text-center text-sm text-neutral-500">Adım {step} / 5</p>
        </div>

        <div className="card p-6 md:p-8">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-neutral-900">Fiziksel Özellikler</h2>
              <div>
                <label className="label">Yaş</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="input"
                  placeholder="25"
                />
              </div>
              <div>
                <label className="label">Cinsiyet</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['male', 'Erkek'],
                      ['female', 'Kadın'],
                      ['other', 'Diğer'],
                    ] as const
                  ).map(([value, lbl]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGender(value)}
                      className={`select-tile text-center ${gender === value ? 'select-tile-active' : ''}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Boy (cm)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="input"
                    placeholder="175"
                  />
                </div>
                <div>
                  <label className="label">Mevcut Kilo (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={currentWeight}
                    onChange={(e) => setCurrentWeight(e.target.value)}
                    className="input"
                    placeholder="75"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-neutral-900">Hedefin ne?</h2>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGoal(g.value)}
                    className={`select-tile text-center ${goal === g.value ? 'select-tile-active' : ''}`}
                  >
                    <div className="text-2xl">{g.emoji}</div>
                    <div className="mt-1 text-sm font-medium">{g.label}</div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Hedef Kilo (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    className="input"
                    placeholder="70"
                  />
                </div>
                <div>
                  <label className="label">Hedef Süre (hafta, ops.)</label>
                  <input
                    type="number"
                    value={targetWeeks}
                    onChange={(e) => setTargetWeeks(e.target.value)}
                    className="input"
                    placeholder="Otomatik"
                  />
                </div>
              </div>
              <div>
                <label className="label">Aktivite Seviyesi</label>
                <div className="space-y-2">
                  {ACTIVITIES.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setActivityLevel(a.value)}
                      className={`select-tile ${activityLevel === a.value ? 'select-tile-active' : ''}`}
                    >
                      <div className="text-sm font-medium">{a.label}</div>
                      <div className="text-xs text-neutral-400">{a.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-neutral-900">Diyet Tercihleri</h2>
              <div>
                <label className="label">Günde kaç öğün? ({mealCount})</label>
                <input
                  type="range"
                  min={3}
                  max={6}
                  value={mealCount}
                  onChange={(e) => setMealCount(parseInt(e.target.value))}
                  className="w-full accent-brand-600"
                />
                <div className="mt-1 flex justify-between text-xs text-neutral-400">
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                  <span>6</span>
                </div>
              </div>
              <div>
                <label className="label">Tercihler (opsiyonel)</label>
                <div className="grid grid-cols-2 gap-2">
                  {DIET_PREFS.map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => togglePref(pref)}
                      className={`select-tile text-center text-sm ${
                        dietaryPreferences.includes(pref) ? 'select-tile-active' : ''
                      }`}
                    >
                      {pref}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Alerjiler (virgülle ayır)</label>
                <input
                  type="text"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="input"
                  placeholder="Fıstık, süt ürünleri, deniz ürünleri"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-neutral-900">Senin için hesaplanan plan</h2>
              {!plan ? (
                <div className="py-8 text-center">
                  <button onClick={calculatePlan} className="btn-primary px-8 py-3.5">
                    Planımı Hesapla
                  </button>
                  <p className="mt-3 text-sm text-neutral-400">
                    Bilimsel formüllerle (Mifflin-St Jeor + TDEE) kişisel plan
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <PlanStat value={plan.targets.calories} label="Kalori" suffix="" />
                    <PlanStat value={plan.targets.protein} label="Protein" suffix="g" />
                    <PlanStat value={plan.targets.carbs} label="Karb" suffix="g" />
                    <PlanStat value={plan.targets.fat} label="Yağ" suffix="g" />
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">
                    <p>
                      BMR: <strong>{plan.bmr}</strong> · TDEE: <strong>{plan.tdee}</strong> kcal/gün ·
                      Su: <strong>{plan.targets.water_liters} L</strong> · Süre:{' '}
                      <strong>{plan.recommendedWeeks} hafta</strong>
                    </p>
                  </div>
                  {/* Hedef süre güvenli hızın altındaysa kullanıcıyı bilgilendir:
                      plan sessizce daha uzun bir süreye yayılmış olur. */}
                  {plan.paceLimited && (
                    <div className="rounded-xl border border-accent-200 bg-accent-50 p-4 text-sm text-accent-800">
                      Güvenli kilo değişim hızı haftada en fazla{' '}
                      <strong>{NUTRITION_RULES.maxWeeklyRate} kg</strong> olduğu için hedef süren{' '}
                      <strong>{plan.recommendedWeeks} haftaya</strong> uzatıldı (yaklaşık{' '}
                      <strong>{Math.abs(plan.weeklyWeightChange).toFixed(2)} kg/hafta</strong>). Daha
                      hızlısı sağlıklı değil.
                    </div>
                  )}
                  <div className="space-y-2">
                    {plan.mealPlan.meals.map((meal, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-neutral-50 px-4 py-2.5 text-sm"
                      >
                        <span className="font-medium text-neutral-700">
                          {meal.name} <span className="text-neutral-400">· {meal.time}</span>
                        </span>
                        <span className="text-neutral-500">{meal.calories} kcal</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={calculatePlan} className="btn-ghost w-full text-sm">
                    Yeniden Hesapla
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="text-5xl">🎉</div>
                <h2 className="mt-2 text-xl font-bold text-neutral-900">Hazırsın!</h2>
                <p className="mt-1 text-neutral-500">Kişisel beslenme planın hazır.</p>
              </div>

              {plan && (
                <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
                  <p>
                    {age} yaş · {height} cm · {currentWeight} kg → {targetWeight} kg (
                    {GOAL_LABEL[goal]})
                  </p>
                  <p className="mt-1">
                    <strong>{plan.targets.calories}</strong> kcal · P {plan.targets.protein}g · K{' '}
                    {plan.targets.carbs}g · Y {plan.targets.fat}g · {mealCount} öğün
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-neutral-200 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent-500" />
                  <h3 className="text-sm font-semibold text-neutral-800">Örnek 1 günlük program</h3>
                </div>
                {!samplePlan && !loadingSample && (
                  <button onClick={generateSample} className="btn-secondary w-full">
                    Örnek Program Oluştur
                  </button>
                )}
                {loadingSample && (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-neutral-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Hazırlanıyor…
                  </div>
                )}
                {samplePlan && (
                  <div className="space-y-2">
                    {samplePlan.meals.map((meal, i) => (
                      <div key={i} className="rounded-lg bg-neutral-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-neutral-700">
                            {meal.name}{' '}
                            <span className="text-xs text-neutral-400">{meal.time}</span>
                          </span>
                          <span className="text-sm font-semibold text-accent-600">
                            {meal.totals?.calories ?? 0} kcal
                          </span>
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {meal.foods?.map((f, fi) => (
                            <div key={fi} className="flex justify-between text-xs text-neutral-500">
                              <span>
                                {f.name} ({f.amount})
                              </span>
                              <span>{f.calories} kcal</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {samplePlan.note && (
                      <p className="rounded-lg bg-accent-50 p-3 text-sm text-accent-800">
                        💡 {samplePlan.note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigasyon */}
          <div className="mt-6 flex gap-3">
            {step > 1 && (
              <button onClick={() => setStep((step - 1) as Step)} className="btn-secondary flex-1">
                Geri
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={() => {
                  if (step === 3 && !canCalculate) {
                    toast('warning', 'Lütfen fiziksel bilgileri ve hedef kiloyu doldur')
                    return
                  }
                  setStep((step + 1) as Step)
                }}
                className="btn-primary flex-1"
              >
                İleri
              </button>
            ) : step === 4 ? (
              <button
                onClick={() => {
                  if (!plan) {
                    toast('warning', 'Önce planını hesapla')
                    return
                  }
                  setStep(5)
                  void generateSample()
                }}
                disabled={!plan}
                className="btn-primary flex-1"
              >
                Devam Et
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Kaydediliyor…' : 'Tamamla ve Başla'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanStat({ value, label, suffix }: { value: number; label: string; suffix: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3 text-center">
      <p className="text-2xl font-bold text-brand-600">
        {value}
        {suffix}
      </p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  )
}
