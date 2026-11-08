import { useEffect, useRef, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, Clock, Phone, ShieldOff, UserRound, X } from 'lucide-react'
import { formatPlate, normalizePlate } from './plate.ts'
import { STATUS_LABEL, type PublicResult, type StaffResult, type Status } from './types.ts'

/** Türk plakası görünümü: mavi "TR" şeridi + siyah çerçeve. */
export function Plate({ value, size = 'md' }: { value: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`plate plate-${size}`} aria-label={`Plaka ${formatPlate(value)}`}>
      <span className="plate-eu"><i>★</i>TR</span>
      <span className="plate-no">{formatPlate(value) || '—'}</span>
    </span>
  )
}

export function PlateInput({ value, onChange, onEnter, autoFocus, big }: { value: string; onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean; big?: boolean }) {
  return (
    <label className={`plate plate-input ${big ? 'plate-lg' : 'plate-md'}`}>
      <span className="plate-eu"><i>★</i>TR</span>
      <input
        className="plate-no"
        value={value}
        autoFocus={autoFocus}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={14}
        placeholder="07 ABC 123"
        aria-label="Araç plakası"
        onChange={(e) => onChange(normalizePlate(e.target.value))}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      />
    </label>
  )
}

const ICON: Record<Status, ReactNode> = {
  resident: <CheckCircle2 size={34} />,
  visitor: <Clock size={34} />,
  expired: <AlertTriangle size={34} />,
  inactive: <ShieldOff size={34} />,
  unknown: <CircleHelp size={34} />,
}
const TONE: Record<Status, string> = { resident: 'ok', visitor: 'ok', expired: 'warn', inactive: 'warn', unknown: 'bad' }
const dt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })

export function ResultCard({ plate, r, staff }: { plate: string; r: PublicResult | StaffResult; staff?: boolean }) {
  const s = r as StaffResult
  return (
    <div className={`result tone-${TONE[r.status]}`} role="status" aria-live="polite">
      <div className="result-head">
        <span className="result-icon">{ICON[r.status]}</span>
        <div>
          <div className="result-title">{STATUS_LABEL[r.status]}</div>
          <Plate value={plate} size="sm" />
        </div>
      </div>
      {r.status !== 'unknown' && (
        <dl className="facts">
          {r.unit_no && <><dt>Daire</dt><dd><b>{r.unit_no}</b></dd></>}
          {(r.brand || r.color) && <><dt>Araç</dt><dd>{[r.brand, r.color].filter(Boolean).join(' · ')}</dd></>}
          {r.valid_until && <><dt>{r.status === 'expired' ? 'Bitiş (geçti)' : 'Geçerlilik'}</dt><dd>{dt(r.valid_until)}</dd></>}
          {staff && s.visitor_name && <><dt>Ziyaretçi</dt><dd>{s.visitor_name}</dd></>}
          {staff && s.owner_name && <><dt>Sakin</dt><dd><UserRound size={14} /> {s.owner_name}</dd></>}
          {staff && s.note && <><dt>Not</dt><dd>{s.note}</dd></>}
        </dl>
      )}
      {s.phone && r.status !== 'unknown' && (
        <a className="btn primary call" href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}><Phone size={16} /> Araç sahibini ara · {s.phone}</a>
      )}
      {r.status === 'unknown' && <p className="muted">Bu plaka sistemde kayıtlı değil{staff ? '. Gerekirse ziyaretçi olarak ekleyebilirsiniz.' : '.'}</p>}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; prev?.focus() }
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  )
}

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
)

export const Empty = ({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) => (
  <div className="empty">{icon}<b>{title}</b>{text && <p>{text}</p>}</div>
)
