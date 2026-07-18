'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Droplets, Leaf, LogOut } from 'lucide-react'
import {
  mealLogToEntry,
  recommendFiber,
  recommendWaterLiters,
  type UserProfile,
} from '@nutrition/core'
import { useNutritionStore } from '@/lib/store'
import { authService, databaseService } from '@/lib/services'
import { Logo } from '@/components/ui/Logo'
import DashboardHeader from '@/components/DashboardHeader'
import NutritionOverview from '@/components/NutritionOverview'
import MealLogger from '@/components/MealLogger'
import MealHistory from '@/components/MealHistory'

export default function DashboardPage() {
  const router = useRouter()
  const { dailyProgress, initializeDay, setDailyTargets, setMeals, setFiberWaterTargets } =
    useNutritionStore()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [streak, setStreak] = useState(0)
  const [extra, setExtra] = useState({ fiber: 25, water: 2.5 })

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const bootstrap = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser()
      if (!currentUser) {
        router.push('/auth/login')
        return
      }

      const profile = await authService.getUserProfile(currentUser.id)
      // Profil eksikse onboarding'e yönlendir
      if (!profile.age || !profile.height_cm || !profile.current_weight_kg) {
        router.push('/onboarding')
        return
      }
      setUser(profile)

      // Plan, öğünler ve streak paralel yüklenir (seri await yerine)
      const [plan, mealLogs, streakCount] = await Promise.all([
        databaseService.getActiveNutritionPlan(currentUser.id),
        databaseService.getMealLogs(currentUser.id, todayStr),
        databaseService.getCurrentStreak(currentUser.id),
      ])

      initializeDay(todayStr)

      if (plan) {
        const targets = {
          calories: plan.daily_calories,
          protein: plan.protein_g,
          carbs: plan.carbs_g,
          fat: plan.fat_g,
        }
        setDailyTargets(targets)
        const fiber = plan.fiber_g ?? recommendFiber(targets.calories)
        const water = profile.current_weight_kg
          ? recommendWaterLiters(profile.current_weight_kg)
          : 2.5
        setExtra({ fiber, water })
        setFiberWaterTargets(fiber, water)
      }

      // Koşulsuz: DB'de öğün yoksa (ör. hepsi silinmişse) store da temizlensin.
      setMeals(mealLogs.map(mealLogToEntry))
      setStreak(streakCount)
    } catch {
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }, [router, todayStr, initializeDay, setDailyTargets, setMeals, setFiberWaterTargets])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  const handleSignOut = async () => {
    try {
      await authService.signOut()
      router.push('/')
      router.refresh()
    } catch {
      /* yoksay */
    }
  }

  if (loading || !dailyProgress) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Üst bar */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-neutral-500 sm:block">
              Merhaba,{' '}
              <span className="font-medium text-neutral-800">{user?.name || 'Kullanıcı'}</span>
            </span>
            <button onClick={handleSignOut} className="btn-ghost">
              <LogOut className="h-4 w-4" /> Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <DashboardHeader
          date={today}
          totalCalories={dailyProgress.consumed.calories}
          targetCalories={dailyProgress.target.calories}
          streak={streak}
        />

        <NutritionOverview consumed={dailyProgress.consumed} target={dailyProgress.target} />

        {/* Su & Lif */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-water/10 text-water">
              <Droplets className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Su hedefi</p>
              <p className="font-semibold text-neutral-800">{extra.water} L / gün</p>
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fiber/10 text-fiber">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Lif hedefi</p>
              <p className="font-semibold text-neutral-800">{extra.fiber} g / gün</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <MealLogger userMealCount={user?.meal_count || 3} />
          </div>
          <div className="lg:col-span-2">
            <MealHistory />
          </div>
        </div>
      </main>
    </div>
  )
}
