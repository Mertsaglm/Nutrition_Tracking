// ============================================================================
// Tarih yardımcıları — tüm platformlarda "gün" sınırı kullanıcının YEREL günüdür.
// UTC (toISOString) kullanmak, UTC+3 gibi ofsetlerde gece yarısı civarı öğünlerin
// yanlış güne düşmesine yol açardı; bu yüzden yerel takvim bileşenleri kullanılır.
// ============================================================================

/** Bir Date/ISO değerini yerel takvim tarihine (YYYY-MM-DD) çevirir. */
export function toLocalDateStr(value: Date | string = new Date()): string {
  const d = value instanceof Date ? value : new Date(value)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
