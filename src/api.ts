import type { LookupLog, Profile, PublicResult, Role, Settings, Snapshot, Source, StaffResult, Unit, Vehicle, Visitor } from './types.ts'

export interface AppUser {
  id: string
  email: string
  name: string
  role: Role | 'none'
}

/** Arayüzün konuştuğu tek yüzey. İki gerçeklemesi var: demo (tarayıcıda) ve bulut (Supabase). */
export interface Api {
  mode: 'demo' | 'cloud'
  getUser(): Promise<AppUser | null>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>

  publicSettings(): Promise<Pick<Settings, 'building_name' | 'public_lookup'>>
  publicLookup(plate: string): Promise<PublicResult>
  staffLookup(plate: string, source: Source): Promise<StaffResult>

  snapshot(): Promise<Snapshot>
  saveUnit(u: Partial<Unit> & { no: string }): Promise<Unit>
  deleteUnit(id: string): Promise<void>
  saveVehicle(v: Partial<Vehicle> & { unit_id: string; plate: string }): Promise<void>
  deleteVehicle(id: string): Promise<void>
  addVisitor(v: Omit<Visitor, 'id' | 'created_by'>): Promise<void>
  deleteVisitor(id: string): Promise<void>
  saveSettings(s: Partial<Settings>): Promise<void>

  lookups(limit: number): Promise<LookupLog[]>
  clearLookups(): Promise<void>
  profiles(): Promise<Profile[]>
  setRole(id: string, role: Role | 'none', fullName?: string): Promise<void>
}

/** Kullanıcıya gösterilecek anlaşılır hata iletisi. */
export function errText(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e)
  if (/public_disabled/.test(m)) return 'Herkese açık sorgu şu an kapalı. Yönetime başvurun.'
  if (/rate_limited/.test(m)) return 'Çok fazla sorgu yapıldı. Bir dakika sonra tekrar deneyin.'
  if (/bad_plate/.test(m)) return 'Plaka geçersiz görünüyor.'
  if (/not_allowed/.test(m)) return 'Bu işlem için yetkiniz yok.'
  if (/Invalid login credentials/i.test(m)) return 'E-posta veya şifre hatalı.'
  if (/duplicate key|already exists|unique/i.test(m)) return 'Bu kayıt zaten var (aynı plaka veya daire numarası).'
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin.'
  return m
}

export const uid = () => crypto.randomUUID()
