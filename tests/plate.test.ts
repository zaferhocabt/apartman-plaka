import { formatPlate, isValidPlate, normalizePlate, plateCandidates } from '../src/plate.ts'
import { lookupPlate, parseCsv, toCsv, toPublic } from '../src/logic.ts'
import type { Snapshot } from '../src/types.ts'

let fail = 0
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`)
}

eq('normalize boşluk/küçük', normalizePlate('07 abc 123'), '07ABC123')
eq('normalize Türkçe', normalizePlate('34 şğ 12-34'), '34SG1234')
eq('normalize ı/İ', normalizePlate('06 ıİ 111'), '06II111')
eq('geçerli', ['07ABC123', '34AB1234', '06A12', '81Z999'].map(isValidPlate), [true, true, true, true])
eq('geçersiz', ['00ABC123', '82AB123', '07ABCD123', '07AB1', '07123ABC', ''].map(isValidPlate), [false, false, false, false, false, false])
eq('format', formatPlate('07ABC123'), '07 ABC 123')

eq('OCR doğru okuma', plateCandidates('07 ABC 123')[0], '07ABC123')
eq('OCR O→0 il kodunda', plateCandidates('O7ABC123')[0], '07ABC123')
eq('OCR 0→O harf yerinde', plateCandidates('070BC123')[0], '07OBC123')
eq('OCR I→1 / S→5 rakam yerinde', plateCandidates('34 ABC I2S')[0], '34ABC125')
eq('OCR gürültülü metin', plateCandidates('xx |07 ABC 123| yy')[0], '07ABC123')
eq('OCR plaka yok', plateCandidates('merhaba'), [])

const now = new Date('2026-11-08T12:00:00Z')
const snap: Snapshot = {
  settings: { building_name: 'T', public_lookup: true },
  units: [{ id: 'u1', no: '3', owner_name: 'Ayşe Y.', phone: '555' }],
  vehicles: [
    { id: 'v1', unit_id: 'u1', plate: '07ABC123', brand: 'Fiat', color: 'Beyaz', active: true },
    { id: 'v2', unit_id: 'u1', plate: '07PAS11', active: false },
  ],
  visitors: [
    { id: 'z1', unit_id: 'u1', plate: '34ZZ100', valid_from: '2026-11-08T00:00:00Z', valid_until: '2026-11-09T00:00:00Z' },
    { id: 'z2', unit_id: 'u1', plate: '34OLD10', valid_from: '2026-11-01T00:00:00Z', valid_until: '2026-11-02T00:00:00Z' },
    { id: 'z3', unit_id: 'u1', plate: '34FUT10', valid_from: '2026-11-10T00:00:00Z', valid_until: '2026-11-11T00:00:00Z' },
  ],
}
eq('sakin', lookupPlate(snap, '07 abc 123', now).status, 'resident')
eq('pasif', lookupPlate(snap, '07PAS11', now).status, 'inactive')
eq('ziyaretçi geçerli', lookupPlate(snap, '34 ZZ 100', now).status, 'visitor')
eq('ziyaretçi süresi dolmuş', lookupPlate(snap, '34OLD10', now).status, 'expired')
eq('ziyaretçi henüz başlamamış → expired', lookupPlate(snap, '34FUT10', now).status, 'expired')
eq('kayıtsız', lookupPlate(snap, '01XX999', now), { status: 'unknown' })
const pub = toPublic(lookupPlate(snap, '07ABC123', now))
eq('public: ad/telefon yok', JSON.stringify(pub).includes('Ayşe') || JSON.stringify(pub).includes('555'), false)
eq('public: daire+marka var', [pub.unit_no, pub.brand], ['3', 'Fiat'])
eq('public kayıtsız daire yok', toPublic(lookupPlate(snap, '01XX999', now)).unit_no ?? null, null)

const csv = toCsv([['Daire', 'Plaka', 'Not'], ['3', '07ABC123', 'a;b "c"']])
eq('csv roundtrip', parseCsv(csv), [['Daire', 'Plaka', 'Not'], ['3', '07ABC123', 'a;b "c"']])
eq('csv virgül', parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']])

console.log(fail ? `\n${fail} TEST BAŞARISIZ` : '\nTüm testler geçti')
process.exit(fail ? 1 : 0)
