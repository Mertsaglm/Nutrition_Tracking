// ============================================================================
// GÜVENLİK SÖZLEŞMELERİ — sırların istemciye sızmaması.
//
// Bu testler davranış değil, KURAL doğrular. Bir yapay zeka ajanı "daha kolay
// olsun" diye Gemini anahtarını istemciye taşıyabilir ya da bir anahtarı koda
// gömebilir; bunların HİÇBİRİ derleme/tip hatası vermez ve uygulama sorunsuz
// çalışmaya devam eder. Fark edildiğinde ise anahtar çoktan yayınlanmıştır.
//
// Kural özeti:
//   · GEMINI_API_KEY yalnızca `*.server.ts` içinde okunabilir.
//   · Hiçbir kaynak dosyada gerçek anahtar/JWT gömülü olamaz.
//   · İstemciye gömülen (NEXT_PUBLIC_/EXPO_PUBLIC_) değişkenler sır içeremez.
//   · .env dosyaları sürüm kontrolüne girmez.
// ============================================================================
import { describe, expect, it } from 'vitest'
import {
  allProjectSources,
  codeOf,
  findLines,
  importsOf,
  readRepoFile,
  repoFileExists,
  scanSources,
} from '../helpers/source-scan'

const sources = allProjectSources()

/** CI tanımları — sırlar buraya da gömülmemeli. */
const workflows = scanSources(['.github/workflows'], { exts: ['.yml', '.yaml'] })

/** Hiçbir dosyada bulunmaması gereken sır kalıpları. */
const SECRET_PATTERNS: [string, RegExp][] = [
  ['Google API anahtarı', /AIza[0-9A-Za-z_-]{20,}/],
  ['JWT (Supabase anahtarı)', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
  ['OpenAI anahtarı', /\bsk-[A-Za-z0-9]{20,}\b/],
  ['service_role anahtarı', /service_role/],
  ['özel anahtar bloğu', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
]

/** Sunucuda çalıştığı garanti edilen dosyalar. */
function isServerOnly(rel: string): boolean {
  return /\.server\.tsx?$/.test(rel) || rel.includes('/app/api/')
}

describe('kaynak taraması hazır', () => {
  it('proje dosyalarını gerçekten buluyor', () => {
    // Tarayıcı bozulursa aşağıdaki tüm güvenlik testleri sessizce "geçer".
    expect(sources.length).toBeGreaterThan(25)
    expect(sources.some((f) => f.rel === 'packages/core/src/index.ts')).toBe(true)
    expect(sources.some((f) => f.rel === 'apps/web/lib/gemini.server.ts')).toBe(true)
    expect(sources.some((f) => f.rel.startsWith('apps/mobile/app/'))).toBe(true)
  })

  it('test dosyalarını taramaz (yanlış pozitif olmasın)', () => {
    expect(sources.some((f) => f.rel.includes('/tests/'))).toBe(false)
  })
})

describe('Gemini anahtarı', () => {
  it('YALNIZCA sunucu dosyalarında okunur', () => {
    // Yorum satırları hariç (bazı dosyalar "burada GEMINI_API_KEY YOK" diye
    // bilinçli olarak not düşüyor).
    const offenders = sources
      .filter((f) => /GEMINI/.test(codeOf(f)))
      .filter((f) => !isServerOnly(f.rel))
      .map((f) => f.rel)

    expect(offenders, 'GEMINI_API_KEY istemci tarafına sızmış').toEqual([])
  })

  it('process.env üzerinden yalnızca sunucuda okunur', () => {
    const offenders = sources
      .filter((f) => /process\.env\.[A-Z_]*GEMINI/.test(f.text))
      .filter((f) => !isServerOnly(f.rel))
      .map((f) => f.rel)

    expect(offenders).toEqual([])
  })

  it('asla NEXT_PUBLIC_ / EXPO_PUBLIC_ öneki almaz', () => {
    // Bu önekler değeri paket içine GÖMER; anahtar herkese açık olur.
    const hits = findLines(sources, /(NEXT_PUBLIC|EXPO_PUBLIC)_[A-Z_]*GEMINI/)
    expect(hits).toEqual([])
  })

  it('Gemini SDK’si yalnızca sunucu dosyalarında import edilir', () => {
    const offenders = sources
      .filter((f) => importsOf(f).some((id) => id.startsWith('@google/generative-ai')))
      .filter((f) => !isServerOnly(f.rel))
      .map((f) => f.rel)

    expect(offenders).toEqual([])
  })

  it('mobil uygulama Gemini SDK’sini hiç tanımaz', () => {
    const mobileFiles = sources.filter((f) => f.rel.startsWith('apps/mobile/'))
    const offenders = mobileFiles
      .filter((f) => /@google\/generative-ai|GEMINI_API_KEY/.test(f.text))
      .map((f) => f.rel)

    expect(offenders).toEqual([])
  })

  it('çekirdek paket AI anahtarına hiç dokunmaz', () => {
    const coreFiles = sources.filter((f) => f.rel.startsWith('packages/'))
    for (const file of coreFiles) {
      expect(codeOf(file), file.rel).not.toMatch(/GEMINI|@google\/generative-ai/)
    }
  })
})

describe('sabit kodlanmış sırlar', () => {
  it.each(SECRET_PATTERNS)('%s koda gömülmemiş', (_label, pattern) => {
    expect(findLines(sources, pattern)).toEqual([])
  })

  it('Supabase adresleri koda gömülmemiş (env’den gelir)', () => {
    const hits = findLines(sources, /https:\/\/[a-z0-9]{15,}\.supabase\.co/)
    expect(hits).toEqual([])
  })
})

describe('istemciye gömülen ortam değişkenleri', () => {
  /** Kaynaklarda geçen tüm public env değişken adları. */
  const publicVars = new Set(
    sources
      .flatMap((f) => f.text.match(/(?:NEXT_PUBLIC|EXPO_PUBLIC)_[A-Z0-9_]+/g) ?? [])
      .map((name) => name.trim())
  )

  it('beklenen public değişkenler kullanılıyor', () => {
    expect([...publicVars].sort()).toEqual([
      'EXPO_PUBLIC_API_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
    ])
  })

  it('hiçbiri sır çağrıştıran bir ad taşımaz', () => {
    // ANON_KEY güvenlidir (RLS ile korunur); SECRET/PRIVATE/SERVICE_ROLE değildir.
    for (const name of publicVars) {
      expect(name, name).not.toMatch(/SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|TOKEN/)
    }
  })
})

describe('sürüm kontrolü hijyeni', () => {
  const gitignore = readRepoFile('.gitignore')

  it.each(['.env', '.env.local', '.env*.local'])('.gitignore %j desenini içerir', (pattern) => {
    expect(gitignore.split('\n').map((line) => line.trim())).toContain(pattern)
  })

  it('örnek env dosyaları mevcut (kurulum rehberi)', () => {
    expect(repoFileExists('apps/web/.env.example')).toBe(true)
    expect(repoFileExists('apps/mobile/.env.example')).toBe(true)
  })

  it('örnek env dosyaları gerçek anahtar içermez', () => {
    for (const file of ['apps/web/.env.example', 'apps/mobile/.env.example']) {
      const content = readRepoFile(file)
      expect(content, file).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/)
      expect(content, file).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./)
      expect(content, file).toMatch(/your-|<|example/i)
    }
  })
})

describe('CI yapılandırması', () => {
  it('workflow dosyası mevcut (testler otomatik çalışıyor)', () => {
    // Testler yalnızca elle çalıştırılıyorsa er ya da geç atlanır.
    expect(workflows.length).toBeGreaterThan(0)
  })

  it.each(SECRET_PATTERNS)('%s CI dosyalarına gömülmemiş', (_label, pattern) => {
    expect(findLines(workflows, pattern)).toEqual([])
  })

  it('gerçek Supabase adresi içermez', () => {
    expect(findLines(workflows, /https:\/\/[a-z0-9]{15,}\.supabase\.co/)).toEqual([])
  })

  it('doğrulama adımlarını çalıştırır', () => {
    const combined = workflows.map((file) => file.text).join('\n')
    expect(combined).toContain('npm run typecheck')
    expect(combined).toContain('npm test')
  })
})

describe('kullanıcıya gösterilen hata mesajları', () => {
  it('ham hata metnini doğrudan basan yer yok', () => {
    // `error.message` kullanıcıya gösterildiğinde anahtar/URL sızabilir.
    // Uygulamada kullanıcıya giden metin AppError.userMessage'dan gelmelidir.
    const apiFiles = sources.filter((f) => f.rel.includes('/app/api/'))
    for (const file of apiFiles) {
      expect(file.text, file.rel).not.toMatch(/apiError\(\s*(?:String\()?error/)
      expect(file.text, file.rel).not.toMatch(/error\.message.*apiError/)
    }
  })
})
