# 🥗 Nutrition Tracker

AI destekli kişiselleştirilmiş beslenme takip uygulaması. Bilimsel formüllerle hesaplanan günlük kalori ve makro besin hedefleri ile sağlıklı yaşam yolculuğunuza başlayın.

## ✨ Özellikler

- **🤖 AI Destekli Besin Analizi** - Google Gemini AI ile doğal dilde yemek açıklaması
- **📊 Kişiselleştirilmiş Plan** - Bilimsel formüllerle hesaplanan günlük hedefler
- **🎯 Akıllı Hedef Belirleme** - Kilo verme, alma, kas yapma veya koruma
- **📱 Modern UI** - Glassmorphism tasarım, responsive ve kullanıcı dostu
- **🔒 Güvenli** - Supabase Auth ve Row Level Security

## 🚀 Hızlı Başlangıç

### 1. Kurulum

```bash
git clone https://github.com/Mertsaglm/Nutrition-_Tracking.git
cd Nutrition-_Tracking
npm install
```

### 2. Environment Variables

`.env.local` dosyası oluşturun:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Google Gemini AI
NEXT_PUBLIC_GEMINI_API_KEY=your-gemini-api-key
```

**API Anahtarları:**
- **Supabase:** [supabase.com](https://supabase.com) → Yeni proje → Settings → API
- **Gemini:** [ai.google.dev](https://ai.google.dev) → Get API Key

### 3. Veritabanı Kurulumu

1. Supabase Dashboard → SQL Editor
2. `supabase-schema.sql` dosyasını çalıştırın

### 4. Başlatın

```bash
npm run dev
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde çalışacak.

## 📖 Kullanım

1. **Kayıt Olun** - Email ve şifre ile kayıt olun
2. **Onboarding** - Fiziksel özelliklerinizi ve hedeflerinizi girin
3. **Öğün Ekleyin** - "2 yumurta, 1 dilim ekmek" gibi doğal dilde yazın
4. **Takip Edin** - Günlük ilerlemenizi görün

## 🧮 Bilimsel Formüller

### BMR (Bazal Metabolizma Hızı)
```
Erkek: BMR = 10 × kilo + 6.25 × boy - 5 × yaş + 5
Kadın: BMR = 10 × kilo + 6.25 × boy - 5 × yaş - 161
```

### TDEE (Günlük Enerji İhtiyacı)
```
TDEE = BMR × Aktivite Çarpanı (1.2 - 1.9)
```

### Makro Dağılımı
- **Kilo Verme:** Protein %35, Karb %35, Yağ %30
- **Kas Yapma:** Protein %30, Karb %40, Yağ %30
- **Koruma:** Protein %25, Karb %45, Yağ %30

## 🛠️ Teknolojiler

- **Frontend:** Next.js 14, React 18, TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **AI:** Google Gemini 2.5 Flash
- **State:** Zustand

## 📁 Proje Yapısı

```
├── app/
│   ├── api/              # API endpoints
│   ├── auth/             # Login/Signup
│   ├── dashboard/        # Ana sayfa
│   └── onboarding/       # Kullanıcı kurulumu
├── components/           # React bileşenleri
├── lib/                  # Utility fonksiyonlar
│   ├── gemini-service.ts    # AI servisi
│   ├── nutrition-calculator.ts  # Hesaplama motoru
│   └── database-service.ts  # DB işlemleri
└── comprehensive-nutrition-database.json  # 500+ Türk yiyeceği
```

## 🚀 Deployment (Vercel)

1. GitHub'a push edin
2. [Vercel](https://vercel.com) → Import Project
3. Environment Variables ekleyin:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_GEMINI_API_KEY`
4. Deploy!

## ⚠️ Önemli Notlar

### Gemini API Limitleri (Free Tier)
- **RPM:** 15 istek/dakika
- **RPD:** 250 istek/gün
- **Çözüm:** Paid Tier 1 (1,000 RPM, 10,000 RPD)

### Veritabanı
- Row Level Security (RLS) aktif
- Her kullanıcı sadece kendi verilerini görebilir
- Otomatik trigger'lar ile günlük ilerleme hesaplanır

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing`)
3. Commit edin (`git commit -m 'feat: Add feature'`)
4. Push edin (`git push origin feature/amazing`)
5. Pull Request açın

## 📝 Lisans

MIT License

## 👨‍💻 Geliştirici

**Mert Sağlam**

---

⭐ Projeyi beğendiyseniz yıldız vermeyi unutmayın!
