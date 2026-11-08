export type Role = 'admin' | 'guard'
export type Status = 'resident' | 'visitor' | 'expired' | 'inactive' | 'unknown'
export type Source = 'public' | 'staff' | 'camera'

export interface Unit {
  id: string
  no: string // "1", "12", "A-3"
  owner_name?: string | null
  phone?: string | null
  note?: string | null
}

export interface Vehicle {
  id: string
  unit_id: string
  plate: string // normalize edilmiş: 07ABC123
  brand?: string | null
  color?: string | null
  note?: string | null
  active: boolean
}

export interface Visitor {
  id: string
  unit_id: string
  plate: string
  name?: string | null
  valid_from: string // ISO
  valid_until: string // ISO
  note?: string | null
  created_by?: string | null
}

export interface LookupLog {
  id: string
  plate: string
  status: Status
  unit_no?: string | null
  source: Source
  user_name?: string | null
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role | 'none'
}

export interface Settings {
  building_name: string
  public_lookup: boolean
  /** Açıksa herkese açık sorgu, sakin/ziyaretçi sonucunda daire telefonunu da verir (Araç sahibini ara düğmesi). */
  public_phone: boolean
}

/** Herkese açık sorgunun döndürdüğü asgari bilgi: kimlik/telefon asla yok. */
export interface PublicResult {
  status: Status
  unit_no?: string | null
  brand?: string | null
  color?: string | null
  valid_until?: string | null
  /** Yalnızca yönetici "herkese açık telefon" ayarını açtıysa ve sonuç sakin/ziyaretçi ise dolu gelir. */
  phone?: string | null
}

/** Görevlinin gördüğü sonuç: sakin adı ve telefonu da var. */
export interface StaffResult extends PublicResult {
  owner_name?: string | null
  visitor_name?: string | null
  note?: string | null
  unit_id?: string | null
}

export interface Snapshot {
  units: Unit[]
  vehicles: Vehicle[]
  visitors: Visitor[]
  settings: Settings
}

export const STATUS_LABEL: Record<Status, string> = {
  resident: 'Kayıtlı sakin aracı',
  visitor: 'Geçerli ziyaretçi',
  expired: 'Ziyaretçi süresi dolmuş',
  inactive: 'Araç kaydı pasif',
  unknown: 'Kayıtlı değil',
}
