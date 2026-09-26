// Approvals — the human-in-the-loop queue, full page.
// Two sources, both real:
//  • Agent actions — the durable approvals ledger (GET /approvals): side-effecting
//    tool calls agents made that wait for the owner (agents/approvals.py).
//  • Message drafts — reminders/bookings drafted as pending_approval alerts;
//    approving sends them, dismissing persists (never sent).
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { AppShell } from '../components/AppShell.jsx'
import { ApprovalCard, rel } from '../components/ApprovalCard.jsx'
import { Can } from '../components/rui/Can.jsx'
import { BrandIcon } from '../components/BrandIcon.jsx'
import { toast } from '../lib/toast.js'
import { ShieldCheck, CheckCheck, Loader2, CheckCircle2, Ban, Zap, X } from 'lucide-react'

const STATUSES = ['pending', 'executed', 'denied', 'failed']

const hashParams = () => new URLSearchParams(location.hash.split('?')[1] || '')

export default function Approvals() {
  const [tab, setTab] = useState(hashParams().get('tab') === 'drafts' ? 'drafts' : 'actions')
  const [status, setStatus] = useState('pending')
  const [ledger, setLedger] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [grants, setGrants] = useState({ grants: [], gated_tools: [] })
  const focus = hashParams().get('id')

  const load = () => {
    api.approvals().then(setLedger).catch(() => setLedger([]))
    api.alerts().then(setAlerts).catch(() => setAlerts([]))
    api.approvalGrants().then(setGrants).catch(() => {})
  }
  useEffect(() => {
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, 15000)
    return () => clearInterval(t)
  }, [])

  const counts = useMemo(() => Object.fromEntries(STATUSES.map(s => [s, (ledger || []).filter(a => a.status === s).length])), [ledger])
  const rows = (ledger || []).filter(a => a.status === status)
  const drafts = alerts.filter(a => a.status === 'pending_approval')
  const recentDrafts = alerts.filter(a => ['sent', 'dismissed'].includes(a.status)).slice(0, 6)

  const revoke = async (tool) => {
    try { await api.grantTool(tool, false); toast.push(`${tool.replace(/_/g, ' ')} asks again`); load() } catch {}
  }

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight text-ink flex items-center gap-2">
                <ShieldCheck size={20} className="text-accent" /> Approvals
              </h1>
              <p className="text-[12px] text-slate-500 mt-1">Agents read freely — anything that changes your books, schedules or reaches a customer waits for you here.</p>
            </div>
          </div>

          <div className="flex gap-1 mb-5 rounded-xl border border-slate-200 bg-white p-1 w-fit">
            {[['actions', 'Agent actions', counts.pending], ['drafts', 'Message drafts', drafts.length]].map(([k, l, n]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium transition
                  ${tab === k ? 'bg-ink text-white' : 'text-slate-500 hover:text-ink'}`}>
                {l}
                {n > 0 && <span className={`text-[9px] font-bold rounded-full px-1.5 ${tab === k ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>{n}</span>}
              </button>
            ))}
          </div>

          {tab === 'actions' ? (
            <>
              <div className="flex gap-1.5 mb-4">
                {STATUSES.map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`text-[11px] rounded-full border px-3 py-1 transition ${status === s ? 'border-ink bg-ink text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {s} <span className="opacity-60">{counts[s] || 0}</span>
                  </button>
                ))}
              </div>
              {ledger === null ? (
                <div className="py-16 grid place-items-center text-slate-400"><Loader2 size={16} className="animate-spin" /></div>
              ) : rows.length === 0 ? (
                <Empty text={status === 'pending' ? 'Nothing waiting on you.' : `No ${status} actions yet.`} />
              ) : (
                <div className="space-y-2.5">
                  {rows.map(a => <ApprovalCard key={`${a.id}-${a.status}`} item={a} onChanged={load} highlight={a.id === focus} />)}
                </div>
              )}

              <section className="mt-8">
                <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5"><Zap size={11} /> Auto-approve</div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  {grants.grants.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Every gated action asks you first. Use “Always allow” on a card to auto-approve a tool.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {grants.grants.map(t => (
                        <span key={t} className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-mono pl-2.5 pr-1 py-0.5">
                          {t}
                          <Can perm="approve"><button onClick={() => revoke(t)} title="Ask me again" className="rounded-full hover:bg-emerald-100 p-0.5"><X size={10} /></button></Can>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-3">Gated tools: {grants.gated_tools.map(t => t.replace(/_/g, ' ')).join(' · ')}</p>
                </div>
              </section>
            </>
          ) : (
            <Drafts drafts={drafts} recent={recentDrafts} onChanged={load} />
          )}
        </div>
      </main>
    </AppShell>
  )
}

function Empty({ text }) {
  return (
    <div className="text-center py-14 rounded-2xl border border-dashed border-slate-200 bg-white">
      <CheckCheck size={20} className="mx-auto text-emerald-400 mb-2" />
      <div className="text-[12px] font-medium text-ink">All clear</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{text}</div>
    </div>
  )
}

function Drafts({ drafts, recent, onChanged }) {
  const [busy, setBusy] = useState({})
  const act = async (a, kind) => {
    setBusy(b => ({ ...b, [a.id]: kind }))
    try {
      if (kind === 'send') { const r = await api.approveAlert(a.id); toast.push(`Sent via ${r.via}`) }
      else { await api.dismissAlert(a.id); toast.push('Dismissed — it will not be sent') }
      onChanged()
    } catch (e) { if (e.status !== 403) toast.push(`Couldn't ${kind} — ${e.message}`, 'err') }
    setBusy(b => ({ ...b, [a.id]: '' }))
  }
  if (!drafts.length && !recent.length) return <Empty text="No drafted messages." />
  return (
    <div className="space-y-2.5">
      {drafts.length === 0 && <Empty text="No drafts waiting." />}
      {drafts.map(a => (
        <div key={a.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-slate-100 bg-slate-50/60">
            <BrandIcon id={a.channel === 'email' ? 'gmail' : 'whatsapp'} size={13} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-ink truncate">{a.title}</div>
              <div className="text-[9px] text-slate-400">{a.kind} · to {a.to || '—'} · via {a.channel || 'email'}</div>
            </div>
          </div>
          {(a.draft || a.body) && (
            <div className="px-3.5 py-2.5 text-[11px] text-slate-700 whitespace-pre-wrap leading-snug">{a.draft || a.body}</div>
          )}
          <Can perm="approve" fallback={<div className="px-3.5 pb-3 text-[10px] text-slate-400 italic">Needs a manager or the owner to decide</div>}>
            <div className="flex gap-1.5 px-3.5 pb-3">
              <button onClick={() => act(a, 'send')} disabled={!!busy[a.id]}
                className="flex-1 rounded-lg bg-ink text-white text-[11px] font-medium py-1.5 flex items-center justify-center gap-1 hover:bg-ink/85 disabled:opacity-60">
                {busy[a.id] === 'send' ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Approve & send
              </button>
              <button onClick={() => act(a, 'dismiss')} disabled={!!busy[a.id]}
                className="rounded-lg border border-slate-200 text-slate-500 text-[11px] px-3 py-1.5 flex items-center gap-1 hover:text-ink disabled:opacity-60">
                <Ban size={10} /> Dismiss
              </button>
            </div>
          </Can>
        </div>
      ))}
      {recent.length > 0 && (
        <div className="pt-4">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Recently decided</div>
          {recent.map(a => (
            <div key={a.id} className="flex items-center gap-2 py-1.5 text-[11px] text-slate-500">
              {a.status === 'sent' ? <CheckCircle2 size={11} className="text-emerald-500 shrink-0" /> : <Ban size={11} className="text-slate-400 shrink-0" />}
              <span className="truncate flex-1">{a.title}</span>
              <span className="text-[9px] text-slate-300">{a.status} {rel(a.sent_at || a.dismissed_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
