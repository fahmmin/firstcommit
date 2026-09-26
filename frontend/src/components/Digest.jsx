// Morning digest — "here's what needs you" card shown on a fresh chat.
// Source of truth = backend GET /dashboard/summary `brief[]` (tenant-scoped, only
// emits an item when the data actually exists). Each row is a one-tap CTA.
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Sunrise, FileWarning, Truck, ShieldCheck, ArrowRight, Bell } from 'lucide-react'

const KIND = {
  overdue:  { icon: FileWarning, tint: 'text-rose-500 bg-rose-50',
              prompt: 'Show my overdue invoices and draft a reminder for the oldest one.' },
  approval: { icon: ShieldCheck, tint: 'text-amber-600 bg-amber-50', openApprovals: true },
  agent_action: { icon: ShieldCheck, tint: 'text-violet-600 bg-violet-50', href: '#/approvals' },
  shipment: { icon: Truck, tint: 'text-emerald-600 bg-emerald-50',
              prompt: 'Which orders are in transit right now and when will they reach?' },
}

export function Digest({ onAction, owner }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    api.dashboard().then(d => {
      setItems((d?.brief || []).slice(0, 3).map(b => ({
        ...(KIND[b.kind] || { icon: Bell, tint: 'text-slate-500 bg-slate-50' }),
        title: b.title, sub: b.detail,
      })))
    }).catch(() => setItems([]))  // no fabricated fallback — an empty day stays empty
  }, [])

  if (!items?.length) return null
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const who = (owner || '').trim().split(/\s+/)[0]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-float">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 grid place-items-center"><Sunrise size={14} /></span>
        <div>
          <div className="text-[13px] font-semibold text-ink">{greet}{who ? `, ${who}` : ''} — {items.length} thing{items.length > 1 ? 's' : ''} need you</div>
          <div className="text-[10px] text-slate-400">overnight scan by your agents</div>
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <button key={i} onClick={() => it.href ? (location.hash = it.href) : it.openApprovals ? onAction?.('approvals') : onAction?.(it.prompt)}
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
