import type { Api } from './api.ts'
import { parseCsv } from './logic.ts'
import { isValidPlate, normalizePlate } from './plate.ts'
import type { Snapshot } from './types.ts'

export interface ImportRow { unit: string; plate: string; brand?: string; color?: string; owner?: string; phone?: string }

const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9]/g, '')

/** CSV → satırlar. Başlıklar (Daire, Plaka, Marka, Renk, Sakin, Telefon) tanınır; başlık yoksa bu sırayla varsayılır. */
export function rowsFromCsv(text: string): ImportRow[] {
  const all = parseCsv(text)
  if (!all.length) return []
  const find = (h: string[], keys: string[]) => h.findIndex((x) => keys.some((k) => fold(x).includes(k)))
  const head = all[0]
  const hasHeader = find(head, ['plaka']) >= 0
  const idx = hasHeader
    ? { unit: find(head, ['daire', 'no']), plate: find(head, ['plaka']), brand: find(head, ['marka', 'model']), color: find(head, ['renk']), owner: find(head, ['sakin', 'ad']), phone: find(head, ['telefon', 'tel']) }
    : { unit: 0, plate: 1, brand: 2, color: 3, owner: 4, phone: 5 }
  const at = (r: string[], i: number) => (i >= 0 ? r[i]?.trim() || undefined : undefined)
  return all.slice(hasHeader ? 1 : 0).map((r) => ({ unit: at(r, idx.unit) ?? '', plate: at(r, idx.plate) ?? '', brand: at(r, idx.brand), color: at(r, idx.color), owner: at(r, idx.owner), phone: at(r, idx.phone) }))
}

export const TEMPLATE_CSV = '﻿Daire;Plaka;Marka;Renk;Sakin;Telefon\r\n1;07ABC123;Fiat Egea;Beyaz;Ayşe Yılmaz;0555 000 00 01\r\n1;07KL452;Renault Clio;Gri;;\r\n2;07DEF456;Toyota Corolla;Siyah;Mehmet Kaya;0555 000 00 02\r\n'

export interface ImportReport { units: number; added: number; updated: number; skipped: string[] }

/** Birleştirir (silmez): olmayan daire/araç eklenir, var olan plakanın bilgisi güncellenir. */
export async function importRows(api: Api, snap: Snapshot, rows: ImportRow[]): Promise<ImportReport> {
  const units = new Map(snap.units.map((u) => [u.no, u]))
  const cars = new Map(snap.vehicles.map((v) => [v.plate, v]))
  const rep: ImportReport = { units: 0, added: 0, updated: 0, skipped: [] }
  const seen = new Set<string>()

  for (const [i, r] of rows.entries()) {
    const line = i + 2
    const plate = normalizePlate(r.plate)
    const no = r.unit.trim()
    if (!no || !plate) { rep.skipped.push(`Satır ${line}: daire veya plaka boş`); continue }
    if (plate.length < 4 || plate.length > 10) { rep.skipped.push(`Satır ${line}: plaka geçersiz (${r.plate})`); continue }
    if (seen.has(plate)) { rep.skipped.push(`Satır ${line}: ${plate} dosyada tekrar ediyor`); continue }
    seen.add(plate)
    try {
      let u = units.get(no)
      if (!u) {
        u = await api.saveUnit({ no, owner_name: r.owner ?? null, phone: r.phone ?? null })
        units.set(no, u)
        rep.units++
      } else if ((r.owner && !u.owner_name) || (r.phone && !u.phone)) {
        u = await api.saveUnit({ id: u.id, no, owner_name: u.owner_name || r.owner || null, phone: u.phone || r.phone || null })
        units.set(no, u)
      }
      const ex = cars.get(plate)
      await api.saveVehicle({ id: ex?.id, unit_id: u.id, plate, brand: r.brand ?? ex?.brand ?? null, color: r.color ?? ex?.color ?? null, active: ex?.active ?? true })
      if (ex) rep.updated++
      else rep.added++
      if (!isValidPlate(plate)) rep.skipped.push(`Satır ${line}: ${plate} eklendi ama biçimi alışılmadık, kontrol edin`)
    } catch (e) {
      rep.skipped.push(`Satır ${line}: ${(e as Error).message}`)
    }
  }
  return rep
}
