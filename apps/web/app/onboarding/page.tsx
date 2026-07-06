'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/lib/auth'
import { nutritionCalculator } from '@/lib/nutrition-calculator'
import { databaseService } from '@/lib/database-service'

type Step = 1 | 2 | 3 | 4 | 5

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Step 1: Fiziksel özellikler
  const [age, setAge] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male')
  const [height, setHeight] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')

  // Step 2: Hedef ve süre
  const [goal, setGoal] = useState<'lose_weight' | 'gain_weight' | 'build_muscle' | 'maintain'>('maintain')
  const [targetWeight, setTargetWeight] = useState('')
  const [targetWeeks, setTargetWeeks] = useState('')
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'>('moderate')

  // Step 3: Diyet tercihleri
  const [mealCount, setMealCount] = useState(3)
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([])
  const [allergies, setAllergies] = useState('')

  // Step 4: Hesaplanan plan
  const [calculatedPlan, setCalculatedPlan] = useState<any>(null)

  // Step 5: Örnek beslenme programı
  const [sampleMealPlan, setSampleMealPlan] = useState<any>(null)
  const [loadingSamplePlan, setLoadingSamplePlan] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await authService.getCurrentUser()
        if (!user) {
          router.push('/auth/login')
        } else {
          setUserId(user.id)
        }
      } catch (error) {
        router.push('/auth/login')
      }
    }
    checkUser()
  }, [router])

  const handleDietaryPreferenceToggle = (pref: string) => {
    setDietaryPreferences(prev =>
      prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]
    )
  }

  const calculatePlan = () => {
    const userData = {
      age: parseInt(age),
      gender,
      height_cm: parseInt(height),
      current_weight_kg: parseFloat(currentWeight),
      target_weight_kg: parseFloat(targetWeight),
      activity_level: activityLevel,
      goal,
      target_weeks: targetWeeks ? parseInt(targetWeeks) : undefined
    }

    const plan = nutritionCalculator.createFullNutritionPlan(userData, mealCount)
    setCalculatedPlan(plan)
    
    // Önerilen öğün sayısını güncelle
    if (!targetWeeks) {
      setTargetWeeks(plan.recommendedWeeks.toString())
    }
  }

  const handleSubmit = async () => {
    if (!userId || !calculatedPlan) return

    setLoading(true)
    try {
      // Profili güncelle
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
        allergies: allergies.split(',').map(a => a.trim()).filter(Boolean),
      })

      // Beslenme planını kaydet
      await databaseService.createNutritionPlan(
        userId,
        calculatedPlan.targets,
        `${goal === 'lose_weight' ? 'Kilo Verme' : goal === 'gain_weight' ? 'Kilo Alma' : goal === 'build_muscle' ? 'Kas Yapma' : 'Koruma'} Planı`
      )

      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Profil güncellenirken hata:', error)
      alert('Bir hata oluştu, lütfen tekrar dene')
    } finally {
      setLoading(false)
    }
  }

  const generateSampleMealPlan = async () => {
    if (!calculatedPlan) return

    setLoadingSamplePlan(true)
    try {
      const response = await fetch('/api/sample-meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyCalories: calculatedPlan.targets.calories,
          protein: calculatedPlan.targets.protein,
          carbs: calculatedPlan.targets.carbs,
          fat: calculatedPlan.targets.fat,
          mealCount,
          dietaryPreferences,
          allergies: allergies.split(',').map(a => a.trim()).filter(Boolean),
          goal
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setSampleMealPlan(result.data)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Örnek program oluşturulamadı:', error)
      alert('Örnek program oluşturulamadı. Dashboard\'a geçebilirsin.')
    } finally {
      setLoadingSamplePlan(false)
    }
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Fiziksel Özellikler 📊</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Yaş</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="25"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cinsiyet</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'male', label: 'Erkek' },
                  { value: 'female', label: 'Kadın' },
                  { value: 'other', label: 'Diğer' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setGender(option.value as any)}
                    className={`py-3 rounded-lg font-medium transition-colors ${
                      gender === option.value
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Boy (cm)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="175"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mevcut Kilo (kg)</label>
              <input
                type="number"
                step="0.1"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="75.5"
                required
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Hedefin Ne? 🎯</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Amacın</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'lose_weight', label: 'Kilo Ver', emoji: '📉' },
                  { value: 'gain_weight', label: 'Kilo Al', emoji: '📈' },
                  { value: 'build_muscle', label: 'Kas Yap', emoji: '💪' },
                  { value: 'maintain', label: 'Koru', emoji: '⚖️' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setGoal(option.value as any)}
                    className={`py-4 rounded-lg font-medium transition-colors ${
                      goal === option.value
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="text-2xl mb-1">{option.emoji}</div>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hedef Kilo (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="70.0"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hedef Süre (hafta)
                  <span className="text-xs text-gray-500 ml-1">(opsiyonel)</span>
                </label>
                <input
                  type="number"
                  value={targetWeeks}
                  onChange={(e) => setTargetWeeks(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Otomatik"
                />
              </div>
            </div>

            {targetWeight && currentWeight && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 {Math.abs(parseFloat(targetWeight) - parseFloat(currentWeight)).toFixed(1)} kg {
                    parseFloat(targetWeight) > parseFloat(currentWeight) ? 'almak' : 'vermek'
                  } istiyorsun. Sağlıklı bir hedef!
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Aktivite Seviyesi</label>
              <div className="space-y-2">
                {[
                  { value: 'sedentary', label: 'Sedanter', desc: 'Hareketsiz, masa başı iş' },
                  { value: 'light', label: 'Hafif Aktif', desc: 'Haftada 1-3 gün egzersiz' },
                  { value: 'moderate', label: 'Orta', desc: 'Haftada 3-5 gün egzersiz' },
                  { value: 'active', label: 'Aktif', desc: 'Haftada 6-7 gün egzersiz' },
                  { value: 'very_active', label: 'Çok Aktif', desc: 'Günde 2 kez egzersiz/sporcu' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setActivityLevel(option.value as any)}
                    className={`w-full text-left p-4 rounded-lg transition-colors ${
                      activityLevel === option.value
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className={`text-sm ${activityLevel === option.value ? 'text-green-100' : 'text-gray-500'}`}>
                      {option.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Diyet Tercihleri 🍽️</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Günde Kaç Öğün? ({mealCount})
              </label>
              <input
                type="range"
                min="3"
                max="6"
                value={mealCount}
                onChange={(e) => setMealCount(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6</span>
              </div>
              
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  💡 {
                    goal === 'lose_weight' 
                      ? '3 öğün önerilir: Kahvaltı, Öğle, Akşam. Daha az sıklıkta ama doyurucu öğünler kilo vermeyi kolaylaştırır.'
                      : goal === 'gain_weight'
                      ? '5 öğün önerilir: Kahvaltı, Kuşluk, Öğle, İkindi, Akşam. Sık öğün metabolizmayı aktif tutar ve kilo almayı kolaylaştırır.'
                      : goal === 'build_muscle'
                      ? '5 öğün önerilir: Kahvaltı, Kuşluk, Öğle, İkindi, Akşam. Protein sentezi için düzenli besin alımı kas yapımını destekler.'
                      : '4 öğün önerilir: Kahvaltı, Öğle, İkindi, Akşam. Dengeli bir seçimdir.'
                  }
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Diyet Tercihleri (Opsiyonel)</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Vejetaryen',
                  'Vegan',
                  'Glutensiz',
                  'Laktozsuz',
                  'Ketojenik',
                  'Akdeniz Diyeti',
                ].map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => handleDietaryPreferenceToggle(pref)}
                    className={`py-3 rounded-lg font-medium transition-colors ${
                      dietaryPreferences.includes(pref)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alerjiler (Opsiyonel, virgülle ayır)
              </label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Fıstık, süt ürünleri, deniz ürünleri"
              />
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Senin İçin Hesaplanan Plan 📊</h2>
            
            {!calculatedPlan ? (
              <div className="text-center py-8">
                <button
                  onClick={calculatePlan}
                  className="bg-green-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
                >
                  Planımı Hesapla
                </button>
                <p className="text-sm text-gray-500 mt-3">
                  Bilimsel formüllerle kişiselleştirilmiş planını oluşturacağız
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Günlük Hedefler */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4 text-lg">Günlük Hedefler</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center bg-white rounded-lg p-3">
                      <p className="text-3xl font-bold text-green-600">
                        {calculatedPlan.targets.calories}
                      </p>
                      <p className="text-sm text-gray-600">Kalori</p>
                    </div>
                    <div className="text-center bg-white rounded-lg p-3">
                      <p className="text-3xl font-bold text-blue-600">
                        {calculatedPlan.targets.protein}g
                      </p>
                      <p className="text-sm text-gray-600">Protein</p>
                    </div>
                    <div className="text-center bg-white rounded-lg p-3">
                      <p className="text-3xl font-bold text-amber-600">
                        {calculatedPlan.targets.carbs}g
                      </p>
                      <p className="text-sm text-gray-600">Karbonhidrat</p>
                    </div>
                    <div className="text-center bg-white rounded-lg p-3">
                      <p className="text-3xl font-bold text-purple-600">
                        {calculatedPlan.targets.fat}g
                      </p>
                      <p className="text-sm text-gray-600">Yağ</p>
                    </div>
                  </div>
                </div>

                {/* Metabolizma Bilgileri */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">📈 Metabolizma Analizi</h4>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>• Bazal Metabolizma (BMR): <strong>{calculatedPlan.bmr} kcal/gün</strong></p>
                    <p>• Günlük Enerji İhtiyacı (TDEE): <strong>{calculatedPlan.tdee} kcal/gün</strong></p>
                    <p>• Haftalık Kilo Değişimi: <strong>{calculatedPlan.weeklyWeightChange > 0 ? '+' : ''}{calculatedPlan.weeklyWeightChange.toFixed(2)} kg</strong></p>
                    <p>• Önerilen Süre: <strong>{calculatedPlan.recommendedWeeks} hafta</strong></p>
                    <p>• Günlük Su İhtiyacı: <strong>{calculatedPlan.targets.water_liters} litre</strong></p>
                  </div>
                </div>

                {/* Öğün Planı */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">🍽️ Öğün Dağılımı ({mealCount} öğün)</h4>
                  <div className="space-y-2">
                    {calculatedPlan.mealPlan.meals.map((meal: any, index: number) => (
                      <div key={index} className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                        <div>
                          <p className="font-medium text-gray-900">{meal.name}</p>
                          <p className="text-xs text-gray-500">{meal.time}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{meal.calories} kcal</p>
                          <p className="text-xs text-gray-600">
                            P:{meal.protein}g C:{meal.carbs}g Y:{meal.fat}g
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bilimsel Açıklama */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">🔬 Nasıl Hesaplandı?</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Planın <strong>Mifflin-St Jeor formülü</strong> ile bazal metabolizma hızın hesaplandı, 
                    aktivite seviyene göre günlük enerji ihtiyacın belirlendi. Hedefine ulaşman için 
                    sağlıklı kilo değişim hızı (haftada 0.5 kg) baz alınarak kalori hedefin ayarlandı. 
                    Makro besin dağılımı hedefine özel optimize edildi.
                  </p>
                </div>

                <button
                  onClick={calculatePlan}
                  className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  🔄 Yeniden Hesapla
                </button>
              </div>
            )}
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900">Hazırsın!</h2>
              <p className="text-gray-600 mt-2">
                Profilin tamamlandı. Kişiselleştirilmiş beslenme planın hazır!
              </p>
            </div>

            {/* Özet */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-left">
              <h3 className="font-semibold text-green-900 mb-3">📋 Özet:</h3>
              <div className="space-y-2 text-sm text-green-800">
                <p>• <strong>Fiziksel:</strong> {age} yaşında, {height} cm, {currentWeight} kg</p>
                <p>• <strong>Hedef:</strong> {targetWeight} kg ({
                  goal === 'lose_weight' ? 'Kilo Verme' :
                  goal === 'gain_weight' ? 'Kilo Alma' :
                  goal === 'build_muscle' ? 'Kas Yapma' : 'Koruma'
                })</p>
                {calculatedPlan && (
                  <>
                    <p>• <strong>Günlük Kalori:</strong> {calculatedPlan.targets.calories} kcal</p>
                    <p>• <strong>Protein:</strong> {calculatedPlan.targets.protein}g | <strong>Karb:</strong> {calculatedPlan.targets.carbs}g | <strong>Yağ:</strong> {calculatedPlan.targets.fat}g</p>
                    <p>• <strong>Öğün Sayısı:</strong> {mealCount} öğün/gün</p>
                    <p>• <strong>Tahmini Süre:</strong> {calculatedPlan.recommendedWeeks} hafta</p>
                  </>
                )}
                {dietaryPreferences.length > 0 && (
                  <p>• <strong>Tercihler:</strong> {dietaryPreferences.join(', ')}</p>
                )}
                {allergies && (
                  <p>• <strong>Alerjiler:</strong> {allergies}</p>
                )}
              </div>
            </div>

            {/* Örnek Beslenme Programı */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-purple-900">✨ Örnek 1 Günlük Program</h3>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  İlham Verici Örnek
                </span>
              </div>

              {!sampleMealPlan && !loadingSamplePlan && (
                <div className="text-center py-6">
                  <p className="text-sm text-purple-700 mb-4">
                    Senin için özel hazırlanmış örnek bir günlük program görmek ister misin?
                  </p>
                  <button
                    onClick={generateSampleMealPlan}
                    className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    🍽️ Örnek Program Oluştur
                  </button>
                </div>
              )}

              {loadingSamplePlan && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-200 border-t-purple-600 mb-3"></div>
                  <p className="text-sm text-purple-700">
                    Senin için özel program hazırlanıyor...
                  </p>
                </div>
              )}

              {sampleMealPlan && (
                <div className="space-y-3">
                  {sampleMealPlan.meals?.map((meal: any, index: number) => (
                    <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{meal.name}</h4>
                          <p className="text-xs text-gray-500">{meal.time}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-purple-600">{meal.totals?.calories || 0} kcal</p>
                          <p className="text-xs text-gray-600">
                            P:{meal.totals?.protein || 0}g C:{meal.totals?.carbs || 0}g Y:{meal.totals?.fat || 0}g
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {meal.foods?.map((food: any, foodIndex: number) => (
                          <div key={foodIndex} className="flex justify-between text-sm">
                            <span className="text-gray-700">• {food.name} ({food.amount})</span>
                            <span className="text-gray-500">{food.calories} kcal</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {sampleMealPlan.note && (
                    <div className="bg-purple-100 border border-purple-200 rounded-lg p-3 mt-4">
                      <p className="text-sm text-purple-800">
                        💡 {sampleMealPlan.note}
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-center text-purple-600 mt-3">
                    Bu sadece bir örnektir. Dashboard'da kendi öğünlerini kaydedebilirsin!
                  </p>
                </div>
              )}
            </div>

            {/* Bilgilendirme */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                💡 Dashboard'da öğünlerini kaydetmeye başlayabilir, ilerlemeni takip edebilirsin!
              </p>
            </div>
          </div>
        )
    }
  }

  if (!userId) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>
  }

  const canProceedToStep4 = age && height && currentWeight && targetWeight && goal && activityLevel
  const canProceedToStep5 = calculatedPlan !== null

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full mx-1 ${
                  s <= step ? 'bg-green-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600 text-center">Adım {step} / 5</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {renderStep()}

          {/* Navigation */}
          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as Step)}
                className="flex-1 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Geri
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={() => {
                  if (step === 3 && !canProceedToStep4) {
                    alert('Lütfen tüm alanları doldurun')
                    return
                  }
                  setStep((step + 1) as Step)
                }}
                disabled={step === 3 && !canProceedToStep4}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                İleri
              </button>
            ) : step === 4 ? (
              <button
                onClick={() => {
                  if (!canProceedToStep5) {
                    alert('Lütfen önce planını hesapla')
                    return
                  }
                  setStep(5)
                  // Step 5'e geçince otomatik örnek program oluştur
                  setTimeout(() => generateSampleMealPlan(), 500)
                }}
                disabled={!canProceedToStep5}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Devam Et
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Kaydediliyor...' : 'Tamamla ve Başla'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
