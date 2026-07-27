// ============================================================================
// MONOREPO BÜTÜNLÜĞÜ — paket yapılandırmalarının tutarlılığı.
//
// npm workspaces, Turbo, Next transpilePackages ve Metro (Expo) yapılandırmaları
// birbirine bağlıdır. Biri değişip diğeri değişmediğinde hata genelde derlemede
// değil, "uygulama açılmıyor" biçiminde ortaya çıkar. Ayrıca test altyapısının
// kendisi de korunmalıdır: `npm test` komutu ya da bir vitest projesi silinirse
// bu dosyadaki testler dışında hiçbir şey haber vermez.
// ============================================================================
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO_ROOT, readRepoFile, repoFileExists } from '../helpers/source-scan'

function readJson(rel: string): Record<string, any> {
  return JSON.parse(readRepoFile(rel))
}

const root = readJson('package.json')
const core = readJson('packages/core/package.json')
const tokens = readJson('packages/tokens/package.json')
const web = readJson('apps/web/package.json')
const mobile = readJson('apps/mobile/package.json')

const WORKSPACE_PACKAGES = [
  { label: 'core', rel: 'packages/core', json: core, name: '@nutrition/core' },
  { label: 'tokens', rel: 'packages/tokens', json: tokens, name: '@nutrition/tokens' },
  { label: 'web', rel: 'apps/web', json: web, name: '@nutrition/web' },
  { label: 'mobile', rel: 'apps/mobile', json: mobile, name: '@nutrition/mobile' },
]

describe('kök paket', () => {
  it('workspace tanımları apps/* ve packages/* içerir', () => {
    expect(root.workspaces).toEqual(['apps/*', 'packages/*'])
  })

  it('yayımlanmaz (private)', () => {
    expect(root.private).toBe(true)
  })

  it('test komutları tanımlıdır', () => {
    // Bu testler ancak çalıştırılabilirse koruma sağlar.
    expect(root.scripts.test).toBeDefined()
    expect(root.scripts['test:watch']).toBeDefined()
    expect(root.scripts['test:coverage']).toBeDefined()
    expect(root.scripts.test).toContain('vitest')
  })

  it('typecheck ve build komutları korunur', () => {
    expect(root.scripts.typecheck).toBeDefined()
    expect(root.scripts.build).toBeDefined()
    expect(root.scripts.lint).toBeDefined()
  })

  it('vitest geliştirme bağımlılığı olarak kurulu', () => {
    expect(root.devDependencies.vitest).toBeDefined()
  })

  it('Node sürüm alt sınırı belirtilmiş', () => {
    expect(root.engines?.node).toBeDefined()
  })
})

describe.each(WORKSPACE_PACKAGES)('$label paketi', ({ rel, json, name }) => {
  it('doğru adı taşır ve private’dır', () => {
    expect(json.name).toBe(name)
    expect(json.private).toBe(true)
  })

  it('typecheck komutu vardır', () => {
    expect(json.scripts?.typecheck).toBeDefined()
  })

  it('tsconfig dosyası mevcuttur', () => {
    expect(repoFileExists(`${rel}/tsconfig.json`)).toBe(true)
  })
})

describe('kütüphane paketlerinin giriş noktaları', () => {
  it.each([
    ['core', core, 'packages/core'],
    ['tokens', tokens, 'packages/tokens'],
  ])('%s: main/types gerçek dosyaları gösterir', (_label, json, rel) => {
    for (const field of ['main', 'types'] as const) {
      const target = json[field] as string
      expect(target, field).toBeDefined()
      expect(fs.existsSync(path.resolve(REPO_ROOT, rel, target)), `${rel}/${target}`).toBe(true)
    }
  })

  it.each([
    ['core', core, 'packages/core'],
    ['tokens', tokens, 'packages/tokens'],
  ])('%s: exports haritasındaki tüm yollar mevcuttur', (_label, json, rel) => {
    for (const [subpath, target] of Object.entries(json.exports as Record<string, string>)) {
      expect(fs.existsSync(path.resolve(REPO_ROOT, rel, target)), `${subpath} → ${target}`).toBe(
        true
      )
    }
  })

  it('ham TypeScript kaynağı yayınlar (build adımı yok)', () => {
    // Bu yüzden Next `transpilePackages` ve Metro watchFolders ayarları şart.
    expect(core.main).toMatch(/\.ts$/)
    expect(tokens.main).toMatch(/\.ts$/)
  })
})

describe('uygulama bağımlılıkları', () => {
  it.each([
    ['web', web],
    ['mobile', mobile],
  ])('%s workspace paketlerini "*" ile bağlar', (_label, json) => {
    expect(json.dependencies['@nutrition/core']).toBe('*')
    expect(json.dependencies['@nutrition/tokens']).toBe('*')
  })

  it('web, workspace paketlerini transpile eder', () => {
    const nextConfig = readRepoFile('apps/web/next.config.js')
    expect(nextConfig).toContain('transpilePackages')
    expect(nextConfig).toContain('@nutrition/core')
    expect(nextConfig).toContain('@nutrition/tokens')
  })

  it('mobil Metro yapılandırması monorepo köküne bakar', () => {
    const metro = readRepoFile('apps/mobile/metro.config.js')
    expect(metro).toContain('watchFolders')
    expect(metro).toContain('nodeModulesPaths')
  })

  it('mobil React’i tek kopyaya sabitler', () => {
    // Web (React 18) ile mobil (React 19) aynı köke hoist edildiğinde Fabric
    // renderer yanlış React kopyasını okuyup çöküyordu; çözüm metro.config.js'te.
    const metro = readRepoFile('apps/mobile/metro.config.js')
    expect(metro).toContain('resolveRequest')
    expect(metro).toMatch(/node_modules\/react/)
  })

  it('web ve mobil aynı Supabase istemcisini kullanır', () => {
    const webVersion = web.dependencies['@supabase/supabase-js']
    const mobileVersion = mobile.dependencies['@supabase/supabase-js']
    const coreVersion = core.dependencies['@supabase/supabase-js']
    expect(webVersion).toBe(coreVersion)
    expect(mobileVersion).toBe(coreVersion)
  })

  it('AI SDK’si yalnızca web uygulamasının bağımlılığıdır', () => {
    expect(web.dependencies['@google/generative-ai']).toBeDefined()
    expect(mobile.dependencies['@google/generative-ai']).toBeUndefined()
    expect(core.dependencies?.['@google/generative-ai']).toBeUndefined()
  })
})

describe('Turbo yapılandırması', () => {
  const turbo = readJson('turbo.json')

  it('temel görevleri tanımlar', () => {
    expect(Object.keys(turbo.tasks).sort()).toEqual(['build', 'dev', 'lint', 'typecheck'])
  })

  it('dev görevi önbelleğe alınmaz', () => {
    expect(turbo.tasks.dev.cache).toBe(false)
    expect(turbo.tasks.dev.persistent).toBe(true)
  })
})

describe('TypeScript yapılandırması', () => {
  const base = readJson('tsconfig.base.json')

  it('strict mod açıktır', () => {
    // Kapatılırsa tip güvenliğinin büyük kısmı sessizce kaybolur.
    expect(base.compilerOptions.strict).toBe(true)
  })

  it('JSON modülleri çözümlenir (besin veritabanı için gerekli)', () => {
    expect(base.compilerOptions.resolveJsonModule).toBe(true)
  })

  it('paketler ortak yapılandırmayı genişletir', () => {
    for (const rel of ['packages/core', 'packages/tokens', 'apps/web']) {
      expect(readJson(`${rel}/tsconfig.json`).extends, rel).toMatch(/tsconfig\.base\.json$/)
    }
  })
})

describe('test altyapısı', () => {
  const config = readRepoFile('vitest.config.ts')

  it('vitest yapılandırması mevcuttur', () => {
    expect(repoFileExists('vitest.config.ts')).toBe(true)
  })

  it('tüm test projeleri tanımlıdır', () => {
    for (const project of ['core', 'tokens', 'web', 'web-ui', 'mobile', 'guards']) {
      expect(config, project).toContain(`name: '${project}'`)
    }
  })

  it('saat dilimi bilinçli olarak sabitlenmiştir', () => {
    // date.ts testleri UTC olmayan bir saat dilimi olmadan anlamsızlaşır.
    expect(config).toContain("TZ: 'Europe/Istanbul'")
  })

  it('her projenin test klasörü gerçekten vardır', () => {
    for (const dir of [
      'packages/core/tests',
      'packages/tokens/tests',
      'apps/web/tests/server',
      'apps/web/tests/ui',
      'apps/mobile/tests',
      'tests/guards',
    ]) {
      expect(fs.existsSync(path.resolve(REPO_ROOT, dir)), dir).toBe(true)
    }
  })

  it('her test klasöründe en az bir test dosyası vardır', () => {
    for (const dir of [
      'packages/core/tests',
      'packages/tokens/tests',
      'apps/web/tests/server',
      'apps/web/tests/ui',
      'apps/mobile/tests',
      'tests/guards',
    ]) {
      const files = fs.readdirSync(path.resolve(REPO_ROOT, dir))
      expect(files.some((f) => f.includes('.test.')), dir).toBe(true)
    }
  })
})
