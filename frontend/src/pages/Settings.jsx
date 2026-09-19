import { useEffect, useRef, useState } from 'react'
import { api, TENANT } from '../api.js'
import { BrandIcon } from '../components/BrandIcon.jsx'
import { FractionalSlider } from '../components/rui/FractionalSlider.jsx'
import { CloudSync } from '../components/rui/CloudSync.jsx'
import { Can } from '../components/rui/Can.jsx'
import { AccessRings } from '../components/rui/Circles.jsx'
import { useRole, role, ROLES } from '../lib/role.js'
import {
  ArrowLeft, Building2, SlidersHorizontal, PlugZap, Braces, Server,
  CheckCircle2, Plus, Trash2, Brain, FileSpreadsheet, Upload, Loader2, Store, ShieldCheck,
} from 'lucide-react'

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
  const [memories, setMemories] = useState([])
  const [mcpName, setMcpName] = useState('')
  const [mcpUrl, setMcpUrl] = useState('')
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)
  const currentRole = useRole()
  const [syncing, setSyncing] = useState(false)

  const mcps = settings?.mcp_servers || []
  const disabledTools = settings?.prefs?.disabled_tools || []

  const load = () => {
    api.settings().then(setSettings).catch(() => {})
    api.connectors().then(setConnectors).catch(() => {})
    api.memories().then(setMemories).catch(() => setMemories([]))
  }
  useEffect(load, [])

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500) }

  const patch = async (body) => {
    const r = await api.updateSettings(body)
    if (r.status === 'saved') { flash(); load() }
  }

  const toggleConnector = async (c) => {
    setSyncing(true)
    if (c.status === 'connected') await api.disconnectConnector(c.id)
    else await api.connectConnector(c.id)
    setTimeout(() => setSyncing(false), 1400)
    load()
  }

  const toggleTool = (t) => {
    const next = disabledTools.includes(t) ? disabledTools.filter(x => x !== t) : [...disabledTools, t]
    patch({ prefs: { disabled_tools: next } })
  }

  const setMcps = (next) => patch({ mcp_servers: next })
  const addMcp = () => {
    if (!mcpName.trim() || !mcpUrl.trim()) return
    setMcps([...mcps, { id: `mcp-${Date.now()}`, name: mcpName.trim(), url: mcpUrl.trim(), status: 'configured' }])
    setMcpName(''); setMcpUrl('')
  }

  const doImport = async (f) => {
    if (!f) return
    setImporting(true); setImportResult(null)
    try { setImportResult(await api.importExcel(f)) }
    catch (e) { setImportResult({ error: e.message }) }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
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

        {/* business context — preview; full management lives on its own page */}
        <section>
          <SectionHead icon={Brain} title="Business context"
            sub={<span className="text-[10px] text-slate-400">Used by every agent in every reply</span>}
            right={<a href="#/context" className="text-[11px] text-accent hover:text-ink transition">Manage →</a>} />
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-50">
            {memories.slice(0, 3).map(m => (
              <div key={m.id} className="px-5 py-3 text-[12px] text-slate-600 flex items-center gap-2.5">
                <Brain size={12} className="text-accent shrink-0" />
                <span className="truncate">{m.text}</span>
              </div>
            ))}
            <a href="#/context" className="block px-5 py-3 text-[11px] text-accent hover:bg-slate-50 transition">
              {memories.length > 3 ? `+${memories.length - 3} more — manage all` : 'Add business context →'}
            </a>
          </div>
        </section>

        {/* preferences */}
        <section>
          <SectionHead icon={SlidersHorizontal} title="Preferences" right={saved && <span className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 size={11} /> saved</span>} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 grid sm:grid-cols-2 gap-5">
            <Field label="Reminder cadence (days)">
              <FractionalSlider min={1} max={30} step={1} major={5} unit="d"
                value={settings?.prefs?.reminder_cadence_days ?? 7}
                onChange={v => { setSettings(s => ({ ...s, prefs: { ...s.prefs, reminder_cadence_days: v } })) }}
                className="pt-1" />
              <button onClick={() => patch({ prefs: { reminder_cadence_days: settings?.prefs?.reminder_cadence_days } })}
                className="mt-2 text-[10px] font-medium text-accent hover:text-ink transition">
                Save cadence → {settings?.prefs?.reminder_cadence_days}d
              </button>
            </Field>
            <Field label="Approval mode">
              <select defaultValue={settings?.prefs?.approval_mode}
                onChange={e => patch({ prefs: { approval_mode: e.target.value } })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-ink bg-white">
                <option value="manual">Manual — approve everything</option>
                <option value="auto_low_risk">Auto — low-risk only</option>
              </select>
            </Field>
            <Field label="Language">
              <select defaultValue={settings?.prefs?.language}
                onChange={e => patch({ prefs: { language: e.target.value } })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-ink bg-white">
                <option value="hinglish">Hinglish</option><option value="english">English</option><option value="hindi">Hindi</option>
              </select>
            </Field>
            <Field label="Notification email">
              <input type="email" defaultValue={settings?.prefs?.notify_email}
                onBlur={e => patch({ prefs: { notify_email: e.target.value } })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-ink" />
            </Field>
          </div>
        </section>

        {/* connectors */}
        <section>
          <SectionHead icon={PlugZap} title="Connectors" />
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 mb-3 flex items-center justify-between">
            <CloudSync syncing={syncing}
              status={syncing ? 'Syncing sources…' : `${connectors.filter(c => c.status === 'connected').length} sources synced`} />
            <span className="text-[10px] text-slate-400">last sync {connectors.find(c => c.last_sync)?.last_sync ? new Date(connectors.find(c => c.last_sync).last_sync).toLocaleTimeString() : '—'}</span>
          </div>
          {/* Excel import — real: parses rows into the ledger */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0 bg-emerald-100 text-emerald-600">
              <FileSpreadsheet size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-ink">Excel / Tally import</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {importResult?.error
                  ? <span className="text-rose-500">Import failed — {importResult.error}</span>
                  : importResult
                    ? <span className="text-emerald-600 font-medium">{importResult.imported} rows imported to {importResult.collection}{importResult.skipped ? ` · ${importResult.skipped} skipped` : ''}</span>
                    : 'Drop your existing ledger .xlsx — rows become invoices your agents can chase'}
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => doImport(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={importing}
              className="text-[11px] font-medium rounded-lg px-3 py-1.5 shrink-0 bg-ink text-white hover:bg-ink/85 transition flex items-center gap-1.5 disabled:opacity-50">
              {importing ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} {importing ? 'Importing…' : 'Upload'}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {connectors.map(c => {
              const connected = c.status === 'connected'
              return (
                <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${connected ? 'bg-emerald-50' : 'bg-slate-50'} border border-slate-100`}>
                    <BrandIcon id={c.icon || c.id} size={17} />
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
                  <Can perm="connect" reason="Connecting sources needs Owner">
                    <button onClick={() => toggleConnector(c)}
                      className={`text-[11px] font-medium rounded-lg px-3 py-1.5 shrink-0 transition
                        ${connected ? 'border border-slate-200 text-slate-500 hover:bg-slate-50' : 'bg-ink text-white hover:bg-ink/85'}`}>
                      {connected ? 'Disconnect' : 'Connect'}
                    </button>
                  </Can>
                </div>
              )
            })}
          </div>
        </section>

        {/* skills */}
        <section>
          <SectionHead icon={Braces} title="Skills" sub={<span className="text-[10px] text-slate-400">Tool groups agents can use — click to enable/disable</span>}
            right={<a href="#/marketplace" className="text-[11px] text-accent hover:text-ink flex items-center gap-1 transition"><Store size={11} /> Browse marketplace</a>} />
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-50">
            {(settings?.prefs?.installed_skills || []).length > 0 && (
              <div className="px-5 py-3.5 flex items-center gap-4 bg-accent/5">
                <span className="text-[11px] font-semibold text-accent w-20 shrink-0">installed</span>
                <div className="flex gap-1.5 flex-wrap">
                  {settings.prefs.installed_skills.map(s => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {SKILL_GROUPS.map(g => (
              <div key={g.group} className="px-5 py-3.5 flex items-center gap-4">
                <span className="text-[11px] font-semibold text-ink w-20 shrink-0">{g.group}</span>
                <div className="flex gap-1.5 flex-wrap">
                  {g.tools.map(t => {
                    const off = disabledTools.includes(t)
                    return (
                      <button key={t} onClick={() => toggleTool(t)} title={off ? 'Disabled — click to enable' : 'Enabled — click to disable'}
                        className={`text-[10px] px-2 py-0.5 rounded-full transition
                          ${off ? 'bg-slate-50 text-slate-300 line-through border border-dashed border-slate-200' : 'bg-ink/5 text-ink border border-ink/10 hover:border-ink/30'}`}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* role / access — RBAC demo surface */}
        <section>
          <SectionHead icon={ShieldCheck} title="Access role" sub={<span className="text-[10px] text-slate-400">What this login can do — drives button permissions across the app</span>} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-6">
            <AccessRings allowed={currentRole === 'owner'} size={84} />
            <div className="flex-1">
              <div className="flex gap-2">
                {Object.entries(ROLES).map(([k, r]) => (
                  <button key={k} onClick={() => role.set(k)}
                    className={`rounded-xl border px-4 py-2.5 text-left transition
                      ${currentRole === k ? 'border-ink bg-ink text-white' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="text-[12px] font-semibold">{r.label}</div>
                    <div className={`text-[9px] mt-0.5 ${currentRole === k ? 'text-white/60' : 'text-slate-400'}`}>{r.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                Viewer sees everything but can't act; Manager can approve drafts and hire agents; Owner controls connectors, MCP and skills.
              </p>
            </div>
          </div>
        </section>

        {/* mcp servers */}
        <section>
          <SectionHead icon={Server} title="MCP servers" sub={<span className="text-[9px] font-bold text-magenta bg-magenta/10 rounded px-1.5 py-0.5">BETA</span>}
            right={<a href="#/marketplace" className="text-[11px] text-accent hover:text-ink flex items-center gap-1 transition"><Store size={11} /> Browse marketplace</a>} />
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
                <button onClick={() => setMcps(mcps.filter(x => x.id !== m.id))} className="text-slate-300 hover:text-rose-500 transition"><Trash2 size={13} /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={mcpName} onChange={e => setMcpName(e.target.value)} placeholder="Server name (e.g. tally-mcp)"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] focus:outline-none focus:border-ink" />
              <input value={mcpUrl} onChange={e => setMcpUrl(e.target.value)} placeholder="https://…/sse"
                className="flex-[1.5] rounded-lg border border-slate-200 px-3 py-2 text-[12px] focus:outline-none focus:border-ink" />
              <Can perm="mcp" reason="Adding MCP servers needs Owner">
                <button onClick={addMcp}
                  className="rounded-lg bg-ink text-white px-4 text-[12px] font-medium flex items-center gap-1 hover:bg-ink/85 transition">
                  <Plus size={12} /> Add
                </button>
              </Can>
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
