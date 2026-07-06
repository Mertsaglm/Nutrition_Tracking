'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale/tr'
import { Clock, Trash2, ChevronDown, ChevronUp, Utensils } from 'lucide-react'
import { useNutritionStore } from '@/lib/nutrition-store'
import { databaseService } from '@/lib/database-service'
import { authService } from '@/lib/auth'
import { MealEntry } from '@/lib/types'

export default function MealHistory() {
  const { dailyProgress, deleteMealEntry } = useNutritionStore()
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set())

  if (!dailyProgress || dailyProgress.meals.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Utensils className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Henüz öğün eklenmemiş
        </h3>
        <p className="text-gray-500">
          İlk öğününüzü ekleyerek günlük takibinizi başlatın
        </p>
      </div>
    )
  }

  const toggleMealExpansion = (mealId: string) => {
    const newExpanded = new Set(expandedMeals)
    if (newExpanded.has(mealId)) {
      newExpanded.delete(mealId)
    } else {
      newExpanded.add(mealId)
    }
    setExpandedMeals(newExpanded)
  }

  const handleDeleteMeal = async (mealId: string) => {
    if (confirm('Bu öğünü silmek istediğinizden emin misiniz?')) {
      try {
        // Önce local store'dan sil (hızlı UI güncellemesi için)
        deleteMealEntry(mealId)
        
        // Sonra database'den sil
        await databaseService.deleteMealLog(mealId)
        console.log('Öğün database\'den silindi')
      } catch (error) {
        console.error('Öğün silinirken hata:', error)
        alert('Öğün silinirken bir hata oluştu.')
      }
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Günlük Öğünler</h2>
      
      {dailyProgress.meals.map((meal: MealEntry) => {
        const isExpanded = expandedMeals.has(meal.id)
        
        return (
          <div key={meal.id} className="meal-card">
            {/* Öğün Başlığı */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                  <Utensils className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{meal.mealType}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    {format(new Date(meal.timestamp), 'HH:mm', { locale: tr })}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="font-bold text-gray-800">
                    {meal.totalNutrition.calories.toFixed(0)} kcal
                  </p>
                  <p className="text-sm text-gray-600">
                    P: {meal.totalNutrition.protein.toFixed(1)}g • 
                    K: {meal.totalNutrition.carbs.toFixed(1)}g • 
                    Y: {meal.totalNutrition.fat.toFixed(1)}g
                  </p>
                </div>
                
                <button
                  onClick={() => toggleMealExpansion(meal.id)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                </button>
                
                <button
                  onClick={() => handleDeleteMeal(meal.id)}
                  className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Açıklama */}
            <div className="mb-4">
              <p className="text-gray-700 bg-gray-50 rounded-lg p-3 text-sm">
                "{meal.description}"
              </p>
            </div>

            {/* Genişletilmiş İçerik */}
            {isExpanded && (
              <div className="space-y-4 pt-4 border-t border-gray-200/50">
                {/* Tespit Edilen Yiyecekler */}
                {meal.foods.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-800 mb-3">Tespit Edilen Yiyecekler</h4>
                    <div className="grid gap-2">
                      {meal.foods.map((food, index) => (
                        <div key={index} className="flex justify-between items-center bg-white/70 rounded-lg p-3">
                          <span className="text-gray-700">
                            {food.name} ({food.amount}{food.unit})
                          </span>
                          <div className="text-sm text-gray-600">
                            {food.nutrition.calories.toFixed(0)} kcal
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Analizi */}
                {meal.aiAnalysis && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">AI Analizi</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {meal.aiAnalysis}
                    </p>
                  </div>
                )}

                {/* Öneriler */}
                {meal.suggestions && (
                  <div className="bg-amber-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">Öneriler</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {meal.suggestions}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}