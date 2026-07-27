// ============================================================================
// services/auth-service.ts — Supabase Auth sarmalayıcı.
//
// Önemli tasarım kararı: profil kaydını DB trigger'ı (on_auth_user_created)
// oluşturur. Eskiden istemci setTimeout + manuel insert yapıyordu ve kayıt
// sırasında yarış koşulu oluşuyordu. Testler o kırılgan yolun geri gelmesini
// engeller.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { createAuthService } from '@nutrition/core'
import {
  type QueryResult,
  type RecordedQuery,
  createFakeSupabase,
  fail,
  ok,
} from '../../../tests/helpers/fake-supabase'

function setup(options: {
  auth?: Record<string, unknown>
  respond?: (query: RecordedQuery) => QueryResult | undefined
} = {}) {
  const fake = createFakeSupabase(options as never)
  return { fake, service: createAuthService(fake.client) }
}

const SESSION = { access_token: 'jwt-abc', user: { id: 'user-1' } }
const USER = { id: 'user-1', email: 'test@example.com' }

const PROFILE = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Mert',
  age: 30,
  gender: 'male',
  height_cm: 180,
  current_weight_kg: 80,
  target_weight_kg: 75,
  activity_level: 'moderate',
  goal: 'lose_weight',
  dietary_preferences: [],
  allergies: [],
  meal_count: 3,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('signUp', () => {
  it('e-posta, parola ve ismi Supabase’e iletir', async () => {
    const { fake, service } = setup({
      auth: { signUp: { data: { user: USER, session: SESSION }, error: null } },
    })

    const result = await service.signUp({
      email: 'test@example.com',
      password: 'gizli-parola',
      name: 'Mert',
    })

    expect(fake.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'gizli-parola',
      options: { data: { name: 'Mert' } },
    })
    expect(result).toEqual({ user: USER, session: SESSION })
  })

  it('profil satırını ELLE oluşturmaz (DB trigger’ının işi)', async () => {
    const { fake, service } = setup({
      auth: { signUp: { data: { user: USER, session: null }, error: null } },
    })

    await service.signUp({ email: 'a@b.com', password: 'p', name: 'A' })

    // Hiçbir tabloya yazma yapılmamalı.
    expect(fake.queries).toHaveLength(0)
    expect(fake.client.from).not.toHaveBeenCalled()
  })

  it('hata durumunda fırlatır', async () => {
    const { service } = setup({
      auth: { signUp: { data: null, error: { message: 'Bu e-posta zaten kayıtlı' } } },
    })

    await expect(
      service.signUp({ email: 'a@b.com', password: 'p', name: 'A' })
    ).rejects.toMatchObject({ message: 'Bu e-posta zaten kayıtlı' })
  })
})

describe('signIn', () => {
  it('parola ile giriş yapar', async () => {
    const { fake, service } = setup({
      auth: { signInWithPassword: { data: { user: USER, session: SESSION }, error: null } },
    })

    const result = await service.signIn({ email: 'test@example.com', password: 'gizli' })

    expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'gizli',
    })
    expect(result.session).toEqual(SESSION)
  })

  it('hatalı bilgide fırlatır', async () => {
    const { service } = setup({
      auth: { signInWithPassword: { data: null, error: { message: 'Invalid login credentials' } } },
    })
    await expect(service.signIn({ email: 'a@b.com', password: 'yanlış' })).rejects.toBeTruthy()
  })
})

describe('signOut', () => {
  it('oturumu kapatır', async () => {
    const { fake, service } = setup()
    await service.signOut()
    expect(fake.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('hata durumunda fırlatır', async () => {
    const { service } = setup({ auth: { signOut: { error: { message: 'çıkış yapılamadı' } } } })
    await expect(service.signOut()).rejects.toBeTruthy()
  })
})

describe('getSession', () => {
  it('mevcut oturumu döner', async () => {
    const { service } = setup({ auth: { getSession: { data: { session: SESSION }, error: null } } })
    await expect(service.getSession()).resolves.toEqual(SESSION)
  })

  it('oturum yoksa null döner (hata değil)', async () => {
    const { service } = setup({ auth: { getSession: { data: { session: null }, error: null } } })
    await expect(service.getSession()).resolves.toBeNull()
  })

  it('hata durumunda fırlatır', async () => {
    const { service } = setup({
      auth: { getSession: { data: { session: null }, error: { message: 'token bozuk' } } },
    })
    await expect(service.getSession()).rejects.toBeTruthy()
  })
})

describe('getCurrentUser', () => {
  it('mevcut kullanıcıyı döner', async () => {
    const { service } = setup({ auth: { getUser: { data: { user: USER }, error: null } } })
    await expect(service.getCurrentUser()).resolves.toEqual(USER)
  })

  it('kullanıcı yoksa null döner', async () => {
    const { service } = setup({ auth: { getUser: { data: { user: null }, error: null } } })
    await expect(service.getCurrentUser()).resolves.toBeNull()
  })

  it('hata durumunda fırlatır', async () => {
    const { service } = setup({
      auth: { getUser: { data: { user: null }, error: { message: 'oturum geçersiz' } } },
    })
    await expect(service.getCurrentUser()).rejects.toBeTruthy()
  })
})

describe('getUserProfile', () => {
  it('profili id ile getirir', async () => {
    const { fake, service } = setup({ respond: () => ok(PROFILE) })

    const result = await service.getUserProfile('user-1')

    const query = fake.onlyQuery()
    expect(query.table).toBe('user_profiles')
    expect(query.argsOf('select')).toEqual(['*'])
    expect(query.filterValue('eq', 'id')).toBe('user-1')
    expect(query.terminal).toBe('single')
    expect(result).toBe(PROFILE)
  })

  it('profil bulunamazsa fırlatır', async () => {
    const { service } = setup({ respond: () => fail('no rows', 'PGRST116') })
    await expect(service.getUserProfile('user-1')).rejects.toBeTruthy()
  })
})

describe('updateUserProfile', () => {
  it('yalnızca verilen alanları günceller', async () => {
    const { fake, service } = setup({ respond: () => ok({ ...PROFILE, age: 31 }) })

    const result = await service.updateUserProfile('user-1', { age: 31, goal: 'maintain' })

    const query = fake.onlyQuery()
    expect(query.table).toBe('user_profiles')
    expect(query.payload).toEqual({ age: 31, goal: 'maintain' })
    expect(query.filterValue('eq', 'id')).toBe('user-1')
    expect(query.methods).toEqual(['update', 'eq', 'select', 'single'])
    expect(result).toMatchObject({ age: 31 })
  })

  it('updated_at alanını ELLE yazmaz (DB trigger’ının işi)', async () => {
    const { fake, service } = setup({ respond: () => ok(PROFILE) })
    await service.updateUserProfile('user-1', { name: 'Yeni İsim' })
    expect(fake.onlyQuery().payload).not.toHaveProperty('updated_at')
  })

  it('boş güncelleme nesnesini de iletir', async () => {
    const { fake, service } = setup({ respond: () => ok(PROFILE) })
    await service.updateUserProfile('user-1', {})
    expect(fake.onlyQuery().payload).toEqual({})
  })

  it('hata durumunda fırlatır', async () => {
    const { service } = setup({ respond: () => fail('izin yok') })
    await expect(service.updateUserProfile('user-1', { age: 31 })).rejects.toBeTruthy()
  })
})

describe('servis yüzeyi', () => {
  it('beklenen metotları sunar', () => {
    const { service } = setup()
    expect(Object.keys(service).sort()).toEqual([
      'getCurrentUser',
      'getSession',
      'getUserProfile',
      'signIn',
      'signOut',
      'signUp',
      'updateUserProfile',
    ])
  })

  it('yalnızca user_profiles tablosuna dokunur', async () => {
    const { fake, service } = setup({ respond: () => ok(PROFILE) })
    await service.getUserProfile('u')
    await service.updateUserProfile('u', { age: 30 })
    for (const query of fake.queries) {
      expect(query.table).toBe('user_profiles')
    }
  })
})
