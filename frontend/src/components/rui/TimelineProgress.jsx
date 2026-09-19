// ReverseUI "timeline-progress" recreation — a vertical stack of dark pills
// connected by a growing rail; each pill carries a check circle when done and
// a live spinner on the active step. Shown while an agent reply is cooking.
// Steps are keyword-routed from the user's message (which tool / MCP / skill).
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Database, Wrench, Quote, Sparkles, Check, Loader2, Globe, ListChecks, BookOpen } from 'lucide-react'

const TOOL_ROUTES = [
  [/invoice|overdue|payment|reminder|vasool|bhej/i, { tool: 'list_overdue', via: 'tally-mcp', sources: 'invoices · reminders' }],
  [/supplier|buy|order|price|stock|moq|source/i, { tool: 'search_catalog', via: 'sheets-mcp', sources: 'suppliers · catalog' }],
  [/transport|deliver|track|shipment|carrier|logistic|pickup/i, { tool: 'list_carriers', via: 'india-logistics-mcp', sources: 'carriers · bookings' }],
  [/cash|flow|term|gap|90.?day/i, { tool: 'term_gap_analysis', via: 'khata-engine', sources: 'receivables · payables' }],
  [/hire|agent|nirmata|build|create/i, { tool: 'create_agent', via: 'agent-factory', sources: 'registry · tool map' }],
  [/search|find|where/i, { tool: 'workspace_search', via: 'enterprise-search', sources: 'all collections' }],
]
const DEFAULT_ROUTE = { tool: 'read_ledger', via: 'tally-mcp', sources: 'invoices · memory' }

// scope: { skills: [..], mcps: [..] } from the exclusion tabs — the trace
// honestly names the selected surface instead of the default route.
// mode: chat | web | deep — changes which steps appear (web adds a Perplexity
// search hop; deep expands to a multi-query research plan).
export function TimelineProgress({ text, scope, mode = 'chat' }) {
  const route = useMemo(() => {
    const r = TOOL_ROUTES.find(([re]) => re.test(text || ''))?.[1] || DEFAULT_ROUTE
    const mcp = scope?.mcps?.[0]
    const skill = scope?.skills?.[0]
    return {
      ...r,
      via: mcp ? mcp : r.via,
      sources: skill ? `${skill} · ${r.sources}` : r.sources,
    }
  }, [text, scope])

  const steps = useMemo(() => {
    if (mode === 'deep') return [
      { icon: Brain, label: 'Gathering business memory', sub: 'owner notes' },
      { icon: ListChecks, label: 'Planning research', sub: 'Perplexity Sonar' },
      { icon: Globe, label: 'Running 6 web queries', sub: 'marketplaces · GST rules' },
      { icon: BookOpen, label: 'Reading 12 sources', sub: 'citations ranked' },
      { icon: Wrench, label: `Calling ${route.tool}`, sub: `via ${route.via}` },
      { icon: Sparkles, label: 'Synthesizing report', sub: 'Nova Pro' },
    ]
    const base = [
      { icon: Brain, label: 'Gathering business memory', sub: 'owner notes' },
      { icon: Database, label: 'Fetching sources', sub: route.sources },
      { icon: Wrench, label: `Calling ${route.tool}`, sub: `via ${route.via}` },
    ]
    if (mode === 'web') base.push({ icon: Globe, label: 'Searching the web', sub: 'Perplexity' })
    base.push(
      { icon: Quote, label: 'Reading citations', sub: mode === 'web' ? 'docs · web' : 'docs · tables' },
      { icon: Sparkles, label: 'Cooking response', sub: 'Nova Pro' },
    )
    return base
  }, [route, mode])

  const [shown, setShown] = useState(0)
  useEffect(() => {
    setShown(0)
    const t = setInterval(() => setShown(s => Math.min(s + 1, steps.length)), 430)
    return () => clearInterval(t)
  }, [steps])

  return (
    <div className="w-fit max-w-full">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
        <Loader2 size={9} className="animate-spin" /> {steps.length} tasks running
      </div>
      <div className="relative pl-1">
        {/* the rail — grows as steps land */}
        <motion.span
          className="absolute left-[15px] top-2 bottom-4 w-px bg-ink/15 origin-top"
          initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.5 }}
        />
        <AnimatePresence>
          {steps.slice(0, shown).map((s, i) => {
            const done = i < shown - 1
            const active = i === shown - 1
            const I = s.icon
            return (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="relative flex items-center gap-2 mb-1.5 last:mb-0">
                <span className={`relative z-10 w-[30px] h-[30px] rounded-full grid place-items-center shrink-0 border-2 border-white shadow-sm transition-colors
                  ${done ? 'bg-emerald-500 text-white' : active ? 'bg-ink text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {done ? <Check size={12} strokeWidth={3} /> : <I size={12} className={active ? 'animate-pulse' : ''} />}
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full pl-3 pr-3.5 py-1.5 text-[11px] font-medium shadow-sm
                  ${done ? 'bg-ink text-white' : 'bg-ink text-white'}`}>
                  {s.label}
                  {s.sub && <span className={`text-[9px] font-mono ${done ? 'text-white/50' : 'text-accent-2'}`}>{s.sub}</span>}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
