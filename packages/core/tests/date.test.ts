// ============================================================================
// date.ts — "gün" sınırı REGRESYON KORUMASI.
//
// Uygulamanın tüm günlük mantığı (öğün kaydının hangi güne yazılacağı, streak,
// haftalık grafik) kullanıcının YEREL gününe dayanır. Biri `toISOString()`
// tabanlı bir kısayola dönerse (klasik hata), UTC+3'te gece yarısından önce
// girilen öğünler bir önceki güne düşer ve veri sessizce bozulur.
//
// Bu dosya o davranışı kilitler. Testler UTC'den FARKLI bir saat diliminde
// koşmalıdır; TZ, vitest.config.ts içinde Europe/Istanbul olarak sabitlenmiştir.
// ============================================================================
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toLocalDateStr } from '@nutrition/core'

describe('test ortamı', () => {
  it('UTC olmayan sabit bir saat diliminde koşar', () => {
    // Bu kontrol olmadan aşağıdaki UTC-kayması testleri anlamsızlaşır.
    expect(process.env.TZ).toBe('Europe/Istanbul')
    expect(new Date('2026-06-15T12:00:00Z').getTimezoneOffset()).not.toBe(0)
  })
})

describe('toLocalDateStr', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('Date nesnesini YYYY-MM-DD biçimine çevirir', () => {
    expect(toLocalDateStr(new Date(2026, 2, 15, 13, 45))).toBe('2026-03-15')
  })

  it('ay ve günü sıfırla doldurur', () => {
    expect(toLocalDateStr(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(toLocalDateStr(new Date(2026, 8, 3))).toBe('2026-09-03')
    expect(toLocalDateStr(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('artık günü doğru verir', () => {
    expect(toLocalDateStr(new Date(2028, 1, 29))).toBe('2028-02-29')
  })

  // ---- KRİTİK: yerel gün vs UTC günü -------------------------------------
  it('YEREL günü kullanır — UTC gününü DEĞİL (gece yarısı regresyonu)', () => {
    // 2026-03-15 22:30 UTC = 2026-03-16 01:30 (UTC+3). Kullanıcı için 16 Mart.
    const instant = new Date('2026-03-15T22:30:00Z')

    expect(toLocalDateStr(instant)).toBe('2026-03-16')
    // Yanlış (UTC tabanlı) uygulamanın üreteceği değer:
    expect(instant.toISOString().slice(0, 10)).toBe('2026-03-15')
    expect(toLocalDateStr(instant)).not.toBe(instant.toISOString().slice(0, 10))
  })

  it('yerel gün başında da doğru kalır (00:15)', () => {
    const instant = new Date(2026, 6, 4, 0, 15)
    expect(toLocalDateStr(instant)).toBe('2026-07-04')
  })

  it('yerel gün sonunda da doğru kalır (23:59)', () => {
    const instant = new Date(2026, 6, 4, 23, 59, 59)
    expect(toLocalDateStr(instant)).toBe('2026-07-04')
  })

  it('yerel takvim bileşenleriyle her zaman tutarlıdır', () => {
    // Bir yıl boyunca her günün 23:30'u: yerel gün ile çıktı birebir eşleşmeli.
    for (let day = 0; day < 365; day++) {
      const d = new Date(2026, 0, 1 + day, 23, 30)
      const expected = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-')
      expect(toLocalDateStr(d)).toBe(expected)
    }
  })

  // ---- Girdi türleri ------------------------------------------------------
  it('ISO metin girdisini kabul eder', () => {
    expect(toLocalDateStr('2026-03-15T09:00:00Z')).toBe('2026-03-15')
  })

  it('kendi çıktısını tekrar işlediğinde aynı günü verir (gidiş-dönüş)', () => {
    // Store ve DB bu metinleri saklayıp geri okur; kayma olmamalı.
    const original = toLocalDateStr(new Date(2026, 4, 20, 18, 0))
    expect(toLocalDateStr(original)).toBe(original)
  })

  it('argümansız çağrıldığında bugünü verir', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 8, 14, 0))
    expect(toLocalDateStr()).toBe('2026-10-08')
  })

  it('geçersiz girdide çökmez', () => {
    expect(() => toLocalDateStr('bu bir tarih değil')).not.toThrow()
    expect(typeof toLocalDateStr('bu bir tarih değil')).toBe('string')
  })

  it('her zaman YYYY-MM-DD kalıbında (10 karakter) döner', () => {
    const samples = [
      new Date(2026, 0, 1),
      new Date(2026, 11, 31, 23, 59),
      new Date(1999, 5, 7, 3, 0),
      new Date(2100, 3, 30),
    ]
    for (const sample of samples) {
      const result = toLocalDateStr(sample)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(result).toHaveLength(10)
    }
  })

  it('sıralanabilir biçimdedir (metin sıralaması = kronolojik sıralama)', () => {
    // daily_progress / meal_logs sorguları bu metinleri `order`/`lt` ile kullanır.
    const dates = [
      new Date(2026, 0, 9),
      new Date(2026, 0, 10),
      new Date(2026, 1, 1),
      new Date(2025, 11, 31),
    ].map(toLocalDateStr)

    expect([...dates].sort()).toEqual(['2025-12-31', '2026-01-09', '2026-01-10', '2026-02-01'])
  })
})
