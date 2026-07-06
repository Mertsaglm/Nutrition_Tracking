'use client'

import { NutritionData } from '@/lib/types'
import { Activity, Zap, Droplets, Flame } from 'lucide-react'

interface NutritionOverviewProps {
  consumed: NutritionData
  target: NutritionData
}

export default function NutritionOverview({ consumed, target }: NutritionOverviewProps) {
  const nutrients = [
    {
      name: 'Kalori',
      consumed: consumed.calories,
      target: target.calories,
      unit: 'kcal',
      icon: Flame,
      color: 'from-red-500 to-orange-500',
      bgColor: 'bg-red-50',
    },
    {
      name: 'Protein',
      consumed: consumed.protein,
      target: target.protein,
      unit: 'g',
      icon: Activity,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Karbonhidrat',
      consumed: consumed.carbs,
      target: target.carbs,
      unit: 'g',
      icon: Zap,
      color: 'from-yellow-500 to-amber-500',
      bgColor: 'bg-yellow-50',
    },
    {
      name: 'Yağ',
      consumed: consumed.fat,
      target: target.fat,
      unit: 'g',
      icon: Droplets,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {nutrients.map((nutrient) => {
        const percentage = Math.min((nutrient.consumed / nutrient.target) * 100, 100)
        const remaining = Math.max(nutrient.target - nutrient.consumed, 0)
        const Icon = nutrient.icon

        return (
          <div key={nutrient.name} className="glass-card rounded-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${nutrient.bgColor} rounded-xl flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-gray-700" />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600 font-medium">{nutrient.name}</p>
                <p className="text-lg font-bold text-gray-800">
                  {nutrient.consumed.toFixed(1)} / {nutrient.target} {nutrient.unit}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">İlerleme</span>
                <span className="text-xs font-semibold text-gray-800">
                  %{percentage.toFixed(1)}
                </span>
              </div>
              
              <div className="h-2 bg-gray-200/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${nutrient.color} rounded-full transition-all duration-500 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              
              <p className="text-xs text-gray-600">
                Kalan: {remaining.toFixed(1)} {nutrient.unit}
              </p>
            </div>

            {/* Status */}
            <div className="mt-3 pt-3 border-t border-gray-200/50">
              {percentage >= 100 ? (
                <span className="text-xs font-medium text-success-600 bg-success-50 px-2 py-1 rounded-full">
                  ✓ Hedef tamamlandı
                </span>
              ) : percentage >= 80 ? (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  ⚡ Hedefe yakın
                </span>
              ) : (
                <span className="text-xs font-medium text-gray-600 bg-gray-50 px-2 py-1 rounded-full">
                  📈 Devam et
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}