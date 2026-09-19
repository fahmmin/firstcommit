import { useEffect, useState } from 'react'
import { api, TENANT } from '../api.js'
import {
  ArrowLeft, Building2, SlidersHorizontal, PlugZap, Braces, Server,
  CheckCircle2, Plus, Trash2, Calendar, Table, MessageSquare, BookOpen, IndianRupee,
} from 'lucide-react'

const CONN_ICONS = { calendar: Calendar, table: Table, message: MessageSquare, ledger: BookOpen, rupee: IndianRupee }

const SKILL_GROUPS = [
  { group: 'invoices', tools: ['list_overdue', 'aging_report', 'create_invoice', 'draft_reminder'] },
  { group: 'suppliers', tools: ['search_catalog', 'check_stock', 'compare_prices', 'trust_score', 'suggest_moq_pool'] },
  { group: 'cashflow', tools: ['timeline', 'term_gap_analysis', 'order_advisor'] },
  { group: 'logistics', tools: ['list_carriers', 'quote_pickup', 'book_pickup'] },
  { group: 'comms', tools: ['send_reminder', 'schedule_alert', 'list_alerts'] },
]

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [connectors, setConnectors] = useState([])
  const [mcps, setMcps] = useState(() => JSON.parse(localStorage.getItem('mcp_servers') || '[]'))
  const [mcpName, setMcpName] = useState('')
  const [mcpUrl, setMcpUrl] = useState('')
  const [saved, setSaved] = useState(false)

  const load = () => {
    api.settings().then(setSettings).catch(() => {})
    api.connectors().then(setConnectors).catch(() => {})
  }
  useEffect(load, [])

  const patch = async (prefs) => {
    const r = await api.updateSettings({ prefs })
    if (r.status === 'saved') { setSaved(true); setTimeout(() => setSaved(false), 1500); load() }
  }

  const toggleConnector = async (c) => {
    if (c.status === 'connected') await api.disconnectConnector(c.id)
    else await api.connectConnector(c.id)
    load()
  }

  const addMcp = () => {
    if (!mcpName.trim() || !mcpUrl.trim()) return
    const next = [...mcps, { id: `mcp-${Date.now()}`, name: mcpName.trim(), url: mcpUrl.trim(), status: 'configured' }]
    setMcps(next); localStorage.setItem('mcp_servers', JSON.stringify(next))
    setMcpName(''); setMcpUrl('')
  }
  const removeMcp = (id) => {
    const next = mcps.filter(m => m.id !== id)
    setMcps(next); localStorage.setItem('mcp_servers', JSON.stringify(next))
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] font-sans">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 h-[52px] flex items-center justify-between">
          <a href="#/app" className="flex items-center gap-2 text-[13px] text-slate-500 hover:text-ink transition">
            <ArrowLeft size={14} /> Back to app
          </a>
          <div className="text-[13px] font-semibold text-ink">Settings</div>
          <span className="text-[11px] text-slate-400">{TENANT}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* business */}
        <section>
          <SectionHead icon={Building2} title="Business" />
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-50">
            {[['Business name', settings?.business?.name], ['Owner', settings?.business?.owner],
              ['City', settings?.business?.city], ['Line', settings?.business?.line]].map(([l, v]) => (
              <Row key={l} label={l} value={v} />
            ))}
          </div>
        </section>

        {/* preferences */}
        <section>
          <SectionHead icon={SlidersHorizontal} title="Preferences" right={saved && <span className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 size={11} /> saved</span>} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 grid sm:grid-cols-2 gap-5">
            <Field label="Reminder cadence (days)">
              <input type="number" min="1" max="30" defaultValue={settings?.prefs?.reminder_cadence_days}
                onBlur={e => patch({ reminder_cadence_days: +e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-ink" />
            </Field>
            <Field label="Approval mode">
              <select defaultValue={settings?.prefs?.approval_mode}
                onChange={e => patch({ approval_mode: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-ink bg-white">
                <option value="manual">Manual — approve everything</option>
                <option value="auto_low_risk">Auto — low-risk only</option>
              </select>
            </Field>
            <Field label="Language">
              <select defaultValue={settings?.prefs?.language}
                onChange={e => patch({ language: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-ink bg-white">
                <option value="hinglish">Hinglish</option><option value="english">English</option><option value="hindi">Hindi</option>
              </select>
            </Field>
            <Field label="Notification email">
              <input type="email" defaultValue={settings?.prefs?.notify_email}
                onBlur={e => patch({ notify_email: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-ink" />
            </Field>
          </div>
        </section>

        {/* connectors */}
        <section>
          <SectionHead icon={PlugZap} title="Connectors" />
          <div className="grid sm:grid-cols-2 gap-3">
            {connectors.map(c => {
              const I = CONN_ICONS[c.icon] || PlugZap
              const connected = c.status === 'connected'
              return (
                <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${connected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <I size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
                      {c.name}
                      {connected && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded px-1 py-0.5">CONNECTED</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{c.description}</div>
                    {connected && c.items_synced != null &&
                      <div className="text-[10px] text-slate-400 mt-1">{c.items_synced} items synced · last {new Date(c.last_sync).toLocaleDateString()}</div>}
                  </div>
                  <button onClick={() => toggleConnector(c)}
                    className={`text-[11px] font-medium rounded-lg px-3 py-1.5 shrink-0 transition
                      ${connected ? 'border border-slate-200 text-slate-500 hover:bg-slate-50' : 'bg-ink text-white hover:bg-ink/85'}`}>
                    {connected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* skills */}
        <section>
          <SectionHead icon={Braces} title="Skills" sub="Tool groups agents can be given — the allowlist" />
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-50">
            {SKILL_GROUPS.map(g => (
              <div key={g.group} className="px-5 py-3.5 flex items-center gap-4">
                <span className="text-[11px] font-semibold text-ink w-20 shrink-0">{g.group}</span>
                <div className="flex gap-1.5 flex-wrap">
                  {g.tools.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* mcp servers */}
        <section>
          <SectionHead icon={Server} title="MCP servers" sub={<span className="text-[9px] font-bold text-magenta bg-magenta/10 rounded px-1.5 py-0.5">BETA</span>} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <p className="text-[12px] text-slate-500 leading-relaxed">
              Plug in external MCP endpoints — agents can call their tools after owner approval.
            </p>
            {mcps.map(m => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                <Server size={13} className="text-slate-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-ink">{m.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{m.url}</div>
                </div>
                <span className="text-[9px] font-medium text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">{m.status}</span>
                <button onClick={() => removeMcp(m.id)} className="text-slate-300 hover:text-rose-500 transition"><Trash2 size={13} /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={mcpName} onChange={e => setMcpName(e.target.value)} placeholder="Server name (e.g. tally-mcp)"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] focus:outline-none focus:border-ink" />
              <input value={mcpUrl} onChange={e => setMcpUrl(e.target.value)} placeholder="https://…/sse"
                className="flex-[1.5] rounded-lg border border-slate-200 px-3 py-2 text-[12px] focus:outline-none focus:border-ink" />
              <button onClick={addMcp}
                className="rounded-lg bg-ink text-white px-4 text-[12px] font-medium flex items-center gap-1 hover:bg-ink/85 transition">
                <Plus size={12} /> Add
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

const SectionHead = ({ icon: I, title, sub, right }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <I size={14} className="text-slate-400" />
      <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      {sub}
    </div>
    {right}
  </div>
)

const Row = ({ label, value }) => (
  <div className="flex justify-between px-5 py-3 text-[13px]">
    <span className="text-slate-400">{label}</span>
    <span className="text-slate-700 font-medium">{value || '—'}</span>
  </div>
)

const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-[11px] font-medium text-slate-500 block mb-1.5">{label}</span>
    {children}
  </label>
)
