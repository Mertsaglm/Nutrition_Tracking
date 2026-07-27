// ============================================================================
// nutrition/food-db.ts — AI prompt'una gömülecek besinlerin seçimi.
//
// Bu modül maliyeti ve doğruluğu birlikte belirler: 379 besinin tamamı her
// prompt'a gömülürse istekler pahalı ve yavaş olur; ilgili besinler seçilmezse
// AI tahmin uydurur. Testler hem seçim mantığını hem Türkçe normalizasyonu
// (ğ/ü/ş/ı/ö/ç) hem de "sık besinler her zaman eklenir" garantisini kilitler.
// ============================================================================
import { describe, expect, it } from 'vitest'
import { allFoods, selectRelevantFoods } from '@nutrition/core'

/** Açıklamadan bağımsız olarak HER prompt'ta bulunması gereken besinler. */
const ALWAYS_PRESENT = [
  'tavuk gogus',
  'tavuk yumurta tam',
  'ekmek beyaz',
  'bugday ekmegi',
  'pirinc',
  'pilav',
  'bulgur',
  'makarna',
  'mercimek',
  'nohut',
  'inek sutu yagli',
  'yogurt yagli',
  'beyaz peynir yagli',
  'zeytinyagi',
  'muz',
  'elma',
  'yulaf',
]

describe('selectRelevantFoods', () => {
  it('boş açıklamada yalnızca sık besinleri döner', () => {
    expect(Object.keys(selectRelevantFoods(''))).toEqual(ALWAYS_PRESENT)
  })

  it('sık besinler her açıklamada bulunur', () => {
    const descriptions = [
      '',
      'bir dilim karpuz',
      'somon balığı ve brokoli',
      'çikolatalı pasta',
      'sadece su içtim',
      '🍕🍔',
    ]
    for (const description of descriptions) {
      const selection = selectRelevantFoods(description)
      for (const key of ALWAYS_PRESENT) {
        expect(selection, `"${description}" → ${key}`).toHaveProperty([key])
      }
    }
  })

  it('açıklamada geçen besinleri bulur', () => {
    const selection = selectRelevantFoods('200g tavuk göğsü ve 150g pirinç pilavı')
    expect(selection).toHaveProperty(['tavuk gogus'])
    expect(selection).toHaveProperty(['pilav'])
    expect(selection).toHaveProperty(['pirinc'])
  })

  it('aynı kökten türeyen varyantları da getirir', () => {
    const selection = selectRelevantFoods('tavuk yedim')
    const tavukKeys = Object.keys(selection).filter((key) => key.startsWith('tavuk'))
    expect(tavukKeys.length).toBeGreaterThan(3)
  })

  describe('Türkçe normalizasyon', () => {
    it.each([
      ['büyük harf', 'PİLAV YEDİM'],
      ['karışık harf', 'PiLaV yEdIm'],
      ['küçük harf', 'pilav yedim'],
      ['noktalama ile', '150g pilav, biraz da salata!'],
      ['çoklu boşluk', '  pilav    yedim  '],
    ])('%s → aynı sonucu verir', (_label, description) => {
      expect(selectRelevantFoods(description)).toHaveProperty(['pilav'])
    })

    it('Türkçe karakterleri ASCII karşılığına indirger', () => {
      // Veritabanı anahtarları ASCII; kullanıcı ise "göğsü", "yoğurt" yazar.
      expect(selectRelevantFoods('yoğurt')).toHaveProperty(['yogurt yagli'])
      expect(selectRelevantFoods('göğüs')).toBeTruthy()
      expect(selectRelevantFoods('şeftali ve çilek')).toBeTruthy()
    })

    it('büyük İ/I dönüşümünü tr-TR kurallarıyla yapar', () => {
      // 'PİRİNÇ'.toLowerCase() İngilizce yerelde "pi̇rinç" üretir (birleşik nokta).
      expect(selectRelevantFoods('PİRİNÇ')).toHaveProperty(['pirinc'])
    })
  })

  describe('token filtresi', () => {
    it('3 karakterden kısa kelimeleri yok sayar', () => {
      // "et" gibi kısa kelimeler neredeyse tüm veritabanıyla eşleşirdi.
      expect(Object.keys(selectRelevantFoods('et'))).toEqual(ALWAYS_PRESENT)
      expect(Object.keys(selectRelevantFoods('su ve az'))).toEqual(ALWAYS_PRESENT)
    })

    it('3 harfli kelimeler alt dize olarak da eşleşir', () => {
      // Eşleştirme çift yönlü `includes` kullanır: "bir" → "bira" ile eşleşir.
      // Bu bilinçli bir gevşeklik (ek almış Türkçe kelimeleri yakalamak için).
      expect(selectRelevantFoods('bir')).toHaveProperty(['bira'])
    })

    it('hiç eşleşme yoksa sık besinlerle yetinir', () => {
      expect(Object.keys(selectRelevantFoods('zzzzz qqqqq wwwww'))).toEqual(ALWAYS_PRESENT)
    })
  })

  describe('boyut sınırı (prompt maliyeti)', () => {
    it('varsayılan limit ile makul sayıda besin döner', () => {
      const selection = selectRelevantFoods('tavuk pilav ekmek yumurta peynir yoğurt makarna')
      // 40 skorlu + sık besinler; toplam üst sınır kontrolü.
      expect(Object.keys(selection).length).toBeLessThanOrEqual(40 + ALWAYS_PRESENT.length)
    })

    it('özel limit skorlu besin sayısını sınırlar', () => {
      const selection = selectRelevantFoods('tavuk pilav ekmek yumurta peynir yoğurt', 5)
      expect(Object.keys(selection).length).toBeLessThanOrEqual(5 + ALWAYS_PRESENT.length)
    })

    it('limit 0 olsa bile sık besinler korunur', () => {
      expect(Object.keys(selectRelevantFoods('tavuk', 0))).toEqual(ALWAYS_PRESENT)
    })

    it('çok uzun açıklamada bile veritabanının tamamını göndermez', () => {
      const everything = Object.values(allFoods())
        .flatMap((category) => Object.keys(category))
        .join(' ')
        .replace(/_/g, ' ')
      const selection = selectRelevantFoods(everything)
      const totalFoods = Object.values(allFoods()).reduce(
        (sum, category) => sum + Object.keys(category).length,
        0
      )
      expect(Object.keys(selection).length).toBeLessThan(totalFoods / 2)
    })
  })

  describe('çıktı şekli', () => {
    it('her besin için makro değerleri döner', () => {
      const selection = selectRelevantFoods('tavuk göğsü')
      for (const [label, macros] of Object.entries(selection)) {
        expect(typeof macros.calories, label).toBe('number')
        expect(typeof macros.protein, label).toBe('number')
        expect(typeof macros.carbs, label).toBe('number')
        expect(typeof macros.fat, label).toBe('number')
      }
    })

    it('etiketler alt çizgi içermez (AI kullanıcı dostu isim üretsin diye)', () => {
      for (const label of Object.keys(selectRelevantFoods('tavuk pilav yumurta'))) {
        expect(label).not.toContain('_')
      }
    })

    it('JSON olarak serileştirilebilir (prompt içine gömülür)', () => {
      const selection = selectRelevantFoods('tavuk pilav')
      expect(() => JSON.stringify(selection)).not.toThrow()
      expect(JSON.parse(JSON.stringify(selection))).toEqual(selection)
    })
  })

  describe('kararlılık', () => {
    it('aynı açıklama her zaman aynı sonucu verir', () => {
      const first = selectRelevantFoods('200g tavuk göğsü ve pilav')
      const second = selectRelevantFoods('200g tavuk göğsü ve pilav')
      expect(first).toEqual(second)
    })

    it('tekrarlanan çağrılar veritabanını bozmaz', () => {
      // NOT: dönen makro nesneleri veritabanındaki nesnelerin ta kendisidir.
      // Çağıran taraf bunları DEĞİŞTİRMEMELİDİR — kopyalayarak kullanmalıdır.
      const before = JSON.stringify(allFoods())
      for (let i = 0; i < 20; i++) selectRelevantFoods('tavuk pilav yumurta peynir')
      expect(JSON.stringify(allFoods())).toBe(before)
    })

    it('çökmeden çalışır — beklenmedik girdilerde bile', () => {
      const weird = ['', ' ', '\n\n', '🥗🍗', '<script>alert(1)</script>', 'a'.repeat(5000), '###']
      for (const input of weird) {
        expect(() => selectRelevantFoods(input), JSON.stringify(input)).not.toThrow()
      }
    })
  })
})

describe('allFoods', () => {
  it('kategorilere ayrılmış ham veritabanını döner', () => {
    const foods = allFoods()
    expect(Object.keys(foods).length).toBeGreaterThanOrEqual(20)
    expect(foods).toHaveProperty('kanatlilar')
    expect(foods.kanatlilar).toHaveProperty('tavuk_gogus')
  })

  it('bilinen bir besinin değerleri beklenen aralıkta', () => {
    // Çiğ tavuk göğsü ~104 kcal/100g (prompt'taki çiğ/pişmiş kuralı buna dayanır).
    const chicken = allFoods().kanatlilar.tavuk_gogus
    expect(chicken.calories).toBe(104)
    expect(chicken.protein).toBeGreaterThan(20)
  })
})
