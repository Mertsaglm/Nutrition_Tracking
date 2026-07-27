# Usta — Taşınabilir AI Mühendislik Yardımcısı

Bu repo, farklı AI kodlama araçlarında (**Claude Code, Cursor, Antigravity,
VS Code eklentileri, Copilot...**) aynı şekilde çalışan kişisel bir
"usta/yol gösteren" sistemidir. Sır şu: her şey düz markdown, hiçbir aracın
özel özelliğine bağımlılık yok.

## Yapı

```
proje/
├── AGENTS.md                        ← KANONİK dosya: Usta'nın kimliği, kuralları, komutları
├── CLAUDE.md                        ← Claude Code köprüsü (sadece AGENTS.md'ye yönlendirir)
├── GEMINI.md                        ← Antigravity köprüsü (araç-özel ayarlar buraya)
├── .github/copilot-instructions.md  ← Copilot/VS Code köprüsü
├── ai/
│   ├── PROJECT.md                   ← Projenin amacı, kapsamı, kısıtları (nadiren değişir)
│   ├── STATE.md                     ← Durum: bitti / devam / bloklar / sıradaki 3 iş
│   ├── DECISIONS.md                 ← Karar günlüğü (ADR): ne, neden, ne zaman tekrar bak
│   ├── PROFILE.md                   ← Mert'in profili ve kısıtları (projeler arası ORTAK)
│   ├── LESSONS.md                   ← Geçmiş hatalardan dersler (anti-pattern listesi)
│   └── archive/                     ← STATE şişince eski içerik buraya
└── yeni-proje.sh                    ← Şablonu yeni bir projeye kopyalar
```

## Nasıl çalışır?

1. AI aracı projeyi açınca kural dosyasını okur (AGENTS.md'yi doğrudan, ya da
   köprü dosyası üzerinden).
2. Usta oturum başında `ai/` dosyalarını okur → "nerede kalmıştık" sorusu hiç doğmaz.
3. Oturum sonunda (`/kapat`) STATE.md güncellenir → bir sonraki oturum, hangi
   araçta olursa olsun, kaldığı yerden devam eder.

## Komutlar

Bunlar gerçek slash komutu değil, AGENTS.md içinde tanımlı **sözleşmeler** —
bu yüzden her araçta çalışırlar. Sohbete yazman yeterli:

| Komut | Ne yapar |
|---|---|
| `/baslat` | Oturumu açar: durumu okur, bugün için iş önerir (dosyalar boşsa önce keşfe geçer) |
| `/tanis` | Tanışma + proje keşfi: Usta sorular sorar, PROFILE.md ve PROJECT.md'yi kendisi doldurur |
| `/durum` | Neler bitti, neler kaldı, sıradaki 3 iş |
| `/karar <konu>` | Seçenekleri tartışır, kararı gerekçesiyle DECISIONS.md'ye işler |
| `/plan <hedef>` | Hedefi milestone'lara ve 1-2 saatlik görevlere böler |
| `/kapat` | Oturumda yapılanları STATE.md'ye yazar, kapanış özeti verir |
| `/ders <olay>` | Yaşanan bir hatadan ders çıkarıp LESSONS.md'ye ekler |
| `/ogret <konu>` | Konuyu sade, benzetmeli, öğretici şekilde anlatır |

## Yeni projeye başlarken

```bash
./yeni-proje.sh ~/Desktop/YeniProjem
```

Script şablonu kopyalar ve STATE'i sıfırlar. Sonra tek yapman gereken:
1. Yeni klasörü AI aracında açıp `/baslat` yazmak.
2. Gerisi Usta'da: PROJECT.md boş olduğunu görür, sana proje fikrini sorar,
   turlar halinde sorularla projeyi anlar, anladığını sana onaylatır ve
   PROJECT.md'yi **kendisi doldurur**. Sen sadece anlatırsın.

`ai/PROFILE.md` projeler arası ortaktır — bir yerde güncellediğinde
diğer projelere de kopyalamayı unutma (tek doğruluk kaynağı bu repo olsun).

## Araç uyumluluğu notları

- **Claude Code:** CLAUDE.md'yi otomatik okur → AGENTS.md'ye yönlenir.
- **Cursor:** AGENTS.md'yi doğrudan okur (eski .cursorrules'a gerek yok).
- **Antigravity:** AGENTS.md'yi okur; çakışmada GEMINI.md öncelikli olduğu
  için araca özel ayarlar GEMINI.md'ye yazılır.
- **VS Code (Copilot):** `.github/copilot-instructions.md` → AGENTS.md'ye yönlenir.
- **Cline / Continue / Roo:** AGENTS.md'yi okuyabilir; okumazsa ilk mesajda
  "AGENTS.md'yi oku ve uygula" yazman yeterli.

Her araçta geçerli son çare: sohbetin ilk mesajına şunu yaz →
**"AGENTS.md'yi oku ve oradaki kurallara göre çalış."**
