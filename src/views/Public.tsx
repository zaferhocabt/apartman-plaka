import { useState } from 'react'
import { Camera, LogIn, Search } from 'lucide-react'
import apt from '../assets/apt.jpg'
import { Scanner } from '../Scanner.tsx'
import { errText } from '../api.ts'
import { useApp } from '../ctx.tsx'
import { isValidPlate } from '../plate.ts'
import type { PublicResult } from '../types.ts'
import { Credit, PlateInput, ResultCard } from '../ui.tsx'

/** Herkese açık sayfa: giriş gerekmez. Yalnızca durum + daire no gösterir; ad/telefon sunucudan hiç gelmez. */
export default function Public({ enabled }: { enabled: boolean }) {
  const { api, building, user, go } = useApp()
  const [plate, setPlate] = useState('')
  const [res, setRes] = useState<{ plate: string; r: PublicResult } | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState(false)

  const search = async (p = plate) => {
    if (p.length < 4) return setErr('Plakayı yazın. Örnek: 07ABC123')
    setBusy(true)
    setErr('')
    try {
      setRes({ plate: p, r: await api.publicLookup(p) })
    } catch (e) {
      setRes(null)
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-shell">
    <div className="public-wrap">
      <aside className="side-img left" aria-hidden="true"><img src={apt} alt="" decoding="async" /></aside>
      <main className="public">
      <header className="public-top">
        <div className="logo-dot" aria-hidden="true" />
        <div>
          <h1>{building}</h1>
          <p>Plaka Sorgulama</p>
        </div>
        <button className="btn ghost" onClick={() => go(user ? '#/sorgu' : '#/giris')}><LogIn size={16} /> {user ? 'Panele dön' : 'Görevli girişi'}</button>
      </header>

      {api.mode === 'demo' && <div className="banner">Demo modu: veriler yalnızca bu tarayıcıda, örnek plakalar: <b>07ABC123</b> (sakin), <b>34ZZ100</b> (ziyaretçi), <b>06TUV55</b> (pasif).</div>}

      <section className="card search-card">
        {enabled ? (
          <>
            <p className="lead">Aracın plakasını yazın, bu apartmanda kayıtlı olup olmadığını öğrenin.</p>
            <PlateInput big value={plate} onChange={(v) => { setPlate(v); setErr('') }} onEnter={() => search()} autoFocus />
            <p className="muted small center">Boşluk bırakmadan yazın. Örnek: 07ABC123 {plate && !isValidPlate(plate) && plate.length >= 5 && <b className="warn-text"> · Plaka biçimi alışılmadık, yine de sorgulanır.</b>}</p>
            <div className="row center">
              <button className="btn primary xl" onClick={() => search()} disabled={busy}><Search size={18} /> {busy ? 'Sorgulanıyor…' : 'Sorgula'}</button>
              <button className="btn xl" onClick={() => setScan(true)} disabled={busy}><Camera size={18} /> Kamerayla oku</button>
            </div>
            {err && <p className="error" role="alert">{err}</p>}
          </>
        ) : (
          <p className="lead">Herkese açık plaka sorgusu şu an kapalı. Görevli girişi ile devam edebilirsiniz.</p>
        )}
      </section>

      {res && <ResultCard plate={res.plate} r={res.r} />}
      {scan && <Scanner onClose={() => setScan(false)} onPick={(p) => { setScan(false); setPlate(p); void search(p) }} />}

      <footer className="public-foot">
        Bu sorgu yalnızca apartman güvenliği içindir; sorgular kayıt altına alınır. Kişisel bilgiler (ad, telefon) bu sayfada gösterilmez.
      </footer>
      </main>
      <aside className="side-img right" aria-hidden="true"><img src={apt} alt="" decoding="async" /></aside>
    </div>
    <Credit />
    </div>
  )
}
