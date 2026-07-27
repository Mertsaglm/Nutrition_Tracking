# DECISIONS.md — Karar Günlüğü (ADR)

> Yalnızca ÖNEMLİ kararlar: mimari, araç, yaklaşım seçimleri.
> Her karar "neden"i ve "tekrar gözden geçirme koşulu" ile kaydedilir.
> En yeni karar en üste.

---

## #007 — 2026-07-27 — Plan kullanıcıya GERÇEĞİ söyler + tek kaynak konsolidasyonu

**Bağlam:** Test yazımı sırasında dört sessiz hata ortaya çıktı. Hiçbiri
derleme/tip hatası vermiyordu, uygulama "çalışıyor" görünüyordu:

1. `createFullNutritionPlan().weeklyWeightChange` kullanıcının İSTEDİĞİ hızı
   döndürüyordu. "2 haftada 5 kg" isteğinde kalori hedefi güvenlik için
   1 kg/hafta'ya kırpılıyor ama arayüz hâlâ 2.5 kg/hafta vaat ediyordu.
2. Mobil bildirim hatırlatmaları `MEAL_TYPES`'ın ilk N öğününü seçiyordu;
   3 öğünlük planda Akşam yerine Kuşluk için hatırlatma kuruluyordu.
3. `food-search` ekranındaki 6 kategori etiketi veritabanı anahtarlarıyla
   eşleşmiyordu; o kategorilerde ham anahtar ("bakliyat_kuru") görünüyordu.
4. `COMMON_KEYS` içindeki `yumurta` anahtarı veritabanında yoktu; "her
   prompt'ta bulunsun" denen besinlerden biri hiç eklenmiyordu.

**Seçenekler:**
- A) Sadece belgele, davranışı koru → kullanıcıya yanlış vaat sürer
- B) Düzelt ve düzeltmeyi testle kilitle → davranış değişir ama doğrulanır
- C) Yalnızca 3 ve 4'ü düzelt (kozmetik olanlar), 1 ve 2'ye dokunma →
  yarım çözüm, asıl yanıltıcı olan 1. madde kalır

**Karar:** B. Dördü de düzeltildi:
- `weeklyWeightChange` artık kalori farkından türetilir; yani tüm güvenlik
  sınırları (hız kırpması, minimum kalori tabanı, TDEE×1.3 tavanı) uygulandıktan
  sonra planın FİİLEN sağlayacağı hızdır. `recommendedWeeks` de o hızla hedefe
  ulaşmak için gereken gerçek süredir. Yeni `paceLimited: boolean` alanı,
  isteğin kırpıldığını arayüze bildirir (web onboarding'de uyarı gösterilir).
- Öğün listesi tek kaynağa alındı: `selectMealTypes()` (`calculator.ts`).
  Plan, web öğün seçici (eski `MEAL_INDICES` tablosu silindi) ve mobil
  bildirimler artık aynı listeyi kullanır.
- Kategori etiketleri ve `COMMON_KEYS` veritabanıyla hizalandı.

**Neden:** Bu bir sağlık uygulaması; kullanıcıya gösterilen sayı, sistemin
gerçekten yapacağı şey olmalı. "İstediğini göster" davranışı, güvenlik sınırını
görünmez kılıyordu — sınır varken kullanıcı onu bilmiyordu. Çiftlenmiş veriler
(öğün listesi) ise zaten ayrışmıştı; tek kaynak bunu yapısal olarak imkânsız
kılıyor. Her düzeltme, aynı hataya dönüşü engelleyen bir testle kilitlendi.

**Tekrar gözden geçir:** Ürün tarafında "kullanıcının girdiği süreyi aynen
göster, sadece uyar" tercih edilirse (UX kararı) — o zaman `recommendedWeeks`
isteği yansıtır, `paceLimited` + ayrı bir `achievableWeeks` alanı kullanılır.

---

## #006 — 2026-07-27 — Test stratejisi: davranış testleri + sözleşme (guard) testleri

**Bağlam:** Claude Code aboneliği bitiyor; proje bundan sonra daha zayıf
modellerle veya farklı araçlarla düzenlenecek. Asıl risk sözdizimi hatası değil,
**sessiz davranış bozulması**: yanlış kalori formülü, UTC'ye kayan gün hesabı,
istemciye sızan API anahtarı, şemayla uyuşmayan kolon adı. Bunların hiçbiri
derleme hatası vermez.

**Seçenekler:**
- A) Yalnızca klasik birim testleri → mantık korunur ama mimari/güvenlik
  kuralları (ör. "core React import etmesin") korunmaz
- B) Birim + entegrasyon + arayüz testleri + statik "guard" testleri →
  hem davranış hem kural korunur
- C) E2E (Playwright/Detox) ağırlıklı → gerçekçi ama yavaş, kırılgan ve
  kurulum yükü yüksek; tek kişilik projede bakımı zor

**Karar:** B. Vitest 3 üzerinde tek kök yapılandırma (`vitest.config.ts`),
6 proje: `core`, `tokens`, `web` (node), `web-ui` (jsdom), `mobile`, `guards`.
`tests/guards/` altındaki testler davranışı değil PROJE KURALLARINI doğrular:
sır sızıntısı, katman sınırları, yerel tarih kuralı, SQL ↔ TypeScript şema
hizası, ortam değişkeni sözleşmesi, monorepo bütünlüğü.

**Neden:** Guard testleri, bu projenin en değerli ama en kırılgan varlıklarını
(platform bağımsızlığı, sunucu-only anahtar, yerel gün kuralı) makine tarafından
okunabilir hâle getirir. Bir sonraki ajan kuralı "bilmek" zorunda değil — kuralı
çiğnediğinde test kırılır. `TZ=Europe/Istanbul` bilinçli olarak sabitlendi;
UTC'de koşan bir test paketi tarih regresyonunu göremezdi.

**Tekrar gözden geçir:** CI kurulduktan sonra E2E ihtiyacı yeniden
değerlendirilir; ayrıca mobil tarafta RN ekran testleri gerekirse ayrı bir
proje/preset eklenir.

---

## #001 — 2026-07-23 — Taşınabilirlik için AGENTS.md standardı + düz markdown hafıza

**Bağlam:** Claude Code aboneliği bitince Cursor, Antigravity, VS Code gibi
farklı araçlara geçilecek. Usta sistemi her araçta aynı şekilde çalışmalı.

**Seçenekler:**
- A) Araca özel özellikler (.claude/commands, .cursorrules...) → güçlü ama her araçta yeniden kurulum gerekir
- B) Tek AGENTS.md + düz markdown hafıza dosyaları → her uyumlu araç okur, kilitlenme yok
- C) Fine-tuning / özel model → pahalı ve gereksiz; sorun davranış+bağlam sorunu, bilgi sorunu değil

**Karar:** B. AGENTS.md kanonik dosya; CLAUDE.md, GEMINI.md ve
copilot-instructions.md yalnızca ona işaret eden köprüler. Komutlar araç
özelliği değil, AGENTS.md içinde "sözleşme" olarak tanımlı.

**Neden:** AGENTS.md araçlar arası fiili standart (Claude Code, Cursor,
Antigravity, Copilot, Codex destekliyor). Düz markdown hiçbir araca bağımlı
değil; git ile taşınır, her yerde okunur.

**Tekrar gözden geçir:** Ana kullanılan araç AGENTS.md desteğini bırakırsa
veya araca özel bir özellik (ör. gerçek slash komutları) ciddi verim farkı
yaratmaya başlarsa.

---

## #005 — 2026-07-06 — Supabase: Auth + Postgres + RLS

**Bağlam:** Kullanıcı hesapları, kişisel plan ve öğün geçmişi gibi
kişiye özel verinin güvenli saklanması ve auth gerekiyordu.

**Seçenekler:**
- A) Supabase (Postgres + Auth + RLS) → tek servis, ücretsiz katman,
  hem web hem mobilde aynı JS SDK
- B) Firebase → NoSQL, RLS yerine security rules; ekip Postgres'e alışkın değil
- C) Kendi backend'i (Node + Postgres + kendi auth) → tam kontrol ama
  bakım yükü ve auth'u sıfırdan yazma riski

**Karar:** A. Supabase.

**Neden:** Row Level Security ile kullanıcı bazlı izolasyon veritabanı
seviyesinde garanti altına alınıyor; auth hazır; hem web hem Expo'da
aynı `@supabase/supabase-js` kullanılabiliyor (`packages/core` içinde
platform-bağımsız factory ile).

**Tekrar gözden geçir:** Supabase ücretsiz katman limitleri aşılırsa
veya self-host/başka bir sağlayıcı ihtiyacı doğarsa.

---

## #004 — 2026-07-06 — AI sağlayıcı: Google Gemini (gemini-2.5-flash)

**Bağlam:** Doğal dilde yazılan öğün açıklamasından besin değeri
çıkarmak için bir LLM gerekiyordu.

**Seçenekler:**
- A) Google Gemini 2.5 Flash → ücretsiz katman (15 istek/dk, 250/gün),
  hızlı, yapılandırılmış çıktı desteği iyi
- B) OpenAI GPT → güçlü ama ücretsiz katmanı yok/kısıtlı
- C) Yerel/açık kaynak model → maliyet yok ama Türkçe besin çıkarımında
  kalite riski ve altyapı yükü

**Karar:** A. Gemini 2.5 Flash, model id `packages/core/src/config.ts`
→ `AI_CONFIG.model` içinde merkezi.

**Neden:** Ücretsiz katman v1 için yeterli, Türkçe metin işlemede kalite
kabul edilebilir, entegrasyonu basit.

**Tekrar gözden geçir:** Günlük 250 istek limiti gerçek kullanımda
aşılmaya başlarsa (ücretli plana geçiş veya sağlayıcı değişikliği
konuşulmalı).

---

## #003 — 2026-07-06 — AI çağrılarını client'tan server'a taşıma

**Bağlam:** İlk sürümde AI çağrıları client'tan yapılıyordu; bu,
`GEMINI_API_KEY`'in client bundle'ında/ağ trafiğinde görünmesi riskini
taşıyordu.

**Seçenekler:**
- A) Next.js API Routes üzerinden server-side proxy (`/api/analyze-meal`,
  `/api/sample-meal-plan`), key sadece serverda; her istek Supabase
  Bearer token ile doğrulanır
- B) Client'tan doğrudan Gemini çağrısı + key'i gizlemeye çalışmak →
  pratikte imkansız, key her zaman client'ta görünür kalır

**Karar:** A. `apps/web/lib/gemini.server.ts` sunucu tarafı Gemini
mantığını taşıyor; `packages/core/src/ai/client.ts` hem web hem mobil
için ortak HTTP client (web'in kendi API rotalarını çağırıyor, Gemini
SDK'sini değil).

**Neden:** Key sızıntısı riskini ortadan kaldırır; anonim kullanım
engellenmiş olur (bölüm: Kısıtlar → auth zorunlu AI rotaları).

**Tekrar gözden geçir:** Node.js runtime yerine edge'e geçme ihtiyacı
doğarsa (şu an Gemini SDK Node gerektiriyor, bu yüzden API route'ları
edge runtime kullanmıyor).

---

## #002 — 2026-07-06 — Monorepo yapısına geçiş + paylaşılan `@nutrition/core`

**Bağlam:** Web ve mobil uygulamalar ayrı ayrı geliştiriliyordu; iş
mantığı (hesaplama, tipler, servisler) iki yerde kopyalanıyor ve
birbirinden sapma riski taşıyordu.

**Seçenekler:**
- A) npm workspaces + Turborepo monorepo, `packages/core` +
  `packages/tokens` paylaşılan → tek doğruluk kaynağı, platform-bağımsız
  factory pattern (storage/env enjeksiyonu)
- B) İki ayrı repo + npm paketi olarak yayınlama → versiyon senkronu
  yükü, küçük ekip için gereksiz karmaşıklık
- C) Kod tekrarına devam → hızlı ama sapma/bakım riski yüksek

**Karar:** A. Monorepo + `@nutrition/core` (iş mantığı) ve
`@nutrition/tokens` (tasarım sistemi) paylaşılan paketler.

**Neden:** Tek kod tabanında hesaplama/tip/servis mantığı bir kez
yazılır, iki platformda da kullanılır; `packages/core`'un
`localStorage`/`AsyncStorage`/`process.env`'e doğrudan dokunmaması
kuralı bunu platform-bağımsız tutuyor.

**Tekrar gözden geçir:** Ekip büyür ve web/mobil release döngüleri
tamamen ayrışırsa (o zaman ayrı repo/paket yayınlama tekrar konuşulur).

---

<!-- Yeni karar şablonu:

## #NNN — YYYY-MM-DD — Kısa başlık

**Bağlam:** Hangi sorun/ihtiyaç bu kararı doğurdu?

**Seçenekler:**
- A) ... → artı/eksi
- B) ... → artı/eksi

**Karar:** Seçilen şey.

**Neden:** Hangi kısıta/hedefe dayanarak?

**Tekrar gözden geçir:** Hangi koşul oluşursa bu karar masaya geri gelir?
-->
