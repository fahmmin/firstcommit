import VasoolCards from './VasoolCards.jsx'
import LogisticsCards from './LogisticsCards.jsx'
import KhataCards from './KhataCards.jsx'
import { Activity } from 'lucide-react'

/* Template registry — resolve cards by tool signature, not agent id,
   so factory-hired agents automatically inherit the right panels. */
const SIGNATURES = [
  { has: 'list_overdue', Comp: VasoolCards },
  { has: 'list_carriers', Comp: LogisticsCards },
  { has: 'term_gap_analysis', Comp: KhataCards },
]

export function AgentCards({ agent, context }) {
  const sig = SIGNATURES.find(s => agent?.tools?.includes(s.has))
  if (sig) return <sig.Comp context={context} />
  return <GenericCards context={context} />
}

function GenericCards({ context }) {
  const acts = context?.recent_actions || []
  if (!acts.length) return null
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="text-[10px] font-semibold text-slate-500 mb-2">Recent activity</div>
      {acts.slice(0, 4).map(a => (
        <div key={a.id} className="flex items-start gap-1.5 text-[11px] py-1 border-b border-slate-50 last:border-0">
          <Activity size={10} className="text-slate-300 mt-0.5 shrink-0" />
          <span className="text-slate-600 leading-snug">{a.text}</span>
        </div>
      ))}
    </div>
  )
}
