// Artifacts gallery — every shareable mini-page agents have created.
import { useEffect, useState } from 'react'
import { api, TENANT } from '../api.js'
import { AgentAvatar } from '../lib/avatar.jsx'
import { FileText, ExternalLink, Copy, MapPin, Receipt, Store, IndianRupee } from 'lucide-react'
import { AppShell } from '../components/AppShell.jsx'
import { toast } from '../lib/toast.js'

const TEMPLATE_META = {
  tracking_page: { label: 'Live tracking', icon: MapPin, tint: 'text-emerald-600 bg-emerald-50' },
  invoice_summary: { label: 'Invoice summary', icon: Receipt, tint: 'text-accent bg-accent/10' },
  supplier_compare: { label: 'Supplier compare', icon: Store, tint: 'text-violet-600 bg-violet-50' },
  payment_card: { label: 'Payment request', icon: IndianRupee, tint: 'text-amber-600 bg-amber-50' },
}

export default function Artifacts() {
  const [items, setItems] = useState([])
  useEffect(() => { api.artifacts().then(setItems).catch(() => setItems([])) }, [])

  const copy = (e, path) => {
    e.preventDefault()
    navigator.clipboard?.writeText(`${location.origin}${location.pathname}#${path}`).catch(() => {})
    toast.push('Share link copied')
  }

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">Shareable pages your agents made</h1>
          <p className="text-[12px] text-slate-500 mt-1">
            Ask any agent to "create a tracking page" or "summarize this invoice" — it lands here,
            shareable with a link. No login needed on the other side.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {items.map(a => {
            const meta = TEMPLATE_META[a.template] || { label: a.template || 'Artifact', icon: FileText, tint: 'text-slate-500 bg-slate-50' }
            return (
              <a key={a.id} href={`#${a.share_path}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-ink/30 hover:shadow-float transition group">
                <div className="flex items-start justify-between gap-2">
                  <span className={`w-9 h-9 rounded-xl grid place-items-center ${meta.tint}`}><meta.icon size={16} /></span>
                  <span className="text-[9px] font-medium text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{meta.label}</span>
                </div>
                <div className="text-[13px] font-semibold text-ink mt-2.5 group-hover:text-accent transition truncate">{a.title}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                  <AgentAvatar seed={a.created_by} size={12} className="rounded" />
                  <span>by {a.created_by}</span>
                  <span>·</span>
                  <span>{new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[10px] text-accent flex items-center gap-1"><ExternalLink size={10} /> Open</span>
                  <button onClick={e => copy(e, a.share_path)}
                    className="ml-auto text-[10px] text-slate-400 hover:text-ink flex items-center gap-1 transition">
                    <Copy size={10} /> Copy link
                  </button>
                </div>
              </a>
            )
          })}
        </div>
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
            <FileText size={20} className="mx-auto text-slate-300 mb-2" />
            <div className="text-[13px] text-slate-500">No artifacts yet</div>
            <div className="text-[11px] text-slate-400 mt-1">Ask an agent to create one — try "make a tracking page for ORD-1042".</div>
          </div>
        )}
        </div>
      </main>
    </AppShell>
  )
}
