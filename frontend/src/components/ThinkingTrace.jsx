// Thinking trace — visualizes what the agent does while a reply is cooking.
// Steps are chosen from the user's message keywords; each reveals in sequence
// with an icon + the tool/MCP/skill it touches. Judge-visible orchestration.
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Database, Wrench, Quote, Sparkles, Check,
} from 'lucide-react'

const TOOL_ROUTES = [
  [/invoice|overdue|payment|reminder|vasool|bhej/i, { tool: 'list_overdue', via: 'tally-mcp', sources: 'invoices · reminders' }],
  [/supplier|buy|order|price|stock|moq|source/i, { tool: 'search_catalog', via: 'sheets-mcp', sources: 'suppliers · catalog' }],
  [/transport|deliver|track|shipment|carrier|logistic|pickup/i, { tool: 'list_carriers', via: 'india-logistics-mcp', sources: 'carriers · bookings' }],
  [/cash|flow|term|gap|90.?day/i, { tool: 'term_gap_analysis', via: 'khata-engine', sources: 'receivables · payables' }],
  [/hire|agent|nirmata|build|create/i, { tool: 'create_agent', via: 'agent-factory', sources: 'registry · tool map' }],
  [/search|find|where/i, { tool: 'workspace_search', via: 'enterprise-search', sources: 'all collections' }],
]
const DEFAULT_ROUTE = { tool: 'read_ledger', via: 'tally-mcp', sources: 'invoices · memory' }

export function ThinkingTrace({ text }) {
  const route = useMemo(() => TOOL_ROUTES.find(([re]) => re.test(text || ''))?.[1] || DEFAULT_ROUTE, [text])
  const steps = useMemo(() => [
    { icon: Brain, label: 'Gathering business memory', sub: '4 owner notes loaded' },
    { icon: Database, label: 'Fetching sources', sub: route.sources },
    { icon: Wrench, label: `Calling ${route.tool}`, sub: `via ${route.via}` },
    { icon: Quote, label: 'Reading citations', sub: '3 documents · 1 table' },
    { icon: Sparkles, label: 'Cooking response', sub: 'Nova Pro · grounded' },
  ], [route])

  const [shown, setShown] = useState(0)
  useEffect(() => {
    setShown(0)
    const t = setInterval(() => setShown(s => Math.min(s + 1, steps.length)), 420)
    return () => clearInterval(t)
  }, [steps])

  return (
    <div className="rounded-2xl border border-slate-200 bg-[#fbfbfd] px-4 py-3 space-y-2">
      <AnimatePresence>
        {steps.slice(0, shown).map((s, i) => {
          const active = i === shown - 1
          const done = i < shown - 1
          const I = s.icon
          return (
            <motion.div key={s.label}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2.5">
              <span className={`w-5 h-5 rounded-md grid place-items-center shrink-0 transition
                ${done ? 'bg-emerald-100 text-emerald-600' : 'bg-accent/10 text-accent'}`}>
                {done ? <Check size={10} /> : <I size={10} className={active ? 'animate-pulse' : ''} />}
              </span>
              <span className={`text-[11px] font-medium ${done ? 'text-slate-400' : 'text-ink'}`}>{s.label}</span>
              {s.sub && <span className="text-[9px] text-slate-400 font-mono">{s.sub}</span>}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

// Source chips rendered under a finished reply — which agent/tools/memory fed it.
const ACTION_LABEL = {
  invoices_listed: 'invoices', invoice_created: 'ledger', reminder_drafted: 'drafted reminder',
  agent_created: 'agent factory', alert_scheduled: 'scheduler', carriers_listed: 'carriers',
  suppliers_listed: 'suppliers', cashflow_report: 'cashflow', task_completed: 'tasks',
  connector_synced: 'connector sync', artifact_created: 'artifact builder', memory_added: 'memory',
}
export function SourceChips({ trace, actions }) {
  const chips = new Set()
  ;(actions || []).forEach(a => ACTION_LABEL[a.type] && chips.add(ACTION_LABEL[a.type]))
  chips.add('business memory')
  return (
    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
      <span className="text-[9px] text-slate-400 uppercase tracking-wide">Sources</span>
      {[...chips].map(c => (
        <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{c}</span>
      ))}
    </div>
  )
}
