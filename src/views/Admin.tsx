import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileUp, Printer, Save } from 'lucide-react'
import { errText } from '../api.ts'
import { useApp } from '../ctx.tsx'
import { importRows, rowsFromCsv, TEMPLATE_CSV, type ImportReport } from '../importer.ts'
import { toCsv } from '../logic.ts'
import { formatPlate } from '../plate.ts'
import type { Profile, Role } from '../types.ts'
import { Field } from './../ui.tsx'
import { download } from './History.tsx'

export default function Admin() {
  const { api, snap, user, reload, toast, building } = useApp()
  const [name, setName] = useState(snap?.settings.building_name ?? '')
  const [pub, setPub] = useState(snap?.settings.public_lookup ?? true)
  const [pubPhone, setPubPhone] = useState(snap?.settings.public_phone ?? false)
  const [users, setUsers] = useState<Profile[]>([])
  const [report, setReport] = useState<ImportReport | null>(null)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const loadUsers = useCallback(async () => { try { setUsers(await api.profiles()) } catch (e) { toast(errText(e), 'err') } }, [api, toast])
  useEffect(() => { void loadUsers() }, [loadUsers])

  const saveSettings = async () => {
    try { await api.saveSettings({ building_name: name.trim() || 'Apartmanım', public_lookup: pub, public_phone: pub && pubPhone }); await reload(); toast('Ayarlar kaydedildi') } catch (e) { toast(errText(e), 'err') }
  }
  const setRole = async (p: Profile, role: Role | 'none') => {
    if (p.id === user?.id && role !== 'admin' && !confirm('Kendi yönetici yetkinizi kaldırıyorsunuz. Emin misiniz?')) return
    try { await api.setRole(p.id, role); await loadUsers(); toast('Rol güncellendi') } catch (e) { toast(errText(e), 'err') }
  }

  const sortedCars = () => {
    const unit = new Map((snap?.units ?? []).map((u) => [u.id, u]))
    return (snap?.vehicles ?? [])
      .map((v) => ({ v, u: unit.get(v.unit_id) }))
      .sort((a, b) => (a.u?.no ?? '').localeCompare(b.u?.no ?? '', 'tr', { numeric: true }) || a.v.plate.localeCompare(b.v.plate))
  }

  const exportCars = () =>
    download(`araclar-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([['Daire', 'Plaka', 'Marka', 'Renk', 'Sakin', 'Telefon', 'Aktif'], ...sortedCars().map(({ v, u }) => [u?.no, v.plate, v.brand, v.color, u?.owner_name, u?.phone, v.active ? 'Evet' : 'Hayır'])]))
  const exportJson = () =>
    download(`plaka-yedek-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'apartman-plaka', exportedAt: new Date().toISOString(), ...snap }, null, 1), 'application/json')

  const onFile = async (f: File) => {
    if (!snap) return
    setBusy(true)
    setReport(null)
    try {
      const text = await f.text()
      let rows
      if (/\.json$/i.test(f.name)) {
        const d = JSON.parse(text)
        if (d.app !== 'apartman-plaka' || !Array.isArray(d.units) || !Array.isArray(d.vehicles)) throw new Error('Bu dosya geçerli bir plaka yedeği değil.')
        const unit = new Map((d.units as { id: string; no: string; owner_name?: string; phone?: string }[]).map((u) => [u.id, u]))
        rows = (d.vehicles as { unit_id: string; plate: string; brand?: string; color?: string }[]).map((v) => ({ unit: unit.get(v.unit_id)?.no ?? '', plate: v.plate, brand: v.brand ?? undefined, color: v.color ?? undefined, owner: unit.get(v.unit_id)?.owner_name ?? undefined, phone: unit.get(v.unit_id)?.phone ?? undefined }))
      } else rows = rowsFromCsv(text)
      if (!rows.length) throw new Error('Dosyada satır bulunamadı.')
      if (!confirm(`${rows.length} satır içe aktarılacak. Mevcut kayıtlar silinmez; yeni olanlar eklenir, aynı plakanın bilgisi güncellenir. Devam edilsin mi?`)) return
      setReport(await importRows(api, snap, rows))
      await reload()
    } catch (e) {
      toast(errText(e), 'err')
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }

  return (
    <>
      <div className="page-head"><h1>Yönetim</h1></div>
      <div className="grid">
        <section className="card form">
          <h3 className="sec">Bina ve herkese açık sorgu</h3>
          <Field label="Bina adı"><input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Field>
          <label className="check"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} /> Herkese açık plaka sorgusu açık (giriş gerektirmez; yalnızca “kayıtlı mı + daire no” gösterir)</label>
          <label className="check"><input type="checkbox" checked={pub && pubPhone} disabled={!pub} onChange={(e) => setPubPhone(e.target.checked)} /> <span>Herkese açık sorguda sakin/ziyaretçi sonucunda <b>“Araç sahibini ara”</b> düğmesi ve daire telefonu gösterilsin. <span className="warn-text">Dikkat: telefon numarası plakayı bilen herkese görünür; yalnızca sakinlerin bilgisi ve onayı varsa açın.</span></span></label>
          <button className="btn primary" onClick={saveSettings}><Save size={16} /> Kaydet</button>
        </section>

        <section className="card">
          <h3 className="sec">Kullanıcılar</h3>
          {api.mode === 'cloud' && <p className="muted small">Yeni kişi eklemek için Supabase → Authentication → Users’tan hesap açın; burada rolünü verin. “Yetkisiz” rolü sisteme giremez.</p>}
          <ul className="list">
            {users.map((p) => (
              <li key={p.id} className="row-item">
                <div className="grow"><b>{p.full_name || p.email}</b><div className="muted small">{p.email}</div></div>
                <select value={p.role} onChange={(e) => setRole(p, e.target.value as Role | 'none')} aria-label={`${p.email} rolü`}>
                  <option value="admin">Yönetici</option><option value="guard">Görevli</option><option value="none">Yetkisiz</option>
                </select>
              </li>
            ))}
          </ul>
        </section>

        <section className="card form">
          <h3 className="sec">Veri: içe / dışa aktar</h3>
          <div className="row">
            <button className="btn" onClick={exportCars}><Download size={16} /> Araç listesi (CSV)</button>
            <button className="btn" onClick={exportJson}><Download size={16} /> Yedek (JSON)</button>
            <button className="btn" onClick={() => window.print()}><Printer size={16} /> Yazdır / PDF</button>
          </div>
          <div className="row">
            <button className="btn primary" disabled={busy} onClick={() => file.current?.click()}><FileUp size={16} /> {busy ? 'Aktarılıyor…' : 'CSV / JSON içe aktar'}</button>
            <button className="btn ghost" onClick={() => download('sablon.csv', TEMPLATE_CSV)}>Şablonu indir</button>
            <input ref={file} type="file" hidden accept=".csv,.json,text/csv,application/json" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
          </div>
          <p className="muted small">CSV sütunları: Daire; Plaka; Marka; Renk; Sakin; Telefon. Excel’den “CSV (noktalı virgül/virgül ayraçlı)” olarak kaydedin. İçe aktarma mevcut kaydı silmez.</p>
          {report && (
            <div className="report" role="status">
              <b>{report.added} araç eklendi, {report.updated} güncellendi, {report.units} yeni daire.</b>
              {report.skipped.length > 0 && <ul>{report.skipped.slice(0, 20).map((s) => <li key={s}>{s}</li>)}{report.skipped.length > 20 && <li>… ve {report.skipped.length - 20} satır daha</li>}</ul>}
            </div>
          )}
        </section>
      </div>

      <section className="print-only" aria-hidden="true">
        <h2>{building} — Kayıtlı araçlar</h2>
        <p>{new Date().toLocaleDateString('tr-TR', { dateStyle: 'long' })}</p>
        <table>
          <thead><tr><th>Daire</th><th>Plaka</th><th>Araç</th><th>Sakin</th></tr></thead>
          <tbody>{sortedCars().map(({ v, u }) => <tr key={v.id}><td>{u?.no}</td><td>{formatPlate(v.plate)}</td><td>{[v.brand, v.color].filter(Boolean).join(' · ')}</td><td>{u?.owner_name}</td></tr>)}</tbody>
        </table>
      </section>
    </>
  )
}
