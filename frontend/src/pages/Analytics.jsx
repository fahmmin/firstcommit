// Analytics — the numbers page. KPI tiles from /dashboard/summary, a cash-
// position forecast computed from dated receivables+payables, aging buckets,
// status donut, billed-by-customer, agent activity and connector sync health.
import { useEffect, useMemo, useState } from 'react'
import { api, TENANT } from '../api.js'
import { BrandIcon } from '../components/BrandIcon.jsx'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import { AppShell } from '../components/AppShell.jsx'
import {
  FileWarning, Landmark, Wallet, Lock, ShieldCheck, IndianRupee,
  TrendingUp, Activity, PlugZap, Bot,
} from 'lucide-react'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtK = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}k`
const STATUS_COLORS = { paid: '#10b981', due_soon: '#f59e0b', overdue: '#f43f5e', pending: '#3494f4' }
const BUCKET_COLORS = ['#f59e0b', '#f97316', '#ef4444', '#be123c']

export default function Analytics() {
  const [summary, setSummary] = useState(null)
  const [cf, setCf] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [connectors, setConnectors] = useState([])
  const [agents, setAgents] = useState([])

  useEffect(() => {
    api.dashboard().then(setSummary).catch(() => {})
    api.cashflow().then(setCf).catch(() => {})
    api.invoices().then(setInvoices).catch(() => {})
    api.connectors().then(setConnectors).catch(() => {})
    api.agents().then(setAgents).catch(() => {})
  }, [])

  // running cash position: dated events → cumulative balance line
  const cashSeries = useMemo(() => {
    if (!cf) return []
    const events = [
      ...(cf.receivables || []).map(r => ({ d: r.expected, amt: +r.amount })),
      ...(cf.payables || []).map(p => ({ d: p.due, amt: -p.amount })),
    ].sort((a, b) => new Date(a.d) - new Date(b.d))
    let bal = cf.opening_balance ?? 180000
    return events.map(e => ({ date: e.d?.slice(5).replace('-', '/'), bal: (bal += e.amt) }))
  }, [cf])

  // aging buckets from real days_overdue
  const aging = useMemo(() => {
    const b = [0, 0, 0, 0]
    invoices.filter(i => i.status !== 'paid').forEach(i => {
      const d = i.days_overdue || 0
      b[d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : 3] += Number(i.amount || 0)
    })
    return ['current', '1–30d', '31–60d', '60d+'].map((k, i) => ({ k, v: b[i] }))
  }, [invoices])

  const statusPie = useMemo(() => {
    const m = {}
    invoices.forEach(i => { m[i.status] = (m[i.status] || 0) + Number(i.amount || 0) })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  }, [invoices])

  const byCustomer = useMemo(() => {
    const m = {}
    invoices.forEach(i => { m[i.buyer] = (m[i.buyer] || 0) + Number(i.amount || 0) })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, value]) => ({ name: name.split(' ')[0], value }))
  }, [invoices])

  const kpis = summary ? [
    { icon: Wallet, tint: 'text-accent bg-accent/10', label: 'Outstanding', value: fmtK(summary.receivables?.total), sub: `${invoices.length} invoices` },
    { icon: FileWarning, tint: 'text-rose-500 bg-rose-50', label: 'Overdue', value: fmtK(summary.receivables?.overdue_total), sub: `${summary.receivables?.overdue_count} invoices` },
    { icon: Landmark, tint: 'text-amber-600 bg-amber-50', label: 'Due soon', value: fmtK(summary.receivables?.due_soon_total), sub: 'next 30 days' },
    { icon: IndianRupee, tint: 'text-emerald-600 bg-emerald-50', label: 'Payables 30d', value: fmtK(summary.payables_due_30d), sub: 'going out' },
    { icon: Lock, tint: 'text-violet-600 bg-violet-50', label: 'Locked in long terms', value: fmtK(summary.capital_locked_long_terms), sub: '60–90 day buyers' },
    { icon: ShieldCheck, tint: 'text-magenta bg-magenta/10', label: 'Pending approvals', value: summary.pending_approvals, sub: 'awaiting your tap' },
  ] : []

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">The business, in numbers</h1>
        <p className="text-[12px] text-slate-500 mt-1 mb-6">Live from your ledgers — updated every time an agent touches an invoice.</p>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {kpis.map((k, i) => (
            <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-3.5 animate-popIn" style={{ animationDelay: `${i * 50}ms` }}>
              <span className={`w-7 h-7 rounded-lg grid place-items-center mb-2 ${k.tint}`}><k.icon size={13} /></span>
              <div className="text-[17px] font-semibold text-ink leading-none">{k.value}</div>
              <div className="text-[9px] text-slate-400 mt-1">{k.label}</div>
              <div className="text-[9px] text-slate-300">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* cash position forecast */}
          <Card title="Cash position forecast" sub="receivables in − payables out, next 90 days" wide>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={cashSeries} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3494f4" stopOpacity={.35} />
                    <stop offset="100%" stopColor="#3494f4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip formatter={v => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0' }} />
                <Area type="monotone" dataKey="bal" stroke="#3494f4" strokeWidth={2} fill="url(#cashGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* status donut */}
          <Card title="Invoice status" sub="by amount">
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={statusPie} dataKey="value" innerRadius={46} outerRadius={68} paddingAngle={3} strokeWidth={0}>
                    {statusPie.map(s => <Cell key={s.name} fill={STATUS_COLORS[s.name] || '#94a3b8'} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {statusPie.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[s.name] || '#94a3b8' }} />
                    <span className="text-slate-500 capitalize">{s.name.replace('_', ' ')}</span>
                    <span className="ml-auto font-medium text-ink">{fmt(s.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* aging */}
          <Card title="Receivables aging" sub="how late the money is">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={aging} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <XAxis dataKey="k" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={v => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                  {aging.map((_, i) => <Cell key={i} fill={BUCKET_COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* billed by customer */}
          <Card title="Billed by customer" sub="top 5 buyers">
            <div className="space-y-2.5 pt-1">
              {byCustomer.map(c => (
                <div key={c.name}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-600 font-medium">{c.name}</span>
                    <span className="text-ink font-semibold">{fmt(c.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(c.value / (byCustomer[0]?.value || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* agent activity */}
          <Card title="Agent activity" sub={`${summary?.agents?.total ?? agents.length} agents · ${summary?.agents?.ai_hired ?? 0} hired by AI`}>
            <div className="space-y-1">
              {(summary?.recent_activity || []).map(a => (
                <div key={a.id} className="flex items-start gap-2.5 py-1.5 text-[11px]">
                  <span className="w-5 h-5 rounded-md bg-accent/10 text-accent grid place-items-center shrink-0 mt-px"><Bot size={10} /></span>
                  <div className="min-w-0">
                    <div className="text-slate-600 leading-snug">{a.text}</div>
                    <div className="text-[9px] text-slate-300">{new Date(a.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
              {!summary?.recent_activity?.length && <div className="text-[11px] text-slate-400 py-4 text-center">No activity yet — agents post here as they work.</div>}
            </div>
          </Card>

          {/* sync health */}
          <Card title="Sync health" sub="connector freshness">
            <div className="space-y-2">
              {connectors.filter(c => c.status === 'connected').map(c => (
                <div key={c.id} className="flex items-center gap-2.5 text-[11px]">
                  <BrandIcon id={c.icon || c.id} size={14} />
                  <span className="text-slate-600 font-medium">{c.name}</span>
                  <span className="text-[9px] text-slate-400">{c.items_synced} items</span>
                  <span className="ml-auto flex items-center gap-1 text-emerald-600 text-[9px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {c.last_sync ? `synced ${new Date(c.last_sync).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'live'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
        </div>
      </main>
    </AppShell>
  )
}

const Card = ({ title, sub, wide, children }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${wide ? 'lg:col-span-2' : ''}`}>
    <div className="flex items-baseline justify-between mb-3">
      <div className="text-[13px] font-semibold text-ink">{title}</div>
      <div className="text-[9px] text-slate-400">{sub}</div>
    </div>
    {children}
  </div>
)
