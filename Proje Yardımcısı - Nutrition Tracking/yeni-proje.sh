#!/bin/bash
# Usta şablonunu yeni bir projeye kopyalar.
# Kullanım: ./yeni-proje.sh /yol/YeniProje
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Kullanım: ./yeni-proje.sh /yol/YeniProje"
  exit 1
fi

KAYNAK="$(cd "$(dirname "$0")" && pwd)"
HEDEF="$1"

if [ -e "$HEDEF" ] && [ -n "$(ls -A "$HEDEF" 2>/dev/null)" ]; then
  echo "HATA: '$HEDEF' zaten var ve boş değil. Üzerine yazmamak için duruyorum."
  exit 1
fi

mkdir -p "$HEDEF/ai/archive" "$HEDEF/.github"

cp "$KAYNAK/AGENTS.md"  "$HEDEF/"
cp "$KAYNAK/CLAUDE.md"  "$HEDEF/"
cp "$KAYNAK/GEMINI.md"  "$HEDEF/"
cp "$KAYNAK/.github/copilot-instructions.md" "$HEDEF/.github/"
cp "$KAYNAK/ai/PROFILE.md"  "$HEDEF/ai/"   # projeler arası ortak profil
cp "$KAYNAK/ai/LESSONS.md"  "$HEDEF/ai/"   # dersler de seninle taşınsın
cp "$KAYNAK/ai/archive/README.md" "$HEDEF/ai/archive/"

# PROJECT.md BOŞ şablon olarak başlar.
# (Kaynak projenin dolu PROJECT.md'si kopyalanırsa Usta yeni projeyi eski proje
#  sanır ve keşif protokolünü hiç çalıştırmaz — sessiz ve tehlikeli bir hata.)
cat > "$HEDEF/ai/PROJECT.md" <<'EOF'
# PROJECT.md — Projenin Kimliği

> Bir kez yazılır, nadiren değişir. Usta bu dosya boş/şablon halindeyken
> keşif protokolünü (AGENTS.md bölüm 3) çalıştırır ve burayı KENDİSİ doldurur.

## Proje Adı
_(henüz belirlenmedi)_

## Tek Cümlelik Amaç
_(Usta keşifte öğrenip yazar)_

## Kapsam (Ne VAR)
- _(v1'de mutlaka olması gerekenler)_

## Kapsam Dışı (Ne YOK)
- _(bilerek yapılmayacaklar — scope creep'e karşı en güçlü savunma)_

## Kısıtlar
- **Bütçe:** _(henüz öğrenilmedi)_
- **Zaman:** _(henüz öğrenilmedi)_
- **Ortam:** _(henüz öğrenilmedi)_
- **Diğer:** _(teknik/yasal/kişisel kısıtlar)_

## Teknoloji Yığını
| Katman | Seçim | Karar kaydı |
|---|---|---|
| _(henüz seçilmedi)_ | | |

## Başarı Kriteri
- _("oldu bu iş" dedirtecek, doğrulanabilir cümleler)_
EOF

BUGUN="$(date +%Y-%m-%d)"

# STATE.md sıfırdan başlar
cat > "$HEDEF/ai/STATE.md" <<EOF
# STATE.md — Mevcut Durum

> Usta her oturumun başında bu dosyayı okur, sonunda günceller.
> KISA TUT: ~100 satırı aşınca eskiyi \`ai/archive/STATE-YYYY-MM.md\`'ye taşı.

**Son güncelleme:** $BUGUN
**Aktif milestone:** Başlangıç

## ✅ Tamamlananlar
- $BUGUN — Proje şablondan oluşturuldu

## 🔨 Devam Edenler
- (yok)

## 🧱 Bloklar / Bekleyenler
- (yok)

## 🎯 Sıradaki 3 İş
1. /baslat yaz — Usta proje keşfini yapsın: sorular sorup ai/PROJECT.md'yi kendisi doldursun — DoD: PROJECT.md dolu ve onaylı
2. /plan ile ilk milestone'u çıkar — DoD: 1-2 saatlik görevler + DoD'ler hazır
3. En riskli varsayımı doğrulayan ilk görevi yap — DoD: "bu iş çalışır" kanıtlandı

## 📦 Backlog (şimdi değil, unutma da)
- (boş)
EOF

# DECISIONS.md boş başlar (şablonla birlikte)
cat > "$HEDEF/ai/DECISIONS.md" <<'EOF'
# DECISIONS.md — Karar Günlüğü (ADR)

> Yalnızca ÖNEMLİ kararlar: mimari, araç, yaklaşım seçimleri.
> Her karar "neden"i ve "tekrar gözden geçirme koşulu" ile kaydedilir.
> En yeni karar en üste.

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
EOF

echo "✅ Hazır: $HEDEF"
echo "Sıradaki adım: AI aracında projeyi aç ve '/baslat' yaz."
echo "Usta sana soruları sorup PROJECT.md'yi kendisi dolduracak."
