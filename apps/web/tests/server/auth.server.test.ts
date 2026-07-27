// ============================================================================
// lib/auth.server.ts — AI route'larının KAPISI.
//
// Bu fonksiyon AI uç noktalarının anonim kullanıma kapalı kalmasını sağlar.
// `null` dönerse route 401 verir. Gevşetilirse (ör. token doğrulaması atlanır,
// ya da hata durumunda kullanıcı id'si uydurulur) herkes Gemini kotanızı
// harcayabilir hale gelir.
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const getUserMock = vi.fn()
const createClientMock = vi.fn(() => ({ auth: { getUser: getUserMock } }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...(args as [])),
}))

const URL_VAR = 'NEXT_PUBLIC_SUPABASE_URL'
const KEY_VAR = 'NEXT_PUBLIC_SUPABASE_ANON_KEY'

/** Yalnızca `authorization` başlığı okunan minimal bir istek. */
function requestWith(authorization?: string): NextRequest {
  return {
    headers: new Headers(authorization ? { authorization } : {}),
  } as unknown as NextRequest
}

/** Modülü sıfırdan yükler (env değerleri modül yüklenirken okunur). */
async function loadAuthModule() {
  vi.resetModules()
  return import('@/lib/auth.server')
}

describe('getUserIdFromRequest', () => {
  beforeEach(() => {
    vi.stubEnv(URL_VAR, 'https://project.supabase.co')
    vi.stubEnv(KEY_VAR, 'public-anon-key')
    getUserMock.mockReset()
    createClientMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  describe('geçerli token', () => {
    it('kullanıcı id’sini döner', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
      const { getUserIdFromRequest } = await loadAuthModule()

      await expect(getUserIdFromRequest(requestWith('Bearer jwt-abc'))).resolves.toBe('user-1')
      expect(getUserMock).toHaveBeenCalledWith('jwt-abc')
    })

    it('Bearer önekini büyük/küçük harf duyarsız ayıklar', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
      const { getUserIdFromRequest } = await loadAuthModule()

      await getUserIdFromRequest(requestWith('bearer jwt-abc'))
      expect(getUserMock).toHaveBeenCalledWith('jwt-abc')
    })

    it('fazladan boşlukları temizler', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
      const { getUserIdFromRequest } = await loadAuthModule()

      await getUserIdFromRequest(requestWith('Bearer    jwt-abc   '))
      expect(getUserMock).toHaveBeenCalledWith('jwt-abc')
    })

    it('token’ı public anon anahtarıyla doğrular (service_role DEĞİL)', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
      const { getUserIdFromRequest } = await loadAuthModule()
      await getUserIdFromRequest(requestWith('Bearer jwt-abc'))

      expect(createClientMock).toHaveBeenCalledWith(
        'https://project.supabase.co',
        'public-anon-key'
      )
    })
  })

  describe('reddedilen istekler', () => {
    it('Authorization başlığı yoksa null döner', async () => {
      const { getUserIdFromRequest } = await loadAuthModule()
      await expect(getUserIdFromRequest(requestWith())).resolves.toBeNull()
      expect(getUserMock).not.toHaveBeenCalled()
    })

    it('boş başlıkta null döner', async () => {
      const { getUserIdFromRequest } = await loadAuthModule()
      await expect(getUserIdFromRequest(requestWith('   '))).resolves.toBeNull()
    })

    it('token’sız "Bearer" başlığında da erişim vermez', async () => {
      // Not: HTTP başlık değerleri kırpılır, bu yüzden "Bearer " → "Bearer" olur
      // ve önek deseni (\s+ gerektirir) eşleşmez; metin token sanılıp Supabase'e
      // sorulur ve reddedilir. Sonuç yine erişim yok (fail-closed).
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } })
      const { getUserIdFromRequest } = await loadAuthModule()
      await expect(getUserIdFromRequest(requestWith('Bearer '))).resolves.toBeNull()
    })

    it('geçersiz token’da null döner', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } })
      const { getUserIdFromRequest } = await loadAuthModule()
      await expect(getUserIdFromRequest(requestWith('Bearer sahte'))).resolves.toBeNull()
    })

    it('kullanıcı bulunamazsa null döner', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: null })
      const { getUserIdFromRequest } = await loadAuthModule()
      await expect(getUserIdFromRequest(requestWith('Bearer jwt'))).resolves.toBeNull()
    })
  })

  describe('yapılandırma eksikse', () => {
    it.each([URL_VAR, KEY_VAR])('%s yoksa null döner (fail-closed)', async (variable) => {
      vi.stubEnv(variable, '')
      const { getUserIdFromRequest } = await loadAuthModule()

      await expect(getUserIdFromRequest(requestWith('Bearer jwt'))).resolves.toBeNull()
      // Supabase istemcisi hiç kurulmamalı.
      expect(createClientMock).not.toHaveBeenCalled()
    })
  })

  it('her istekte token yeniden doğrulanır (önbelleğe alınmaz)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const { getUserIdFromRequest } = await loadAuthModule()

    await getUserIdFromRequest(requestWith('Bearer jwt-1'))
    await getUserIdFromRequest(requestWith('Bearer jwt-2'))

    expect(getUserMock).toHaveBeenCalledTimes(2)
    expect(getUserMock).toHaveBeenNthCalledWith(1, 'jwt-1')
    expect(getUserMock).toHaveBeenNthCalledWith(2, 'jwt-2')
  })
})
