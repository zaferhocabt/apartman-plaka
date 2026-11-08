import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { Building2, CalendarClock, ExternalLink, History, Loader2, LogOut, Search, Settings } from 'lucide-react'
import type { Api, AppUser } from './api.ts'
import { createCloudApi } from './cloud.ts'
import { CLOUD, SUPABASE_KEY, SUPABASE_URL } from './config.ts'
import { AppCtx, useApp, type Ctx } from './ctx.tsx'
import { createDemoApi } from './demo.ts'
import type { Snapshot } from './types.ts'
import Admin from './views/Admin.tsx'
import HistoryView from './views/History.tsx'
import Login from './views/Login.tsx'
import Lookup from './views/Lookup.tsx'
import Public from './views/Public.tsx'
import Units from './views/Units.tsx'
import Visitors from './views/Visitors.tsx'

const TABS: { id: string; label: string; icon: ComponentType<{ size?: number }>; view: ComponentType; admin?: boolean }[] = [
  { id: 'sorgu', label: 'Sorgu', icon: Search, view: Lookup },
  { id: 'ziyaretci', label: 'Ziyaretçi', icon: CalendarClock, view: Visitors },
  { id: 'daireler', label: 'Daireler', icon: Building2, view: Units },
  { id: 'gecmis', label: 'Geçmiş', icon: History, view: HistoryView },
  { id: 'yonetim', label: 'Yönetim', icon: Settings, view: Admin, admin: true },
]

const route = () => location.hash.replace(/^#\/?/, '').split('?')[0]

export default function App() {
  const [api, setApi] = useState<Api | null>(null)
  const [fatal, setFatal] = useState('')
  const [user, setUser] = useState<AppUser | null>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [pub, setPub] = useState({ building_name: 'Apartman', public_lookup: true })
  const [r, setR] = useState(route())
  const [toastMsg, setToastMsg] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const on = () => setR(route())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])

  // Sunucu bağlantısını kur: ortam değişkeni varsa Supabase, yoksa demo.
  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const a = CLOUD ? await createCloudApi(SUPABASE_URL, SUPABASE_KEY) : createDemoApi()
        if (dead) return
        setApi(a)
        setPub(await a.publicSettings().catch(() => ({ building_name: 'Apartman', public_lookup: true })))
        setUser(await a.getUser().catch(() => null))
      } catch (e) {
        setFatal((e as Error).message)
      }
    })()
    return () => { dead = true }
  }, [])

  const go = useCallback((to: string) => { location.hash = to }, [])
  const toast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToastMsg({ msg, kind })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToastMsg(null), 3500)
  }, [])

  const staff = user && (user.role === 'admin' || user.role === 'guard') ? user : null

  const reload = useCallback(async () => {
    if (!api || !staff) return setSnap(null)
    try { setSnap(await api.snapshot()) } catch (e) { toast((e as Error).message, 'err') }
  }, [api, staff, toast])
  useEffect(() => { void reload() }, [reload])

  const refreshUser = useCallback(async () => {
    if (!api) return
    setUser(await api.getUser())
    go('#/sorgu')
  }, [api, go])

  const signOut = useCallback(async () => { await api?.signOut(); setUser(null); setSnap(null); go('#/') }, [api, go])

  const building = snap?.settings.building_name ?? pub.building_name
  useEffect(() => { document.title = `${building} · Plaka Sistemi` }, [building])

  const ctx: Ctx | null = useMemo(() => (api ? { api, user, snap, building, reload, toast, signOut, go } : null), [api, user, snap, building, reload, toast, signOut, go])

  if (fatal) return <div className="splash"><p className="error">Başlatılamadı: {fatal}</p></div>
  if (!ctx) return <div className="splash"><Loader2 className="spin" /> Yükleniyor…</div>

  let body
  if (r === 'giris') body = staff ? <Redirect to="#/sorgu" /> : <Login onDone={refreshUser} />
  else if (r === '' || r === 'sorgula') body = <Public enabled={pub.public_lookup} />
  else {
    const tab = TABS.find((t) => t.id === r)
    if (!staff) body = user ? <NoAccess /> : <Redirect to="#/giris" />
    else if (!tab || (tab.admin && staff.role !== 'admin')) body = <Redirect to="#/sorgu" />
    else {
      const View = tab.view
      body = (
        <div className="app">
          <nav className="side" aria-label="Ana menü">
            <div className="brand"><span className="logo-dot" aria-hidden="true" /><span>{building}</span></div>
            {TABS.filter((t) => !t.admin || staff.role === 'admin').map((t) => (
              <a key={t.id} href={`#/${t.id}`} className="nav-btn" aria-current={r === t.id ? 'page' : undefined}><t.icon size={20} /><span>{t.label}</span></a>
            ))}
            <div className="side-foot">
              <a className="nav-btn" href="#/"><ExternalLink size={18} /><span>Herkese açık sayfa</span></a>
              <div className="who">{staff.name}<small>{staff.role === 'admin' ? 'Yönetici' : 'Görevli'}</small></div>
              <button className="nav-btn" onClick={signOut}><LogOut size={18} /><span>Çıkış</span></button>
            </div>
          </nav>
          <main className="main">
            {/* Telefonda yan menü gizli olduğundan çıkış ve herkese açık sayfa bağlantısı burada */}
            <div className="mobile-bar">
              <a className="btn" href="#/"><ExternalLink size={16} /> Herkese açık sayfa</a>
              <span className="who-mini">{staff.name}</span>
              <button className="btn" onClick={signOut}><LogOut size={16} /> Çıkış</button>
            </div>
            {api?.mode === 'demo' && <div className="banner">Demo modu: veriler yalnızca bu tarayıcıda saklanır.</div>}
            <View />
          </main>
        </div>
      )
    }
  }

  return (
    <AppCtx.Provider value={ctx}>
      {body}
      {toastMsg && <div className={`toast ${toastMsg.kind}`} role="status">{toastMsg.msg}</div>}
    </AppCtx.Provider>
  )
}

function Redirect({ to }: { to: string }) {
  useEffect(() => { location.replace(to) }, [to])
  return null
}

function NoAccess() {
  const { signOut, user } = useApp()
  return (
    <main className="public"><div className="card login">
      <h1>Yetkiniz henüz yok</h1>
      <p>{user?.email} hesabı giriş yaptı ama yönetici henüz bir rol vermedi. Yönetimden rol vermesini isteyin.</p>
      <button className="btn" onClick={signOut}><LogOut size={16} /> Çıkış</button>
    </div></main>
  )
}
