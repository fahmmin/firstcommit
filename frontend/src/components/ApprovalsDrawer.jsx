// Approvals drawer — the human-in-the-loop queue. Slide-over from the right:
// queued agent actions (approvals ledger) + drafted messages with a preview of
// exactly what the customer would receive. Full view lives at #/approvals.
import { useState } from 'react'
import { ApprovalCard } from './ApprovalCard.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api.js'
import { toast } from '../lib/toast.js'
import { Can } from './rui/Can.jsx'
import { BrandIcon } from './BrandIcon.jsx'
import { DrawCheck, RingBell } from './anim/index.jsx'
import { Bell, X, CheckCircle2, CheckCheck, Ban, ShieldCheck, Loader2 } from 'lucide-react'

export function ApprovalsDrawer({ open, onClose, alerts, actions = [], onChanged }) {
  const [approving, setApproving] = useState({})   // id -> 'busy' | 'done'
  const pending = alerts.filter(a => a.status === 'pending_approval')
  const done = alerts.filter(a => a.status === 'sent' || a.status === 'approved')
  const total = pending.length + actions.length

  const approve = async (a) => {
    setApproving(s => ({ ...s, [a.id]: 'busy' }))
    try {
      const r = await api.approveAlert(a.id)
      setApproving(s => ({ ...s, [a.id]: 'done' }))
      toast.push(`Approved — sent via ${r.via}`)
      setTimeout(() => onChanged?.(), 600)
    } catch (e) {
      setApproving(s => ({ ...s, [a.id]: undefined }))
      if (e.status !== 403) toast.push(`Couldn't send — ${e.message}`, 'err')
    }
  }
  const dismiss = async (a) => {
    try { await api.dismissAlert(a.id); toast.push('Dismissed — it will not be sent'); onChanged?.() }
    catch (e) { if (e.status !== 403) toast.push(`Couldn't dismiss — ${e.message}`, 'err') }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-ink/25" onClick={onClose} />
          <motion.div initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed right-0 top-0 bottom-0 z-[71] w-[330px] bg-white border-l border-slate-200 shadow-float-lg flex flex-col">
            <div className="flex items-center justify-between px-4 h-[52px] border-b border-slate-100">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <ShieldCheck size={14} className="text-accent" /> Approvals
                {total > 0 && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">{total} waiting</span>}
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-ink transition"><X size={15} /></button>
            </div>

            <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3">
              <a href="#/approvals" onClick={onClose} className="block text-right text-[10px] font-medium text-accent hover:text-ink">View all approvals →</a>
              <div className="text-[10px] text-slate-400 leading-snug rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                Agents draft — you approve. Nothing reaches a customer without your tap.
              </div>
              {actions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Agent actions</div>
                  {actions.slice(0, 5).map(a => <ApprovalCard key={a.id} item={a} compact onChanged={onChanged} />)}
                </div>
              )}
              {pending.length > 0 && actions.length > 0 && (
                <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 pt-1">Message drafts</div>
              )}
              {total === 0 && (
                <div className="text-center py-10">
                  <CheckCheck size={20} className="mx-auto text-emerald-400 mb-2" />
                  <div className="text-[12px] font-medium text-ink">All clear</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Nothing waiting on you.</div>
                </div>
              )}
              {pending.map(a => (
                <div key={a.id} className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2.5 flex items-center gap-2 border-b border-slate-100 bg-slate-50/60">
                    <BrandIcon id={(a.channel || a.via) === 'email' ? 'gmail' : 'whatsapp'} size={13} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-ink truncate">{a.title}</div>
                      <div className="text-[9px] text-slate-400">{a.kind} · drafted {a.agent ? `by ${a.agent}` : 'overnight'}</div>
                    </div>
                  </div>
                  {/* WhatsApp-style preview of the actual outbound message */}
                  {(a.draft || a.body) && (
                    <div className="px-3 py-2.5 bg-[#e5ddd2]">
                      <div className="bg-white rounded-lg rounded-tl-none px-2.5 py-2 shadow-sm max-w-[92%]">
                        <div className="text-[10.5px] text-slate-800 leading-snug whitespace-pre-wrap">{a.draft || a.body}</div>
                        <div className="text-right text-[8px] text-slate-400 mt-0.5 flex items-center justify-end gap-0.5">
                          {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} <CheckCheck size={9} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-1.5 px-3 py-2.5">
                    <Can perm="approve" reason="Approving outbound actions needs Manager+">
                      <button onClick={() => approve(a)} disabled={approving[a.id]}
                        className="flex-1 rounded-lg bg-ink text-white text-[11px] font-medium py-1.5 flex items-center justify-center gap-1 hover:bg-ink/85 transition disabled:opacity-70">
                        {approving[a.id] === 'busy' && <Loader2 size={11} className="animate-spin" />}
                        {approving[a.id] === 'done' && <DrawCheck size={11} />}
                        {!approving[a.id] && <CheckCircle2 size={11} />}
                        {approving[a.id] === 'done' ? 'Sent!' : 'Approve & send'}
                      </button>
                    </Can>
                    <Can perm="approve">
                    <button onClick={() => dismiss(a)}
                      className="rounded-lg border border-slate-200 text-slate-500 text-[11px] px-3 py-1.5 flex items-center gap-1 hover:text-ink hover:border-slate-300 transition">
                      <Ban size={10} /> Dismiss
                    </button>
                    </Can>
                  </div>
                </div>
              ))}
              {done.length > 0 && (
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 mt-4">Recently sent</div>
                  {done.slice(0, 4).map(a => (
                    <div key={a.id} className="flex items-center gap-2 py-1.5 text-[11px] text-slate-500">
                      <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                      <span className="truncate">{a.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Header bell — badge = pending count, swings once when a new one lands.
export function ApprovalBell({ alerts, actions = [], onClick }) {
  const n = alerts.filter(a => a.status === 'pending_approval').length + actions.length
  return (
    <button onClick={onClick} title="Pending approvals"
      className="relative w-7 h-7 rounded-lg grid place-items-center text-slate-400 hover:text-ink hover:bg-slate-100 transition">
      <RingBell ring={n > 0}><Bell size={13} /></RingBell>
      {n > 0 && <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-bold grid place-items-center animate-popIn">{n}</span>}
    </button>
  )
}
