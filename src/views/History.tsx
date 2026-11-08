import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, History as Hist, Loader2 } from 'lucide-react'
import { errText } from '../api.ts'
import { useApp } from '../ctx.tsx'
import { toCsv } from '../logic.ts'
import { normalizePlate } from '../plate.ts'
import { STATUS_LABEL, type LookupLog, type Status } from '../types.ts'
import { Empty, Plate } from '../ui.tsx'

export const download = (name: string, text: string, mime = 'text/csv') => {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const SOURCE = { public: 'Herkese açık', staff: 'Görevli', camera: 'Kamera' } as const

export default function History() {
  const { api, user, toast } = useApp()
  const [rows, setRows] = useState<LookupLog[] | null>(null)
  const [q, setQ] = useState('')
  const [st, setSt] = useState<'' | Status>('')

  const load = useCallback(async () => {
    try { setRows(await api.lookups(500)) } catch (e) { toast(errText(e), 'err'); setRows([]) }
  }, [api, toast])
  useEffect(() => { void load() }, [load])

  const shown = useMemo(() => {
    const t = normalizePlate(q)
    return (rows ?? []).filter((r) => (!st || r.status === st) && (!t || r.plate.includes(t)))
  }, [rows, q, st])

  const fmt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'medium' })
  const exportCsv = () =>
    download(`sorgu-gecmisi-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([['Zaman', 'Plaka', 'Sonuç', 'Daire', 'Kaynak', 'Sorgulayan'], ...shown.map((r) => [fmt(r.created_at), r.plate, STATUS_LABEL[r.status], r.unit_no ?? '', SOURCE[r.source], r.user_name ?? ''])]))
  const clear = async () => {
    if (!confirm('Tüm sorgu geçmişi kalıcı olarak silinsin mi?')) return
    try { await api.clearLookups(); await load(); toast('Geçmiş temizlendi') } catch (e) { toast(errText(e), 'err') }
  }

  const count = (s: Status) => (rows ?? []).filter((r) => r.status === s).length

  return (
    <>
      <div className="page-head">
        <h1>Sorgu geçmişi</h1>
        <div className="row">
          <button className="btn" onClick={exportCsv} disabled={!shown.length}><Download size={16} /> CSV</button>
          {user?.role === 'admin' && <button className="btn danger" onClick={clear} disabled={!rows?.length}>Temizle</button>}
        </div>
      </div>
      <p className="muted small">{user?.role === 'admin' ? 'Tüm sorgular (son 500).' : 'Yalnızca sizin yaptığınız sorgular (son 500).'}</p>
      <div className="stats">
        <div><b>{rows?.length ?? '…'}</b><span>sorgu</span></div>
        <div><b>{count('unknown')}</b><span>kayıtsız</span></div>
        <div><b>{count('expired') + count('inactive')}</b><span>süresi dolmuş / pasif</span></div>
      </div>
      <div className="filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Plakaya göre filtrele…" aria-label="Plaka filtresi" />
        <select value={st} onChange={(e) => setSt(e.target.value as '' | Status)} aria-label="Sonuç filtresi">
          <option value="">Tüm sonuçlar</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {rows === null ? <p className="muted center"><Loader2 className="spin" size={16} /> Yükleniyor…</p> : shown.length === 0 ? <Empty icon={<Hist size={28} />} title="Kayıt yok" /> : (
        <ul className="list">
          {shown.map((r) => (
            <li key={r.id} className="row-item">
              <Plate value={r.plate} size="sm" />
              <div className="grow">
                <span className={`pill ${r.status === 'resident' || r.status === 'visitor' ? 'ok' : r.status === 'unknown' ? 'bad' : 'warn'}`}>{STATUS_LABEL[r.status]}</span>
                {r.unit_no && <b> · Daire {r.unit_no}</b>}
                <div className="muted small">{fmt(r.created_at)} · {SOURCE[r.source]}{r.user_name ? ` · ${r.user_name}` : ''}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
