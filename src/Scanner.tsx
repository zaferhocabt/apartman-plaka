import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImageUp, Loader2, RefreshCw } from 'lucide-react'
import { Modal, Plate } from './ui.tsx'
import { plateCandidates } from './plate.ts'

type Worker = import('tesseract.js').Worker

/** Kameradan plaka okur (tarayıcı içinde, Tesseract OCR). Sonuç her zaman kullanıcıya doğrulatılır; doğruluk ışığa/açıya bağlıdır. */
export function Scanner({ onPick, onClose }: { onPick: (plate: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const guide = useRef<HTMLDivElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const worker = useRef<Worker | null>(null)
  const [camErr, setCamErr] = useState('')
  const [ready, setReady] = useState(false) // ref değişince React yeniden çizmez; düğmeler bu duruma bağlı
  const [busy, setBusy] = useState('')
  const [cands, setCands] = useState<string[] | null>(null)
  const [raw, setRaw] = useState('')

  useEffect(() => {
    let dead = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (dead) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        // Sürekli otomatik odak (destekleyen cihazlarda); desteklenmezse sessizce geçilir.
        void s.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as never] }).catch(() => {})
        if (video.current) video.current.srcObject = s
        setReady(true)
      })
      .catch(() => setCamErr('Kamera açılamadı. İzin verdiğinizden emin olun veya aşağıdan fotoğraf seçin.'))
    if (!navigator.mediaDevices) setCamErr('Bu tarayıcı kamerayı desteklemiyor. Aşağıdan fotoğraf seçin.')
    return () => {
      dead = true
      stream.current?.getTracks().forEach((t) => t.stop())
      void worker.current?.terminate()
    }
  }, [])

  const getWorker = useCallback(async () => {
    if (worker.current) return worker.current
    setBusy('Okuyucu yükleniyor (ilk seferde birkaç saniye sürer)…')
    const { createWorker } = await import('tesseract.js')
    const w = await createWorker('eng')
    await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', tessedit_pageseg_mode: '7' as never, user_defined_dpi: '300' })
    worker.current = w
    return w
  }, [])

  /** Otsu yöntemiyle otomatik eşik (ışığa göre kendini ayarlar). */
  const otsu = (hist: number[], total: number) => {
    let sum = 0
    for (let i = 0; i < 256; i++) sum += i * hist[i]
    let wB = 0, sB = 0, best = 0, th = 128
    for (let t = 0; t < 256; t++) {
      wB += hist[t]
      if (!wB) continue
      const wF = total - wB
      if (!wF) break
      sB += t * hist[t]
      const diff = wB * wF * (sB / wB - (sum - sB) / wF) ** 2
      if (diff > best) { best = diff; th = t }
    }
    return th
  }

  /**
   * Kaynağın (sx,sy,cw,ch) bölgesini kırpar, harf yüksekliği ~110px olacak şekilde ölçekler,
   * griye çevirip kontrastı gerer, isteğe bağlı Otsu ile siyah-beyaz yapar ve çevresine beyaz kenar ekler
   * (Tesseract kenara yapışık harfleri kötü okur).
   */
  const prep = (src: CanvasImageSource, sx: number, sy: number, cw: number, ch: number, binarize: boolean, cutStrip: boolean) => {
    if (cutStrip) { const cut = cw * 0.11; sx += cut; cw -= cut } // sol mavi "TR" şeridi
    const scale = Math.max(0.5, Math.min(4, 110 / ch))
    const w = Math.round(cw * scale), h = Math.round(ch * scale), pad = 16
    const c = document.createElement('canvas')
    c.width = w + pad * 2
    c.height = h + pad * 2
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, c.width, c.height)
    g.imageSmoothingQuality = 'high'
    g.drawImage(src, sx, sy, cw, ch, pad, pad, w, h)
    const img = g.getImageData(pad, pad, w, h)
    const d = img.data
    const hist = new Array<number>(256).fill(0)
    for (let i = 0; i < d.length; i += 4) {
      const y = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114)
      d[i] = y
      hist[y]++
    }
    // %2-%98 yüzdelikleriyle kontrast germe (tek parlak/koyu piksel bozmasın)
    const n = w * h
    let acc = 0, lo = 0, hi = 255
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * 0.02) { lo = i; break } }
    acc = 0
    for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= n * 0.02) { hi = i; break } }
    const span = Math.max(1, hi - lo)
    const h2 = new Array<number>(256).fill(0)
    for (let i = 0; i < d.length; i += 4) {
      const y = Math.max(0, Math.min(255, ((d[i] - lo) / span) * 255))
      d[i] = y
      h2[Math.round(y)]++
    }
    const th = binarize ? otsu(h2, n) : -1
    // Çoğunluk koyuysa (koyu zemin / açık yazı) ters çevir
    let dark = 0
    for (let i = 0; i <= (th < 0 ? 128 : th); i++) dark += h2[i]
    const invert = dark > n * 0.6
    for (let i = 0; i < d.length; i += 4) {
      let y = d[i]
      if (th >= 0) y = y > th ? 255 : 0
      if (invert) y = 255 - y
      d[i] = d[i + 1] = d[i + 2] = y
    }
    g.putImageData(img, pad, pad)
    return c
  }

  /** Birden fazla kare + birden fazla ön işleme; adayları oylayarak en tutarlı olanı öne alır. */
  const recognize = async (grab: () => { src: CanvasImageSource; crop: [number, number, number, number] } | null, frames: number) => {
    try {
      const w = await getWorker()
      const votes = new Map<string, number>()
      const raws: string[] = []
      for (let f = 0; f < frames; f++) {
        setBusy('Plaka okunuyor… (' + (f + 1) + '/' + frames + ')')
        const fr = grab()
        if (!fr) break
        for (const [bin, cut] of [[false, false], [true, false], [true, true], [false, true]] as const) {
          const c = prep(fr.src, ...fr.crop, bin, cut)
          const text = (await w.recognize(c)).data.text
          raws.push(text)
          plateCandidates(text).forEach((p, i) => votes.set(p, (votes.get(p) ?? 0) + (i === 0 ? 2 : 1)))
        }
        if (f < frames - 1) await new Promise((r) => setTimeout(r, 150))
      }
      setRaw([...new Set(raws.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean))].join(' | '))
      setCands([...votes.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p).slice(0, 4))
    } catch {
      setCamErr('Okuma başarısız oldu (internet gerekebilir). Plakayı elle yazabilirsiniz.')
    } finally {
      setBusy('')
    }
  }

  /** Ekrandaki sarı çerçevenin tam karşılığı olan video bölgesi (object-fit: cover hesaba katılır). */
  const guideCrop = (): [number, number, number, number] | null => {
    const v = video.current, gd = guide.current
    if (!v || !gd || !v.videoWidth) return null
    const vr = v.getBoundingClientRect(), gr = gd.getBoundingClientRect()
    const scale = Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight)
    const offX = (v.videoWidth * scale - vr.width) / 2
    const offY = (v.videoHeight * scale - vr.height) / 2
    const pad = 0.06 // çerçevenin %6 dışına kadar al; plaka kenara değse de kesilmesin
    const sx = (gr.left - vr.left + offX) / scale, sy = (gr.top - vr.top + offY) / scale
    const sw = gr.width / scale, sh = gr.height / scale
    const x = Math.max(0, sx - sw * pad), y = Math.max(0, sy - sh * pad)
    return [x, y, Math.min(v.videoWidth - x, sw * (1 + pad * 2)), Math.min(v.videoHeight - y, sh * (1 + pad * 2))]
  }

  const snap = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    void recognize(() => {
      const crop = guideCrop()
      return crop ? { src: v, crop } : null
    }, 3)
  }

  const fromFile = async (f: File) => {
    const bmp = await createImageBitmap(f)
    await recognize(() => ({ src: bmp, crop: [0, 0, bmp.width, bmp.height] }), 1)
  }

  return (
    <Modal title="Kamerayla plaka oku" onClose={onClose}>
      <div className="scanner">
        {!camErr || ready ? (
          <div className="viewfinder">
            <video ref={video} autoPlay playsInline muted />
            <div className="guide" ref={guide} aria-hidden="true"><span>Plakayı çerçeveye getirin</span></div>
          </div>
        ) : <p className="muted">{camErr}</p>}
        {camErr && ready && <p className="muted">{camErr}</p>}

        {busy && <p className="muted center"><Loader2 className="spin" size={16} /> {busy}</p>}

        {cands && !busy && (
          <div className="cands">
            {cands.length ? <p className="muted">Okunan plakayı seçin (yanlışsa tekrar tarayın):</p> : <p className="muted">Plaka okunamadı{raw ? ` (okunan: “${raw}”)` : ''}. Plakayı sarı çerçeveyi dolduracak kadar yaklaştırın, yansıma olmadan ve telefonu sabit tutarak deneyin.</p>}
            <div className="chips">{cands.map((c) => <button key={c} className="chip" onClick={() => onPick(c)}><Plate value={c} size="sm" /></button>)}</div>
          </div>
        )}

        <div className="row">
          <button className="btn primary" onClick={snap} disabled={!!busy || !ready}>{cands ? <RefreshCw size={16} /> : <Camera size={16} />} {cands ? 'Tekrar tara' : 'Tara'}</button>
          <label className="btn">
            <ImageUp size={16} /> Fotoğraf seç
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && void fromFile(e.target.files[0])} />
          </label>
        </div>
        <p className="muted small">Okuma tarayıcıda yapılır, görüntü hiçbir yere gönderilmez. İlk kullanımda okuyucu dosyaları internetten indirilir.</p>
      </div>
    </Modal>
  )
}
