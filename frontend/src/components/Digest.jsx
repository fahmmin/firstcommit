// Morning digest — "here's what needs you" card shown on a fresh chat.
// Computed from live alerts + invoices + cashflow; each row is a one-tap CTA
// that sends the matching prompt into the composer flow.
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Sunrise, FileWarning, Landmark, Truck, ShieldCheck, ArrowRight } from 'lucide-react'

export function Digest({ onAction }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    Promise.all([
      api.alerts().catch(() => []), api.invoices().catch(() => []), api.cashflow?.().catch(() => null) ?? Promise.resolve(null),
    ]).then(([alerts, invoices]) => {
      const pending = alerts.filter(a => a.status === 'pending_approval')
      const overdue = invoices.filter(i => i.status === 'overdue' || (i.days_overdue || 0) > 0)
      const dueSoon = invoices.filter(i => i.status === 'pending' || i.status === 'due')
      const out = []
      if (overdue.length) out.push({
        icon: FileWarning, tint: 'text-rose-500 bg-rose-50',
        title: `${overdue.length} invoice${overdue.length > 1 ? 's' : ''} overdue`,
        sub: `₹${overdue.reduce((s, i) => s + Number(i.amount || 0), 0).toLocaleString('en-IN')} locked`,
        prompt: 'Show my overdue invoices and draft a reminder for the oldest one.',
      })
      if (pending.length) out.push({
        icon: ShieldCheck, tint: 'text-amber-600 bg-amber-50',
        title: `${pending.length} action${pending.length > 1 ? 's' : ''} waiting for your approval`,
        sub: 'drafted overnight — nothing sent yet',
        prompt: null, openApprovals: true,
      })
      if (dueSoon.length) out.push({
        icon: Landmark, tint: 'text-accent bg-accent/10',
        title: `₹${dueSoon.reduce((s, i) => s + Number(i.amount || 0), 0).toLocaleString('en-IN')} coming due`,
        sub: `${dueSoon.length} open invoice${dueSoon.length > 1 ? 's' : ''} in the next days`,
        prompt: 'Show my cash flow for the next 30 days and warn me where money gets tight.',
      })
      out.push({
        icon: Truck, tint: 'text-emerald-600 bg-emerald-50',
        title: 'Shipments on the move',
        sub: 'carriers + ETAs on one screen',
        prompt: 'Which orders are in transit right now and when will they reach?',
      })
      setItems(out.slice(0, 3))
    })
  }, [])

  if (!items?.length) return null
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-float">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 grid place-items-center"><Sunrise size={14} /></span>
        <div>
          <div className="text-[13px] font-semibold text-ink">{greet}, Ramesh — {items.length} thing{items.length > 1 ? 's' : ''} need you</div>
          <div className="text-[10px] text-slate-400">overnight scan by your agents</div>
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <button key={i} onClick={() => it.openApprovals ? onAction?.('approvals') : onAction?.(it.prompt)}
            className="w-full flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-left hover:border-slate-300 hover:bg-white transition group">
            <span className={`w-6 h-6 rounded-lg grid place-items-center shrink-0 ${it.tint}`}><it.icon size={12} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11.5px] font-medium text-ink truncate">{it.title}</span>
              <span className="block text-[9.5px] text-slate-400 truncate">{it.sub}</span>
            </span>
            <ArrowRight size={12} className="text-slate-300 group-hover:text-ink group-hover:translate-x-0.5 transition shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
