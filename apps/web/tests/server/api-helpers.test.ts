// ============================================================================
// lib/api.ts — API route yanıt zarfı + CORS.
//
// Mobil uygulama bu uç noktaları cross-origin çağırır ve @nutrition/core'daki
// AI istemcisi `{ success, data, error }` zarfını bekler. Zarf biçimi ya da
// CORS başlıkları değişirse mobil uygulama sessizce çalışmaz — web çalışmaya
// devam ettiği için fark edilmesi zordur.
// ============================================================================
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError, ERROR_MESSAGES } from '@nutrition/core'
import { apiCatch, apiError, apiOptions, apiSuccess } from '@/lib/api'

describe('apiSuccess', () => {
  it('başarı zarfı döner', async () => {
    const response = apiSuccess({ calories: 500 })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: { calories: 500 } })
  })

  it('boş veri (null) da zarflanır', async () => {
    await expect(apiSuccess(null).json()).resolves.toEqual({ success: true, data: null })
  })

  it('CORS başlıklarını ekler', () => {
    const response = apiSuccess({})
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})

describe('apiError', () => {
  it('hata zarfı ve varsayılan 500 döner', async () => {
    const response = apiError('bir şeyler ters gitti')
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'bir şeyler ters gitti',
    })
  })

  it.each([400, 401, 403, 429])('verilen durum kodunu (%i) kullanır', (status) => {
    expect(apiError('hata', status).status).toBe(status)
  })

  it('hata yanıtlarında da CORS başlıkları bulunur', () => {
    // Aksi halde mobil istemci hatayı okuyamaz, jenerik ağ hatası gösterir.
    const response = apiError('yetkisiz', 401)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('data alanı içermez', async () => {
    await expect(apiError('hata').json()).resolves.not.toHaveProperty('data')
  })
})

describe('apiOptions (preflight)', () => {
  it('204 ve gövdesiz yanıt döner', () => {
    const response = apiOptions()
    expect(response.status).toBe(204)
    expect(response.body).toBeNull()
  })

  it('izin verilen metot ve başlıkları bildirir', () => {
    const response = apiOptions()
    const methods = response.headers.get('Access-Control-Allow-Methods') ?? ''
    const headers = response.headers.get('Access-Control-Allow-Headers') ?? ''

    expect(methods).toContain('POST')
    expect(methods).toContain('OPTIONS')
    expect(headers).toContain('Content-Type')
    // Kimlik doğrulama başlığı olmadan mobil istemci token gönderemez.
    expect(headers).toContain('Authorization')
  })
})

describe('apiCatch', () => {
  // Kod bilinçli olarak sunucuya log basar; test çıktısını kirletmesin.
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('AppError’ı kullanıcı dostu mesaja çevirir', async () => {
    const response = apiCatch(new AppError('RATE_LIMIT', 'Gemini 429 rate limit'))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: ERROR_MESSAGES.api.rateLimit,
    })
  })

  it('bilinmeyen hatayı jenerik mesajla döner', async () => {
    const response = apiCatch(new Error('ECONNRESET at internal/stream'))
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: ERROR_MESSAGES.api.generic,
    })
  })

  it('TEKNİK DETAYI kullanıcıya sızdırmaz', async () => {
    // Sunucu tarafı mesajlar API anahtarı, dosya yolu, stack içerebilir.
    const leaky = new Error('Invalid api key AIzaSyTEST123 at /app/lib/gemini.server.ts:29')
    const body = (await apiCatch(leaky).json()) as { error: string }

    expect(body.error).not.toContain('AIzaSy')
    expect(body.error).not.toContain('gemini.server.ts')
    expect(body.error).toBe(ERROR_MESSAGES.api.invalidKey)
  })

  it('sunucu tarafında hata kodunu log’lar', () => {
    apiCatch(new AppError('QUOTA_EXCEEDED', 'kota doldu'))
    expect(consoleError).toHaveBeenCalledWith('[API]', 'QUOTA_EXCEEDED', 'kota doldu')
  })

  it('Error olmayan girdilerde de çökmez', async () => {
    for (const input of ['metin hata', null, undefined, 42, { a: 1 }]) {
      const response = apiCatch(input)
      expect(response.status).toBe(500)
      const body = (await response.json()) as { success: boolean; error: string }
      expect(body.success).toBe(false)
      expect(typeof body.error).toBe('string')
    }
    expect(consoleError).toHaveBeenCalled()
  })

  it('CORS başlıklarını korur', () => {
    expect(apiCatch(new Error('x')).headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})
