// ============================================================================
// ORTAM DEĞİŞKENİ SÖZLEŞMESİ.
//
// Kodda okunan her değişken, ilgili `.env.example` dosyasında BELGELENMİŞ
// olmalıdır. Aksi halde projeyi kuran kişi (ya da yeni bir CI ortamı) eksik
// değişkeni ancak çalışma zamanında, anlaşılmaz bir hatayla öğrenir.
//
// Ters yön de önemli: `.env.example` içindeki ölü bir kayıt, kimsenin okumadığı
// bir değişkeni "gerekli" gibi gösterir.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { allProjectSources, codeOf, readRepoFile } from '../helpers/source-scan'

const sources = allProjectSources()

/** Node'un kendi sağladığı, .env'de tanımlanmayan değişkenler. */
const BUILT_IN_VARS = new Set(['NODE_ENV'])

/** Bir kaynak kümesinde okunan tüm ortam değişkeni adları. */
function envVarsUsedIn(prefix: string): Set<string> {
  const names = new Set<string>()
  for (const file of sources.filter((f) => f.rel.startsWith(prefix))) {
    for (const match of codeOf(file).matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      if (!BUILT_IN_VARS.has(match[1])) names.add(match[1])
    }
  }
  return names
}

/** .env.example dosyasındaki değişken adları. */
function envVarsDocumentedIn(file: string): Set<string> {
  return new Set(
    readRepoFile(file)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=')[0].trim())
      .filter(Boolean)
  )
}

const APPS = [
  { name: 'web', prefix: 'apps/web/', example: 'apps/web/.env.example', publicPrefix: 'NEXT_PUBLIC_' },
  {
    name: 'mobile',
    prefix: 'apps/mobile/',
    example: 'apps/mobile/.env.example',
    publicPrefix: 'EXPO_PUBLIC_',
  },
]

describe.each(APPS)('$name uygulaması', ({ prefix, example, publicPrefix }) => {
  const used = envVarsUsedIn(prefix)
  const documented = envVarsDocumentedIn(example)

  it('en az bir ortam değişkeni okuyor (tarama çalışıyor)', () => {
    expect(used.size).toBeGreaterThan(0)
  })

  it('okunan her değişken .env.example içinde belgelenmiş', () => {
    const missing = [...used].filter((name) => !documented.has(name))
    expect(missing, `${example} dosyasına eklenmeli`).toEqual([])
  })

  it('.env.example içinde ölü kayıt yok', () => {
    const unused = [...documented].filter((name) => !used.has(name))
    expect(unused, 'kodda okunmayan değişken').toEqual([])
  })

  it('public önekli değişkenler doğru platform önekini kullanıyor', () => {
    const wrongPrefix = [...used].filter(
      (name) =>
        (name.startsWith('NEXT_PUBLIC_') || name.startsWith('EXPO_PUBLIC_')) &&
        !name.startsWith(publicPrefix)
    )
    expect(wrongPrefix).toEqual([])
  })
})

describe('env modülleri', () => {
  const envModules = sources.filter((f) => /apps\/(web|mobile)\/lib\/env\.ts$/.test(f.rel))

  it('her iki uygulamada da bir env modülü var', () => {
    expect(envModules.map((f) => f.rel).sort()).toEqual([
      'apps/mobile/lib/env.ts',
      'apps/web/lib/env.ts',
    ])
  })

  it('eksik değişkende sessizce devam etmez', () => {
    for (const file of envModules) {
      expect(codeOf(file), file.rel).toMatch(/throw new Error/)
    }
  })

  it('hata mesajı değişken adını ve dosyayı söyler', () => {
    for (const file of envModules) {
      expect(file.text, file.rel).toMatch(/\$\{name\}/)
      expect(file.text, file.rel).toMatch(/\.env/)
    }
  })

  it('yalnızca public önekli değişken okur', () => {
    for (const file of envModules) {
      const vars = [...codeOf(file).matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1])
      expect(vars.length, file.rel).toBeGreaterThan(0)
      for (const name of vars) {
        expect(name, `${file.rel} → ${name}`).toMatch(/^(NEXT_PUBLIC_|EXPO_PUBLIC_)/)
      }
    }
  })
})

describe('sunucu-only değişkenler', () => {
  it('GEMINI_API_KEY yalnızca web tarafında belgelenmiş', () => {
    expect(envVarsDocumentedIn('apps/web/.env.example').has('GEMINI_API_KEY')).toBe(true)
    expect(envVarsDocumentedIn('apps/mobile/.env.example').has('GEMINI_API_KEY')).toBe(false)
  })

  it('web .env.example, anahtarın sunucu-only olduğunu açıkça yazar', () => {
    const content = readRepoFile('apps/web/.env.example')
    expect(content).toMatch(/SUNUCU-ONLY|sunucu/i)
  })

  it('mobil, AI için sunucu adresi bekler (anahtar değil)', () => {
    expect(envVarsDocumentedIn('apps/mobile/.env.example').has('EXPO_PUBLIC_API_URL')).toBe(true)
  })
})
