# PROJECT.md — Projenin Kimliği

> Bir kez yazılır, nadiren değişir. Yeni projeye başlarken bu şablonu doldur.

## Proje Adı
Nutrition Tracking (Beslenme Takip) — mobil paket adı `com.mertsaglam.beslenmetakip`

## Tek Cümlelik Amaç
Kullanıcının doğal dilde anlattığı öğünleri yapay zekâ ile analiz edip
besin değerlerini çıkaran, Mifflin-St Jeor/TDEE formülüyle kişiye özel
kalori-makro planı hesaplayan ve günlük/haftalık ilerlemeyi takip ettiren,
web + mobil (Expo) üzerinde çalışan Türkçe bir beslenme takip uygulaması.

## Kapsam (Ne VAR)
- Kullanıcı onboarding: yaş, boy, kilo, cinsiyet, hedef (kilo ver/al/kas
  yap/koru), aktivite seviyesi, diyet tercihi (vejetaryen, vegan,
  glutensiz vb.), alerjiler, opsiyonel hedef süre.
- Mifflin-St Jeor BMR + TDEE ile kişiye özel kalori/makro planı
  (`packages/core/src/nutrition/calculator.ts`).
- Doğal dil öğün analizi: metin → Gemini 2.5 Flash → kalori/protein/
  karbonhidrat/yağ; 370+ kalemlik Türkçe besin veritabanı ile desteklenir
  (`packages/core/src/data/nutrition-db.json`).
- Örnek öğün planı üretimi (`/api/sample-meal-plan`).
- Günlük/haftalık takip: kalori-makro ilerlemesi, öğün geçmişi, kilo
  günlüğü, streak.
- Supabase e-posta/şifre auth; tüm AI rotaları Bearer token zorunlu
  (anonim çağrı yok).
- Mobilde öğün hatırlatma bildirimleri (`expo-notifications`). Expo Go'da
  native modül olmadığı için servis orada sessizce no-op çalışır; gerçek
  build'de bildirimler kurulur. Hatırlatılan öğünler beslenme planındaki
  öğünlerle aynıdır (`selectMealTypes`).
- Web (Next.js) ve mobil (Expo) aynı iş mantığını (`@nutrition/core`) ve
  aynı tasarım dilini (`@nutrition/tokens`) paylaşır.
- Otomatik test paketi (Vitest): iş mantığı, AI parse/prompt, Supabase
  servisleri, API route'ları, web bileşenleri, mobil servisler ve mimari/
  güvenlik sözleşmeleri. Rehber: kök dizindeki `TESTING.md`
  (bkz. DECISIONS.md #006).

## Kapsam Dışı (Ne YOK)
- Anonim/misafir kullanım — her AI çağrısı için giriş zorunlu.
- Sosyal özellikler (arkadaş ekleme, paylaşım, liderlik tablosu vb.) —
  planlanmadı.
- Kendi besin veritabanı editörü/admin paneli — veritabanı statik JSON.
- EAS build/submit otomasyonu — henüz `eas.json` yok, mobil dağıtım
  şimdilik Expo Go/manuel build seviyesinde.
- Uçtan uca (E2E) tarayıcı/cihaz testleri (Playwright/Detox) ve React Native
  ekran render testleri — bilinçli olarak kapsam dışı (bkz. DECISIONS #006).
- CI/CD otomasyonu — testler şimdilik elle (`npm run verify`) çalıştırılıyor;
  GitHub Actions kurulumu STATE.md'de sıradaki işler arasında.

## Kısıtlar
- **Bütçe:** Gemini ücretsiz katman — dakikada 15, günde 250 istek limiti
  (`docs/PROJECT_BRIEF.txt`). Bu limit aşılırsa maliyet/plan kararı gerekir.
- **Zaman:** Sabit bir hedef tarih dokümante edilmemiş; son commit'ler
  (2026-07-18) GitHub/Vercel'de yayına hazırlanmaya işaret ediyor.
- **Ortam:** Web → Vercel (Root Directory: `apps/web`), DB/Auth →
  Supabase, Mobil → Expo (SDK ~54, hem iOS hem Android bundle ID hazır,
  henüz EAS profili yok).
- **Diğer:**
  - Gemini API key sadece sunucu tarafında (`GEMINI_API_KEY`), asla
    `NEXT_PUBLIC_` ile client'a sızdırılmaz.
  - Supabase RLS her kullanıcıyı kendi verisiyle sınırlar.
  - `packages/core` platform bağımsız kalmalı: `localStorage`,
    `AsyncStorage`, `process.env`'e doğrudan dokunmaz — hepsi factory
    (`createSupabaseClient`, `createNutritionStore`,
    `createDatabaseService`, `createAuthService`) ile enjekte edilir.
  - Sağlık/güvenlik sınırları `packages/core/src/config.ts` içinde
    kodlu: cinsiyete göre minimum kalori (1500/1200/1350 kcal), haftalık
    maksimum kilo değişimi 1.0 kg, minimum kg başı protein. Plan bu
    sınırları kullanıcıdan GİZLEMEZ: istek kırpıldığında süre gerçekçi
    değere uzar ve `paceLimited` ile arayüz uyarır (bkz. DECISIONS #007).
  - "Gün" daima kullanıcının YEREL günüdür (`toLocalDateStr`). UTC tabanlı
    kestirmeler (`toISOString().split('T')[0]`) yasaktır — UTC+3'te gece
    yarısı civarı öğünleri bir önceki güne yazar.
  - Aynı bilgi iki yerde tutulmaz; tutulmak zorundaysa bir sözleşme testiyle
    bağlanır (bkz. LESSONS.md L-003).
  - Değişiklik sonrası `npm run verify` (typecheck + tüm testler) yeşil
    olmadan iş "bitti" sayılmaz.

## Teknoloji Yığını
| Katman | Seçim | Karar kaydı |
|---|---|---|
| Monorepo | npm workspaces + Turborepo, TypeScript ~5.9.2 | DECISIONS.md #002 |
| Web | Next.js 14 (App Router), React 18, Tailwind CSS | DECISIONS.md #002 |
| Mobil | Expo ~54, expo-router ~6, React Native 0.81.5, React 19.1.0 | DECISIONS.md #002 |
| Paylaşılan iş mantığı | `@nutrition/core` (types, calculator, food DB, auth/db factory, AI client, Zustand store) | DECISIONS.md #002 |
| Paylaşılan tasarım | `@nutrition/tokens` (Tailwind preset web / THEME objesi mobil) | DECISIONS.md #002 |
| State yönetimi | Zustand ^5 | — |
| Backend/API | Next.js API Routes (Node.js runtime — Gemini SDK Node gerektiriyor) | DECISIONS.md #003 |
| Veritabanı/Auth | Supabase (Postgres + Auth, RLS aktif) | DECISIONS.md #004 |
| AI sağlayıcı | Google Gemini `gemini-2.5-flash`, sadece server-side çağrı | DECISIONS.md #003, #005 |
| Dağıtım — Web | Vercel (Root Directory: `apps/web`) | — |
| Dağıtım — DB | Supabase (SQL editor → `supabase/schema.sql`) | — |
| Dağıtım — Mobil | Expo (bundle ID hazır, EAS profili yok) | — |
| Test | Vitest 3 (6 proje) + Testing Library/jsdom (web arayüzü) | DECISIONS.md #006 |

## Başarı Kriteri
- Kullanıcı bir öğünü doğal dilde yazdığında doğru/makul besin değerleri
  ile birkaç saniyede kaydediliyor.
- Günlük/haftalık ilerleme, kullanıcının kişisel plan hedeflerine göre
  doğru hesaplanıp gösteriliyor.
- Web ve mobil uygulamalar aynı hesap/veriyle sorunsuz senkron çalışıyor.
- Uygulama Vercel (web) ve en az bir mobil ortamda (Expo Go veya dev
  build) kararlı şekilde çalışıyor, kritik hata/crash yok.
- Kod tabanı, farklı araç/model ile yapılan sonraki düzenlemelere karşı
  korunaklı: `npm run verify` yeşilse davranış, güvenlik ve mimari
  sözleşmeler yerinde demektir.
