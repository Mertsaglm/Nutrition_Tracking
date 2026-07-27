// ============================================================================
// validation.ts — form girdisi doğrulama.
// Bu katman, hesaplama motoruna saçma değer girmesini engelleyen tek bariyer.
// Gevşetilirse (ör. aralık kontrolünün kaldırılması) kullanıcı 0 kg / 500 yaş
// gibi girdilerle anlamsız kalori hedefleri alır.
// ============================================================================
import { describe, expect, it } from 'vitest'
import {
  VALIDATION_RULES,
  validateMealDescription,
  validateNumber,
  validateOnboarding,
} from '@nutrition/core'

const AGE = VALIDATION_RULES.age

describe('validateNumber', () => {
  it('aralık içindeki sayıyı kabul eder', () => {
    expect(validateNumber(30, AGE, 'Yaş')).toEqual({ ok: true })
  })

  it('metin girdiyi sayıya çevirir', () => {
    expect(validateNumber('30', AGE, 'Yaş').ok).toBe(true)
  })

  it('Türkçe ondalık ayracını (virgül) kabul eder', () => {
    // Mobil klavyede ve tr-TR yerelinde kullanıcı "72,5" yazar.
    expect(validateNumber('72,5', VALIDATION_RULES.weight_kg, 'Kilo').ok).toBe(true)
  })

  it('nokta ondalığı da kabul eder', () => {
    expect(validateNumber('72.5', VALIDATION_RULES.weight_kg, 'Kilo').ok).toBe(true)
  })

  it('baştaki/sondaki boşluğu tolere eder', () => {
    expect(validateNumber('  30  ', AGE, 'Yaş').ok).toBe(true)
  })

  it.each([
    ['boş metin', ''],
    ['null', null],
    ['undefined', undefined],
    ['harf', 'abc'],
    ['sadece boşluk', '   '],
    ['NaN', Number.NaN],
  ])('%s girdisini reddeder ve "girilmelidir" der', (_label, input) => {
    const result = validateNumber(input as never, AGE, 'Yaş')
    expect(result.ok).toBe(false)
    expect(result.message).toBe('Yaş girilmelidir')
  })

  it('sınır değerleri kapsayıcıdır (min ve max dahil)', () => {
    expect(validateNumber(AGE.min, AGE, 'Yaş').ok).toBe(true)
    expect(validateNumber(AGE.max, AGE, 'Yaş').ok).toBe(true)
  })

  it('aralık dışını reddeder ve sınırları mesajda gösterir', () => {
    const tooLow = validateNumber(AGE.min - 1, AGE, 'Yaş')
    expect(tooLow.ok).toBe(false)
    expect(tooLow.message).toBe(`Yaş ${AGE.min}-${AGE.max} aralığında olmalı`)

    expect(validateNumber(AGE.max + 1, AGE, 'Yaş').ok).toBe(false)
  })

  it('negatif ve sonsuz değerleri reddeder', () => {
    expect(validateNumber(-5, AGE, 'Yaş').ok).toBe(false)
    expect(validateNumber(Number.POSITIVE_INFINITY, AGE, 'Yaş').ok).toBe(false)
    expect(validateNumber(Number.NEGATIVE_INFINITY, AGE, 'Yaş').ok).toBe(false)
  })

  it('sıfırı "boş" saymaz — aralık kuralına göre değerlendirir', () => {
    // `raw == null` kontrolü 0'ı yakalamamalı (bilinen JS tuzağı).
    const result = validateNumber(0, { min: 0, max: 10 }, 'Değer')
    expect(result.ok).toBe(true)
  })

  it('etiket mesajlara birebir yansır', () => {
    expect(validateNumber('', AGE, 'Hedef kilo').message).toBe('Hedef kilo girilmelidir')
  })
})

describe('validateOnboarding', () => {
  const validInput = {
    age: '30',
    height_cm: '180',
    current_weight_kg: '80',
    target_weight_kg: '75',
  }

  it('geçerli girdiyi kabul eder', () => {
    const result = validateOnboarding(validInput)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('sayısal girdiyi de kabul eder', () => {
    expect(
      validateOnboarding({
        age: 30,
        height_cm: 180,
        current_weight_kg: 80,
        target_weight_kg: 75,
      }).ok
    ).toBe(true)
  })

  it.each([
    ['age', 'Yaş'],
    ['height_cm', 'Boy'],
    ['current_weight_kg', 'Mevcut kilo'],
    ['target_weight_kg', 'Hedef kilo'],
  ])('%s alanı eksikse o alanda hata üretir', (field, label) => {
    const result = validateOnboarding({ ...validInput, [field]: '' })
    expect(result.ok).toBe(false)
    expect(Object.keys(result.errors)).toEqual([field])
    expect(result.errors[field]).toContain(label)
  })

  it('birden fazla hatayı aynı anda toplar', () => {
    const result = validateOnboarding({
      age: '',
      height_cm: '500',
      current_weight_kg: 'abc',
      target_weight_kg: '75',
    })
    expect(result.ok).toBe(false)
    expect(Object.keys(result.errors).sort()).toEqual(['age', 'current_weight_kg', 'height_cm'])
  })

  it('dört zorunlu alanı da doğrular (hiçbiri atlanmaz)', () => {
    const result = validateOnboarding({
      age: '',
      height_cm: '',
      current_weight_kg: '',
      target_weight_kg: '',
    })
    expect(Object.keys(result.errors).sort()).toEqual([
      'age',
      'current_weight_kg',
      'height_cm',
      'target_weight_kg',
    ])
  })

  describe('target_weeks (opsiyonel)', () => {
    it('verilmediğinde doğrulanmaz', () => {
      expect(validateOnboarding(validInput).ok).toBe(true)
    })

    it('boş metin verildiğinde doğrulanmaz', () => {
      expect(validateOnboarding({ ...validInput, target_weeks: '' }).ok).toBe(true)
    })

    it('geçerli değeri kabul eder', () => {
      expect(validateOnboarding({ ...validInput, target_weeks: '12' }).ok).toBe(true)
    })

    it.each([
      ['0 (min altı)', '0'],
      ['200 (max üstü)', '200'],
      ['metin', 'yakında'],
    ])('geçersiz değeri (%s) reddeder', (_label, value) => {
      const result = validateOnboarding({ ...validInput, target_weeks: value })
      expect(result.ok).toBe(false)
      expect(result.errors.target_weeks).toBeDefined()
    })

    it('sınır değerleri kabul eder', () => {
      expect(
        validateOnboarding({ ...validInput, target_weeks: VALIDATION_RULES.target_weeks.min }).ok
      ).toBe(true)
      expect(
        validateOnboarding({ ...validInput, target_weeks: VALIDATION_RULES.target_weeks.max }).ok
      ).toBe(true)
    })
  })
})

describe('validateMealDescription', () => {
  const { minLength, maxLength } = VALIDATION_RULES.meal.description

  it('yeterince uzun açıklamayı kabul eder', () => {
    expect(validateMealDescription('200g tavuk göğsü ve pilav')).toEqual({ ok: true })
  })

  it('minimum uzunluğu tam karşılayanı kabul eder', () => {
    expect(validateMealDescription('a'.repeat(minLength)).ok).toBe(true)
  })

  it('kısa açıklamayı reddeder', () => {
    const result = validateMealDescription('a'.repeat(minLength - 1))
    expect(result.ok).toBe(false)
    expect(result.message).toBe(`Lütfen en az ${minLength} karakter yaz`)
  })

  it('boş metni reddeder', () => {
    expect(validateMealDescription('').ok).toBe(false)
  })

  it('yalnızca boşluktan oluşan metni reddeder (trim uygulanır)', () => {
    // Kullanıcı boşluk basarak AI çağrısı tetikleyememeli (maliyet koruması).
    expect(validateMealDescription('        ').ok).toBe(false)
  })

  it('uzunluğu trim sonrası ölçer', () => {
    expect(validateMealDescription(`   ${'a'.repeat(minLength)}   `).ok).toBe(true)
    expect(validateMealDescription(`   ${'a'.repeat(minLength - 1)}   `).ok).toBe(false)
  })

  it('maksimum uzunluğu tam karşılayanı kabul eder', () => {
    expect(validateMealDescription('a'.repeat(maxLength)).ok).toBe(true)
  })

  it('çok uzun açıklamayı reddeder (prompt maliyeti koruması)', () => {
    const result = validateMealDescription('a'.repeat(maxLength + 1))
    expect(result.ok).toBe(false)
    expect(result.message).toBe(`En fazla ${maxLength} karakter`)
  })

  it('Türkçe karakterleri doğru sayar', () => {
    expect(validateMealDescription('şşş').ok).toBe(true)
  })

  it('yeni satır içeren açıklamayı kabul eder', () => {
    expect(validateMealDescription('2 yumurta\n1 dilim ekmek').ok).toBe(true)
  })
})
