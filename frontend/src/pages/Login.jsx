import { useState } from 'react'
import { api } from '../api.js'
import { session } from '../lib/auth.js'
import { MFACode } from '../components/rui/MFACode.jsx'
import { ArrowLeft, Chrome, Phone, ChevronRight, Loader2, MailCheck } from 'lucide-react'

// Provider adapters are client-side seams — /auth/login + tenant are real.
export default function Login() {
  const [mode, setMode] = useState('pick') // pick | phone | otp | email-verify
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const finish = async (provider, provider_id, name, business) => {
    setBusy(true); setErr('')
    try {
      const r = await api.login({ provider, provider_id, name, business })
      session.set(r)
      location.hash = r.onboarded ? '#/app' : '#/onboarding'
    } catch (e) {
      setErr('Backend not reachable — is it running on :8000?')
    } finally { setBusy(false) }
  }

  const google = () => setMode('email-verify')
  const guest = () => finish('guest', null, 'Ramesh Gupta', 'Ramesh Auto Components')

  return (
    <div className="min-h-screen bg-[#fbfbfd] font-sans flex flex-col">
      <header className="px-6 h-[52px] flex items-center">
        <a href="#/" className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-ink text-white grid place-items-center text-[10px] font-bold">स</span>
          <span className="font-semibold text-[14px] tracking-tight text-ink">Sahayak</span>
        </a>
      </header>

      <main className="flex-1 grid place-items-center px-6 pb-16">
        <div className="w-full max-w-[340px]">
          {mode === 'pick' && (<>
            <h1 className="text-[26px] font-semibold tracking-tight text-ink text-center">Your back-office,<br />staffed by AI</h1>
            <p className="text-[13px] text-slate-500 text-center mt-2 mb-8">Sign in to open your workspace</p>

            <button onClick={google} disabled={busy}
              className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-medium text-ink hover:border-slate-300 hover:shadow-float transition disabled:opacity-50">
              <Chrome size={16} className="text-slate-500" />
              Continue with Google
              {busy && <Loader2 size={14} className="ml-auto animate-spin text-slate-400" />}
            </button>

            <button onClick={() => setMode('phone')}
              className="mt-3 w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-medium text-ink hover:border-slate-300 hover:shadow-float transition">
              <Phone size={16} className="text-slate-500" />
              Continue with phone
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button onClick={guest} disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-ink text-white px-4 py-3 text-[13px] font-medium hover:bg-ink/85 transition disabled:opacity-50">
              Continue as Ramesh (demo tenant) <ChevronRight size={14} />
            </button>
            {err && <p className="text-[11px] text-rose-500 text-center mt-3">{err}</p>}
            <p className="text-[10px] text-slate-400 text-center mt-6 leading-relaxed">
              By continuing you agree to let Sahayak agents draft actions for your approval.
            </p>
          </>)}

          {mode === 'phone' && (<>
            <button onClick={() => setMode('pick')} className="text-[12px] text-slate-400 hover:text-ink flex items-center gap-1 mb-6"><ArrowLeft size={12} /> Back</button>
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">Enter your phone</h1>
            <p className="text-[12px] text-slate-500 mt-1.5 mb-6">We'll send a one-time code to verify it's you.</p>
            <form onSubmit={e => { e.preventDefault(); if (phone.trim().length >= 10) setMode('otp') }}
              className="space-y-3">
              <div className="flex items-center rounded-xl border border-slate-200 bg-white focus-within:border-ink transition overflow-hidden">
                <span className="px-3.5 text-[13px] text-slate-500 border-r border-slate-100">+91</span>
                <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98765 43210" inputMode="numeric" autoFocus
                  className="flex-1 px-3.5 py-3 text-[13px] focus:outline-none" />
              </div>
              <button className="w-full rounded-xl bg-ink text-white py-3 text-[13px] font-medium hover:bg-ink/85 transition">
                Send code
              </button>
            </form>
          </>)}

          {mode === 'otp' && (<>
            <button onClick={() => setMode('phone')} className="text-[12px] text-slate-400 hover:text-ink flex items-center gap-1 mb-6"><ArrowLeft size={12} /> Back</button>
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">Enter the code</h1>
            <p className="text-[12px] text-slate-500 mt-1.5 mb-7">Sent to +91 {phone} — any 6 digits work in this build.</p>
            <form onSubmit={e => { e.preventDefault(); if (otp.length === 6) finish('phone', `+91${phone}`, 'Ramesh Gupta', 'Ramesh Auto Components') }}
              className="space-y-5">
              <MFACode value={otp} onChange={setOtp} />
              <button disabled={otp.length !== 6 || busy}
                className="w-full rounded-xl bg-ink text-white py-3 text-[13px] font-medium hover:bg-ink/85 transition disabled:opacity-40 flex items-center justify-center gap-2">
                {busy ? <Loader2 size={14} className="animate-spin" /> : 'Verify & continue'}
              </button>
            </form>
            {err && <p className="text-[11px] text-rose-500 text-center mt-3">{err}</p>}
          </>)}

          {mode === 'email-verify' && (<>
            <button onClick={() => setMode('pick')} className="text-[12px] text-slate-400 hover:text-ink flex items-center gap-1 mb-6"><ArrowLeft size={12} /> Back</button>
            <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent grid place-items-center mb-4"><MailCheck size={18} /></div>
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">Verify your email</h1>
            <p className="text-[12px] text-slate-500 mt-1.5 mb-7">We sent a 6-digit code to <span className="font-medium text-ink">ramesh@rameshauto.in</span></p>
            <form onSubmit={e => { e.preventDefault(); if (emailCode.length === 6) finish('google', 'ramesh@rameshauto.in', 'Ramesh Gupta', 'Ramesh Auto Components') }}
              className="space-y-5">
              <MFACode value={emailCode} onChange={setEmailCode} />
              <button disabled={emailCode.length !== 6 || busy}
                className="w-full rounded-xl bg-ink text-white py-3 text-[13px] font-medium hover:bg-ink/85 transition disabled:opacity-40 flex items-center justify-center gap-2">
                {busy ? <Loader2 size={14} className="animate-spin" /> : 'Verify & sign in'}
              </button>
              <button type="button" onClick={() => finish('google', 'ramesh@rameshauto.in', 'Ramesh Gupta', 'Ramesh Auto Components')}
                className="w-full text-[11px] text-slate-400 hover:text-ink transition">Skip verification for now</button>
            </form>
            {err && <p className="text-[11px] text-rose-500 text-center mt-3">{err}</p>}
          </>)}
        </div>
      </main>
    </div>
  )
}
