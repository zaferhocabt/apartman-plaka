import { uid, type Api, type AppUser } from './api.ts'
import { lookupPlate, toPublic } from './logic.ts'
import type { LookupLog, Profile, Role, Settings, Snapshot, Source } from './types.ts'

/**
 * Demo modu: sunucu yok, her şey bu tarayıcının localStorage'ında. Yalnızca denemek içindir.
 * Hesaplar: yonetici@demo.local / demo1234 (yönetici), gorevli@demo.local / demo1234 (görevli).
 */
const KEY = 'plaka-demo-v1'
const USER_KEY = 'plaka-demo-user'

interface Store extends Snapshot {
  lookups: LookupLog[]
  profiles: Profile[]
}

const day = 86400000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString()

function seed(): Store {
  const units = ['1', '2', '3', '4', '5', '6', '7', '8'].map((no, i) => ({
    id: uid(),
    no,
    owner_name: ['Ayşe Yılmaz', 'Mehmet Kaya', 'Fatma Demir', 'Ali Çelik', 'Zeynep Şahin', 'Mustafa Aydın', 'Elif Arslan', 'Hasan Koç'][i],
    phone: `0555 000 00 0${i + 1}`,
    note: null,
  }))
  const car = (n: number, plate: string, brand: string, color: string, active = true) => ({ id: uid(), unit_id: units[n].id, plate, brand, color, note: null, active })
  const vehicles = [
    car(0, '07ABC123', 'Fiat Egea', 'Beyaz'),
    car(0, '07KL452', 'Renault Clio', 'Gri'),
    car(1, '07DEF456', 'Toyota Corolla', 'Siyah'),
    car(2, '34GHJ789', 'Hyundai i20', 'Kırmızı'),
    car(3, '07MN1234', 'Dacia Duster', 'Yeşil'),
    car(4, '07PR321', 'VW Passat', 'Lacivert'),
    car(5, '06TUV55', 'Ford Focus', 'Mavi', false),
    car(6, '07YZ987', 'Opel Astra', 'Gümüş'),
  ]
  const visitors = [
    { id: uid(), unit_id: units[0].id, plate: '34ZZ100', name: 'Dayı', valid_from: iso(-0.5), valid_until: iso(1.5), note: 'Hafta sonu misafir', created_by: null },
    { id: uid(), unit_id: units[2].id, plate: '35XY200', name: 'Tamirci', valid_from: iso(-5), valid_until: iso(-3), note: null, created_by: null },
  ]
  const settings: Settings = { building_name: 'Örnek Apartmanı', public_lookup: true }
  const profiles: Profile[] = [
    { id: 'demo-admin', email: 'yonetici@demo.local', full_name: 'Demo Yönetici', role: 'admin' },
    { id: 'demo-guard', email: 'gorevli@demo.local', full_name: 'Demo Görevli', role: 'guard' },
  ]
  return { units, vehicles, visitors, settings, lookups: [], profiles }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* bozuk kayıt → yeniden tohumla */ }
  const s = seed()
  save(s)
  return s
}
function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* özel mod */ }
}

const ACCOUNTS: Record<string, { pass: string; id: string }> = {
  'yonetici@demo.local': { pass: 'demo1234', id: 'demo-admin' },
  'gorevli@demo.local': { pass: 'demo1234', id: 'demo-guard' },
}

export function createDemoApi(): Api {
  const me = (): AppUser | null => {
    const id = localStorage.getItem(USER_KEY)
    const p = id ? load().profiles.find((x) => x.id === id) : null
    return p ? { id: p.id, email: p.email, name: p.full_name, role: p.role } : null
  }
  const log = (s: Store, plate: string, status: LookupLog['status'], unit_no: string | null | undefined, source: Source) => {
    const u = me()
    s.lookups.unshift({ id: uid(), plate, status, unit_no, source, user_name: source === 'public' ? null : u?.name, created_at: new Date().toISOString() })
    s.lookups = s.lookups.slice(0, 1000)
  }
  const mutate = async (fn: (s: Store) => void) => { const s = load(); fn(s); save(s) }
  const dup = () => new Error('duplicate key')

  return {
    mode: 'demo',
    getUser: async () => me(),
    async signIn(email, password) {
      const a = ACCOUNTS[email.trim().toLowerCase()]
      if (!a || a.pass !== password) throw new Error('Invalid login credentials')
      localStorage.setItem(USER_KEY, a.id)
    },
    signOut: async () => localStorage.removeItem(USER_KEY),

    publicSettings: async () => { const s = load().settings; return { building_name: s.building_name, public_lookup: s.public_lookup } },
    async publicLookup(plate) {
      const s = load()
      if (!s.settings.public_lookup) throw new Error('public_disabled')
      const r = lookupPlate(s, plate)
      log(s, plate.toUpperCase().replace(/[^A-Z0-9]/g, ''), r.status, r.unit_no, 'public')
      save(s)
      return toPublic(r)
    },
    async staffLookup(plate, source) {
      if (!me()) throw new Error('not_allowed')
      const s = load()
      const r = lookupPlate(s, plate)
      log(s, plate.toUpperCase().replace(/[^A-Z0-9]/g, ''), r.status, r.unit_no, source)
      save(s)
      return r
    },

    snapshot: async () => { const { units, vehicles, visitors, settings } = load(); return { units, vehicles, visitors, settings } },
    async saveUnit(u) {
      let out!: Snapshot['units'][number]
      await mutate((s) => {
        if (s.units.some((x) => x.no === u.no && x.id !== u.id)) throw dup()
        const i = u.id ? s.units.findIndex((x) => x.id === u.id) : -1
        out = i >= 0 ? (s.units[i] = { ...s.units[i], ...u }) : (s.units[s.units.length] = { id: uid(), owner_name: null, phone: null, note: null, ...u })
      })
      return out
    },
    deleteUnit: (id) => mutate((s) => {
      s.units = s.units.filter((x) => x.id !== id)
      s.vehicles = s.vehicles.filter((x) => x.unit_id !== id)
      s.visitors = s.visitors.filter((x) => x.unit_id !== id)
    }),
    saveVehicle: (v) => mutate((s) => {
      if (s.vehicles.some((x) => x.plate === v.plate && x.id !== v.id)) throw dup()
      const i = v.id ? s.vehicles.findIndex((x) => x.id === v.id) : -1
      if (i >= 0) s.vehicles[i] = { ...s.vehicles[i], ...v }
      else s.vehicles.push({ id: uid(), brand: null, color: null, note: null, active: true, ...v })
    }),
    deleteVehicle: (id) => mutate((s) => { s.vehicles = s.vehicles.filter((x) => x.id !== id) }),
    addVisitor: (v) => mutate((s) => { s.visitors.push({ ...v, id: uid(), created_by: me()?.id ?? null }) }),
    deleteVisitor: (id) => mutate((s) => { s.visitors = s.visitors.filter((x) => x.id !== id) }),
    saveSettings: (p) => mutate((s) => { s.settings = { ...s.settings, ...p } }),

    async lookups(limit) {
      const u = me()
      const all = load().lookups
      return (u?.role === 'admin' ? all : all.filter((l) => l.user_name === u?.name)).slice(0, limit)
    },
    clearLookups: () => mutate((s) => { s.lookups = [] }),
    profiles: async () => load().profiles,
    setRole: (id, role: Role | 'none', fullName) => mutate((s) => {
      s.profiles = s.profiles.map((p) => (p.id === id ? { ...p, role, full_name: fullName ?? p.full_name } : p))
    }),
  }
}
