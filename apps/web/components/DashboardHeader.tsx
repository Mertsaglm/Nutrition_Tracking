'use client'

import { format } from 'date-fns'
import { tr } from 'date-fns/locale/tr'
import { Flame } from 'lucide-react'

interface DashboardHeaderProps {
  date: Date
  totalCalories: number
  targetCalories: number
  streak?: number
}

export default function DashboardHeader({
  date,
  totalCalories,
  targetCalories,
  streak = 0,
}: DashboardHeaderProps) {
  const pct = targetCalories > 0 ? Math.min((totalCalories / targetCalories) * 100, 100) : 0
  const remaining = Math.max(targetCalories - totalCalories, 0)

  return (
    <div className="card mb-8 p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium capitalize text-neutral-500">
            {format(date, 'dd MMMM yyyy, EEEE', { locale: tr })}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-neutral-900">
              {Math.round(totalCalories).toLocaleString('tr-TR')}
            </span>
            <span className="text-lg text-neutral-400">
              / {targetCalories.toLocaleString('tr-TR')} kcal
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {remaining > 0
              ? `${Math.round(remaining).toLocaleString('tr-TR')} kcal kaldı`
              : 'Günlük hedefe ulaştın 🎉'}
          </p>
        </div>

        {streak > 0 && (
          <div className="flex items-center gap-3 self-start rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3">
            <Flame className="h-6 w-6 text-accent-500" />
            <div>
              <p className="text-2xl font-bold leading-none text-accent-600">{streak}</p>
              <p className="text-xs text-accent-700">günlük seri</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
