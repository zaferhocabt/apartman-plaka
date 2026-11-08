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

const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', T: '7', B: '8' }
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '6': 'G', '7': 'T', '8': 'B' }

/**
 * OCR çıktısından plaka adayları üretir. OCR O/0, I/1, S/5, B/8 gibi karakterleri karıştırır;
 * plakada hangi konumun rakam, hangisinin harf olduğu bilindiği için konuma göre düzeltilir.
 * Geçerli adaylar, düzeltme sayısı az olandan başlayarak sıralanır.
 */
export function plateCandidates(raw: string): string[] {
  const text = normalizePlate(raw)
  const out = new Map<string, number>()
  for (let len = 5; len <= 9; len++) {
    for (let start = 0; start + len <= text.length; start++) {
      const s = text.slice(start, start + len)
      for (let letters = 1; letters <= 3; letters++) {
        const digits = len - 2 - letters
        if (digits < 2 || digits > 4) continue
        let fixes = 0
        let cand = ''
        let ok = true
        for (let i = 0; i < len && ok; i++) {
          const c = s[i]
          const wantDigit = i < 2 || i >= 2 + letters
          if (wantDigit) {
            if (/\d/.test(c)) cand += c
            else if (TO_DIGIT[c]) (cand += TO_DIGIT[c], fixes++)
            else ok = false
          } else {
            if (/[A-Z]/.test(c)) cand += c
            else if (TO_LETTER[c]) (cand += TO_LETTER[c], fixes++)
            else ok = false
          }
        }
        if (ok && isValidPlate(cand)) {
          // önce metnin en çoğunu kapsayan aday, eşitse en az düzeltme gereken
          const score = (text.length - len) * 10 + fixes
          if (!out.has(cand) || out.get(cand)! > score) out.set(cand, score)
        }
      }
    }
  }
  return [...out.entries()].sort((a, b) => a[1] - b[1]).map(([p]) => p).slice(0, 4)
}
