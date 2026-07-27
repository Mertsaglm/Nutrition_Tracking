# STATE.md — Mevcut Durum

> Usta her oturumun başında bu dosyayı okur, sonunda günceller.
> KISA TUT: ~100 satırı aşınca eskiyi `ai/archive/STATE-YYYY-MM.md`'ye taşı.

**Son güncelleme:** 2026-07-27
**Aktif milestone:** Yayına hazırlık — kod tabanı testlerle kilitlendi, sıra dağıtımda

## ✅ Tamamlananlar
- 2026-07-06 — Monorepo yapısına geçiş + paylaşılan `@nutrition/core` paketi
- 2026-07-06 — AI çağrıları client'tan server'a taşındı (Gemini key güvenliği), tasarım sistemi (`@nutrition/tokens`) ve iki platform arayüzü yenilendi
- 2026-07-06 — API hata eşleme, web lint config, monorepo README
- 2026-07-06 — Metro monorepo bundle çözümü düzeltildi (mobil)
- 2026-07-06 — Web'de Google Fonts bağımlılığı kaldırıldı → offline-güvenli sistem font stack
- 2026-07-18 — GitHub/Vercel yayınına hazırlık: monorepo revizyonu
- 2026-07-25 — Usta sistemi bu projeye kuruldu (AGENTS.md + ai/ hafıza katmanı), `ai/PROJECT.md` proje keşfiyle dolduruldu
- 2026-07-27 — **Mobil kararlılık paketi tamamlandı ve commit'lendi**: Expo Go
  bildirim fallback'i, tek React kopyası pinleme, signup session durumu,
  Hermes uyumlu timeout tespiti
- 2026-07-27 — **Kapsamlı test altyapısı kuruldu**: Vitest 3 · 6 proje ·
  43 dosya · 1037 test · %99.7 satır kapsamı. İş mantığı, AI parse/prompt,
  Supabase servisleri, API route'ları, React bileşenleri, mobil servisler ve
  mimari/güvenlik "guard" testleri. Rehber: kök dizindeki `TESTING.md`
- 2026-07-27 — Testlerin ortaya çıkardığı 4 hata düzeltildi (bkz. DECISIONS #007)
- 2026-07-27 — Dokümantasyon güncellendi: `README.md`, `docs/PROJECT_BRIEF.txt`,
  `TESTING.md` ve bu hafıza katmanı

## 🔨 Devam Edenler
- _(yok — çalışma dizini temiz, `npm run verify` yeşil)_

## 🧱 Bloklar / Bekleyenler
- _(yok)_

## 🎯 Sıradaki 3 İş
1. **Vercel'de web'i canlıya al** — Root Directory `apps/web`, üç env değişkeni
   (`GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   → DoD: prod URL üzerinden kayıt + öğün analizi uçtan uca çalışıyor
2. **CI kur (GitHub Actions)** — her push'ta `npm run verify` çalışsın
   → DoD: testler kırmızıyken merge engelleniyor. Testler ancak otomatik
   çalıştığında gerçek bir koruma olur; elle çalıştırmaya bel bağlanmaz
3. **Mobil dağıtım: `eas.json` + EAS build profili**
   → DoD: en az bir preview build üretiliyor ve cihazda açılıyor

## 📦 Backlog (şimdi değil, unutma da)
- React Native ekran testleri — mobilde şu an yalnızca servis/kablolama
  testleri var; RN render testleri ayrı bir kurulum gerektiriyor
- Web sayfa bileşeni testleri (dashboard, onboarding, auth akışları)
- Gemini ücretsiz katman limiti (250 istek/gün) gerçek kullanımda aşılırsa
  ücretli plan / sağlayıcı kararı (bkz. DECISIONS #004)
