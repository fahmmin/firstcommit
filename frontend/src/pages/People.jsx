// People — the lightweight CRM. Customers are aggregated from real invoices
// (total billed, outstanding, worst overdue days); suppliers + carriers come
// from their live endpoints. Remind buttons deep-link a prompt into the chat.
import { useEffect, useMemo, useState } from 'react'
import { api, TENANT } from '../api.js'
import { AgentAvatar } from '../lib/avatar.jsx'
import { AppShell } from '../components/AppShell.jsx'
import {
  Users, Search, Store, Truck, Star, ShieldCheck,
  MessageSquareWarning, BadgeCheck, PhoneCall,
} from 'lucide-react'

export default function People() {
  const [tab, setTab] = useState('customers')
  const [q, setQ] = useState('')
  const [invoices, setInvoices] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [carriers, setCarriers] = useState([])

  useEffect(() => {
    Promise.all([api.invoices().catch(() => []), api.suppliers().catch(() => []), api.carriers().catch(() => [])])
      .then(([inv, sup, car]) => { setInvoices(inv); setSuppliers(sup); setCarriers(car) })
  }, [])

  // customers = invoices grouped by buyer
  const customers = useMemo(() => {
    const map = {}
    invoices.forEach(i => {
      const c = map[i.buyer] ||= { name: i.buyer, billed: 0, outstanding: 0, overdueDays: 0, count: 0, last: i.due_date }
      c.billed += Number(i.amount || 0); c.count++
      if (i.status !== 'paid') c.outstanding += Number(i.amount || 0)
      c.overdueDays = Math.max(c.overdueDays, i.days_overdue || 0)
      if (i.due_date > c.last) c.last = i.due_date
    })
    return Object.values(map).sort((a, b) => b.outstanding - a.outstanding)
  }, [invoices])

  const needle = q.toLowerCase()
  const stats = [
    [customers.length, 'customers'], [suppliers.length, 'suppliers'], [carriers.length, 'carriers'],
    [`₹${(customers.reduce((s, c) => s + c.outstanding, 0) / 1000).toFixed(1)}k`, 'outstanding'],
  ]

  const remind = (name) => {
    localStorage.setItem('prefill_prompt', `Draft a payment reminder for ${name}'s oldest overdue invoice.`)
    location.hash = '#/app'
  }

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Everyone your business touches</h1>
            <p className="text-[12px] text-slate-500 mt-1">Buyers, suppliers, carriers — assembled from your real invoices and ledgers.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 w-56 focus-within:border-ink transition">
            <Search size={13} className="text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search people…"
              className="flex-1 text-[12px] focus:outline-none bg-transparent" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {stats.map(([v, l]) => (
            <div key={l} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[18px] font-semibold text-ink">{v}</div>
              <div className="text-[10px] text-slate-400">{l}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mb-5 rounded-xl border border-slate-200 bg-white p-1 w-fit">
          {[['customers', 'Customers', Users], ['suppliers', 'Suppliers', Store], ['carriers', 'Carriers', Truck]].map(([k, l, I]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium transition
                ${tab === k ? 'bg-ink text-white' : 'text-slate-500 hover:text-ink'}`}>
              <I size={12} /> {l}
            </button>
          ))}
        </div>

        {tab === 'customers' && (
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-50 overflow-hidden">
            {customers.filter(c => !needle || c.name.toLowerCase().includes(needle)).map((c, i) => (
              <div key={c.name} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition animate-slideInRight"
                style={{ animationDelay: `${i * 30}ms` }}>
                <AgentAvatar seed={c.name} size={30} className="rounded-lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">{c.name}</span>
                    {c.overdueDays > 30 && <span className="text-[9px] font-bold rounded px-1.5 py-px bg-rose-50 text-rose-600">defaulter</span>}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {c.count} invoice{c.count > 1 ? 's' : ''} · billed ₹{c.billed.toLocaleString('en-IN')}
                    {c.overdueDays > 0 && <span className="text-rose-500"> · {c.overdueDays}d worst overdue</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-[13px] font-semibold ${c.outstanding ? 'text-ink' : 'text-emerald-600'}`}>
                    {c.outstanding ? `₹${c.outstanding.toLocaleString('en-IN')}` : 'settled'}
                  </div>
                  <div className="text-[9px] text-slate-400">outstanding</div>
                </div>
                {c.outstanding > 0 && (
                  <button onClick={() => remind(c.name)} title="Draft a reminder"
                    className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 grid place-items-center text-slate-400 hover:text-accent hover:border-accent transition">
                    <MessageSquareWarning size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'suppliers' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {suppliers.filter(s => !needle || `${s.name} ${s.category}`.toLowerCase().includes(needle)).map(s => (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-float transition">
                <div className="flex items-start gap-3">
                  <AgentAvatar seed={s.id} size={30} className="rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-ink truncate">{s.name}</span>
                      {s.verified && <BadgeCheck size={12} className="text-accent shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{s.category} · {s.lead_days}d lead</div>
                  </div>
                  <div className="flex items-center gap-0.5 text-amber-500 text-[10px] font-semibold shrink-0">
                    <Star size={10} fill="currentColor" /> {s.trust_score}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 text-[10px]">
                  <span className="rounded-full bg-slate-50 border border-slate-100 px-2 py-0.5 text-slate-500">₹{s.price_per_unit}/unit</span>
                  <span className="rounded-full bg-slate-50 border border-slate-100 px-2 py-0.5 text-slate-500">MOQ {s.moq}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ml-auto ${s.stock === 'in_stock' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {s.stock === 'in_stock' ? 'in stock' : s.stock}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'carriers' && (
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-50 overflow-hidden">
            {carriers.filter(c => !needle || `${c.name} ${c.route}`.toLowerCase().includes(needle)).map(c => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center shrink-0"><Truck size={14} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-ink">{c.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{c.route} · ₹{c.rate_per_kg}/kg{c.phone ? ` · ${c.phone}` : ''}</div>
                </div>
                {c.phone && <PhoneCall size={12} className="text-slate-300" />}
              </div>
            ))}
          </div>
        )}
        </div>
      </main>
    </AppShell>
  )
}
