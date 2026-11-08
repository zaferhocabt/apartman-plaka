import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImageUp, Loader2, RefreshCw } from 'lucide-react'
import { Modal, Plate } from './ui.tsx'
import { plateCandidates } from './plate.ts'

type Worker = import('tesseract.js').Worker

/** Kameradan plaka okur (tarayıcı içinde, Tesseract OCR). Sonuç her zaman kullanıcıya doğrulatılır; doğruluk ışığa/açıya bağlıdır. */
export function Scanner({ onPick, onClose }: { onPick: (plate: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const worker = useRef<Worker | null>(null)
  const [camErr, setCamErr] = useState('')
  const [busy, setBusy] = useState('')
  const [cands, setCands] = useState<string[] | null>(null)
  const [raw, setRaw] = useState('')

  useEffect(() => {
    let dead = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (dead) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        if (video.current) video.current.srcObject = s
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
    await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', tessedit_pageseg_mode: '7' as never })
    worker.current = w
    return w
  }, [])

  /** Gri tonlama + kontrast germe; ikinci geçişte eşikleme (parlak/sönük plakalar için). */
  const prep = (src: CanvasImageSource, sw: number, sh: number, sx: number, sy: number, cw: number, ch: number, threshold: boolean) => {
    const scale = Math.min(2.5, 900 / cw)
    const c = document.createElement('canvas')
    c.width = Math.round(cw * scale)
    c.height = Math.round(ch * scale)
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(src, sx, sy, Math.min(cw, sw - sx), Math.min(ch, sh - sy), 0, 0, c.width, c.height)
    const img = g.getImageData(0, 0, c.width, c.height)
    const d = img.data
    let lo = 255, hi = 0
    for (let i = 0; i < d.length; i += 4) {
      const y = (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10
      d[i] = y
      if (y < lo) lo = y
      if (y > hi) hi = y
    }
    const span = Math.max(1, hi - lo)
    for (let i = 0; i < d.length; i += 4) {
      let y = ((d[i] - lo) / span) * 255
      if (threshold) y = y > 128 ? 255 : 0
      d[i] = d[i + 1] = d[i + 2] = y
    }
    g.putImageData(img, 0, 0)
    return c
  }

  const recognize = async (src: CanvasImageSource, sw: number, sh: number, crop: [number, number, number, number]) => {
    try {
      const w = await getWorker()
      setBusy('Plaka okunuyor…')
      const texts: string[] = []
      for (const th of [false, true]) {
        const c = prep(src, sw, sh, ...crop, th)
        texts.push((await w.recognize(c)).data.text)
      }
      setRaw(texts.join(' | ').replace(/\s+/g, ' ').trim())
      const set = new Set<string>()
      for (const t of texts) plateCandidates(t).forEach((p) => set.add(p))
      setCands([...set].slice(0, 4))
    } catch {
      setCamErr('Okuma başarısız oldu (internet gerekebilir). Plakayı elle yazabilirsiniz.')
    } finally {
      setBusy('')
    }
  }

  const snap = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    // Kılavuz çerçevesi: ortada, genişliğin %80'i, yüksekliği ~genişlik/4.2
    const cw = v.videoWidth * 0.8
    const ch = Math.min(v.videoHeight * 0.5, cw / 4.2 * 1.6)
    void recognize(v, v.videoWidth, v.videoHeight, [(v.videoWidth - cw) / 2, (v.videoHeight - ch) / 2, cw, ch])
  }

  const fromFile = async (f: File) => {
    const bmp = await createImageBitmap(f)
    await recognize(bmp, bmp.width, bmp.height, [0, 0, bmp.width, bmp.height])
  }

  return (
    <Modal title="Kamerayla plaka oku" onClose={onClose}>
      <div className="scanner">
        {!camErr || stream.current ? (
          <div className="viewfinder">
            <video ref={video} autoPlay playsInline muted />
            <div className="guide" aria-hidden="true"><span>Plakayı çerçeveye getirin</span></div>
          </div>
        ) : <p className="muted">{camErr}</p>}
        {camErr && stream.current && <p className="muted">{camErr}</p>}

        {busy && <p className="muted center"><Loader2 className="spin" size={16} /> {busy}</p>}

        {cands && !busy && (
          <div className="cands">
            {cands.length ? <p className="muted">Okunan plakayı seçin (yanlışsa tekrar tarayın):</p> : <p className="muted">Plaka okunamadı{raw ? ` (okunan: “${raw}”)` : ''}. Daha yakından, ışığı arkanıza alarak deneyin.</p>}
            <div className="chips">{cands.map((c) => <button key={c} className="chip" onClick={() => onPick(c)}><Plate value={c} size="sm" /></button>)}</div>
          </div>
        )}

        <div className="row">
          <button className="btn primary" onClick={snap} disabled={!!busy || !stream.current}>{cands ? <RefreshCw size={16} /> : <Camera size={16} />} {cands ? 'Tekrar tara' : 'Tara'}</button>
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
