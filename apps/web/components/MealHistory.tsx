'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale/tr'
import { Clock, Trash2, ChevronDown, ChevronUp, UtensilsCrossed } from 'lucide-react'
import type { MealEntry } from '@nutrition/core'
import { useNutritionStore } from '@/lib/store'
import { databaseService } from '@/lib/services'
import { useToast } from '@/components/ui/Toast'

export default function MealHistory() {
  const { dailyProgress, deleteMealEntry } = useNutritionStore()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDelete = async (id: string) => {
    deleteMealEntry(id) // optimistik
    try {
      await databaseService.deleteMealLog(id)
      toast('success', 'Öğün silindi')
    } catch {
      toast('error', 'Öğün silinirken bir sorun oluştu')
    }
  }

  if (!dailyProgress || dailyProgress.meals.length === 0) {
    return (
      <div className="card p-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
          <UtensilsCrossed className="h-7 w-7 text-neutral-400" />
        </div>
        <h3 className="text-base font-semibold text-neutral-700">Henüz öğün eklenmemiş</h3>
        <p className="mt-1 text-sm text-neutral-500">İlk öğününü ekleyerek takibe başla</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-neutral-900">Bugünkü Öğünler</h2>
      {dailyProgress.meals.map((meal: MealEntry) => {
        const isOpen = expanded.has(meal.id)
        return (
          <div key={meal.id} className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                  {meal.mealType}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-xs text-neutral-400">
                    <Clock className="h-3 w-3" />
                    {format(new Date(meal.timestamp), 'HH:mm', { locale: tr })}
                  </p>
                  <p className="truncate text-sm text-neutral-600">{meal.description}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="text-right">
                  <p className="font-bold text-neutral-900">
                    {Math.round(meal.totalNutrition.calories)}
                    <span className="text-xs font-normal text-neutral-400"> kcal</span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    P {Math.round(meal.totalNutrition.protein)} · K{' '}
                    {Math.round(meal.totalNutrition.carbs)} · Y {Math.round(meal.totalNutrition.fat)}
                  </p>
                </div>
                <button
                  onClick={() => toggle(meal.id)}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100"
                  aria-label="Detay"
                >
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => handleDelete(meal.id)}
                  className="rounded-lg p-2 text-danger hover:bg-danger/10"
                  aria-label="Sil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4">
                {meal.foods.length > 0 && (
                  <div className="space-y-1.5">
                    {meal.foods.map((food, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-neutral-600">
                          {food.name} ({food.amount}
                          {food.unit})
                        </span>
                        <span className="text-neutral-400">
                          {Math.round(food.nutrition.calories)} kcal
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {meal.aiAnalysis && (
                  <div className="rounded-lg bg-protein/5 p-3 text-sm text-neutral-600">
                    {meal.aiAnalysis}
                  </div>
                )}
                {meal.suggestions && (
                  <div className="rounded-lg bg-accent-50 p-3 text-sm text-neutral-600">
                    {meal.suggestions}
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
