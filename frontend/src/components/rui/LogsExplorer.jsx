// ReverseUI "logs-explorer" recreation — a dark terminal stream of
// timestamped entries, color-coded by level, animating in real time.
// Fed ONLY from the real activity log (GET /logs, polled) — no synthesized lines.
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../api.js'

const LEVEL_STYLE = {
  INFO: 'text-sky-400 bg-sky-400/10',
  TOOL: 'text-emerald-400 bg-emerald-400/10',
  APPROVE: 'text-amber-400 bg-amber-400/10',
  MCP: 'text-violet-400 bg-violet-400/10',
  WARN: 'text-rose-400 bg-rose-400/10',
  SYNC: 'text-accent-2 bg-accent-2/10',
}

const ts = (d = new Date()) =>
  `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })} ${d.toTimeString().slice(0, 8)}`

// activity row kind → stream level
const LEVEL_OF = (kind = '') =>
  /approv|reminder|pending/.test(kind) ? 'APPROVE'
  : /sync|connector/.test(kind) ? 'SYNC'
  : /mcp/.test(kind) ? 'MCP'
  : /fail|error|warn|overdue/.test(kind) ? 'WARN'
  : /task|tool|agent|hire|spec|invoice|artifact|memory|context|onboard/.test(kind) ? 'TOOL'
  : 'INFO'

// agent_run rows carry telemetry (tracing.record_run) — show it, it's real
const detail = (a) => a.kind === 'agent_run'
  ? `${a.agent || 'agent'} · ${(a.tools || []).join(', ') || 'no tools'} · ${a.total_tokens ?? 0} tok · $${(a.cost_usd ?? 0).toFixed(4)} · ${a.latency_ms ?? 0}ms`
  : (a.text || a.kind)

const toRow = (a) => ({
  id: a.id, level: LEVEL_OF(a.kind), text: detail(a),
  t: ts(a.ts ? new Date(a.ts) : new Date()), iso: a.ts || '',
})

// Real stream only: polls GET /logs (activity audit rows) and prepends anything
// new. No synthesized lines — if nothing happens, nothing scrolls. The dot is
// green only while the last poll succeeded.
export function LogsExplorer({ maxRows = 60, className = '', pollMs = 4000 }) {
  const [rows, setRows] = useState([])
  const [live, setLive] = useState(null) // null = connecting, true = ok, false = paused
  const newest = useRef('')
  const seen = useRef(new Set())
  const boxRef = useRef(null)

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const fresh = await api.logs(maxRows, newest.current)
        if (!alive) return
        setLive(true)
        const add = fresh.filter(a => a.id && !seen.current.has(a.id))
        if (!add.length) return
        add.forEach(a => seen.current.add(a.id))
        const top = add.reduce((m, a) => (a.ts > m ? a.ts : m), newest.current)
        newest.current = top
        setRows(r => [...add.map(toRow), ...r].slice(0, maxRows))
      } catch { if (alive) setLive(false) }
    }
    poll()
    const t = setInterval(poll, pollMs)
    return () => { alive = false; clearInterval(t) }
  }, [maxRows, pollMs])

  const dot = live ? 'bg-emerald-400 animate-pulse' : live === false ? 'bg-slate-500' : 'bg-amber-400'
  const label = live ? 'live' : live === false ? 'paused — backend unreachable' : 'connecting'

  return (
    <div ref={boxRef} className={`rounded-xl bg-[#121110] border border-white/5 overflow-hidden font-mono ${className}`}>
      <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-white/5">
        <span className="w-2 h-2 rounded-full bg-[#f96a5f]" /><span className="w-2 h-2 rounded-full bg-[#fcbd2e]" /><span className="w-2 h-2 rounded-full bg-[#33c648]" />
        <span className="ml-2 text-[10px] text-white/40">sahayak — agent activity stream</span>
        <span className="ml-auto text-[9px] text-white/30">{label}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      </div>
      <div className="max-h-[340px] overflow-y-auto scroll-thin px-3.5 py-2">
        {rows.length === 0 && (
          <div className="py-6 text-center text-[11px] text-white/30">
            {live === false ? 'Backend unreachable — no activity to show.' : 'No activity yet — chat with an agent and its runs appear here.'}
          </div>
        )}
        <AnimatePresence initial={false}>
          {rows.map(r => (
            <motion.div key={r.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-baseline gap-2.5 py-[3px] border-b border-white/[0.04] last:border-0">
              <span className="text-[10px] text-white/30 tabular-nums shrink-0">{r.t}</span>
              <span className={`text-[9px] font-semibold px-1.5 py-px rounded shrink-0 ${LEVEL_STYLE[r.level] || LEVEL_STYLE.INFO}`}>[{r.level}]</span>
              <span className="text-[11px] text-white/70 truncate" title={r.text}>{r.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
