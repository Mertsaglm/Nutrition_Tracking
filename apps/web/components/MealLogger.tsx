'use client'

import { useMemo, useState } from 'react'
import { Plus, Loader2, Sparkles, Clock, X } from 'lucide-react'
import {
  mealLogToEntry,
  selectMealTypes,
  validateMealDescription,
  type MealAnalysisResult,
  type MealEntry,
} from '@nutrition/core'
import { useNutritionStore } from '@/lib/store'
import { aiClient } from '@/lib/ai'
import { databaseService, authService } from '@/lib/services'
import { useToast } from '@/components/ui/Toast'

export default function MealLogger({ userMealCount = 3 }: { userMealCount?: number }) {
  const { dailyProgress, addMealEntry } = useNutritionStore()
  const { toast } = useToast()

  const [isOpen, setIsOpen] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState('')
  const [description, setDescription] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<MealAnalysisResult | null>(null)

  const dailyTargetCalories = dailyProgress?.target.calories ?? 0

  // Beslenme planıyla AYNI öğün listesi (tek kaynak: @nutrition/core).
  const mealTypes = useMemo(() => selectMealTypes(userMealCount), [userMealCount])

  const reset = () => {
    setIsOpen(false)
    setSelectedMeal('')
    setDescription('')
    setResult(null)
  }

  const handleAnalyze = async () => {
    if (!selectedMeal) {
      toast('warning', 'Önce bir öğün türü seç')
      return
    }
    const valid = validateMealDescription(description)
    if (!valid.ok) {
      toast('warning', valid.message ?? 'Geçersiz açıklama')
      return
    }

    // FIX: hedef kalori, gerçek günlük hedeften × öğün oranı hesaplanır (önceden hep 0'dı).
    const ratio = mealTypes.find((m) => m.name === selectedMeal)?.targetRatio ?? 0.25
    const targetCalories = Math.round((dailyTargetCalories || 2000) * ratio)

    setIsAnalyzing(true)
    try {
      const analysis = await aiClient.analyzeMeal(description, selectedMeal, targetCalories)
      setResult(analysis)
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Analiz yapılamadı')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!result || !selectedMeal) return
    try {
      const user = await authService.getCurrentUser()
      if (!user) {
        toast('error', 'Öğünü kaydetmek için giriş yapmalısın')
        return
      }
      const entry: MealEntry = {
        id: '', // DB gen_random_uuid() atayacak
        mealType: selectedMeal,
        description,
        foods: result.foods,
        totalNutrition: result.totalNutrition,
        timestamp: new Date(),
        aiAnalysis: result.analysis,
        suggestions: result.suggestions,
      }
      // DB'ye yaz, sonra store'a DB'nin döndürdüğü GERÇEK kaydı (UUID id) ekle.
      // Böylece daha sonra silme, DB id'siyle eşleşir (önceki Date.now() id hatası giderildi).
      const saved = await databaseService.saveMealLog(user.id, entry)
      addMealEntry(mealLogToEntry(saved))
      toast('success', `${selectedMeal} öğünü kaydedildi`)
      reset()
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Öğün kaydedilemedi')
    }
  }

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="btn-primary w-full py-4">
        <Plus className="h-5 w-5" /> Yeni Öğün Ekle
      </button>
    )
  }

  return (
    <div className="card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">Yeni Öğün</h2>
        </div>
        <button onClick={reset} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Öğün türü */}
      <label className="label">Öğün Türü</label>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {mealTypes.map((meal) => {
          const active = selectedMeal === meal.name
          return (
            <button
              key={meal.name}
              onClick={() => setSelectedMeal(meal.name)}
              className={`select-tile ${active ? 'select-tile-active' : ''}`}
            >
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Clock className="h-3.5 w-3.5" />
                {meal.name}
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                {Math.round((dailyTargetCalories || 2000) * meal.targetRatio)} kcal · {meal.time}
              </p>
            </button>
          )
        })}
      </div>

      {/* Açıklama */}
      <label className="label">Ne yedin?</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Örnek: 200g tavuk göğsü, 150g pirinç pilavı, 1 kase mevsim salata"
        className="input min-h-[100px] resize-none"
        rows={4}
      />
      <p className="mt-1.5 text-xs text-neutral-400">
        💡 Miktarları gram, adet veya dilim gibi belirtmen analizi güçlendirir
      </p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleAnalyze}
          disabled={!selectedMeal || !description.trim() || isAnalyzing}
          className="btn-primary flex-1"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analiz ediliyor…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> AI ile Analiz Et
            </>
          )}
        </button>
      </div>

      {/* Sonuç */}
      {result && (
        <div className="mt-6 space-y-4 border-t border-neutral-200 pt-6">
          <div className="grid grid-cols-4 gap-3 rounded-xl bg-brand-50 p-4 text-center">
            <Stat value={result.totalNutrition.calories} label="kcal" />
            <Stat value={result.totalNutrition.protein} label="Protein" />
            <Stat value={result.totalNutrition.carbs} label="Karb" />
            <Stat value={result.totalNutrition.fat} label="Yağ" />
          </div>

          {result.foods.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-neutral-700">Tespit edilenler</h3>
              <div className="space-y-1.5">
                {result.foods.map((food, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm"
                  >
                    <span className="text-neutral-700">
                      {food.name} ({food.amount}
                      {food.unit})
                    </span>
                    <span className="text-neutral-500">
                      {Math.round(food.nutrition.calories)} kcal
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.analysis && (
            <div className="rounded-xl bg-protein/5 p-4">
              <h3 className="mb-1 text-sm font-semibold text-neutral-700">AI Yorumu</h3>
              <p className="text-sm leading-relaxed text-neutral-600">{result.analysis}</p>
            </div>
          )}
          {result.suggestions && (
            <div className="rounded-xl bg-accent-50 p-4">
              <h3 className="mb-1 text-sm font-semibold text-neutral-700">Öneri</h3>
              <p className="text-sm leading-relaxed text-neutral-600">{result.suggestions}</p>
            </div>
          )}

          <button onClick={handleSave} className="btn-primary w-full">
            Öğünü Kaydet
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-xl font-bold text-neutral-900">{Math.round(value)}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  )
}
