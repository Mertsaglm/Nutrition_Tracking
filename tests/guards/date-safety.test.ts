// ============================================================================
// TARİH SÖZLEŞMESİ — "gün" her zaman kullanıcının YEREL günüdür.
//
// Türkiye UTC+3'tür. Bir öğün 15 Mart 23:30'da girildiğinde UTC'ye göre
// 15 Mart 20:30'dur — aynı gün. Ama 16 Mart 01:30'da girilen öğün UTC'ye göre
// 15 Mart 22:30'dur ve UTC tabanlı bir kod onu BİR ÖNCEKİ GÜNE yazar.
// Sonuç: kullanıcının günlük toplamı yanlış, streak'i kırık, grafiği kaymış olur
// ve hiçbir test/derleme bunu haber vermez.
//
// Bu yüzden gün üretimi TEK bir yerden yapılır: `toLocalDateStr` (core/date.ts).
// Aşağıdaki testler kestirme yolların geri gelmesini engeller.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { allProjectSources, codeOf, findLines, importsOf } from '../helpers/source-scan'

const sources = allProjectSources()
const codeOnly = sources.map((file) => ({ ...file, text: codeOf(file) }))

describe('UTC kestirmeleri yasak', () => {
  it('toISOString ile gün üretilmiyor', () => {
    // Klasik hata: `new Date().toISOString().split('T')[0]`
    const hits = findLines(codeOnly, /toISOString\(\)\s*\.\s*(split|slice|substring|substr)/)
    expect(hits, 'Gün üretimi için toLocalDateStr kullanın').toEqual([])
  })

  it('getUTC* ile takvim bileşeni okunmuyor', () => {
    const hits = findLines(codeOnly, /getUTC(FullYear|Month|Date)\b/)
    expect(hits).toEqual([])
  })

  it('Date.UTC ile gün kurulmuyor', () => {
    expect(findLines(codeOnly, /Date\.UTC\s*\(/)).toEqual([])
  })

  it('toJSON kestirmesi kullanılmıyor', () => {
    expect(findLines(codeOnly, /toJSON\(\)\s*\.\s*(split|slice)/)).toEqual([])
  })
})

describe('tek kaynak: toLocalDateStr', () => {
  it('çekirdekte tanımlıdır', () => {
    const dateModule = sources.find((f) => f.rel === 'packages/core/src/date.ts')
    expect(dateModule).toBeDefined()
    expect(dateModule!.text).toMatch(/export function toLocalDateStr/)
  })

  it('yalnızca bir kez tanımlanır', () => {
    const definitions = sources.filter((f) =>
      /^\s*(export\s+)?function\s+toLocalDateStr\s*\(/m.test(codeOf(f))
    )
    expect(definitions.map((f) => f.rel)).toEqual(['packages/core/src/date.ts'])
  })

  it('yerel takvim getter’larını kullanır (UTC değil)', () => {
    const dateModule = sources.find((f) => f.rel === 'packages/core/src/date.ts')!
    expect(dateModule.text).toContain('getFullYear()')
    expect(dateModule.text).toContain('getMonth()')
    expect(dateModule.text).toContain('getDate()')
    expect(codeOf(dateModule)).not.toContain('toISOString')
  })

  it('veritabanı servisi tarih üretirken bunu kullanır', () => {
    const dbService = sources.find((f) => f.rel === 'packages/core/src/services/database-service.ts')!
    expect(importsOf(dbService)).toContain('../date')
    expect(dbService.text).toContain('toLocalDateStr')
  })
})

describe('tarih kolonlarına yazan kod', () => {
  /** `date:` alanı yazan (insert/upsert eden) çekirdek servis dosyaları. */
  const writers = sources.filter(
    (f) => f.rel.startsWith('packages/core/src/services/') && /\bdate:/.test(codeOf(f))
  )

  it('tarih yazan en az bir servis var', () => {
    expect(writers.length).toBeGreaterThan(0)
  })

  it('hepsi toLocalDateStr üzerinden geçer', () => {
    for (const file of writers) {
      expect(codeOf(file), file.rel).toContain('toLocalDateStr')
    }
  })
})

describe('tarih biçimi', () => {
  it('kodda elle YYYY-MM-DD birleştirmesi yok', () => {
    // `${y}-${m}-${d}` kalıbı yalnızca date.ts içinde bulunmalı.
    const offenders = codeOnly
      .filter((f) => f.rel !== 'packages/core/src/date.ts')
      .filter((f) => /\$\{[^}]*\}-\$\{[^}]*\}-\$\{[^}]*\}/.test(f.text))
      .map((f) => f.rel)

    expect(offenders).toEqual([])
  })
})
