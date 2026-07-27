// ============================================================================
// errors.ts — hata sınıflandırma ve kullanıcıya gösterilecek mesajlar.
// Kritik: `userMessage` kullanıcıya gider; ham hata metni (anahtar parçaları,
// URL'ler, stack) ASLA sızmamalı. `toAppError` sırası da önemlidir.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { AppError, ERROR_MESSAGES, toAppError, type AppErrorCode } from '@nutrition/core'

describe('AppError', () => {
  it('Error türevidir ve alanlarını korur', () => {
    const error = new AppError('API_ERROR', 'bir şey oldu', { status: 500 })
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
    expect(error.name).toBe('AppError')
    expect(error.code).toBe('API_ERROR')
    expect(error.message).toBe('bir şey oldu')
    expect(error.details).toEqual({ status: 500 })
  })

  it('details opsiyoneldir', () => {
    expect(new AppError('TIMEOUT', 'zaman aşımı').details).toBeUndefined()
  })

  it('throw/catch üzerinden tipi korunur', () => {
    try {
      throw new AppError('RATE_LIMIT', 'çok istek')
    } catch (caught) {
      expect(caught).toBeInstanceOf(AppError)
      expect((caught as AppError).code).toBe('RATE_LIMIT')
    }
  })

  describe('userMessage', () => {
    const cases: [AppErrorCode, string][] = [
      ['INVALID_API_KEY', ERROR_MESSAGES.api.invalidKey],
      ['RATE_LIMIT', ERROR_MESSAGES.api.rateLimit],
      ['QUOTA_EXCEEDED', ERROR_MESSAGES.api.quotaExceeded],
      ['NETWORK_ERROR', ERROR_MESSAGES.api.network],
      ['TIMEOUT', ERROR_MESSAGES.api.timeout],
      ['API_ERROR', ERROR_MESSAGES.api.generic],
      ['UNKNOWN_ERROR', ERROR_MESSAGES.api.generic],
    ]

    it.each(cases)('%s → sabit kullanıcı mesajı', (code, expected) => {
      const error = new AppError(code, 'ham teknik detay: sk-abc123 @ https://api.example.com')
      expect(error.userMessage).toBe(expected)
    })

    it('VALIDATION_ERROR kendi mesajını gösterir (kullanıcıya özel geri bildirim)', () => {
      const error = new AppError('VALIDATION_ERROR', 'Yaş 10-100 aralığında olmalı')
      expect(error.userMessage).toBe('Yaş 10-100 aralığında olmalı')
    })

    it('doğrulama dışındaki kodlarda ham mesaj sızmaz', () => {
      const secretish = 'GEMINI_API_KEY=AIzaSyTEST123 geçersiz'
      for (const [code] of cases) {
        const message = new AppError(code, secretish).userMessage
        expect(message).not.toContain('AIzaSy')
        expect(message).not.toContain('GEMINI_API_KEY')
      }
    })
  })
})

describe('toAppError', () => {
  it('zaten AppError ise aynı nesneyi döner (sarmalamaz)', () => {
    const original = new AppError('TIMEOUT', 'zaman aşımı')
    expect(toAppError(original)).toBe(original)
  })

  describe('API anahtarı hataları', () => {
    it.each([
      'API key not valid',
      'api_key expired',
      'Invalid API-KEY provided',
      'permission denied',
      'invalid x-goog-api-key',
    ])('%j → INVALID_API_KEY', (message) => {
      expect(toAppError(new Error(message)).code).toBe('INVALID_API_KEY')
    })
  })

  describe('oran sınırı hataları', () => {
    it.each(['429 Too Many Requests', 'rate limit reached', 'RATE-LIMIT exceeded'])(
      '%j → RATE_LIMIT',
      (message) => {
        expect(toAppError(new Error(message)).code).toBe('RATE_LIMIT')
      }
    )
  })

  describe('kota hataları', () => {
    it.each(['quota exhausted', 'daily limit exceeded'])('%j → QUOTA_EXCEEDED', (message) => {
      expect(toAppError(new Error(message)).code).toBe('QUOTA_EXCEEDED')
    })
  })

  describe('ağ hataları', () => {
    it.each([
      'network request failed',
      'fetch failed',
      'timeout of 30000ms',
      'connect ETIMEDOUT 1.2.3.4:443',
      'getaddrinfo ENOTFOUND api.example.com',
    ])('%j → NETWORK_ERROR', (message) => {
      expect(toAppError(new Error(message)).code).toBe('NETWORK_ERROR')
    })
  })

  it('eşleşmeyen hata UNKNOWN_ERROR olur ve orijinali details içinde tutar', () => {
    const original = new Error('beklenmedik bir durum')
    const converted = toAppError(original)
    expect(converted.code).toBe('UNKNOWN_ERROR')
    expect(converted.message).toBe('beklenmedik bir durum')
    expect(converted.details).toBe(original)
    // Kullanıcıya jenerik mesaj gider — teknik metin değil.
    expect(converted.userMessage).toBe(ERROR_MESSAGES.api.generic)
  })

  it('sınıflandırma sırası: rate limit, kota kontrolünden önce gelir', () => {
    // "429 quota exceeded" her iki kalıba da uyar; davranış sabitlenir.
    expect(toAppError(new Error('429 quota exceeded')).code).toBe('RATE_LIMIT')
  })

  it('sınıflandırma sırası: API anahtarı her şeyden önce gelir', () => {
    expect(toAppError(new Error('invalid api key, quota exceeded')).code).toBe('INVALID_API_KEY')
  })

  it.each([
    ['metin', 'düz bir hata metni'],
    ['sayı', 42],
    ['null', null],
    ['undefined', undefined],
    ['nesne', { weird: true }],
    ['dizi', [1, 2, 3]],
  ])('Error olmayan girdiyi (%s) güvenle çevirir', (_label, input) => {
    const converted = toAppError(input)
    expect(converted).toBeInstanceOf(AppError)
    expect(typeof converted.userMessage).toBe('string')
    expect(converted.userMessage.length).toBeGreaterThan(0)
  })

  it('boş mesajlı hatada jenerik metne düşer', () => {
    const converted = toAppError(new Error(''))
    expect(converted.code).toBe('UNKNOWN_ERROR')
    expect(converted.message).toBe(ERROR_MESSAGES.api.generic)
  })

  it('asla fırlatmaz — hata yolunun kendisi hata üretemez', () => {
    const nasty = {
      get message() {
        throw new Error('getter patladı')
      },
    }
    expect(() => toAppError(nasty)).not.toThrow()
  })
})
