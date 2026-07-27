# LESSONS.md — Dersler ve Anti-Pattern'ler

> Geçmiş hatalardan çıkan dersler. Usta bunları bilir ve aynı çukura ikinci
> kez düşülmesine izin vermez. `/ders <olay>` komutuyla yeni ders eklenir.
> Bu dosya projeler arası taşınır — dersler birikir.

---

## L-004 — Kullanıcıya gösterilen sayı, sistemin fiilen yapacağı şey olmalı

**Olay:** Beslenme planı, kullanıcının istediği hızı ("2 haftada 5 kg")
gösteriyordu; oysa kalori hedefi güvenlik için sessizce 1 kg/hafta'ya
kırpılıyordu. Kullanıcı hem yanlış bir vaat görüyor hem de güvenlik sınırının
varlığından haberdar olmuyordu.

**Ders:** Bir değeri hesaplarken sınırlıyorsan (clamp/clip/floor/cap), arayüze
giden özet o sınırdan SONRAKİ değeri yansıtmalı. Girdiyi aynen geri yansıtan
"özet" alanları, sistemin gerçekte ne yaptığını gizler.

**Kural:** Bir hesaplama sonucunda güvenlik/iş kuralı gereği kırpma varsa
(a) çıktı kırpılmış gerçeği bildirsin, (b) kırpıldığını söyleyen açık bir alan
(`paceLimited` gibi) eklensin, (c) kırpmanın olduğu ve olmadığı durum ayrı ayrı
testlensin. Özellikle sağlık/finans gibi alanlarda bunu tartışmaya açma.

---

## L-003 — Aynı bilgiyi iki yerde tutma; tutuyorsan testle bağla

**Olay:** Öğün listesi üç yerde yaşıyordu: `config.ts` (MEAL_TYPES),
`calculator.ts` (ayrı bir ALL_MEALS dizisi) ve `MealLogger.tsx`
(MEAL_INDICES tablosu). Mobil bildirim servisi ise dördüncü bir yöntemle
"ilk N öğün" seçiyordu. Zamanla ayrıştılar: 3 öğünlük planda kullanıcı
Kahvaltı/Öğle/Akşam görüyordu ama hatırlatma Kuşluk için kuruluyordu.
Aynı şekilde besin kategorisi etiketleri veritabanı anahtarlarından sapmıştı.

**Ders:** Çiftlenmiş veri her zaman ayrışır; soru "ayrışır mı" değil "ne zaman".
Ayrışma derleme hatası vermediği için de aylarca fark edilmez.

**Kural:** Aynı bilgi iki yerde görünüyorsa önce TEK KAYNAĞA indir
(ör. `selectMealTypes()` gibi paylaşılan bir fonksiyon). Teknik olarak
birleştirilemiyorsa (ör. SQL şeması ↔ TypeScript tipleri), iki tarafı
karşılaştıran bir "sözleşme testi" yaz — bağı kod değil, test kursun.

---

## L-002 — Monorepo'da tek React kopyası pinlenmeli

**Olay:** `apps/mobile` (RN 0.81 → React 19.1.0) ve `apps/web` (React 18)
aynı workspace'te farklı React sürümleri istiyordu; npm hoisting bunları
karıştırınca mobilde Fabric renderer crash'i oluştu
(`Cannot read property 'S' of undefined`).

**Ders:** Monorepo'da farklı React/React Native sürümü gerektiren
uygulamalar varsa, hoisting'e güvenmeden her app'in kendi React kopyasını
kullandığından emin olmak gerekir.

**Kural:** Yeni bir mobil/web paket eklerken React sürüm çakışması
ihtimalini baştan kontrol et; gerekirse `metro.config.js` (mobil) veya
eşdeğer bundler ayarında ilgili paketin resolution'ını app-local'e pinle
(bkz. `apps/mobile/metro.config.js`).

---

## L-001 — Expo Go'da native modül varsayımı yapma

**Olay:** Expo Go (SDK 53+) `expo-notifications`'ın native bildirim
modülünü kaldırdı; kod koşulsuz import/kullanınca Expo Go'da konsol
hatalarına ve bildirim özelliğinin kullanılamaz olmasına yol açtı.

**Ders:** Expo/React Native tarafında bir native modülü kullanmadan
önce, "bu modül Expo Go'da da var mı, yoksa sadece dev build'de mi"
sorusunu sor. Expo Go ile dev build arasındaki fark sessizce
kod kırabilir.

**Kural:** Native modül gerektiren özellikleri (bildirimler, vb.)
`ExecutionEnvironment` kontrolüyle sarmala, Expo Go'da no-op/fallback
davranışı ve kullanıcıya açık bir uyarı (dev build gerektiği) sun —
sessizce patlamasın.

<!-- Yeni ders şablonu:

## L-NNN — Kısa başlık

**Olay:** Ne oldu?

**Ders:** Genelleştirilmiş çıkarım.

**Kural:** Usta bundan sonra somut olarak ne yapacak/soracak?
-->
