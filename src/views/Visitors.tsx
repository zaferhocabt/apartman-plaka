import { useMemo, useState, type FormEvent } from 'react'
import { CalendarPlus, Trash2, UserPlus } from 'lucide-react'
import { errText } from '../api.ts'
import { useApp } from '../ctx.tsx'
import { isValidPlate } from '../plate.ts'
import { Empty, Field, Modal, Plate, PlateInput } from '../ui.tsx'

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const PRESETS: [string, () => Date][] = [
  ['Bugün (gün sonuna kadar)', () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d }],
  ['24 saat', () => new Date(Date.now() + 24 * 3600e3)],
  ['3 gün', () => new Date(Date.now() + 3 * 86400e3)],
  ['1 hafta', () => new Date(Date.now() + 7 * 86400e3)],
]

export function VisitorForm({ plate: p0 = '', onDone }: { plate?: string; onDone: () => void }) {
  const { api, snap, reload, toast } = useApp()
  const [plate, setPlate] = useState(p0)
  const [unit, setUnit] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [from, setFrom] = useState(local(new Date()))
  const [until, setUntil] = useState(local(PRESETS[1][1]()))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!unit) return setErr('Daire seçin.')
    if (plate.length < 4) return setErr('Plakayı yazın.')
    if (new Date(until) <= new Date(from)) return setErr('Bitiş, başlangıçtan sonra olmalı.')
    setBusy(true)
    try {
      await api.addVisitor({ unit_id: unit, plate, name: name || null, note: note || null, valid_from: new Date(from).toISOString(), valid_until: new Date(until).toISOString() })
      await reload()
      toast('Ziyaretçi plakası eklendi')
      onDone()
    } catch (x) {
      setErr(errText(x))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Plaka"><PlateInput value={plate} onChange={setPlate} /></Field>
      {plate.length >= 5 && !isValidPlate(plate) && <p className="muted small warn-text">Plaka biçimi alışılmadık; yabancı/özel plaka ise sorun değil.</p>}
      <Field label="Hangi dairenin misafiri?">
        <select value={unit} onChange={(e) => setUnit(e.target.value)} required>
          <option value="">Daire seçin…</option>
          {snap?.units.map((u) => <option key={u.id} value={u.id}>Daire {u.no}{u.owner_name ? ` — ${u.owner_name}` : ''}</option>)}
        </select>
      </Field>
      <div className="chips">{PRESETS.map(([l, f]) => <button type="button" key={l} className="chip" onClick={() => { setFrom(local(new Date())); setUntil(local(f())) }}>{l}</button>)}</div>
      <div className="two">
        <Field label="Başlangıç"><input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} required /></Field>
        <Field label="Bitiş"><input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} required /></Field>
      </div>
      <Field label="Ziyaretçi adı (isteğe bağlı)"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
      <Field label="Not (isteğe bağlı)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} /></Field>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary xl" disabled={busy}><UserPlus size={18} /> {busy ? 'Ekleniyor…' : 'Ziyaretçiyi ekle'}</button>
    </form>
  )
}

export default function Visitors() {
  const { api, snap, reload, toast, user } = useApp()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'active' | 'past'>('active')
  const now = Date.now()
  const { active, past } = useMemo(() => {
    const v = snap?.visitors ?? []
    return {
      active: v.filter((x) => new Date(x.valid_until).getTime() >= now).sort((a, b) => a.valid_until.localeCompare(b.valid_until)),
      past: v.filter((x) => new Date(x.valid_until).getTime() < now).sort((a, b) => b.valid_until.localeCompare(a.valid_until)).slice(0, 100),
    }
  }, [snap, now])
  const list = tab === 'active' ? active : past
  const unitNo = (id: string) => snap?.units.find((u) => u.id === id)?.no ?? '?'
  const dt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })

  const del = async (id: string) => {
    if (!confirm('Bu ziyaretçi kaydı silinsin mi?')) return
    try { await api.deleteVisitor(id); await reload(); toast('Silindi') } catch (e) { toast(errText(e), 'err') }
  }

  return (
    <>
      <div className="page-head">
        <h1>Ziyaretçi plakaları</h1>
        <button className="btn primary" onClick={() => setOpen(true)}><CalendarPlus size={16} /> Ziyaretçi ekle</button>
      </div>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')}>Geçerli / yaklaşan ({active.length})</button>
        <button role="tab" aria-selected={tab === 'past'} onClick={() => setTab('past')}>Süresi dolan ({past.length})</button>
      </div>
      {list.length === 0 ? <Empty icon={<CalendarPlus size={28} />} title={tab === 'active' ? 'Geçerli ziyaretçi yok' : 'Süresi dolmuş kayıt yok'} /> : (
        <ul className="list">
          {list.map((v) => {
            const started = new Date(v.valid_from).getTime() <= now
            return (
              <li key={v.id} className="row-item">
                <Plate value={v.plate} size="sm" />
                <div className="grow">
                  <b>Daire {unitNo(v.unit_id)}</b>{v.name ? ` · ${v.name}` : ''}
                  <div className="muted small">{dt(v.valid_from)} → {dt(v.valid_until)}{v.note ? ` · ${v.note}` : ''}</div>
                </div>
                {tab === 'active' && <span className={`pill ${started ? 'ok' : 'warn'}`}>{started ? 'Geçerli' : 'Başlamadı'}</span>}
                {(user?.role === 'admin' || v.created_by === user?.id) && <button className="icon-btn" onClick={() => del(v.id)} aria-label="Sil"><Trash2 size={16} /></button>}
              </li>
            )
          })}
        </ul>
      )}
      {open && <Modal title="Ziyaretçi plakası ekle" onClose={() => setOpen(false)}><VisitorForm onDone={() => setOpen(false)} /></Modal>}
    </>
  )
}
