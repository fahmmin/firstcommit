// Logs — agent activity stream page (logs-explorer recreation).
import { LogsExplorer } from '../components/rui/LogsExplorer.jsx'
import { AppShell } from '../components/AppShell.jsx'
import { ScrollText } from 'lucide-react'

export default function Logs() {
  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">Agent activity</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">Real-time stream — tool calls, MCP handshakes, approvals and connector syncs.</p>
          </div>
          <div className="flex gap-2 text-[10px]">
            {[['bg-sky-50 text-sky-600 border-sky-100', 'INFO'], ['bg-emerald-50 text-emerald-600 border-emerald-100', 'TOOL'],
              ['bg-violet-50 text-violet-600 border-violet-100', 'MCP'], ['bg-amber-50 text-amber-600 border-amber-100', 'APPROVE'],
              ['bg-cyan-50 text-cyan-600 border-cyan-100', 'SYNC'], ['bg-rose-50 text-rose-600 border-rose-100', 'WARN']].map(([cls, l]) => (
              <span key={l} className={`px-1.5 py-0.5 rounded border font-mono font-semibold ${cls}`}>{l}</span>
            ))}
          </div>
        </div>
        <LogsExplorer maxRows={80} />
        </div>
      </main>
    </AppShell>
  )
}
