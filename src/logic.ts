import { normalizePlate } from './plate.ts'
import type { PublicResult, Snapshot, StaffResult } from './types.ts'

/** Sunucudaki (SQL) staff_lookup ile birebir aynı kural. Demo modunda ve testlerde kullanılır. */
export function lookupPlate(s: Snapshot, rawPlate: string, now = new Date()): StaffResult {
  const plate = normalizePlate(rawPlate)
  const t = now.getTime()
  const unitOf = (id: string) => s.units.find((u) => u.id === id)

  const v = s.vehicles.find((x) => x.plate === plate)
  if (v) {
    const u = unitOf(v.unit_id)
    return {
      status: v.active ? 'resident' : 'inactive',
      unit_no: u?.no,
      unit_id: u?.id,
      brand: v.brand,
      color: v.color,
      owner_name: u?.owner_name,
      phone: u?.phone,
      note: v.note,
    }
  }

  const visits = s.visitors.filter((x) => x.plate === plate).sort((a, b) => b.valid_until.localeCompare(a.valid_until))
  const live = visits.find((x) => new Date(x.valid_from).getTime() <= t && t <= new Date(x.valid_until).getTime())
  const pick = live ?? visits[0]
  if (pick) {
    const u = unitOf(pick.unit_id)
    return {
      status: live ? 'visitor' : 'expired',
      unit_no: u?.no,
      unit_id: u?.id,
      valid_until: pick.valid_until,
      visitor_name: pick.name,
      owner_name: u?.owner_name,
      phone: u?.phone,
      note: pick.note,
    }
  }
  return { status: 'unknown' }
}

/** Herkese açık sonuç: ad ve telefon çıkarılır. */
export const toPublic = (r: StaffResult): PublicResult => ({
  status: r.status,
  unit_no: r.status === 'unknown' ? null : r.unit_no,
  brand: r.status === 'resident' ? r.brand : null,
  color: r.status === 'resident' ? r.color : null,
  valid_until: r.valid_until,
})

// ---------- CSV ----------

const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
export const toCsv = (rows: unknown[][]) => '﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n')

/** ; , veya sekme ayracını kendisi bulur; tırnaklı alanları destekler. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '')
  const first = t.split(/\r?\n/, 1)[0] ?? ''
  const sep = [';', ',', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0]
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inQ) {
      if (c === '"' && t[i + 1] === '"') (cur += '"', i++)
      else if (c === '"') inQ = false
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === sep) (row.push(cur), (cur = ''))
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(cur)
      cur = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some((x) => x.trim())) rows.push(row)
  return rows.map((r) => r.map((x) => x.trim()))
}
