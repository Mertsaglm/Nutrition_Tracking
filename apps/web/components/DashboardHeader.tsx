'use client'

import { format } from 'date-fns'
import { tr } from 'date-fns/locale/tr'
import { Calendar, Target, TrendingUp } from 'lucide-react'

interface DashboardHeaderProps {
  date: Date
  totalCalories: number
  targetCalories: number
}

export default function DashboardHeader({ 
  date, 
  totalCalories, 
  targetCalories 
}: DashboardHeaderProps) {
  const progressPercentage = Math.min((totalCalories / targetCalories) * 100, 100)
  const remainingCalories = Math.max(targetCalories - totalCalories, 0)

  return (
    <div className="glass-card rounded-3xl p-8 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Sol Taraf - Tarih ve Başlık */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-gray-600">
            <Calendar className="w-5 h-5" />
            <span className="font-medium">
              {format(date, 'dd MMMM yyyy, EEEE', { locale: tr })}
            </span>
          </div>
          <h1 className="text-3xl font-bold gradient-text">
            Beslenme Takibi
          </h1>
        </div>

        {/* Sağ Taraf - Kalori Özeti */}
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Günlük Hedef */}
          <div className="flex items-center gap-4 bg-white/50 rounded-2xl p-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Günlük Hedef</p>
              <p className="text-2xl font-bold text-gray-800">
                {targetCalories.toLocaleString()} kcal
              </p>
            </div>
          </div>

          {/* Tüketilen */}
          <div className="flex items-center gap-4 bg-white/50 rounded-2xl p-4">
            <div className="w-12 h-12 bg-gradient-to-br from-success-500 to-success-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Tüketilen</p>
              <p className="text-2xl font-bold text-gray-800">
                {totalCalories.toLocaleString()} kcal
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* İlerleme Çubuğu */}
      <div className="mt-6 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            Günlük İlerleme
          </span>
          <span className="text-sm font-bold text-gray-800">
            %{progressPercentage.toFixed(1)}
          </span>
        </div>
        
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            Kalan: {remainingCalories.toLocaleString()} kcal
          </span>
          <span className="text-gray-600">
            {progressPercentage >= 100 ? 'Hedef tamamlandı! 🎉' : 'Hedefe devam'}
          </span>
        </div>
      </div>
    </div>
  )
}