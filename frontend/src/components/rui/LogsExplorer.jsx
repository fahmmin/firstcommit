// ReverseUI "logs-explorer" recreation — a dark terminal stream of
// timestamped entries, color-coded by level, animating in real time.
// Fed from real surfaces (alerts, notifications, connectors) + synthesized
// tool-call lines so the stream never runs dry.
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

const SYNTH = [
  ['TOOL', 'vasool.list_overdue() → 6 rows · 3 overdue'],
  ['INFO', 'memory injected — 4 owner notes into system prompt'],
  ['MCP', 'tally-mcp.handshake → tools/list ok (12 tools)'],
  ['TOOL', 'nirmata.create_agent(name="Logistics Agent") → drafted'],
  ['SYNC', 'whatsapp connector synced · 128 messages'],
  ['APPROVE', 'reminder INV-0026 → Sharma Traders queued for approval'],
  ['TOOL', 'khata.term_gap_analysis() → ₹58K gap flagged'],
  ['INFO', 'nova.pro inference — 1,204 tokens · grounded'],
  ['MCP', 'india-logistics-mcp.track(ORD-1042) → in_transit 62%'],
  ['SYNC', 'gmail connector synced · 212 emails parsed'],
  ['WARN', 'invoice INV-0044 crossing 90d — escalation drafted'],
  ['TOOL', 'sourcer.compare_prices("steel rods") → 3 quotes'],
  ['INFO', 'session warm — tenant ramesh_auto'],
  ['APPROVE', 'pickup booking SafeRoad → awaiting owner haan'],
]

export function LogsExplorer({ maxRows = 60, className = '' }) {
  const [rows, setRows] = useState([])
  const iRef = useRef(0)
  const boxRef = useRef(null)

  // seed from real surfaces once, then keep streaming synthesized lines
  useEffect(() => {
    let alive = true
    const seed = async () => {
      // real activity feed (GET /logs) first; alerts+notifications synth as fallback
      const rows = await api.logs?.(40).catch(() => [])
      if (rows?.length) {
        return rows.slice(0, 12).map(a => ({
          level: LEVEL_OF(a.kind), text: a.text || a.kind,
          t: ts(a.ts ? new Date(a.ts) : new Date()),
        }))
      }
      const seeded = []
      try {
        const [alerts, notifs] = await Promise.all([api.alerts().catch(() => []), api.notifications().catch(() => [])])
        alerts.forEach(a => seeded.push({ level: 'APPROVE', text: `${a.title} → ${a.status}`, t: ts() }))
        notifs.forEach(n => seeded.push({ level: 'INFO', text: n.text || n.title || 'notification', t: ts() }))
      } catch {}
      return seeded.slice(0, 5)
    }
    seed().then(s => { if (alive && s.length) setRows(r => [...s, ...r]) })

    const tick = () => {
      const [level, text] = SYNTH[iRef.current++ % SYNTH.length]
      setRows(r => [{ level, text, t: ts() }, ...r].slice(0, maxRows))
    }
    tick()
    const t = setInterval(tick, 1600)
    return () => { alive = false; clearInterval(t) }
  }, [maxRows])

  return (
    <div ref={boxRef} className={`rounded-xl bg-[#121110] border border-white/5 overflow-hidden font-mono ${className}`}>
      <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-white/5">
        <span className="w-2 h-2 rounded-full bg-[#f96a5f]" /><span className="w-2 h-2 rounded-full bg-[#fcbd2e]" /><span className="w-2 h-2 rounded-full bg-[#33c648]" />
        <span className="ml-2 text-[10px] text-white/40">sahayak — live agent stream</span>
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>
      <div className="max-h-[340px] overflow-y-auto scroll-thin px-3.5 py-2">
        <AnimatePresence initial={false}>
          {rows.map((r, i) => (
            <motion.div key={`${r.t}-${r.text}-${i}`}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-baseline gap-2.5 py-[3px] border-b border-white/[0.04] last:border-0">
              <span className="text-[10px] text-white/30 tabular-nums shrink-0">{r.t}</span>
              <span className={`text-[9px] font-semibold px-1.5 py-px rounded shrink-0 ${LEVEL_STYLE[r.level] || LEVEL_STYLE.INFO}`}>[{r.level}]</span>
              <span className="text-[11px] text-white/70 truncate">{r.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
