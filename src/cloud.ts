import type { SupabaseClient } from '@supabase/supabase-js'
import type { Api, AppUser } from './api.ts'
import type { LookupLog, Profile, PublicResult, Role, Settings, Snapshot, StaffResult, Unit, Vehicle } from './types.ts'

/** Supabase gerçeklemesi. Şema ve yetkiler supabase/schema.sql içinde; yetki kararını SUNUCU verir, arayüz yalnızca gösterir. */
export async function createCloudApi(url: string, key: string): Promise<Api> {
  const { createClient } = await import('@supabase/supabase-js')
  const sb: SupabaseClient = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })

  const ok = <T,>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message)
    return r.data
  }
  const rpc = async <T,>(name: string, args?: Record<string, unknown>) => ok(await sb.rpc(name, args)) as T

  return {
    mode: 'cloud',
    async getUser(): Promise<AppUser | null> {
      const { data } = await sb.auth.getSession()
      const u = data.session?.user
      if (!u) return null
      const p = ok(await sb.from('profiles').select('full_name, role').eq('id', u.id).maybeSingle())
      return { id: u.id, email: u.email ?? '', name: p?.full_name || u.email || '', role: p?.role ?? 'none' }
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw new Error(error.message)
    },
    async signOut() { await sb.auth.signOut() },

    publicSettings: () => rpc('public_settings'),
    publicLookup: (plate) => rpc<PublicResult>('public_lookup', { p: plate }),
    staffLookup: (plate, source) => rpc<StaffResult>('staff_lookup', { p: plate, src: source }),

    async snapshot(): Promise<Snapshot> {
      const [units, vehicles, visitors, settings] = await Promise.all([
        sb.from('units').select('*').order('no'),
        sb.from('vehicles').select('*'),
        sb.from('visitors').select('*').order('valid_until', { ascending: false }),
        sb.from('settings').select('*'),
      ])
      const kv = Object.fromEntries((ok(settings) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]))
      return {
        units: ok(units) as Unit[],
        vehicles: ok(vehicles) as Vehicle[],
        visitors: ok(visitors) as Snapshot['visitors'],
        settings: { building_name: String(kv.building_name ?? 'Apartmanım'), public_lookup: kv.public_lookup !== false, public_phone: kv.public_phone === true },
      }
    },
    async saveUnit(u) {
      const { id, ...rest } = u
      return ok(await (id ? sb.from('units').update(rest).eq('id', id) : sb.from('units').insert(rest)).select().single()) as Unit
    },
    async deleteUnit(id) { ok(await sb.from('units').delete().eq('id', id)) },
    async saveVehicle(v) {
      const { id, ...rest } = v
      ok(await (id ? sb.from('vehicles').update(rest).eq('id', id) : sb.from('vehicles').insert(rest)))
    },
    async deleteVehicle(id) { ok(await sb.from('vehicles').delete().eq('id', id)) },
    async addVisitor(v) {
      const { data } = await sb.auth.getUser()
      ok(await sb.from('visitors').insert({ ...v, created_by: data.user?.id }))
    },
    async deleteVisitor(id) { ok(await sb.from('visitors').delete().eq('id', id)) },
    async saveSettings(s: Partial<Settings>) {
      const rows = Object.entries(s).map(([key, value]) => ({ key, value }))
      ok(await sb.from('settings').upsert(rows))
    },

    async lookups(limit) {
      return ok(await sb.from('lookups').select('*').order('created_at', { ascending: false }).limit(limit)) as LookupLog[]
    },
    async clearLookups() { ok(await sb.from('lookups').delete().neq('id', '00000000-0000-0000-0000-000000000000')) },
    async profiles() { return ok(await sb.from('profiles').select('*').order('email')) as Profile[] },
    async setRole(id, role: Role | 'none', fullName) {
      ok(await sb.from('profiles').update({ role, ...(fullName !== undefined ? { full_name: fullName } : {}) }).eq('id', id))
    },
  }
}
