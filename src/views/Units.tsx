import { useMemo, useState, type FormEvent } from 'react'
import { Building2, CarFront, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { errText } from '../api.ts'
import { useApp } from '../ctx.tsx'
import { isValidPlate, normalizePlate } from '../plate.ts'
import type { Unit, Vehicle } from '../types.ts'
import { Empty, Field, Modal, Plate, PlateInput } from '../ui.tsx'

function UnitForm({ unit, onDone }: { unit?: Unit; onDone: () => void }) {
  const { api, reload, toast } = useApp()
  const [f, setF] = useState({ no: unit?.no ?? '', owner_name: unit?.owner_name ?? '', phone: unit?.phone ?? '', note: unit?.note ?? '' })
  const [err, setErr] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.saveUnit({ id: unit?.id, no: f.no.trim(), owner_name: f.owner_name.trim() || null, phone: f.phone.trim() || null, note: f.note.trim() || null })
      await reload()
      toast('Daire kaydedildi')
      onDone()
    } catch (x) { setErr(errText(x)) }
  }
  return (
    <form className="form" onSubmit={submit}>
      <Field label="Daire no"><input required value={f.no} maxLength={10} onChange={(e) => setF({ ...f, no: e.target.value })} placeholder="örn. 5" /></Field>
      <Field label="Sakin adı"><input value={f.owner_name} maxLength={80} onChange={(e) => setF({ ...f, owner_name: e.target.value })} /></Field>
      <Field label="Telefon" hint="Görevli, plakayı sorgularken bu numarayı tek dokunuşla arayabilir."><input type="tel" value={f.phone} maxLength={20} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="Not"><input value={f.note} maxLength={120} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary xl">Kaydet</button>
    </form>
  )
}

function VehicleForm({ unitId, vehicle, onDone }: { unitId: string; vehicle?: Vehicle; onDone: () => void }) {
  const { api, reload, toast } = useApp()
  const [f, setF] = useState({ plate: vehicle?.plate ?? '', brand: vehicle?.brand ?? '', color: vehicle?.color ?? '', note: vehicle?.note ?? '', active: vehicle?.active ?? true })
  const [err, setErr] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (f.plate.length < 4) return setErr('Plakayı yazın.')
    try {
      await api.saveVehicle({ id: vehicle?.id, unit_id: unitId, plate: f.plate, brand: f.brand.trim() || null, color: f.color.trim() || null, note: f.note.trim() || null, active: f.active })
      await reload()
      toast('Araç kaydedildi')
      onDone()
    } catch (x) { setErr(errText(x)) }
  }
  return (
    <form className="form" onSubmit={submit}>
      <Field label="Plaka"><PlateInput value={f.plate} onChange={(v) => setF({ ...f, plate: v })} autoFocus /></Field>
      {f.plate.length >= 5 && !isValidPlate(f.plate) && <p className="muted small warn-text">Plaka biçimi alışılmadık; doğru yazdığınızdan emin olun.</p>}
      <div className="two">
        <Field label="Marka / model"><input value={f.brand} maxLength={40} onChange={(e) => setF({ ...f, brand: e.target.value })} /></Field>
        <Field label="Renk"><input value={f.color} maxLength={20} onChange={(e) => setF({ ...f, color: e.target.value })} /></Field>
      </div>
      <Field label="Not"><input value={f.note} maxLength={120} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Aktif (kapatılırsa “kayıt pasif” uyarısı verir)</label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary xl">Kaydet</button>
    </form>
  )
}

export default function Units() {
  const { api, snap, user, reload, toast } = useApp()
  const admin = user?.role === 'admin'
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<null | { t: 'unit'; unit?: Unit } | { t: 'vehicle'; unitId: string; vehicle?: Vehicle }>(null)

  const rows = useMemo(() => {
    const term = normalizePlate(q)
    const text = q.trim().toLocaleLowerCase('tr-TR')
    return [...(snap?.units ?? [])]
      .sort((a, b) => a.no.localeCompare(b.no, 'tr', { numeric: true }))
      .map((u) => ({ u, cars: snap!.vehicles.filter((v) => v.unit_id === u.id) }))
      .filter(({ u, cars }) => !text || u.no.toLocaleLowerCase('tr-TR') === text || (u.owner_name ?? '').toLocaleLowerCase('tr-TR').includes(text) || (term && cars.some((c) => c.plate.includes(term))))
  }, [snap, q])

  const act = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); await reload(); toast(ok) } catch (e) { toast(errText(e), 'err') }
  }

  return (
    <>
      <div className="page-head">
        <h1>Daireler ve araçlar</h1>
        {admin && <button className="btn primary" onClick={() => setModal({ t: 'unit' })}><Plus size={16} /> Daire ekle</button>}
      </div>
      <div className="searchbar"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Plaka, daire no veya sakin adı ara…" aria-label="Ara" /></div>

      {rows.length === 0 ? <Empty icon={<Building2 size={28} />} title={snap?.units.length ? 'Eşleşen kayıt yok' : 'Henüz daire eklenmemiş'} text={admin && !snap?.units.length ? '“Daire ekle” ile başlayın veya Yönetim ekranından CSV içe aktarın.' : undefined} /> : (
        <div className="grid">
          {rows.map(({ u, cars }) => (
            <article key={u.id} className="card unit">
              <header>
                <div className="unit-no">{u.no}</div>
                <div className="grow"><b>{u.owner_name || 'Sakin adı yok'}</b><div className="muted small">{u.phone || 'Telefon yok'}{u.note ? ` · ${u.note}` : ''}</div></div>
                {admin && <>
                  <button className="icon-btn" aria-label="Daireyi düzenle" onClick={() => setModal({ t: 'unit', unit: u })}><Pencil size={16} /></button>
                  <button className="icon-btn" aria-label="Daireyi sil" onClick={() => confirm(`Daire ${u.no} ve ${cars.length} aracı silinsin mi?`) && act(() => api.deleteUnit(u.id), 'Daire silindi')}><Trash2 size={16} /></button>
                </>}
              </header>
              <ul className="cars">
                {cars.map((c) => (
                  <li key={c.id} className={c.active ? '' : 'inactive'}>
                    <Plate value={c.plate} size="sm" />
                    <span className="grow muted small">{[c.brand, c.color].filter(Boolean).join(' · ') || '—'}{c.active ? '' : ' · pasif'}</span>
                    {admin && <>
                      <button className="icon-btn" aria-label="Aracı düzenle" onClick={() => setModal({ t: 'vehicle', unitId: u.id, vehicle: c })}><Pencil size={15} /></button>
                      <button className="icon-btn" aria-label="Aracı sil" onClick={() => confirm(`${c.plate} silinsin mi?`) && act(() => api.deleteVehicle(c.id), 'Araç silindi')}><Trash2 size={15} /></button>
                    </>}
                  </li>
                ))}
                {cars.length === 0 && <li className="muted small">Kayıtlı araç yok</li>}
              </ul>
              {admin && <button className="btn" onClick={() => setModal({ t: 'vehicle', unitId: u.id })}><CarFront size={16} /> Araç ekle</button>}
            </article>
          ))}
        </div>
      )}

      {modal?.t === 'unit' && <Modal title={modal.unit ? `Daire ${modal.unit.no}` : 'Daire ekle'} onClose={() => setModal(null)}><UnitForm unit={modal.unit} onDone={() => setModal(null)} /></Modal>}
      {modal?.t === 'vehicle' && <Modal title={modal.vehicle ? 'Aracı düzenle' : 'Araç ekle'} onClose={() => setModal(null)}><VehicleForm unitId={modal.unitId} vehicle={modal.vehicle} onDone={() => setModal(null)} /></Modal>}
    </>
  )
}
