// ============================================================================
// index.ts — @nutrition/core’un GENEL API YÜZEYİ.
//
// Web ve mobil uygulamaların tamamı bu yüzeye bağlıdır. Bir dışa aktarımın
// silinmesi ya da yeniden adlandırılması iki uygulamayı birden kırar; üstelik
// çekirdek paketin kendi tip kontrolü bunu yakalamaz (kullanan taraf kırılır).
//
// Bu test yüzeyi TAM olarak kilitler. Yeni bir şey eklemek istiyorsan burayı
// da bilinçli olarak güncelle — kaza eseri değişimi böyle ayırt ediyoruz.
// ============================================================================
import { describe, expect, it } from 'vitest'
import * as core from '@nutrition/core'

/** Çalışma zamanında var olması gereken tüm dışa aktarımlar. */
const EXPECTED_EXPORTS = {
  // Sabitler
  APP_CONFIG: 'object',
  AI_CONFIG: 'object',
  MEAL_TYPES: 'object',
  EMPTY_NUTRITION: 'object',
  NUTRITION_RULES: 'object',
  VALIDATION_RULES: 'object',
  ERROR_MESSAGES: 'object',
  // Hatalar
  AppError: 'function',
  toAppError: 'function',
  // Doğrulama
  validateNumber: 'function',
  validateOnboarding: 'function',
  validateMealDescription: 'function',
  // Tarih
  toLocalDateStr: 'function',
  // Hesaplama
  calculateBMR: 'function',
  calculateTDEE: 'function',
  calculateTargetCalories: 'function',
  calculateMacros: 'function',
  recommendFiber: 'function',
  recommendWaterLiters: 'function',
  createMealPlan: 'function',
  selectMealTypes: 'function',
  recommendMealCount: 'function',
  recommendTargetWeeks: 'function',
  createFullNutritionPlan: 'function',
  // Besin veritabanı
  selectRelevantFoods: 'function',
  allFoods: 'function',
  // AI
  buildMealAnalysisPrompt: 'function',
  buildSampleMealPlanPrompt: 'function',
  parseMealAnalysis: 'function',
  parseSampleMealPlan: 'function',
  createAINutritionClient: 'function',
  // Supabase
  createSupabaseClient: 'function',
  // Servisler
  createAuthService: 'function',
  createDatabaseService: 'function',
  mealLogToEntry: 'function',
  // Store
  createNutritionStore: 'function',
  sumNutrition: 'function',
} as const

describe('@nutrition/core genel API', () => {
  it.each(Object.entries(EXPECTED_EXPORTS))('%s dışa aktarılır (%s)', (name, kind) => {
    expect(core, `${name} dışa aktarımı kayboldu`).toHaveProperty(name)
    expect(typeof core[name as keyof typeof core], name).toBe(kind)
  })

  it('yüzeyde fazladan/eksik dışa aktarım yoktur', () => {
    // Bu test kırıldıysa: bilinçli bir ekleme yaptıysan EXPECTED_EXPORTS’a ekle.
    // Beklenmedik bir silme varsa, iki uygulama da kırılmadan önce yakaladın.
    expect(Object.keys(core).sort()).toEqual(Object.keys(EXPECTED_EXPORTS).sort())
  })

  it('AppError gerçekten bir sınıftır', () => {
    const error = new core.AppError('UNKNOWN_ERROR', 'test')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(core.AppError)
  })

  it('fabrika fonksiyonları çağrılabilir nesneler döner', () => {
    expect(typeof core.createAINutritionClient()).toBe('object')
    expect(typeof core.createAINutritionClient().analyzeMeal).toBe('function')
  })

  it('platforma özgü hiçbir modül sızdırmaz', () => {
    // Çekirdek paket saf olmalı: React, Next, Expo veya Node API’si dışa açılmaz.
    const forbidden = /^(use[A-Z]|React|Next|Expo|Platform|AsyncStorage)/
    for (const name of Object.keys(core)) {
      expect(forbidden.test(name), `${name} platforma özgü görünüyor`).toBe(false)
    }
  })

  it('sunucuya özgü sır adları içermez', () => {
    for (const name of Object.keys(core)) {
      expect(name.toUpperCase()).not.toContain('GEMINI')
      expect(name.toUpperCase()).not.toContain('SERVICE_ROLE')
      expect(name.toUpperCase()).not.toContain('SECRET')
    }
  })

  it('kritik fabrikaların beklenen metotları vardır', () => {
    expect(Object.keys(core.createAINutritionClient()).sort()).toEqual([
      'analyzeMeal',
      'generateSampleMealPlan',
    ])
  })
})
