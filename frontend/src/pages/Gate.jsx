// Demo gate — one shared passcode stands in for real auth (project rule).
// Judges open .../?gate=CODE once; it sticks in localStorage after that.
import { useState } from 'react'
import { Blobs } from '../components/Logo.jsx'
import { setGate, checkGate } from '../api.js'
import { Lock, ArrowRight } from 'lucide-react'

export default function Gate() {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true); setErr('')
    setGate(code.trim())
    if (await checkGate(code.trim())) {      // raw fetch — no demo fallback
      location.hash = '#/app'
    } else {
      setGate('')
      setErr('Wrong passcode — check the link you were sent.')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] font-sans grid place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-[360px] rounded-3xl border border-slate-200 bg-white shadow-float p-8 text-center">
        <div className="flex justify-center mb-4"><Blobs /></div>
        <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto mb-3">
          <Lock size={18} />
        </div>
        <h1 className="text-[18px] font-semibold tracking-tight text-ink">Sahayak demo</h1>
        <p className="text-[12px] text-slate-500 mt-1 mb-5">
          Enter the passcode from your invite link.
        </p>
        <input
          autoFocus value={code} onChange={e => setCode(e.target.value)}
          placeholder="Passcode"
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[14px] text-center tracking-widest outline-none focus:border-ink/40 transition"
        />
        {err && <div className="text-[11px] text-rose-500 mt-2">{err}</div>}
        <button disabled={busy}
          className="mt-4 w-full rounded-xl bg-ink text-white text-[13px] font-medium py-2.5 flex items-center justify-center gap-1.5 hover:bg-ink/90 transition disabled:opacity-50">
          {busy ? 'Checking…' : 'Enter demo'} <ArrowRight size={13} />
        </button>
      </form>
    </div>
  )
}
