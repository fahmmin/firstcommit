// Notifications — the agents' outbound feed. Unread-first, kind-tinted,
// mark-all-read (session), action items deep-link to the approvals drawer.
import { useEffect, useState } from 'react'
import { api, TENANT } from '../api.js'
import { ArrowLeft, Bell, ShieldCheck, AlertTriangle, Info, CheckCheck, Inbox } from 'lucide-react'

const KIND_META = {
  action_required: { icon: ShieldCheck, tint: 'text-amber-600 bg-amber-50', label: 'needs you' },
  warning: { icon: AlertTriangle, tint: 'text-rose-500 bg-rose-50', label: 'warning' },
  info: { icon: Info, tint: 'text-accent bg-accent/10', label: 'info' },
}

const rel = (ts) => {
  const m = Math.max(0, (Date.now() - new Date(ts)) / 60000 | 0)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = m / 60 | 0
  if (h < 24) return `${h}h ago`
  return `${h / 24 | 0}d ago`
}

export default function Notifications() {
  const [items, setItems] = useState([])
  const [readIds, setReadIds] = useState(new Set())

  useEffect(() => { api.notifications().then(setItems).catch(() => setItems([])) }, [])

  const isRead = (n) => n.status === 'read' || readIds.has(n.id)
  const unread = items.filter(n => !isRead(n)).length
  const markAll = () => setReadIds(new Set(items.map(n => n.id)))
  const sorted = [...items].sort((a, b) => (isRead(a) ? 1 : 0) - (isRead(b) ? 1 : 0) || new Date(b.created_at) - new Date(a.created_at))

  return (
    <div className="min-h-screen bg-[#fbfbfd] font-sans">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-6 h-[52px] flex items-center justify-between">
          <a href="#/app" className="flex items-center gap-2 text-[13px] text-slate-500 hover:text-ink transition">
            <ArrowLeft size={14} /> Back to app
          </a>
          <div className="text-[13px] font-semibold text-ink flex items-center gap-2">
            Notifications
            {unread > 0 && <span className="text-[9px] font-bold bg-rose-500 text-white rounded-full px-1.5 py-0.5 animate-popIn">{unread} new</span>}
          </div>
          <button onClick={markAll} className="text-[11px] text-slate-400 hover:text-ink flex items-center gap-1 transition">
            <CheckCheck size={12} /> Mark all read
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="space-y-2">
          {sorted.map((n, i) => {
            const meta = KIND_META[n.kind] || KIND_META.info
            const read = isRead(n)
            return (
              <div key={n.id}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 transition animate-slideInRight
                  ${read ? 'border-slate-100 bg-white/60 opacity-70' : 'border-slate-200 bg-white shadow-float hover:shadow-float-lg'}`}
                style={{ animationDelay: `${i * 40}ms` }}>
                <span className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${meta.tint}`}>
                  <meta.icon size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-medium truncate ${read ? 'text-slate-500' : 'text-ink'}`}>{n.title}</span>
                    {!read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                  </div>
                  {n.body && <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{n.body}</div>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[9px] font-medium rounded px-1.5 py-px ${meta.tint}`}>{meta.label}</span>
                    <span className="text-[9px] text-slate-300">{rel(n.created_at)}</span>
                  </div>
                </div>
                {n.kind === 'action_required' && !read && (
                  <a href="#/app" className="shrink-0 text-[10px] font-medium rounded-lg bg-ink text-white px-2.5 py-1.5 hover:bg-ink/85 transition">
                    Review
                  </a>
                )}
                {!isRead(n) && (
                  <button onClick={() => setReadIds(s => new Set(s).add(n.id))} title="Mark read"
                    className="shrink-0 text-slate-300 hover:text-emerald-500 transition"><CheckCheck size={13} /></button>
                )}
              </div>
            )
          })}
          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center">
              <Inbox size={20} className="mx-auto text-slate-300 mb-2" />
              <div className="text-[13px] text-slate-500">All caught up</div>
              <div className="text-[11px] text-slate-400 mt-1">Your agents will post here when something needs you.</div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
