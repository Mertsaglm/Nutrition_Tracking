// ============================================================================
// lib/env.ts — istemciye gömülen ortam değişkenleri.
//
// GÜVENLİK SÖZLEŞMESİ: Burada YALNIZCA `NEXT_PUBLIC_*` değişkenler bulunur.
// Bir gün biri `GEMINI_API_KEY`i buraya eklerse anahtar tarayıcı paketine
// gömülür ve herkes tarafından okunabilir hale gelir.
//
// Ayrıca eksik yapılandırma, anlaşılmaz bir "undefined" hatası yerine, ne
// yapılacağını söyleyen bir mesajla patlamalıdır.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const URL_VAR = 'NEXT_PUBLIC_SUPABASE_URL'
const KEY_VAR = 'NEXT_PUBLIC_SUPABASE_ANON_KEY'

/** Modülü sıfırdan yükler (ENV modül yüklenirken hesaplanır). */
async function loadEnvModule() {
  vi.resetModules()
  return import('@/lib/env')
}

describe('ENV', () => {
  beforeEach(() => {
    vi.stubEnv(URL_VAR, 'https://project.supabase.co')
    vi.stubEnv(KEY_VAR, 'public-anon-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('değişkenler tanımlıysa değerleri okur', async () => {
    const { ENV } = await loadEnvModule()
    expect(ENV.supabaseUrl).toBe('https://project.supabase.co')
    expect(ENV.supabaseAnonKey).toBe('public-anon-key')
  })

  it('yalnızca iki public alan açar', async () => {
    const { ENV } = await loadEnvModule()
    expect(Object.keys(ENV).sort()).toEqual(['supabaseAnonKey', 'supabaseUrl'])
  })

  it('SUNUCU sırlarını asla dışa vermez', async () => {
    const { ENV } = await loadEnvModule()
    const serialized = JSON.stringify(ENV)
    expect(serialized).not.toContain('GEMINI')
    expect(serialized).not.toContain('service_role')
    expect(Object.keys(ENV)).not.toContain('geminiApiKey')
  })

  it.each([
    [URL_VAR, 'NEXT_PUBLIC_SUPABASE_URL'],
    [KEY_VAR, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  ])('%s eksikse anlaşılır bir hata fırlatır', async (variable, name) => {
    vi.stubEnv(variable, '')
    await expect(loadEnvModule()).rejects.toThrow(new RegExp(name))
  })

  it('hata mesajı hangi dosyaya bakılacağını söyler', async () => {
    vi.stubEnv(URL_VAR, '')
    await expect(loadEnvModule()).rejects.toThrow(/\.env\.local/)
  })

  it('boş metin de eksik sayılır', async () => {
    vi.stubEnv(KEY_VAR, '')
    await expect(loadEnvModule()).rejects.toThrow()
  })
})
