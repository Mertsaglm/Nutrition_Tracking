// ============================================================================
// Girdi doğrulama yardımcıları (onboarding + öğün formları)
// ============================================================================
import { VALIDATION_RULES } from './config'

export interface FieldResult {
  ok: boolean
  message?: string
}

/** Bir sayısal alanı parse edip [min,max] aralığında doğrular. */
export function validateNumber(
  raw: string | number | null | undefined,
  range: { min: number; max: number },
  label: string
): FieldResult {
  const value = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(',', '.'))
  if (raw === '' || raw == null || Number.isNaN(value)) {
    return { ok: false, message: `${label} girilmelidir` }
  }
  if (value < range.min || value > range.max) {
    return { ok: false, message: `${label} ${range.min}-${range.max} aralığında olmalı` }
  }
  return { ok: true }
}

export interface OnboardingInput {
  age: string | number
  height_cm: string | number
  current_weight_kg: string | number
  target_weight_kg: string | number
  target_weeks?: string | number
}

/** Onboarding fiziksel/hedef alanlarını topluca doğrular. */
export function validateOnboarding(input: OnboardingInput): {
  ok: boolean
  errors: Record<string, string>
} {
  const checks: Array<[string, FieldResult]> = [
    ['age', validateNumber(input.age, VALIDATION_RULES.age, 'Yaş')],
    ['height_cm', validateNumber(input.height_cm, VALIDATION_RULES.height_cm, 'Boy')],
    [
      'current_weight_kg',
      validateNumber(input.current_weight_kg, VALIDATION_RULES.weight_kg, 'Mevcut kilo'),
    ],
    [
      'target_weight_kg',
      validateNumber(input.target_weight_kg, VALIDATION_RULES.weight_kg, 'Hedef kilo'),
    ],
  ]
  if (input.target_weeks !== undefined && input.target_weeks !== '') {
    checks.push([
      'target_weeks',
      validateNumber(input.target_weeks, VALIDATION_RULES.target_weeks, 'Hedef süre'),
    ])
  }

  const errors: Record<string, string> = {}
  for (const [field, result] of checks) {
    if (!result.ok && result.message) errors[field] = result.message
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

/** Öğün açıklaması doğrulama. */
export function validateMealDescription(description: string): FieldResult {
  const trimmed = description.trim()
  const { minLength, maxLength } = VALIDATION_RULES.meal.description
  if (trimmed.length < minLength) {
    return { ok: false, message: `Lütfen en az ${minLength} karakter yaz` }
  }
  if (trimmed.length > maxLength) {
    return { ok: false, message: `En fazla ${maxLength} karakter` }
  }
  return { ok: true }
}
