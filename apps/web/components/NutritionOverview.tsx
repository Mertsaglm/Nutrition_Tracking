'use client'

import type { NutritionData } from '@nutrition/core'

interface NutritionOverviewProps {
  consumed: NutritionData
  target: NutritionData
}

interface MacroCardProps {
  label: string
  consumed: number
  target: number
  unit: string
  /** Tailwind renk sınıfı kökü (bg-/text-). */
  colorClass: string
}

function MacroCard({ label, consumed, target, unit, colorClass }: MacroCardProps) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0
  const remaining = Math.max(target - consumed, 0)

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-medium text-neutral-500">{label}</span>
        <span className="text-xs text-neutral-400">%{Math.round(pct)}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-neutral-900">{Math.round(consumed)}</span>
        <span className="text-sm text-neutral-400">
          / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        {remaining > 0 ? `${Math.round(remaining)} ${unit} kaldı` : 'Hedefe ulaşıldı 🎉'}
      </p>
    </div>
  )
}

export default function NutritionOverview({ consumed, target }: NutritionOverviewProps) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MacroCard
        label="Kalori"
        consumed={consumed.calories}
        target={target.calories}
        unit="kcal"
        colorClass="bg-accent-500"
      />
      <MacroCard
        label="Protein"
        consumed={consumed.protein}
        target={target.protein}
        unit="g"
        colorClass="bg-protein"
      />
      <MacroCard
        label="Karbonhidrat"
        consumed={consumed.carbs}
        target={target.carbs}
        unit="g"
        colorClass="bg-carbs"
      />
      <MacroCard
        label="Yağ"
        consumed={consumed.fat}
        target={target.fat}
        unit="g"
        colorClass="bg-fat"
      />
    </div>
  )
}
