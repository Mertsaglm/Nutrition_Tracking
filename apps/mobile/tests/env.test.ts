// ============================================================================
// lib/env.ts — mobil ortam değişkenleri.
//
// GÜVENLİK SÖZLEŞMESİ: `EXPO_PUBLIC_*` değişkenler uygulama paketine GÖMÜLÜR ve
// cihazdan okunabilir. Bu yüzden burada yalnızca public değerler bulunabilir:
// Supabase anon anahtarı (RLS ile korunur) ve API adresi. Gemini anahtarı
// buraya eklenirse APK/IPA içinden çıkarılabilir hale gelir.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const URL_VAR = 'EXPO_PUBLIC_SUPABASE_URL'
const KEY_VAR = 'EXPO_PUBLIC_SUPABASE_ANON_KEY'
const API_VAR = 'EXPO_PUBLIC_API_URL'

async function loadEnvModule() {
  vi.resetModules()
  return import('../lib/env')
}

describe('ENV (mobil)', () => {
  beforeEach(() => {
    vi.stubEnv(URL_VAR, 'https://project.supabase.co')
    vi.stubEnv(KEY_VAR, 'public-anon-key')
    vi.stubEnv(API_VAR, 'https://app.example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('değişkenler tanımlıysa değerleri okur', async () => {
    const { ENV } = await loadEnvModule()
    expect(ENV.supabaseUrl).toBe('https://project.supabase.co')
    expect(ENV.supabaseAnonKey).toBe('public-anon-key')
    expect(ENV.apiUrl).toBe('https://app.example.com')
  })

  it('yalnızca üç public alan açar', async () => {
    const { ENV } = await loadEnvModule()
    expect(Object.keys(ENV).sort()).toEqual(['apiUrl', 'supabaseAnonKey', 'supabaseUrl'])
  })

  it('AI anahtarı içermez (AI çağrıları sunucuya gider)', async () => {
    const { ENV } = await loadEnvModule()
    const serialized = JSON.stringify(ENV).toUpperCase()
    expect(serialized).not.toContain('GEMINI')
    expect(serialized).not.toContain('AIZASY') // Google API anahtarı öneki
  })

  it.each([URL_VAR, KEY_VAR, API_VAR])('%s eksikse anlaşılır hata fırlatır', async (variable) => {
    vi.stubEnv(variable, '')
    await expect(loadEnvModule()).rejects.toThrow(new RegExp(variable))
  })

  it('hata mesajı hangi dosyaya bakılacağını söyler', async () => {
    vi.stubEnv(API_VAR, '')
    await expect(loadEnvModule()).rejects.toThrow(/\.env/)
  })

  it('API adresi olmadan uygulama başlamaz (AI özellikleri çalışmaz)', async () => {
    // Sessizce undefined kalırsa istekler "undefined/api/analyze-meal" adresine gider.
    vi.stubEnv(API_VAR, '')
    await expect(loadEnvModule()).rejects.toThrow()
  })
})
