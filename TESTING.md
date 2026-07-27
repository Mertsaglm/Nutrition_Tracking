# Test Rehberi

Bu projenin test paketi, **kodun ileride (özellikle yapay zeka destekli
düzenlemelerle) sessizce bozulmasını engellemek** için yazılmıştır. Testler
yalnızca "çalışıyor mu" diye bakmaz; projenin **sözleşmelerini** kilitler.

## Çalıştırma

```bash
npm test                 # tüm testler (tek sefer)
npm run test:watch       # izleme modu (geliştirirken)
npm run test:coverage    # kapsam raporu → coverage/index.html
npm run verify           # typecheck + tüm testler (değişiklikten sonra bunu çalıştır)

npx vitest run --project core      # yalnızca çekirdek iş mantığı
npx vitest run --project guards    # yalnızca mimari/güvenlik sözleşmeleri
npx vitest run calculator          # adı eşleşen dosyalar
```

Tüm testler tek bir kök yapılandırmadan (`vitest.config.ts`) yönetilir.

## CI

`.github/workflows/ci.yml`, her `main` push'unda ve her pull request'te şunları
çalıştırır: `npm run typecheck` → `npm test` → `npm run build`.

Derleme adımı sahte ortam değişkenleriyle koşar (gerçek anahtarlar yalnızca
Vercel'de tutulur); amacı Vercel'in yapacağı işin yerelde de tuttuğunu
doğrulamaktır. Testler saat dilimini kendisi sabitlediği için CI makinesinin
saat dilimi sonucu etkilemez.

## Projeler

| Proje    | Konum                  | Ortam  | Kapsam                                              |
| -------- | ---------------------- | ------ | --------------------------------------------------- |
| `core`   | `packages/core/tests`  | node   | Hesaplama motoru, doğrulama, tarih, AI parse/prompt, servisler, store |
| `tokens` | `packages/tokens/tests`| node   | Tasarım token'ları, tema tutarlılığı, Tailwind preset |
| `web`    | `apps/web/tests/server`| node   | API route'ları, sunucu lib'leri, env, SSR güvenliği   |
| `web-ui` | `apps/web/tests/ui`    | jsdom  | React bileşenleri ve kullanıcı akışları              |
| `mobile` | `apps/mobile/tests`    | node   | Bildirim servisi (Expo Go / build ayrımı), env       |
| `guards` | `tests/guards`         | node   | Mimari, güvenlik ve şema **sözleşmeleri**            |

Paylaşılan yardımcılar: `tests/helpers/`
(`fake-supabase.ts`, `fixtures.ts`, `source-scan.ts`).

## Guard (sözleşme) testleri — en önemli kısım

`tests/guards/` altındaki testler davranış değil **kural** doğrular. Bunlar
derleme hatası vermeyen, testsiz fark edilmesi çok zor bozulmaları yakalar:

- **`secrets.test.ts`** — `GEMINI_API_KEY` yalnızca `*.server.ts` içinde
  okunabilir; koda gömülü anahtar/JWT olamaz; `.env` dosyaları git'e girmez.
- **`architecture.test.ts`** — `packages/core` platformdan bağımsız kalır
  (React/Next/Expo/Node API'si import etmez); iş mantığı uygulamalara
  kopyalanmaz; sunucu-only modüller istemciden import edilmez.
- **`date-safety.test.ts`** — "gün" hesabı her zaman **yerel** takvimden gelir.
  `toISOString().split('T')[0]` gibi UTC kestirmeleri yasaktır (UTC+3'te öğünleri
  bir önceki güne yazar).
- **`schema-alignment.test.ts`** — `supabase/schema.sql` ↔ `database.types.ts` ↔
  servis sorguları hizalı kalır; RLS ve politika kontrolleri.
- **`env-contract.test.ts`** — kodda okunan her ortam değişkeni `.env.example`
  içinde belgelidir (ve tersi).
- **`domain-consistency.test.ts`** — öğün listesi (`selectMealTypes`) ve besin
  kategorisi etiketleri gibi birden fazla yerde tüketilen verilerin tek kaynakla
  bağını korur; web öğün seçici, mobil bildirimler ve plan aynı listeyi görür.
- **`workspace-integrity.test.ts`** — paket giriş noktaları, Turbo/Metro/Next
  yapılandırmaları ve **test altyapısının kendisi** yerinde kalır.

## Değişiklik yaparken

1. Değişiklikten sonra **`npm run verify`** çalıştır.
2. Bir test kırıldıysa **önce kodu incele**. Bu testlerin çoğu, geçmişte gerçekten
   yaşanmış bir hatayı ya da bilinçli bir tasarım kararını koruyor; test dosyasının
   başındaki yorum bloğu nedenini anlatır.
3. Testi **davranışı doğrulamak için** değiştir, **geçirmek için değil**. Bir
   beklentiyi gevşetmek gerekiyorsa nedenini yorum olarak yaz.
4. Yeni davranış eklerken testini de ekle. Yeni bir dışa aktarım eklediysen
   `packages/core/tests/public-api.test.ts` içindeki listeyi de güncelle
   (bu liste bilinçli olarak eksiksizdir).

### Testleri silmek / atlamak

`it.skip`, `describe.skip` ya da bir test dosyasını silmek, bu paketin amacını
ortadan kaldırır. Bir test artık geçerli değilse **sil değil, güncelle** ve
neden değiştiğini yorumla açıkla.

## Bilinçli olarak kayıt altına alınan davranışlar

Bazı testler "ideal" değil, **mevcut** davranışı belgeler. Bunlar yorumlarda
`DAVRANIŞ NOTU` / `NOT` ifadesiyle işaretlidir:

- `nutrition-db.json` değerleri **çiğ/kuru** haldedir (ör. `pilav` 368 kcal);
  pişmiş dönüşümünü AI prompt'undaki kurallar yapar. Değerleri tek taraflı
  "düzeltmek" prompt'la uyumu bozar.
- Store'dan geri yüklenen öğünlerde `timestamp` bir **metindir** (Date değil);
  kullanmadan önce `new Date(...)` gerekir.
- `selectRelevantFoods` eşleştirmesi çift yönlü `includes` kullanır: "bir" →
  "bira" ile eşleşir. Ek almış Türkçe kelimeleri yakalamak için bilinçli bir
  gevşekliktir.
- `selectRelevantFoods`'un döndürdüğü makro nesneleri veritabanındaki
  nesnelerin ta kendisidir; çağıran taraf onları **değiştirmemelidir**.

### Testlerle birlikte düzeltilen eski davranışlar

Bunlar artık birer regresyon koruması (aynı hataya dönülmesi testi kırar):

- `createFullNutritionPlan()` artık planın **fiilen sağladığı** haftalık değişimi
  ve gerçekçi süreyi bildirir; istek güvenlik sınırıyla kırpıldıysa
  `paceLimited: true` döner.
- Öğün listesi tek kaynaktan gelir: `selectMealTypes()`. Web öğün seçici ve
  mobil bildirim hatırlatmaları artık planla aynı öğünleri kullanır.
- `food-search` kategori etiketleri veritabanı anahtarlarıyla birebir eşleşir.
- `COMMON_KEYS` içindeki ölü `yumurta` anahtarı `tavuk_yumurta_tam` oldu.

## Saat dilimi

`vitest.config.ts` içindeki `TZ: 'Europe/Istanbul'` ayarı **bilinçlidir**.
Tarih testleri UTC'den farklı bir saat dilimi olmadan anlamsızlaşır. Bu ayarı
değiştirme.
