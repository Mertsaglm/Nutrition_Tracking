# 🥗 Beslenme Takip — Monorepo

[![CI](https://github.com/Mertsaglm/Nutrition_Tracking/actions/workflows/ci.yml/badge.svg)](https://github.com/Mertsaglm/Nutrition_Tracking/actions/workflows/ci.yml)

AI destekli kişiselleştirilmiş beslenme takip uygulaması. **Web (Next.js)** ve **mobil (Expo)** olmak üzere iki uygulama, ortak iş mantığını tek bir paylaşılan pakette toplayan bir monorepo.

- **Kişiselleştirilmiş plan** — Mifflin-St Jeor + TDEE ile bilimsel kalori/makro hedefleri
- **AI besin analizi** — Google Gemini ile doğal dilde öğün analizi (370+ Türk yiyeceği veritabanı)
- **Takip** — günlük kalori/makro ilerleme, kilo takibi, seri (streak)
- **Güvenli** — Supabase Auth + Row Level Security; Gemini anahtarı yalnızca sunucuda
- **Test edilmiş** — 1000+ test; iş mantığı, API, arayüz ve mimari sözleşmeleri (bkz. [TESTING.md](TESTING.md))

## 📁 Yapı

```
.
├── apps/
│   ├── web/        # Next.js 14 (App Router) — AI route'larını da barındırır
│   └── mobile/     # Expo + expo-router
├── packages/
│   ├── core/       # @nutrition/core — platformdan bağımsız iş mantığı (tek kaynak)
│   └── tokens/     # @nutrition/tokens — tasarım sistemi (renk/tipografi/spacing)
├── supabase/       # SQL şeması (schema.sql) — tek dosyada tablolar, RLS, trigger'lar
├── tests/          # Paylaşılan test yardımcıları + mimari/güvenlik "guard" testleri
└── docs/           # Proje notları
```

Her paket ve uygulamanın kendi testleri kendi klasöründedir
(`packages/core/tests`, `apps/web/tests`, `apps/mobile/tests`); hepsi kökteki
`vitest.config.ts` üzerinden tek komutla çalışır.

### Mimari ilkeler
- **Tek kaynak:** tipler, hesaplama, DB/auth servisleri, AI prompt/parse ve besin veritabanı `@nutrition/core`'da. Web ve mobil bu paketi tüketir.
- **Platform enjeksiyonu:** core `localStorage`/`AsyncStorage`/`process.env`'e doğrudan dokunmaz; storage/env fabrikalarla dışarıdan verilir (`createSupabaseClient`, `createNutritionStore`, `createDatabaseService`, `createAuthService`).
- **AI sunucuda:** Gemini çağrıları web'in API route'larında çalışır (`GEMINI_API_KEY` server-only). Web ve mobil aynı route'ları ortak `createAINutritionClient` ile çağırır. Prompt'a tüm veritabanı değil, açıklamayla eşleşen besinler gömülür.
- **Tasarım sistemi:** tek renk/tipografi kaynağı (`packages/tokens`); web Tailwind preset'i, mobil `THEME` nesnesi olarak tüketir — ortak marka, platforma özel düzen.
- **Sözleşmeler test edilir:** "core platformdan bağımsızdır", "Gemini anahtarı yalnızca sunucuda okunur", "gün hesabı yereldir", "SQL şeması ile TS tipleri hizalıdır" gibi kurallar `tests/guards/` altında otomatik doğrulanır.

## 🚀 Kurulum

```bash
npm install            # kök dizinde — tüm workspace'leri kurar
```

### Ortam değişkenleri

**apps/web/.env.local** (bkz. `apps/web/.env.example`)
```env
GEMINI_API_KEY=...                      # SUNUCU-ONLY (NEXT_PUBLIC değil)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**apps/mobile/.env** (bkz. `apps/mobile/.env.example`)
```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_URL=http://localhost:3000   # AI route'larını barındıran web API'si
```

> Fiziksel cihazda `EXPO_PUBLIC_API_URL` bilgisayarının LAN IP'sini göstermeli (ör. `http://192.168.1.20:3000`).

### Veritabanı
Supabase Dashboard → SQL Editor → `supabase/schema.sql` içeriğini çalıştır.

## ▲ Vercel'e dağıtım (web)

Bu bir monorepo olduğu için Vercel projesinde **Root Directory** ayarı önemli:

1. Vercel → **Add New Project** → bu GitHub reposunu içe aktar.
2. **Root Directory** = `apps/web` seç (Next.js ve Turborepo otomatik algılanır).
3. **Environment Variables** ekle (Production + Preview):

   | Değişken | Açıklama |
   |---|---|
   | `GEMINI_API_KEY` | Sunucu-only; istemciye gönderilmez |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL'i |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key |

4. **Deploy** — sonraki `main` push'ları otomatik dağıtılır.

> Env değişkenleri build sırasında okunur (`lib/env.ts` eksikse hata fırlatır);
> deploy öncesi üçünün de tanımlı olduğundan emin ol.

## 🧑‍💻 Komutlar (kök dizin)

```bash
npm run dev          # tüm uygulamaları (turbo) geliştirme modunda
npm run web          # yalnız web (http://localhost:3000)
npm run mobile       # yalnız mobil (Expo)
npm run build        # tüm uygulamaları derle
npm run typecheck    # tüm paket ve uygulamaların tip kontrolü
npm run lint         # lint
npm run format       # Prettier

npm test             # tüm testler (tek sefer)
npm run test:watch   # testleri izleme modunda çalıştır
npm run test:coverage# kapsam raporu → coverage/index.html
npm run verify       # typecheck + test — değişiklikten sonra bunu çalıştır
```

## 🧪 Testler

Proje, ileride yapılacak değişikliklerin (özellikle AI destekli düzenlemelerin)
mevcut davranışı sessizce bozmasını engelleyecek şekilde test edilmiştir:
hesaplama motoru, AI parse/prompt katmanı, Supabase servisleri, API route'ları,
React bileşenleri ve mobil bildirim servisi. Ayrıca `tests/guards/` altında
**mimari ve güvenlik sözleşmeleri** statik olarak doğrulanır.

Her push ve pull request'te GitHub Actions (`.github/workflows/ci.yml`) tip
kontrolü, testler ve web derlemesini otomatik çalıştırır — testler ancak
otomatik koştuğunda gerçek bir koruma olur.

Ayrıntılar, kapsam ve katkı kuralları için: **[TESTING.md](TESTING.md)**

## 🧮 Bilimsel formüller
- **BMR:** Mifflin-St Jeor · **TDEE:** BMR × aktivite çarpanı (1.2–1.9)
- **Makro dağılımı:** hedefe göre (kilo verme / alma / kas / koruma)
- **Güvenlik sınırları:** cinsiyete göre minimum kalori, haftada en fazla 1 kg
  değişim, vücut ağırlığı başına minimum protein. Kullanıcının istediği süre bu
  sınırların altındaysa plan süreyi gerçekçi değere uzatır ve `paceLimited` ile
  arayüzü uyarır.
- Kaynak: `packages/core/src/nutrition/calculator.ts`

## 🛠️ Teknolojiler
Next.js 14 · React · Expo / React Native · TypeScript · Tailwind CSS · Supabase (PostgreSQL + Auth) · Google Gemini · Zustand · Turborepo + npm workspaces · Vitest + Testing Library

## 📝 Lisans
MIT — Mert Sağlam
