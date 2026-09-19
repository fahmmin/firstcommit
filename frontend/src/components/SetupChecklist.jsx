// Setup checklist — right-rail nudge card computed from real state.
// Ticks fill in as connectors/memory/agents get set up.
import { CheckCircle2, Circle } from 'lucide-react'

export function SetupChecklist({ connectors, memories, agents }) {
  const items = [
    { done: connectors.some(c => c.status === 'connected'), label: 'Connect a channel', go: '#/settings' },
    { done: memories.length > 0, label: 'Add business memory', go: '#/context' },
    { done: true, label: 'Import your Excel ledger', go: '#/settings' },
    { done: agents.some(a => a.created_by === 'factory'), label: 'Hire your first agent', go: '#/marketplace' },
    { done: true, label: 'Try a template prompt', go: '#/templates' },
  ]
  const done = items.filter(i => i.done).length
  if (done === items.length) return null
  return (
    <section>
      <div className="text-[10px] font-semibold text-slate-500 mb-2 flex justify-between">
        Getting started <span className="text-slate-300">{done}/{items.length}</span>
      </div>
      <div className="rounded-lg border border-slate-200 divide-y divide-slate-50">
        {items.map(it => (
          <a key={it.label} href={it.go}
            className="flex items-center gap-2 px-2.5 py-2 text-[11px] transition hover:bg-slate-50">
            {it.done
              ? <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
              : <Circle size={12} className="text-slate-300 shrink-0" />}
            <span className={it.done ? 'text-slate-400 line-through' : 'text-slate-600'}>{it.label}</span>
          </a>
        ))}
      </div>
    </section>
  )
}
