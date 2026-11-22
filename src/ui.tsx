import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, Clock, Download, Phone, ShieldOff, Smartphone, UserRound, X } from 'lucide-react'
import { formatPlate, isForeignPlate, normalizePlate } from './plate.ts'
import { STATUS_LABEL, type PublicResult, type StaffResult, type Status } from './types.ts'

// Beş köşeli yıldız: bir ucu sağa (ayın açıklığına) bakar.
const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 0.85 : 2.1, a = (i * Math.PI) / 5
  return `${(14.6 + r * Math.cos(a)).toFixed(2)},${(10 + r * Math.sin(a)).toFixed(2)}`
}).join(' ')

/** Türk bayrağı simgesi (kırmızı zemin, beyaz hilal ve yıldız). */
function TrFlag() {
  return (
    <svg className="plate-flag" viewBox="0 0 30 20" aria-hidden="true">
      <rect width="30" height="20" fill="#e30a17" />
      <circle cx="10.5" cy="10" r="5" fill="#fff" />
      <circle cx="11.9" cy="10" r="4" fill="#e30a17" />
      <polygon points={STAR} fill="#fff" />
    </svg>
  )
}

/** Türk plakası görünümü: mavi "TR" şeridi + siyah çerçeve. */
export function Plate({ value, size = 'md' }: { value: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`plate plate-${size}`} aria-label={`Plaka ${formatPlate(value)}`}>
      {isForeignPlate(value) ? <span className="plate-eu plate-foreign">YAB</span> : <span className="plate-eu"><TrFlag />TR</span>}
      <span className="plate-no">{formatPlate(value) || '—'}</span>
    </span>
  )
}

export function PlateInput({ value, onChange, onEnter, autoFocus, big }: { value: string; onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean; big?: boolean }) {
  return (
    <label className={`plate plate-input ${big ? 'plate-lg' : 'plate-md'}`}>
      <span className="plate-eu"><TrFlag />TR</span>
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

type InstallEvt = Event & { prompt: () => Promise<void> }
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Ana ekrana ekle: Android'de sistem penceresi, iOS'ta (Safari'de otomatik pencere yok) adım adım yönerge. Yüklüyse görünmez. */
function InstallButton() {
  const [evt, setEvt] = useState<InstallEvt | null>(null)
  const [help, setHelp] = useState(false)
  const [done, setDone] = useState(isStandalone())
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvt) }
    const onInstalled = () => { setDone(true); setEvt(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  if (done || !(evt || isIos())) return null
  return (
    <>
      <button className="btn" onClick={() => (evt ? void evt.prompt() : setHelp(true))}><Download size={16} /> Uygulamayı yükle</button>
      {help && (
        <Modal title="Ana ekrana ekle" onClose={() => setHelp(false)}>
          <ol className="small">
            <li>Safari'de alttaki <b>Paylaş</b> düğmesine dokunun.</li>
            <li><b>Ana Ekrana Ekle</b>'yi seçin.</li>
            <li><b>Ekle</b>'ye dokunun.</li>
          </ol>
          <p className="muted small">Chrome'da değil, Safari'de açmanız gerekir.</p>
        </Modal>
      )}
    </>
  )
}

/** Sayfa altında ortalı imza: küçük ama okunaklı; telefon simgesi/numara tek dokunuşla arar. */
export const Credit = () => (
  <footer className="credit">
    <InstallButton />
    <span>Bu Web Sayfası Zafer ÜYE tarafından hazırlanmıştır.</span>
    <a href="tel:05059039854" aria-label="İletişim için Zafer ÜYE’yi ara">
      İletişim için <Smartphone size={16} aria-hidden="true" />
    </a>
  </footer>
)

export const Empty =({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) => (
  <div className="empty">{icon}<b>{title}</b>{text && <p>{text}</p>}</div>
)
