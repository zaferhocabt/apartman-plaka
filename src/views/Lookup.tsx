import { useState } from 'react'
import { Camera, Search, UserPlus } from 'lucide-react'
import { errText } from '../api.ts'
import { useApp } from '../ctx.tsx'
import { Scanner } from '../Scanner.tsx'
import type { Source, StaffResult } from '../types.ts'
import { Modal, Plate, PlateInput, ResultCard } from '../ui.tsx'
import { VisitorForm } from './Visitors.tsx'

export default function Lookup() {
  const { api, snap, toast } = useApp()
  const [plate, setPlate] = useState('')
  const [res, setRes] = useState<{ plate: string; r: StaffResult } | null>(null)
  const [recent, setRecent] = useState<string[]>([])
  const [scan, setScan] = useState(false)
  const [visitor, setVisitor] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (p: string, source: Source = 'staff') => {
    if (p.length < 4) return toast('Plakayı yazın', 'err')
    setBusy(true)
    try {
      setRes({ plate: p, r: await api.staffLookup(p, source) })
      setRecent((r) => [p, ...r.filter((x) => x !== p)].slice(0, 6))
    } catch (e) {
      toast(errText(e), 'err')
    } finally {
      setBusy(false)
    }
  }

  const now = Date.now()
  const live = snap?.visitors.filter((v) => new Date(v.valid_until).getTime() >= now).length ?? 0

  return (
    <>
      <div className="page-head"><h1>Plaka sorgula</h1></div>
      <section className="card search-card">
        <PlateInput big value={plate} onChange={setPlate} onEnter={() => run(plate)} autoFocus />
        <div className="row center">
          <button className="btn primary xl" onClick={() => run(plate)} disabled={busy}><Search size={18} /> {busy ? 'Sorgulanıyor…' : 'Sorgula'}</button>
          <button className="btn xl" onClick={() => setScan(true)}><Camera size={18} /> Kamera</button>
        </div>
      </section>

      {res && (
        <>
          <ResultCard plate={res.plate} r={res.r} staff />
          {(res.r.status === 'unknown' || res.r.status === 'expired') && (
            <button className="btn xl" onClick={() => setVisitor(true)}><UserPlus size={18} /> Ziyaretçi olarak ekle</button>
          )}
        </>
      )}

      {recent.length > 0 && (
        <section>
          <h3 className="sec">Son sorgulananlar</h3>
          <div className="chips">{recent.map((p) => <button key={p} className="chip" onClick={() => { setPlate(p); void run(p) }}><Plate value={p} size="sm" /></button>)}</div>
        </section>
      )}

      <div className="stats">
        <div><b>{snap?.units.length ?? 0}</b><span>daire</span></div>
        <div><b>{snap?.vehicles.filter((v) => v.active).length ?? 0}</b><span>kayıtlı araç</span></div>
        <div><b>{live}</b><span>geçerli ziyaretçi</span></div>
      </div>

      {scan && <Scanner onClose={() => setScan(false)} onPick={(p) => { setScan(false); setPlate(p); void run(p, 'camera') }} />}
      {visitor && res && <Modal title="Ziyaretçi olarak ekle" onClose={() => setVisitor(false)}><VisitorForm plate={res.plate} onDone={() => { setVisitor(false); void run(res.plate) }} /></Modal>}
    </>
  )
}
