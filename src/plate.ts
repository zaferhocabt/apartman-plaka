/** Türk plaka kuralları: il kodu (01-81) + 1-3 harf + 2-4 rakam. Örn. 07ABC123, 34 AB 1234. */

/** Büyük harfe çevirir (İ→I, Ş→S… gibi Türkçe harfleri plaka alfabesine indirger), boşluk ve işaretleri atar. */
export function normalizePlate(input: string): string {
  const map: Record<string, string> = { İ: 'I', I: 'I', ı: 'I', Ş: 'S', ş: 'S', Ğ: 'G', ğ: 'G', Ü: 'U', ü: 'U', Ö: 'O', ö: 'O', Ç: 'C', ç: 'C' }
  return [...input]
    .map((c) => map[c] ?? c)
    .join('')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

const RE = /^(0[1-9]|[1-7]\d|8[01])([A-Z]{1,3})(\d{2,4})$/

export const isValidPlate = (p: string) => RE.test(p)

/** Okunaklı gösterim: 07ABC123 → 07 ABC 123 (biçim tanınmazsa olduğu gibi). */
export function formatPlate(p: string): string {
  const m = RE.exec(p)
  return m ? `${m[1]} ${m[2]} ${m[3]}` : p
}
