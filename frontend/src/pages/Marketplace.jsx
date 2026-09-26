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
// • Agents + Templates come from the backend catalog (GET /templates) and
//   install for real (POST /templates/{id}/install → the agent factory).
// • MCP servers: bring your own server URL — saved to settings.mcp_servers.
const MCP_SUGGESTIONS = [
  { id: 'google-sheets', name: 'Google Sheets', icon: 'sheets', desc: 'Read/write your registers as agent tools.', tag: 'data' },
  { id: 'google-drive', name: 'Google Drive', icon: 'google_drive', desc: 'Search and read Drive files as agent context.', tag: 'storage' },
  { id: 'gmail', name: 'Gmail', icon: 'gmail', desc: 'Search the inbox and draft replies.', tag: 'messaging' },
  { id: 'whatsapp', name: 'WhatsApp Business', icon: 'whatsapp', desc: 'Send and read WhatsApp Business messages.', tag: 'messaging' },
  { id: 'razorpay', name: 'Razorpay', icon: 'razorpay', desc: 'Payment links and settlement lookups.', tag: 'payments' },
  { id: 'shopify', name: 'Shopify', icon: 'shopify', desc: 'Products and orders on your storefront.', tag: 'commerce' },
  { id: 'zapier', name: 'Zapier', icon: 'zapier', desc: 'Bridge to thousands of apps via Zapier actions.', tag: 'automation' },
  { id: 'custom', name: 'Any MCP server', icon: 'mcp', desc: 'Paste the URL of any remote (HTTP/SSE) MCP server.', tag: 'custom' },
]

export default function Marketplace() {
  const [tab, setTab] = useState('templates')
  const [q, setQ] = useState('')
  const [settings, setSettings] = useState(null)
  const [templates, setTemplates] = useState([])

  const load = () => api.settings().then(setSettings).catch(() => setSettings(null))
  useEffect(() => { load(); api.templates().then(setTemplates).catch(() => setTemplates([])) }, [])

  const servers = settings?.mcp_servers || []
  const match = (x) => !q || `${x.name || x.title} ${x.desc} ${x.tag || x.category}`.toLowerCase().includes(q.toLowerCase())
  const agentTemplates = templates.filter(t => t.agent_spec && match(t))
  const promptTemplates = templates.filter(t => !t.agent_spec && match(t))

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

        {agentTemplates.length > 0 && <AgentTemplates items={agentTemplates} />}

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
          <McpServers servers={servers} onSaved={load} match={match} />
        )}
        </div>
      </main>
    </AppShell>
  )
}

// Add a real MCP server: the owner supplies the URL — nothing is invented.
function McpServers({ servers, onSaved, match }) {
  const [open, setOpen] = useState(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const has = (name) => servers.some(s => s.name === name)

  const save = async (item) => {
    const u = url.trim()
    if (!/^https?:\/\//.test(u)) { toast.push('Enter the server URL (https://…)', 'err'); return }
    setBusy(true)
    try {
      const next = [...servers, { id: `mcp-${Date.now()}`, name: item.id === 'custom' ? new URL(u).hostname : item.name, url: u, status: 'configured' }]
      const r = await api.updateSettings({ mcp_servers: next })
      if (r?.status !== 'saved') throw new Error('not saved')
      toast.push(`${item.name} added — test it from Settings → MCP`)
      setOpen(null); setUrl(''); onSaved()
    } catch (e) { toast.push(`Couldn't save — ${e.message}`, 'err') }
    setBusy(false)
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {MCP_SUGGESTIONS.filter(match).map(item => {
        const added = item.id !== 'custom' && has(item.name)
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
                  {added ? <><Check size={11} /> Added</> : <><Link2 size={11} /> Add</>}
                </button>
              </Can>
            </div>
            {open === item.id && (
              <form onSubmit={e => { e.preventDefault(); save(item) }} className="mt-3 flex gap-2">
                <input autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-server/mcp"
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

// Ready-made agents from the backend catalog — "Hire" really creates the agent
// via the factory; templates without a ready toolset hand off to Nirmata.
function AgentTemplates({ items }) {
  const [busy, setBusy] = useState('')
  const [done, setDone] = useState(new Set())
  const hire = async (t) => {
    setBusy(t.id)
    try {
      const r = await api.installTemplate(t.id)
      if (r.status === 'needs_factory') {
        localStorage.setItem('prefill_prompt', r.prompt || t.prompt)
        location.hash = '#/app'
        return
      }
      setDone(d => new Set(d).add(t.id))
      toast.push(`${t.agent_spec.name} joined your team`)
    } catch (e) { toast.push(`Couldn't hire — ${e.message}`, 'err') }
    setBusy('')
  }
  return (
    <div className="mb-7">
      <div className="text-[11px] font-semibold text-slate-500 mb-2.5 flex items-center gap-1.5">
        <Sparkles size={11} className="text-accent" /> Ready-made agents
        <span className="text-slate-300 font-normal">— hired by the agent factory with a fixed, policy-checked toolset</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map(t => (
          <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-float transition">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/15 to-magenta/10 border border-slate-100 grid place-items-center text-accent font-bold text-[15px]">
                  {t.agent_spec.name[0]}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-ink">{t.agent_spec.name}</div>
                  <div className="text-[10px] text-slate-400">{t.title}</div>
                </div>
              </div>
              <span className="text-[9px] font-medium text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{t.category}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2.5 leading-snug">{t.agent_spec.goal || t.desc}</p>
            {t.agent_spec.tools?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {t.agent_spec.tools.map(s => (
                  <span key={s} className="text-[9px] font-mono rounded-full border border-accent/20 bg-accent/5 text-accent px-2 py-0.5">{s}</span>
                ))}
              </div>
            )}
            <Can perm="hire" reason="Your role can't hire agents">
              <button onClick={() => hire(t)} disabled={busy === t.id || done.has(t.id)}
                className="mt-3 w-full rounded-lg bg-ink text-white text-[11px] font-medium py-2 flex items-center justify-center gap-1.5 hover:bg-ink/85 transition disabled:opacity-60">
                {done.has(t.id) ? <><Check size={11} /> Hired</>
                  : busy === t.id ? <Loader2 size={11} className="animate-spin" />
                  : <><Download size={11} className="rotate-180" /> {t.agent_spec.tools?.length ? 'Hire this agent' : 'Hire with Nirmata'}</>}
              </button>
            </Can>
          </div>
        ))}
      </div>
    </div>
  )
}
