import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { BrandIcon } from '../components/BrandIcon.jsx'
import { toast } from '../lib/toast.js'
import { AppShell } from '../components/AppShell.jsx'
import { Can } from '../components/rui/Can.jsx'
import {
  Server, Braces, Download, Check, Search, Sparkles, Loader2, Link2,
} from 'lucide-react'

// Honest marketplace: no install counts, no invented URLs.
// • Agents come from the role registry (GET /roles) and hire for real
//   (POST /agents/batch); prompt templates from GET /templates.
// • MCP servers: curated catalogue from GET /marketplace (no URLs we can't vouch
//   for) — the owner pastes their provider's URL; Add saves + runs a real handshake.

export default function Marketplace() {
  const [tab, setTab] = useState('templates')
  const [q, setQ] = useState('')
  const [settings, setSettings] = useState(null)
  const [templates, setTemplates] = useState([])
  const [roles, setRoles] = useState([])
  const [mcpCatalog, setMcpCatalog] = useState([])
  const [hiredRoles, setHiredRoles] = useState(new Set())

  const load = () => api.settings().then(setSettings).catch(() => setSettings(null))
  const loadRoster = () => api.agents().then(as => setHiredRoles(new Set(as.map(a => a.role_id).filter(Boolean)))).catch(() => {})
  useEffect(() => {
    load(); loadRoster()
    api.templates().then(setTemplates).catch(() => setTemplates([]))
    api.roles().then(setRoles).catch(() => setRoles([]))
    api.marketplace().then(m => setMcpCatalog(m.mcp || [])).catch(() => setMcpCatalog([]))
  }, [])

  const servers = settings?.mcp_servers || []
  const match = (x) => !q || `${x.name || x.title} ${x.desc} ${x.tag || x.category}`.toLowerCase().includes(q.toLowerCase())
  const promptTemplates = templates.filter(t => !t.agent_spec && match(t))
  const roleRows = roles.filter(r => match({ name: r.name, desc: r.description, tag: r.category }))

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Extend your agents</h1>
            <p className="text-[12px] text-slate-500 mt-1">Hire ready-made agents, run proven templates, or plug in your own MCP servers.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 w-64 focus-within:border-ink transition">
            <Search size={13} className="text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
              className="flex-1 text-[12px] focus:outline-none bg-transparent" />
          </div>
        </div>

        {roleRows.length > 0 && <RoleCatalog roles={roleRows} hiredRoles={hiredRoles} onHired={loadRoster} />}

        <div className="flex gap-1 mb-5 rounded-xl border border-slate-200 bg-white p-1 w-fit">
          {[['templates', 'Templates', Braces], ['mcp', 'MCP servers', Server]].map(([k, l, I]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium transition
                ${tab === k ? 'bg-ink text-white' : 'text-slate-500 hover:text-ink'}`}>
              <I size={12} /> {l}
            </button>
          ))}
        </div>

        {tab === 'templates' ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {promptTemplates.map(t => (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3 hover:shadow-float transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink">{t.title}</span>
                    <span className="text-[9px] font-medium text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{t.category}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">{t.desc}</p>
                  <div className="text-[10px] text-slate-400 mt-2">runs on <span className="font-mono">{t.runs_on}</span></div>
                </div>
                <a href="#/app" onClick={() => localStorage.setItem('prefill_prompt', t.prompt)}
                  className="text-[11px] font-medium rounded-lg px-3 py-1.5 shrink-0 bg-ink text-white hover:bg-ink/85 transition">
                  Use
                </a>
              </div>
            ))}
            {!promptTemplates.length && <p className="text-[12px] text-slate-400">No templates match.</p>}
          </div>
        ) : (
          <McpServers catalog={mcpCatalog} servers={servers} onSaved={load} match={match} />
        )}
        </div>
      </main>
    </AppShell>
  )
}

// Add a real MCP server: the owner supplies the URL — nothing is invented.
function McpServers({ catalog, servers, onSaved, match }) {
  const [open, setOpen] = useState(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const has = (name) => servers.find(s => s.name === name)

  const save = async (item) => {
    const u = url.trim()
    if (!/^https?:\/\//.test(u)) { toast.push('Enter the server URL (https://…)', 'err'); return }
    setBusy(true)
    try {
      const id = `mcp-${Date.now().toString(36)}`
      const name = item.id === 'custom' ? new URL(u).hostname : item.name
      await api.updateSettings({ mcp_servers: [...servers, { id, name, url: u }] })
      // real handshake right away — the card shows the server's actual answer
      const t = await api.testMcp(id)
      toast.push(t.status === 'connected' ? `${name}: connected — ${t.tools.length} tools` : `${name} saved, but the handshake failed: ${t.error}`,
        t.status === 'connected' ? 'ok' : 'err')
      setOpen(null); setUrl(''); onSaved()
    } catch (e) { if (e.status !== 403) toast.push(`Couldn't save — ${e.message}`, 'err') }
    setBusy(false)
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {catalog.filter(x => match({ name: x.name, desc: x.desc, tag: x.category })).map(item => {
        const added = item.id !== 'custom' && has(item.name)
        item = { ...item, tag: item.category }
        return (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-float transition">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                <BrandIcon id={item.icon} size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">{item.name}</span>
                  <span className="text-[9px] font-medium text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{item.tag}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">{item.desc}</p>
              </div>
              <Can perm="mcp" reason="Only the owner can add MCP servers">
                <button onClick={() => setOpen(open === item.id ? null : item.id)} disabled={added}
                  className={`text-[11px] font-medium rounded-lg px-3 py-1.5 shrink-0 transition flex items-center gap-1
                    ${added ? 'bg-emerald-50 text-emerald-600 cursor-default' : 'bg-ink text-white hover:bg-ink/85'}`}>
                  {added ? <><Check size={11} /> {added.status === 'connected' ? `${added.tools?.length || 0} tools` : added.status || 'added'}</> : <><Link2 size={11} /> Add</>}
                </button>
              </Can>
            </div>
            {open === item.id && (
              <form onSubmit={e => { e.preventDefault(); save(item) }} className="mt-3 flex gap-2">
                <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder={item.url_hint || 'https://your-server/mcp'}
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:border-ink" />
                <button disabled={busy} className="rounded-lg bg-ink text-white text-[11px] px-3 disabled:opacity-50">
                  {busy ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
                </button>
              </form>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Hireable roles from the backend role registry (GET /roles). Pick one or
// several → "Hire team" calls POST /agents/batch, which clamps each hire to its
// role's tool ceiling + limit and rebuilds routing once.
function RoleCatalog({ roles, hiredRoles, onHired }) {
  const [pick, setPick] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const toggle = (id) => setPick(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const hire = async () => {
    setBusy(true)
    try {
      const r = await api.hireTeam([...pick].map(role_id => ({ role_id })))
      if (r.hired.length) toast.push(`${r.hired.map(h => h.name).join(', ')} joined your team`)
      if (r.errors.length) toast.push(`Couldn't hire: ${r.errors.map(e => e.role_id).join(', ')}`, 'err')
      setPick(new Set()); onHired?.()
      window.dispatchEvent(new Event('sahayak:agents-changed'))
    } catch (e) { if (e.status !== 403) toast.push(`Couldn't hire — ${e.message}`, 'err') }
    setBusy(false)
  }
  return (
    <div className="mb-7">
      <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
        <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
          <Sparkles size={11} className="text-accent" /> Hire specialists
          <span className="text-slate-300 font-normal">— each role has a fixed tool ceiling and limit, checked by policy</span>
        </div>
        <Can perm="hire" reason="Your role can't hire agents">
          <button onClick={hire} disabled={!pick.size || busy}
            className="rounded-lg bg-ink text-white text-[11px] font-medium px-3.5 py-1.5 flex items-center gap-1.5 hover:bg-ink/85 disabled:opacity-40 transition">
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} className="rotate-180" />}
            {pick.size > 1 ? `Hire team (${pick.size})` : 'Hire'}
          </button>
        </Can>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {roles.map(r => {
          const on = pick.has(r.id)
          const have = hiredRoles.has(r.id)
          return (
            <button key={r.id} type="button" onClick={() => toggle(r.id)}
              className={`text-left rounded-2xl border bg-white p-4 transition hover:shadow-float
                ${on ? 'border-ink ring-2 ring-ink/10' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/15 to-magenta/10 border border-slate-100 grid place-items-center text-accent font-bold text-[15px]">
                    {r.name[0]}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{r.name} <span className="text-[10px] font-normal text-slate-400">{r.hindi_tagline}</span></div>
                    <div className="text-[10px] text-slate-400">{r.description}</div>
                  </div>
                </div>
                <span className={`w-4 h-4 rounded border grid place-items-center shrink-0 ${on ? 'bg-ink border-ink text-white' : 'border-slate-300'}`}>
                  {on && <Check size={10} />}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2.5">
                {r.default_tools.map(t => (
                  <span key={t} className="text-[9px] font-mono rounded-full border border-accent/20 bg-accent/5 text-accent px-2 py-0.5">{t}</span>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 text-[9px] text-slate-400">
                <span>max {r.tool_limit} tools</span><span>·</span><span>{r.max_action.replace('_', ' ')}</span>
                {have && <span className="ml-auto text-emerald-600 font-medium">on your team</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
