// One queued agent action from the approvals ledger (GET /approvals) — what it
// will do, who asked, and the owner's decision. Used by the Approvals page, the
// drawer and inline in chat (action_queued), so all three behave identically.
import { useState } from 'react'
import { api } from '../api.js'
import { toast } from '../lib/toast.js'
import { Can } from './rui/Can.jsx'
import { CheckCircle2, Ban, Loader2, ChevronDown, ExternalLink, AlertTriangle, Zap } from 'lucide-react'

export const rel = (iso) => {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const STATUS = {
  pending: 'bg-amber-50 text-amber-700', executed: 'bg-emerald-50 text-emerald-700',
  denied: 'bg-slate-100 text-slate-500', failed: 'bg-rose-50 text-rose-600',
}

export function ResultLink({ result: r }) {
  if (!r) return null
  if (r.kind === 'artifact' && r.share_path)
    return <a href={`#${r.share_path}`} className="inline-flex items-center gap-1 text-accent hover:text-ink">{r.label || 'Open page'} <ExternalLink size={9} /></a>
  if (r.kind === 'invoice') return <a href="#/app" className="text-accent hover:text-ink">Invoice {r.label} created →</a>
  if (r.kind === 'alert') return <a href="#/calendar" className="text-accent hover:text-ink">Scheduled: {r.label} →</a>
  return r.label ? <span className="text-slate-500">{r.label}</span> : null
}

export function ApprovalCard({ item, onChanged, compact = false, highlight = false }) {
  const [a, setA] = useState(item)
  const [busy, setBusy] = useState('')
  const [open, setOpen] = useState(false)
  const pending = a.status === 'pending'
  const tool = a.tool || ''

  const decide = async (kind) => {
    setBusy(kind)
    try {
      if (kind === 'approve') {
        const r = await api.approveAction(a.id)
        setA(x => ({ ...x, status: r.status, result_ref: r.result_ref, error: r.error }))
        toast.push(r.status === 'executed' ? `Done — ${a.title}` : `Approved but failed — ${r.error}`, r.status === 'executed' ? 'ok' : 'err')
      } else if (kind === 'deny') {
        await api.denyAction(a.id)
        setA(x => ({ ...x, status: 'denied' }))
        toast.push('Denied — nothing was done')
      } else if (kind === 'grant') {
        await api.grantTool(tool, true)
        const r = await api.approveAction(a.id)
        setA(x => ({ ...x, status: r.status, result_ref: r.result_ref, error: r.error }))
        toast.push(`${tool.replace(/_/g, ' ')} will auto-approve from now on`)
      }
      onChanged?.()
    } catch (e) {
      if (e.status !== 403) toast.push(`Couldn't ${kind} — ${e.message}`, 'err')  // 403 already toasted
    }
    setBusy('')
  }

  return (
    <div className={`rounded-2xl border bg-white overflow-hidden transition ${highlight ? 'border-accent ring-2 ring-accent/20' : 'border-slate-200'}`}>
      <div className="px-3.5 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-ink leading-snug">{a.title}</div>
            {a.summary && a.summary !== a.title && <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{a.summary}</div>}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[9px]">
              <span className="font-mono rounded bg-slate-100 text-slate-600 px-1.5 py-0.5">{tool}</span>
              <span className="text-slate-400">{a.agent ? `asked by ${a.agent}` : 'asked by an agent'}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400">{rel(a.created_at)}</span>
            </div>
          </div>
          <span className={`text-[9px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${STATUS[a.status] || STATUS.denied}`}>{a.status}</span>
        </div>
        {!compact && a.args && Object.keys(a.args).length > 0 && (
          <button onClick={() => setOpen(o => !o)} className="mt-2 text-[10px] text-slate-400 hover:text-ink flex items-center gap-0.5">
            <ChevronDown size={10} className={`transition ${open ? 'rotate-180' : ''}`} /> details
          </button>
        )}
        {open && (
          <pre className="mt-1.5 text-[10px] font-mono bg-slate-50 border border-slate-100 rounded-lg p-2 overflow-x-auto text-slate-600">{JSON.stringify(a.args, null, 2)}</pre>
        )}
        {a.status === 'executed' && a.result_ref && <div className="mt-2 text-[10.5px]"><ResultLink result={a.result_ref} /></div>}
        {a.status === 'failed' && <div className="mt-2 text-[10.5px] text-rose-600 flex items-center gap-1"><AlertTriangle size={10} /> {a.error}</div>}
      </div>
      {pending && (
        <Can perm="approve" fallback={<div className="px-3.5 pb-3 text-[10px] text-slate-400 italic">Needs a manager or the owner to decide</div>}>
          <div className="flex gap-1.5 px-3.5 pb-3">
            <button onClick={() => decide('approve')} disabled={!!busy}
              className="flex-1 rounded-lg bg-ink text-white text-[11px] font-medium py-1.5 flex items-center justify-center gap-1 hover:bg-ink/85 transition disabled:opacity-60">
              {busy === 'approve' ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Approve
            </button>
            <button onClick={() => decide('deny')} disabled={!!busy}
              className="rounded-lg border border-slate-200 text-slate-500 text-[11px] px-3 py-1.5 flex items-center gap-1 hover:text-ink hover:border-slate-300 transition disabled:opacity-60">
              {busy === 'deny' ? <Loader2 size={10} className="animate-spin" /> : <Ban size={10} />} Deny
            </button>
            {!compact && (
              <button onClick={() => decide('grant')} disabled={!!busy} title={`Approve this and auto-approve future ${tool} actions`}
                className="rounded-lg border border-slate-200 text-slate-500 text-[10px] px-2.5 py-1.5 flex items-center gap-1 hover:text-ink hover:border-slate-300 transition disabled:opacity-60">
                {busy === 'grant' ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />} Always allow
              </button>
            )}
          </div>
        </Can>
      )}
    </div>
  )
}
