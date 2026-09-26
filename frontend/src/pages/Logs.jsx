// Logs — agent activity stream page (logs-explorer recreation).
import { useEffect, useState } from 'react'
import { LogsExplorer } from '../components/rui/LogsExplorer.jsx'
import { AppShell } from '../components/AppShell.jsx'
import { api } from '../api.js'

export default function Logs() {
  // real telemetry from GET /metrics (tracing.record_run) — refreshes with the stream
  const [m, setM] = useState(null)
  useEffect(() => {
    const load = () => api.metrics().then(setM).catch(() => setM(null))
    load(); const t = setInterval(load, 10000); return () => clearInterval(t)
  }, [])
  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">Agent activity</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">Agent runs, tool calls, MCP handshakes, approvals and connector syncs — straight from the audit log.</p>
          </div>
          <div className="flex gap-2 text-[10px]">
            {[['bg-sky-50 text-sky-600 border-sky-100', 'INFO'], ['bg-emerald-50 text-emerald-600 border-emerald-100', 'TOOL'],
              ['bg-violet-50 text-violet-600 border-violet-100', 'MCP'], ['bg-amber-50 text-amber-600 border-amber-100', 'APPROVE'],
              ['bg-cyan-50 text-cyan-600 border-cyan-100', 'SYNC'], ['bg-rose-50 text-rose-600 border-rose-100', 'WARN']].map(([cls, l]) => (
              <span key={l} className={`px-1.5 py-0.5 rounded border font-mono font-semibold ${cls}`}>{l}</span>
            ))}
          </div>
        </div>
        {m && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[['Agent runs', m.runs.toLocaleString('en-IN')],
              ['Tokens', m.total_tokens.toLocaleString('en-IN')],
              ['Est. model cost', `$${m.est_cost_usd.toFixed(4)}`],
              ['Avg latency', `${(m.avg_latency_ms / 1000).toFixed(1)}s`]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">{k}</div>
                <div className="text-[15px] font-semibold text-ink tabular-nums">{v}</div>
              </div>
            ))}
          </div>
        )}
        <LogsExplorer maxRows={80} />
        </div>
      </main>
    </AppShell>
  )
}
