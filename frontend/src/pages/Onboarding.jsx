import { useState } from 'react'
import { api } from '../api.js'
import { session } from '../lib/auth.js'
import { role } from '../lib/role.js'
import { toast } from '../lib/toast.js'
import { Blobs } from '../components/Logo.jsx'
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Crown, Calculator, Briefcase, HardHat } from 'lucide-react'

// onboarding role → RBAC role (drives Can/permission gates app-wide)
const ROLE_OPTIONS = [
  { id: 'owner', rbac: 'owner', icon: Crown, label: 'Owner', desc: 'Full control — approvals, hiring agents, settings' },
  { id: 'accountant', rbac: 'manager', icon: Calculator, label: 'Accountant', desc: 'Approve payments, see all reports' },
  { id: 'manager', rbac: 'manager', icon: Briefcase, label: 'Manager', desc: 'Approve actions, talk to every agent' },
  { id: 'worker', rbac: 'viewer', icon: HardHat, label: 'Worker', desc: 'Chat + view — nothing goes out without approval' },
]

const PROBLEMS = [
  'Payments come late — I keep chasing them',
  'Stock runs out before I notice',
  'Deliveries get delayed, nobody tracks them',
  'Too many Excel sheets and registers',
  'Cash-flow surprises at month end',
  'Hard to compare supplier prices',
]

// problem chip → backend pain id (drives auto agent-hiring in POST /onboarding)
const PAIN_ID = {
  'Payments come late — I keep chasing them': 'late_payments',
  'Stock runs out before I notice': 'stock_outs',
  'Deliveries get delayed, nobody tracks them': 'untracked_deliveries',
  'Too many Excel sheets and registers': 'too_many_excels',
  'Cash-flow surprises at month end': 'cash_flow',
  'Hard to compare supplier prices': 'chasing_suppliers',
}

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(session.get()?.user?.name || '')
  const [business, setBusiness] = useState(session.get()?.user?.business || '')
  const [city, setCity] = useState('')
  const [rolePick, setRolePick] = useState('owner')
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)

  const finish = async () => {
    setBusy(true)
    try {
      // chosen role drives RBAC gates across the app
      const rbac = ROLE_OPTIONS.find(r => r.id === rolePick)?.rbac || 'owner'
      role.set(rbac)
      const pickedRole = ROLE_OPTIONS.find(r => r.id === rolePick)
      // one rich call: profile+prefs → settings, answers+pains → memories,
      // pains → agents auto-hired by the factory. Granular calls are the fallback.
      const r = await api.onboarding({
        business: { name: business, owner: name, city },
        prefs: { role: rbac },
        pains: picked.map(p => PAIN_ID[p]).filter(Boolean),
        rules: [...picked,
                `${name || 'User'} is the ${pickedRole?.label.toLowerCase() || 'owner'} of ${business || 'the business'}`],
        auto_hire: true,
      }).catch(() => null)
      if (!r) {
        await api.updateSettings({ business: { name: business, owner: name, city }, onboarded: true })
        await Promise.all([
          ...picked.map(p => api.addMemory(`Owner said: "${p}"`, 'onboarding').catch(() => {})),
          api.addMemory(`${name || 'User'} is the ${pickedRole?.label.toLowerCase() || 'owner'} of ${business || 'the business'}`, 'onboarding').catch(() => {}),
        ])
      }
      if (r?.agents_installed?.length) toast.push(`${r.agents_installed.length} agent${r.agents_installed.length > 1 ? 's' : ''} hired for your problems`)
      location.hash = '#/app'
    } catch { setBusy(false) }
  }

  const steps = [
    { key: 'name', q: 'What should we call you?', ph: 'Ramesh Gupta', val: name, set: setName, ok: name.trim().length > 1 },
    { key: 'role' },   // role picker — rendered specially below
    { key: 'biz', q: "What's your business called?", ph: 'Ramesh Auto Components', val: business, set: setBusiness, ok: business.trim().length > 1 },
    { key: 'city', q: 'Which city do you operate from?', ph: 'Faridabad', val: city, set: setCity, ok: city.trim().length > 1 },
  ]
  const s = steps[step]
  const TOTAL = steps.length + 1

  return (
    <div className="min-h-screen bg-[#fbfbfd] font-sans flex flex-col">
      <header className="px-6 h-[52px] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Blobs />
          <span className="font-semibold text-[14px] tracking-tight text-ink">Sahayak</span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL }, (_, i) => <span key={i} className={`w-6 h-1 rounded-full transition ${i <= step ? 'bg-ink' : 'bg-slate-200'}`} />)}
        </div>
      </header>

      <main className="flex-1 grid place-items-center px-6 pb-16">
        <div className="w-full max-w-[440px]">
          {step === 1 ? (
            <>
              <div className="text-[11px] font-semibold text-accent uppercase tracking-wider mb-3">Setup · 2 of {TOTAL}</div>
              <h1 className="text-[26px] font-semibold tracking-tight text-ink">What's your role in the business?</h1>
              <p className="text-[13px] text-slate-500 mt-2">This sets what you can approve — staff see less power than owners.</p>
              <div className="grid grid-cols-2 gap-2 mt-6">
                {ROLE_OPTIONS.map(r => {
                  const on = rolePick === r.id
                  return (
                    <button key={r.id} onClick={() => setRolePick(r.id)}
                      className={`text-left rounded-xl border p-3.5 transition
                        ${on ? 'border-ink bg-ink text-white shadow-float' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                      <span className={`w-7 h-7 rounded-lg grid place-items-center mb-2 ${on ? 'bg-white/15 text-white' : 'bg-accent/10 text-accent'}`}>
                        <r.icon size={14} />
                      </span>
                      <div className={`text-[12px] font-semibold ${on ? 'text-white' : 'text-ink'}`}>{r.label}</div>
                      <div className={`text-[10px] mt-0.5 leading-snug ${on ? 'text-white/70' : 'text-slate-400'}`}>{r.desc}</div>
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-between items-center mt-6">
                <button onClick={() => setStep(0)} className="text-[12px] text-slate-400 hover:text-ink flex items-center gap-1"><ArrowLeft size={12} /> Back</button>
                <button onClick={() => setStep(2)}
                  className="rounded-xl bg-ink text-white px-5 py-2.5 text-[13px] font-medium hover:bg-ink/85 transition flex items-center gap-1.5">
                  Next <ArrowRight size={13} />
                </button>
              </div>
            </>
          ) : step < 4 ? (
            <>
              <div className="text-[11px] font-semibold text-accent uppercase tracking-wider mb-3">Setup · {step + 1} of {TOTAL}</div>
              <h1 className="text-[26px] font-semibold tracking-tight text-ink">{s.q}</h1>
              <input value={s.val} onChange={e => s.set(e.target.value)} placeholder={s.ph} autoFocus
                onKeyDown={e => e.key === 'Enter' && s.ok && setStep(step + 1)}
                className="mt-6 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] focus:outline-none focus:border-ink transition" />
              <div className="flex justify-between items-center mt-6">
                {step > 0
                  ? <button onClick={() => setStep(step - 1)} className="text-[12px] text-slate-400 hover:text-ink flex items-center gap-1"><ArrowLeft size={12} /> Back</button>
                  : <span />}
                <button onClick={() => setStep(step + 1)} disabled={!s.ok}
                  className="rounded-xl bg-ink text-white px-5 py-2.5 text-[13px] font-medium hover:bg-ink/85 transition disabled:opacity-30 flex items-center gap-1.5">
                  Next <ArrowRight size={13} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] font-semibold text-accent uppercase tracking-wider mb-3">Setup · {TOTAL} of {TOTAL}</div>
              <h1 className="text-[26px] font-semibold tracking-tight text-ink">What eats your time?</h1>
              <p className="text-[13px] text-slate-500 mt-2">Pick what applies — Sahayak remembers these and your agents work on them first.</p>
              <div className="grid grid-cols-2 gap-2 mt-6">
                {PROBLEMS.map(p => {
                  const on = picked.includes(p)
                  return (
                    <button key={p} onClick={() => setPicked(on ? picked.filter(x => x !== p) : [...picked, p])}
                      className={`text-left rounded-xl border p-3 text-[12px] leading-snug transition flex items-start gap-2
                        ${on ? 'border-ink bg-ink text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                      <span className={`w-4 h-4 rounded-full grid place-items-center shrink-0 mt-0.5 ${on ? 'bg-white/20' : 'bg-slate-100'}`}>
                        {on && <Check size={10} />}
                      </span>
                      {p}
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-between items-center mt-6">
                <button onClick={() => setStep(3)} className="text-[12px] text-slate-400 hover:text-ink flex items-center gap-1"><ArrowLeft size={12} /> Back</button>
                <button onClick={finish} disabled={busy}
                  className="rounded-xl bg-ink text-white px-5 py-2.5 text-[13px] font-medium hover:bg-ink/85 transition disabled:opacity-40 flex items-center gap-1.5">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  Open my workspace
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
