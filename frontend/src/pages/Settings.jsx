import { useEffect, useRef, useState } from 'react'
import { api, TENANT } from '../api.js'
import { BrandIcon } from '../components/BrandIcon.jsx'
import { FractionalSlider } from '../components/rui/FractionalSlider.jsx'
import { CloudSync } from '../components/rui/CloudSync.jsx'
import { Can } from '../components/rui/Can.jsx'
import { AccessRings } from '../components/rui/Circles.jsx'
import { useRole, role, ROLES } from '../lib/role.js'
import { a11y } from '../lib/a11y.js'
import { toast } from '../lib/toast.js'
import { AppShell } from '../components/AppShell.jsx'
import { McpServers, ConnectAiTools } from '../components/McpSettings.jsx'
import {
  Building2, SlidersHorizontal, PlugZap, Braces, Server,
  CheckCircle2, Plus, Trash2, Brain, FileSpreadsheet, Upload, Loader2, Store, ShieldCheck,
  Sun, Moon, Accessibility, Contrast, Zap, Type, RefreshCw,
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
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [connNote, setConnNote] = useState(null)
  const [vis, setVis] = useState(() => a11y.get())
  const fileRef = useRef(null)
  const currentRole = useRole()
  const [syncing, setSyncing] = useState(false)

  const mcps = settings?.mcp_servers || []
  const disabledTools = settings?.prefs?.disabled_tools || []

  const [agentList, setAgentList] = useState([])
  const load = () => {
    api.settings().then(setSettings).catch(() => {})
    api.agents().then(setAgentList).catch(() => {})
    api.connectors().then(setConnectors).catch(() => {})
    api.memories().then(setMemories).catch(() => setMemories([]))
  }
  useEffect(load, [])

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500) }

  const patch = async (body) => {
    try {
      const r = await api.updateSettings(body)
      if (r.status === 'saved') { flash(); load() }
    } catch { load() }  // 403 → api toasts the server's reason; re-sync the form
  }

  const toggleConnector = async (c) => {
    setSyncing(true)
    try {
      if (c.status === 'connected') await api.disconnectConnector(c.id)
      else {
        const r = await api.connectConnector(c.id)
        if (r?.note) setConnNote(r.note)          // e.g. "share files to <sa-email>"
        if (r?.status === 'connected') await api.syncConnector?.(c.id).catch(() => {})
      }
    } catch (e) { setConnNote(`Couldn't reach the backend — ${e.message}`) }
    load(); setSyncing(false)
  }

  // real per-connector sync — items_synced counts come back live
  const syncNow = async () => {
    setSyncing(true)
    await Promise.all(connectors.filter(c => c.status === 'connected')
      .map(c => api.syncConnector?.(c.id).catch(() => {})))
    load(); setSyncing(false)
  }

  const toggleTool = (t) => {
    const next = disabledTools.includes(t) ? disabledTools.filter(x => x !== t) : [...disabledTools, t]
    patch({ prefs: { disabled_tools: next } })
  }


  const doImport = async (f) => {
    if (!f) return
    setImporting(true); setImportResult(null)
    try { setImportResult(await api.importExcel(f)) }
    catch (e) { setImportResult({ error: e.message }) }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* accessibility & appearance */}
        <section>
          <SectionHead icon={Accessibility} title="Accessibility & appearance"
            sub={<span className="text-[10px] text-slate-400">Built for owners of every age — applies instantly, everywhere</span>} />
          <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-50">
            {/* theme */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                {vis.theme === 'dark' ? <Moon size={14} className="text-accent" /> : <Sun size={14} className="text-accent" />}
                <div>
                  <div className="text-[13px] font-medium text-ink">Theme</div>
                  <div className="text-[10px] text-slate-400">Dark mode is easier on the eyes at night</div>
                </div>
              </div>
              <div className="flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
                {[['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([k, l, I]) => (
                  <button key={k} onClick={() => setVis(a11y.set({ theme: k }))}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition
                      ${vis.theme === k ? 'bg-ink text-white shadow-sm' : 'text-slate-500 hover:text-ink'}`}>
                    <I size={11} /> {l}
                  </button>
                ))}
              </div>
            </div>
            {/* text size */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Type size={14} className="text-accent" />
                <div>
                  <div className="text-[13px] font-medium text-ink">Text size</div>
                  <div className="text-[10px] text-slate-400">Bigger text across the whole app — for comfortable reading</div>
                </div>
              </div>
              <div className="flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
                {[['normal', 'A', '14px'], ['large', 'A+', '17px'], ['xl', 'A++', '20px']].map(([k, l, px]) => (
                  <button key={k} onClick={() => setVis(a11y.set({ font: k }))}
                    className={`rounded-full px-3.5 py-1.5 font-semibold transition
                      ${vis.font === k ? 'bg-ink text-white shadow-sm' : 'text-slate-500 hover:text-ink'}`}
                    style={{ fontSize: k === 'normal' ? 11 : k === 'large' ? 13 : 15 }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {/* high contrast */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Contrast size={14} className="text-accent" />
                <div>
                  <div className="text-[13px] font-medium text-ink">High contrast</div>
                  <div className="text-[10px] text-slate-400">Stronger text and borders — easier to read labels</div>
                </div>
              </div>
              <Toggle on={vis.contrast === 'high'} onClick={() => setVis(a11y.set({ contrast: vis.contrast === 'high' ? 'normal' : 'high' }))} />
            </div>
            {/* reduced motion */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Zap size={14} className="text-accent" />
                <div>
                  <div className="text-[13px] font-medium text-ink">Reduce motion</div>
                  <div className="text-[10px] text-slate-400">Calms animations, pulses and transitions</div>
                </div>
              </div>
              <Toggle on={vis.motion === 'reduced'} onClick={() => setVis(a11y.set({ motion: vis.motion === 'reduced' ? 'full' : 'reduced' }))} />
            </div>
          </div>
        </section>

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
              <Can perm="settings" reason="Only the owner changes approval mode">
              <select defaultValue={settings?.prefs?.approval_mode}
                onChange={e => patch({ prefs: { approval_mode: e.target.value } })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-ink bg-white">
                <option value="manual">Manual — approve everything</option>
                <option value="auto_low_risk">Auto — low-risk only</option>
              </select>
              </Can>
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
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400">last sync {connectors.find(c => c.last_sync)?.last_sync ? new Date(connectors.find(c => c.last_sync).last_sync).toLocaleTimeString() : '—'}</span>
              {connectors.some(c => c.status === 'connected') && (
                <button onClick={syncNow} disabled={syncing}
                  className="text-[11px] font-medium rounded-lg px-3 py-1.5 border border-slate-200 text-slate-600 hover:border-ink hover:text-ink transition flex items-center gap-1.5 disabled:opacity-40">
                  <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} /> Sync now
                </button>
              )}
            </div>
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
          {connNote && (
            <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] text-sky-800 flex items-start justify-between gap-3">
              <span className="break-all">{connNote}</span>
              <button onClick={() => setConnNote(null)} className="text-sky-400 shrink-0">✕</button>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {connectors.map(c => {
              const connected = c.status === 'connected'
              const soon = c.status === 'coming_soon'
              return (
                <div key={c.id} className={`rounded-2xl border bg-white p-4 flex items-start gap-3 ${soon ? 'border-slate-100 opacity-70' : 'border-slate-200'}`}>
                  <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${connected ? 'bg-emerald-50' : 'bg-slate-50'} border border-slate-100`}>
                    <BrandIcon id={c.icon || c.id} size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
                      {c.name}
                      {connected && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded px-1 py-0.5">CONNECTED</span>}
                      {soon && <span className="text-[9px] font-bold text-slate-400 bg-slate-100 rounded px-1 py-0.5">COMING SOON</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{c.description}</div>
                    {connected && c.items_synced != null &&
                      <div className="text-[10px] text-slate-400 mt-1">{c.items_synced} items synced · last {new Date(c.last_sync).toLocaleDateString()}</div>}
                  </div>
                  {!soon && (
                    <Can perm="connect" reason="Connecting sources needs Owner">
                      <button onClick={() => toggleConnector(c)}
                        className={`text-[11px] font-medium rounded-lg px-3 py-1.5 shrink-0 transition
                          ${connected ? 'border border-slate-200 text-slate-500 hover:bg-slate-50' : 'bg-ink text-white hover:bg-ink/85'}`}>
                        {connected ? 'Disconnect' : 'Connect'}
                      </button>
                    </Can>
                  )}
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
          <SectionHead icon={ShieldCheck} title="Access role" sub={<span className="text-[10px] text-slate-400">Enforced by the server on every request — signed, workspace-bound session</span>} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-6">
            <AccessRings allowed={currentRole === 'owner'} size={84} />
            <div className="flex-1">
              <div className="flex gap-2">
                {Object.entries(ROLES).map(([k, r]) => (
                  <button key={k} disabled={!role.canBecome(k)}
                    title={role.canBecome(k) ? `View the workspace as ${r.label}` : `A ${role.base()} session can't become ${r.label}`}
                    onClick={() => role.set(k).then(() => toast.push(`Now viewing as ${r.label}`)).catch(() => {})}
                    className={`rounded-xl border px-4 py-2.5 text-left transition disabled:opacity-40 disabled:cursor-not-allowed
                      ${currentRole === k ? 'border-ink bg-ink text-white' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="text-[12px] font-semibold">{r.label}</div>
                    <div className={`text-[9px] mt-0.5 ${currentRole === k ? 'text-white/60' : 'text-slate-400'}`}>{r.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                Viewer reads and chats; Manager also approves drafts and hires agents; Owner controls settings, connectors, data and MCP.
                Owners can switch down to preview a role and back — the server refuses anything above your session's ceiling.
              </p>
              <InviteTeammate />
            </div>
          </div>
        </section>

        {/* mcp servers — agents consume external MCP tools (A3) */}
        <section>
          <SectionHead icon={Server} title="MCP servers"
            right={<a href="#/marketplace" className="text-[11px] text-accent hover:text-ink flex items-center gap-1 transition"><Store size={11} /> Browse marketplace</a>} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <McpServers servers={mcps} agents={agentList} onSaved={load} />
          </div>
        </section>

        {/* Sahayak as an MCP server (A3) */}
        <section>
          <SectionHead icon={PlugZap} title="Connect your AI tools to Sahayak" />
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <ConnectAiTools />
          </div>
        </section>
        </div>
      </main>
    </AppShell>
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

const Toggle = ({ on, onClick }) => (
  <button onClick={onClick} role="switch" aria-checked={on}
    className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${on ? 'bg-accent' : 'bg-slate-200'}`}>
    <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
)

// Owner mints a teammate link — its role is baked into the signed token, so an
// invited manager/viewer can never escalate (POST /auth/invite).
function InviteTeammate() {
  const [link, setLink] = useState('')
  const [pick, setPick] = useState('manager')
  const make = async () => {
    try {
      const r = await api.invite(pick)
      setLink(`${location.origin}${location.pathname}#/join/${r.token}`)
    } catch { /* 403 toasted by api */ }
  }
  return (
    <Can perm="settings" reason="Only the owner can invite teammates">
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <select value={pick} onChange={e => setPick(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] bg-white">
          <option value="manager">Manager</option><option value="viewer">Viewer</option>
        </select>
        <button onClick={make} className="rounded-lg bg-ink text-white text-[11px] px-3 py-1.5">Create invite link</button>
        {link && (
          <button onClick={() => { navigator.clipboard?.writeText(link); toast.push('Invite link copied') }}
            className="max-w-[260px] truncate rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-mono text-slate-500 hover:text-ink"
            title={link}>{link}</button>
        )}
      </div>
    </Can>
  )
}
