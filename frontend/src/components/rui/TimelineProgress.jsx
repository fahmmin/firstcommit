// ReverseUI "timeline-progress" recreation — a vertical stack of dark pills
// connected by a growing rail; each pill carries a check circle when done and
// a live spinner on the active step. Shown while an agent reply is cooking.
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Database, Wrench, Sparkles, Check, Loader2, Globe, BookOpen } from 'lucide-react'

// This is a PENDING indicator shown while /chat is in flight — it can't know
// which tools will run, so it never names specific tools, providers, models or
// source counts. The real trace (tools used, sources, tokens) renders on the
// reply itself (SourceChips + usage) once the backend answers.
// scope: { agents: [..], tools: [..] } — only what the USER picked is named.
// mode: chat | web | deep — web/deep add the web-search hop.
export function TimelineProgress({ text, scope, mode = 'chat' }) {
  const steps = useMemo(() => {
    const agent = scope?.agents?.[0]
    const tool = scope?.tools?.[0]
    const s = [
      { icon: Brain, label: 'Reading business memory', sub: 'your notes + documents' },
      { icon: Database, label: agent ? `Asking ${agent}` : 'Routing to the right agent', sub: tool ? `limited to ${tool.replace(/_/g, ' ')}` : 'orchestrator' },
    ]
    if (mode === 'web' || mode === 'deep')
      s.push({ icon: Globe, label: 'Searching the web', sub: mode === 'deep' ? 'broader multi-source pass' : 'live results' })
    if (mode === 'deep') s.push({ icon: BookOpen, label: 'Reading sources', sub: 'ranking what matters' })
    s.push(
      { icon: Wrench, label: 'Using tools on your data', sub: 'reads run now · actions wait for approval' },
      { icon: Sparkles, label: 'Writing the answer', sub: 'with citations' },
    )
    return s
  }, [scope, mode])

  const [shown, setShown] = useState(0)
  useEffect(() => {
    setShown(0)
    const t = setInterval(() => setShown(s => Math.min(s + 1, steps.length)), 430)
    return () => clearInterval(t)
  }, [steps])

  return (
    <div className="w-fit max-w-full">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
        <Loader2 size={9} className="animate-spin" /> Working…
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
