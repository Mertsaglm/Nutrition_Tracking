// ============================================================================
// MİMARİ SÖZLEŞMELERİ — katman sınırlarının korunması.
//
// Bu monorepo'nun tek büyük fikri şu: iş mantığı `packages/core` içinde,
// PLATFORMDAN BAĞIMSIZ olarak yaşar; web ve mobil yalnızca arayüzdür.
// Bu sınır aşındığında (ör. çekirdeğe React import edilmesi, ya da hesaplama
// mantığının bir ekran bileşenine kopyalanması) proje sessizce iki ayrı
// uygulamaya bölünür: bir platformda düzelen hata diğerinde kalır.
//
// Bu testler o sınırı statik olarak korur.
// ============================================================================
import { describe, expect, it } from 'vitest'
import {
  allProjectSources,
  codeOf,
  importsOf,
  type SourceFile,
} from '../helpers/source-scan'

const sources = allProjectSources()

const coreFiles = sources.filter((f) => f.rel.startsWith('packages/core/'))
const tokenFiles = sources.filter((f) => f.rel.startsWith('packages/tokens/'))
const webFiles = sources.filter((f) => f.rel.startsWith('apps/web/'))
const mobileFiles = sources.filter((f) => f.rel.startsWith('apps/mobile/'))

/** Bir dosya kümesinde yasak modül import eden dosyaları listeler. */
function offendersImporting(files: SourceFile[], forbidden: RegExp): string[] {
  return files
    .filter((file) => importsOf(file).some((id) => forbidden.test(id)))
    .map((file) => `${file.rel} → ${importsOf(file).filter((id) => forbidden.test(id)).join(', ')}`)
}

describe('dosya kümeleri bulundu', () => {
  it('her katmanda dosya var (tarama bozulmamış)', () => {
    expect(coreFiles.length).toBeGreaterThan(10)
    expect(tokenFiles.length).toBeGreaterThan(0)
    expect(webFiles.length).toBeGreaterThan(10)
    expect(mobileFiles.length).toBeGreaterThan(10)
  })
})

describe('packages/core — platform bağımsızlığı', () => {
  it('React / React DOM import etmez', () => {
    expect(offendersImporting(coreFiles, /^react($|\/|-dom)/)).toEqual([])
  })

  it('Next.js import etmez', () => {
    expect(offendersImporting(coreFiles, /^next($|\/)/)).toEqual([])
  })

  it('React Native / Expo import etmez', () => {
    expect(offendersImporting(coreFiles, /^(react-native|expo|@react-native)/)).toEqual([])
  })

  it('Node.js API’leri import etmez (tarayıcı ve mobilde çalışmalı)', () => {
    expect(offendersImporting(coreFiles, /^(node:|fs$|path$|crypto$|os$|child_process$)/)).toEqual(
      []
    )
  })

  it('uygulamalardan hiçbir şey import etmez (bağımlılık yönü tek yönlü)', () => {
    expect(offendersImporting(coreFiles, /apps\//)).toEqual([])
  })

  it('yalnızca beklenen dış bağımlılıkları kullanır', () => {
    const allowed = /^(zustand|@supabase\/supabase-js)/
    const external = coreFiles
      .flatMap((file) => importsOf(file))
      .filter((id) => !id.startsWith('.') && !allowed.test(id))

    expect([...new Set(external)]).toEqual([])
  })

  it('tarayıcı global’lerine doğrudan bağımlı değildir', () => {
    // `window` / `document` / `localStorage` çekirdekte kullanılırsa mobil çöker.
    // (Depolama, `createNutritionStore(storage)` ile DIŞARIDAN enjekte edilir.)
    for (const file of coreFiles) {
      const code = codeOf(file)
      expect(code, file.rel).not.toMatch(/\bwindow\./)
      expect(code, file.rel).not.toMatch(/\bdocument\./)
      expect(code, file.rel).not.toMatch(/\blocalStorage\b/)
      expect(code, file.rel).not.toMatch(/\bAsyncStorage\b/)
    }
  })
})

describe('packages/tokens — platform bağımsızlığı', () => {
  it('hiçbir çerçeveyi import etmez', () => {
    expect(offendersImporting(tokenFiles, /^(react|next|react-native|expo|@react-native)/)).toEqual(
      []
    )
  })

  it('yalnızca kendi paletini okur', () => {
    const external = tokenFiles
      .flatMap((file) => importsOf(file))
      .filter((id) => !id.startsWith('.'))
    expect([...new Set(external)]).toEqual([])
  })
})

describe('uygulamalar arası sınırlar', () => {
  it('web, React Native / Expo paketlerini import etmez', () => {
    expect(offendersImporting(webFiles, /^(react-native|expo|@react-native)/)).toEqual([])
  })

  it('mobil, Next.js paketlerini import etmez', () => {
    expect(offendersImporting(mobileFiles, /^(next($|\/)|react-dom|lucide-react)/)).toEqual([])
  })

  it('web ile mobil birbirinden import etmez', () => {
    expect(offendersImporting(webFiles, /apps\/mobile/)).toEqual([])
    expect(offendersImporting(mobileFiles, /apps\/web/)).toEqual([])
  })

  it('hiçbir dosya paket sınırının dışına göreli yolla çıkmaz', () => {
    // `../../../packages/core/src/...` gibi yollar workspace çözümlemesini bozar.
    const offenders = sources
      .filter((file) => importsOf(file).some((id) => /\.\.\/.*(packages|apps)\//.test(id)))
      .map((file) => file.rel)

    expect(offenders).toEqual([])
  })
})

describe('workspace paketlerinin kullanımı', () => {
  it('çekirdek paket her zaman genel yüzeyinden import edilir', () => {
    // `@nutrition/core/src/nutrition/calculator` gibi derin import'lar
    // paket sınırını delip yeniden yapılandırmayı imkânsızlaştırır.
    const offenders = sources
      .filter((file) => importsOf(file).some((id) => /^@nutrition\/core\//.test(id)))
      .map((file) => file.rel)

    expect(offenders).toEqual([])
  })

  it('tokens paketi yalnızca tanımlı alt yolundan import edilir', () => {
    const allowedSubpaths = ['@nutrition/tokens', '@nutrition/tokens/tailwind-preset']
    const used = new Set(
      sources.flatMap((file) => importsOf(file)).filter((id) => id.startsWith('@nutrition/tokens'))
    )

    for (const id of used) {
      expect(allowedSubpaths, id).toContain(id)
    }
  })
})

describe('sunucu-only modüller', () => {
  const serverModules = sources.filter((f) => /\.server\.tsx?$/.test(f.rel))

  it('proje sunucu-only modüller içeriyor', () => {
    expect(serverModules.map((f) => f.rel).sort()).toEqual([
      'apps/web/lib/auth.server.ts',
      'apps/web/lib/gemini.server.ts',
    ])
  })

  it('yalnızca API route’ları veya diğer sunucu modülleri tarafından import edilir', () => {
    const offenders = sources
      .filter((file) => importsOf(file).some((id) => /\.server$/.test(id)))
      .filter((file) => !file.rel.includes('/app/api/') && !/\.server\.tsx?$/.test(file.rel))
      .map((file) => file.rel)

    expect(offenders, 'sunucu modülü istemci tarafından import edilmiş').toEqual([])
  })

  it('"use client" bileşenleri sunucu modülü import etmez', () => {
    const clientComponents = sources.filter((f) => /^['"]use client['"]/m.test(f.text))
    expect(clientComponents.length).toBeGreaterThan(5)

    for (const file of clientComponents) {
      const serverImports = importsOf(file).filter((id) => /\.server$/.test(id))
      expect(serverImports, file.rel).toEqual([])
    }
  })

  it('sunucu modülleri istemci store/servislerini import etmez', () => {
    for (const file of serverModules) {
      const imports = importsOf(file)
      expect(imports, file.rel).not.toContain('@/lib/store')
      expect(imports, file.rel).not.toContain('@/lib/services')
    }
  })
})

describe('iş mantığının tek kaynağı', () => {
  const outsideCore = sources.filter((f) => !f.rel.startsWith('packages/core/'))

  it('hesaplama fonksiyonları yalnızca çekirdekte TANIMLANIR', () => {
    const CALC_FUNCTIONS = [
      'calculateBMR',
      'calculateTDEE',
      'calculateTargetCalories',
      'calculateMacros',
      'createMealPlan',
      'createFullNutritionPlan',
      'recommendMealCount',
      'recommendTargetWeeks',
      'recommendFiber',
      'recommendWaterLiters',
    ]

    for (const file of outsideCore) {
      for (const fn of CALC_FUNCTIONS) {
        // Yalnızca gerçek TANIMLAR: `function X(`, `const X =`.
        // (import bloğundaki `X,` satırı eşleşmemeli.)
        expect(codeOf(file), `${file.rel} → ${fn}`).not.toMatch(
          new RegExp(`^\\s*(export\\s+)?(function\\s+${fn}\\s*[(<]|(const|let)\\s+${fn}\\s*[:=])`, 'm')
        )
      }
    }
  })

  it('AI prompt’ları yalnızca çekirdekte üretilir', () => {
    for (const file of outsideCore) {
      const code = codeOf(file)
      expect(code, file.rel).not.toMatch(
        /^\s*(export\s+)?(function\s+(buildMealAnalysisPrompt|buildSampleMealPlanPrompt)\s*\(|const\s+(buildMealAnalysisPrompt|buildSampleMealPlanPrompt)\s*[:=])/m
      )
      expect(code, file.rel).not.toMatch(
        /^\s*(export\s+)?(function\s+(parseMealAnalysis|parseSampleMealPlan)\s*\(|const\s+(parseMealAnalysis|parseSampleMealPlan)\s*[:=])/m
      )
    }
  })

  it('alan tipleri yalnızca çekirdekte tanımlanır', () => {
    // NOT: `FoodItem` bilinçli olarak listede değil — mobil `food-search`
    // ekranı aynı adla YEREL bir görünüm tipi (kategori etiketi vb.) tanımlıyor.
    // Alan tipiyle karışmaması için oradaki adın değiştirilmesi iyi olur, ama
    // bu bir mimari ihlali değil; testin kapsamı dışında bırakıldı.
    const DOMAIN_TYPES = [
      'NutritionData',
      'MealEntry',
      'UserPhysicalData',
      'NutritionTargets',
      'MealAnalysisResult',
      'DailyProgress',
      'MealPlan',
      'SampleMealPlan',
    ]

    for (const file of outsideCore) {
      for (const type of DOMAIN_TYPES) {
        // Yalnızca gerçek TANIMLAR: `interface X {` / `type X =`.
        // (import bloğundaki `type X,` satırı eşleşmemeli.)
        expect(codeOf(file), `${file.rel} → ${type}`).not.toMatch(
          new RegExp(`^\\s*(export\\s+)?(interface\\s+${type}\\s*[<{]|type\\s+${type}\\s*[<=])`, 'm')
        )
      }
    }
  })

  it('beslenme sabitleri uygulamalarda yeniden tanımlanmaz', () => {
    for (const file of outsideCore) {
      // Mifflin-St Jeor sabitleri ve aktivite çarpanları çekirdeğe aittir.
      const code = codeOf(file)
      expect(code, file.rel).not.toMatch(/ACTIVITY_MULTIPLIERS|MACRO_RATIOS/)
      expect(code, file.rel).not.toMatch(/\b7700\b/) // kcal/kg sabiti
    }
  })

  it('uygulamalar hesaplamayı çekirdekten alır', () => {
    // En az bir uygulama dosyası çekirdeği kullanmalı; aksi halde yukarıdaki
    // "tanımlanmıyor" testleri anlamsızlaşır.
    const usingCore = sources.filter((file) => importsOf(file).includes('@nutrition/core'))
    expect(usingCore.some((f) => f.rel.startsWith('apps/web/'))).toBe(true)
    expect(usingCore.some((f) => f.rel.startsWith('apps/mobile/'))).toBe(true)
  })
})

describe('AI erişim yolu', () => {
  it('istemci tarafı doğrudan Gemini’ye gitmez, kendi API’sini çağırır', () => {
    const clientFiles = sources.filter(
      (f) => !/\.server\.tsx?$/.test(f.rel) && !f.rel.includes('/app/api/')
    )
    for (const file of clientFiles) {
      expect(file.text, file.rel).not.toMatch(/generativelanguage\.googleapis\.com/)
      expect(file.text, file.rel).not.toMatch(/new GoogleGenerativeAI/)
    }
  })

  it('uygulamalar AI istemcisini çekirdekten kurar', () => {
    const aiEntryPoints = sources.filter((f) => /apps\/(web|mobile)\/lib\/ai\.ts$/.test(f.rel))
    expect(aiEntryPoints).toHaveLength(2)

    for (const file of aiEntryPoints) {
      expect(file.text, file.rel).toContain('createAINutritionClient')
      // Her istekte oturum token'ı gönderilmeli.
      expect(file.text, file.rel).toContain('getAuthToken')
    }
  })
})
