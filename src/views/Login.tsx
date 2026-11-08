import { useState, type FormEvent } from 'react'
import { ArrowLeft, LogIn } from 'lucide-react'
import { errText } from '../api.ts'
import { useApp } from '../ctx.tsx'
import { Credit, Field } from '../ui.tsx'

export default function Login({ onDone }: { onDone: () => Promise<void> }) {
  const { api, building, go } = useApp()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api.signIn(email, pass)
      await onDone()
    } catch (x) {
      setErr(errText(x))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-shell">
    <main className="public">
      <form className="card login" onSubmit={submit}>
        <div className="login-head"><div className="logo-dot" aria-hidden="true" /><div><h1>{building}</h1><p>Yönetici / görevli girişi</p></div></div>
        <Field label="E-posta"><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Şifre"><input type="password" autoComplete="current-password" required value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary xl" disabled={busy}><LogIn size={18} /> {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
        {api.mode === 'demo' && <p className="muted small">Demo hesapları: <b>yonetici@demo.local</b> veya <b>gorevli@demo.local</b> · şifre <b>demo1234</b></p>}
        <button type="button" className="btn ghost" onClick={() => go('#/')}><ArrowLeft size={16} /> Plaka sorgulamaya dön</button>
      </form>
    </main>
    <Credit />
    </div>
  )
}
