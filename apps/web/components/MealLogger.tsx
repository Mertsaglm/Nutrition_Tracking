'use client'

import { useState, useMemo } from 'react'
import { Plus, Loader2, Sparkles, Clock } from 'lucide-react'
import { useNutritionStore } from '@/lib/nutrition-store'
import { geminiService } from '@/lib/gemini-service'
import { databaseService } from '@/lib/database-service'
import { authService } from '@/lib/auth'
import { MealEntry } from '@/lib/types'
import { NUTRITION_CONFIG } from '@/lib/constants'

interface MealLoggerProps {
  userMealCount?: number
}

export default function MealLogger({ userMealCount = 3 }: MealLoggerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState('')
  const [description, setDescription] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [testResult, setTestResult] = useState<string>('')
  
  const { addMealEntry } = useNutritionStore()

  // Kullanıcının öğün sayısına göre öğünleri filtrele
  const userMealTypes = useMemo(() => {
    const allMeals = Object.values(NUTRITION_CONFIG.mealTypes)
    
    // Öğün sayısına göre hangi öğünleri göstereceğiz
    let selectedMealIndices: number[] = []
    
    if (userMealCount === 3) {
      // Kahvaltı, Öğle, Akşam
      selectedMealIndices = [0, 2, 4]
    } else if (userMealCount === 4) {
      // Kahvaltı, Öğle, İkindi, Akşam
      selectedMealIndices = [0, 2, 3, 4]
    } else if (userMealCount === 5) {
      // Kahvaltı, Kuşluk, Öğle, İkindi, Akşam
      selectedMealIndices = [0, 1, 2, 3, 4]
    } else if (userMealCount === 6) {
      // Tüm öğünler
      selectedMealIndices = [0, 1, 2, 3, 4, 5]
    } else {
      // Varsayılan: 3 öğün
      selectedMealIndices = [0, 2, 4]
    }
    
    return selectedMealIndices.map(index => allMeals[index])
  }, [userMealCount])

  const handleTestConnection = async () => {
    setTestResult('Test ediliyor...')
    try {
      const success = await geminiService.testConnection()
      setTestResult(success ? '✅ Bağlantı başarılı!' : '❌ Bağlantı başarısız!')
    } catch (error) {
      setTestResult(`❌ Test hatası: ${error}`)
    }
  }

  const handleAnalyze = async () => {
    if (!selectedMeal || !description.trim()) return

    setIsAnalyzing(true)
    try {
      const targetCalories = userMealTypes.find(m => m.name === selectedMeal)?.targetRatio ? 
        NUTRITION_CONFIG.defaultTargets.calories * (userMealTypes.find(m => m.name === selectedMeal)?.targetRatio || 0.25) : 500
      const result = await geminiService.analyzeMealDescription(
        description,
        selectedMeal,
        targetCalories
      )
      setAnalysisResult(result)
    } catch (error) {
      console.error('Analiz hatası:', error)
      alert('Analiz yapılırken bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSaveMeal = async () => {
    if (!analysisResult || !selectedMeal) return

    try {
      const mealEntry: MealEntry = {
        id: Date.now().toString(),
        mealType: selectedMeal,
        description,
        foods: analysisResult.foods,
        totalNutrition: analysisResult.totalNutrition,
        timestamp: new Date(),
        aiAnalysis: analysisResult.analysis,
        suggestions: analysisResult.suggestions,
      }

      // Önce local store'a ekle (hızlı UI güncellemesi için)
      addMealEntry(mealEntry)

      // Sonra database'e kaydet
      const user = await authService.getCurrentUser()
      if (user) {
        await databaseService.saveMealLog(user.id, mealEntry)
        console.log('Öğün database\'e kaydedildi')
      }
      
      // Reset form
      setIsOpen(false)
      setSelectedMeal('')
      setDescription('')
      setAnalysisResult(null)
    } catch (error) {
      console.error('Öğün kaydedilirken hata:', error)
      alert('Öğün kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.')
    }
  }

  const handleCancel = () => {
    setIsOpen(false)
    setSelectedMeal('')
    setDescription('')
    setAnalysisResult(null)
  }

  if (!isOpen) {
    return (
      <div className="mb-8">
        <button
          onClick={() => setIsOpen(true)}
          className="btn-primary w-full flex items-center justify-center gap-3 py-4"
        >
          <Plus className="w-5 h-5" />
          Yeni Öğün Ekle
        </button>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Yeni Öğün Ekle</h2>
      </div>

      {/* Öğün Seçimi */}
      <div className="space-y-4 mb-6">
        <label className="block text-sm font-medium text-gray-700">
          Öğün Türü
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {userMealTypes.map((meal) => (
            <button
              key={meal.name}
              onClick={() => setSelectedMeal(meal.name)}
              className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                selectedMeal === meal.name
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4" />
                <span className="font-medium text-sm">{meal.name}</span>
              </div>
              <p className="text-xs text-gray-600">{meal.time}</p>
              <p className="text-xs text-gray-500">
                {Math.round(NUTRITION_CONFIG.defaultTargets.calories * meal.targetRatio)} kcal
              </p>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          💡 Planınıza göre {userMealCount} öğün önerildi
        </p>
      </div>

      {/* Açıklama */}
      <div className="space-y-4 mb-6">
        <label className="block text-sm font-medium text-gray-700">
          Ne Yediniz? (Doğal dilde açıklayın)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Örnek: 200g tavuk göğsü, 150g pirinç pilavı, 1 kase salata zeytinyağlı, 1 bardak ayran"
          className="input-field min-h-[100px] resize-none"
          rows={4}
        />
        <p className="text-xs text-gray-500">
          💡 İpucu: Miktarları gram, bardak, kaşık gibi birimlerle belirtin
        </p>
      </div>

      {/* Analiz Butonu */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleAnalyze}
          disabled={!selectedMeal || !description.trim() || isAnalyzing}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analiz Ediliyor...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              AI ile Analiz Et
            </>
          )}
        </button>
        <button
          onClick={handleTestConnection}
          className="btn-secondary px-4"
          title="API Bağlantısını Test Et"
        >
          Test
        </button>
        <button
          onClick={handleCancel}
          className="btn-secondary px-6"
        >
          İptal
        </button>
      </div>

      {/* Test Sonucu */}
      {testResult && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm">{testResult}</p>
        </div>
      )}

      {/* Analiz Sonucu */}
      {analysisResult && (
        <div className="space-y-6 pt-6 border-t border-gray-200/50">
          {/* Besin Değerleri */}
          <div className="bg-gradient-to-r from-success-50 to-emerald-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Besin Değerleri</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">
                  {analysisResult.totalNutrition.calories.toFixed(0)}
                </p>
                <p className="text-sm text-gray-600">kcal</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">
                  {analysisResult.totalNutrition.protein.toFixed(1)}
                </p>
                <p className="text-sm text-gray-600">Protein (g)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">
                  {analysisResult.totalNutrition.carbs.toFixed(1)}
                </p>
                <p className="text-sm text-gray-600">Karb (g)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">
                  {analysisResult.totalNutrition.fat.toFixed(1)}
                </p>
                <p className="text-sm text-gray-600">Yağ (g)</p>
              </div>
            </div>
          </div>

          {/* Tespit Edilen Yiyecekler */}
          {analysisResult.foods.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Tespit Edilen Yiyecekler</h3>
              <div className="space-y-2">
                {analysisResult.foods.map((food: any, index: number) => (
                  <div key={index} className="flex justify-between items-center bg-white/50 rounded-lg p-3">
                    <span className="font-medium text-gray-700">
                      {food.name} ({food.amount}{food.unit})
                    </span>
                    <span className="text-sm text-gray-600">
                      {food.nutrition.calories} kcal
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analizi */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-2">AI Analizi</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              {analysisResult.analysis}
            </p>
          </div>

          {/* Öneriler */}
          {analysisResult.suggestions && (
            <div className="bg-amber-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-2">Öneriler</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                {analysisResult.suggestions}
              </p>
            </div>
          )}

          {/* Kaydet Butonu */}
          <button
            onClick={handleSaveMeal}
            className="btn-primary w-full"
          >
            Öğünü Kaydet
          </button>
        </div>
      )}
    </div>
  )
}