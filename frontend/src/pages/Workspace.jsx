import { useEffect, useRef, useState } from 'react'
import { api, TENANT } from '../api.js'
import { session } from '../lib/auth.js'
import { AgentAvatar } from '../lib/avatar.jsx'
import { AgentCards } from '../components/cards/index.jsx'
import { SourceChips } from '../components/ThinkingTrace.jsx'
import { TimelineProgress } from '../components/rui/TimelineProgress.jsx'
import { ExclusionTabs } from '../components/rui/ExclusionTabs.jsx'
import { VoiceOverlay } from '../components/rui/CloudWave.jsx'
import { Can } from '../components/rui/Can.jsx'
import { LinkifiedText, LinkPreviewCard, extractUrls } from '../components/rui/LinkPreview.jsx'
import { NavIndicator } from '../components/rui/NavIndicator.jsx'
import { BrandIcon } from '../components/BrandIcon.jsx'
import { TEMPLATES } from '../lib/templates.js'
import { a11y } from '../lib/a11y.js'
import {
  PlugZap, CheckCircle2, Plus, RotateCcw, ExternalLink, Activity, Settings2,
  LayoutTemplate, X, Search, FileText, LogOut, Store, Brain, Mic, CalendarDays,
  Braces, Server, ScrollText, Paperclip, Globe, MessageSquare, Telescope, ImageIcon,
  Moon, Sun,
} from 'lucide-react'
const GROUP_ORDER = [['Money', a => ['vasool', 'khata'].includes(a.id)],
                     ['Procurement', a => a.id === 'sourcer'],
                     ['Hired by AI', a => a.created_by === 'factory'],
                     ['Other', () => true]]

const SUGGESTIONS = [
  'Show my overdue invoices',
  'Draft a reminder for the pending bill',
  'Buyer gives 90 day terms, should I take the order?',
  'Mera transporter nahi aaya',
]

export default function Workspace() {
  const [messages, setMessages] = useState([
    { role: 'agent', agent: 'sahayak', text: 'Namaste! I am Sahayak — your AI back-office. Ask me about invoices, suppliers, cash flow… or tell me a problem and I will hire a specialist for it.' },
  ])
  const [agents, setAgents] = useState([])
  const [alerts, setAlerts] = useState([])
  const [connectors, setConnectors] = useState([])
  const [settings, setSettings] = useState(null)
  const [context, setContext] = useState(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastSent, setLastSent] = useState('')
  const [activeAgent, setActiveAgent] = useState(null)
  const [tab, setTab] = useState('agent')
  const [showTemplates, setShowTemplates] = useState(false)
  const [voice, setVoice] = useState(false)
  // exclusion tabs — which capability surface the next message should use
  const [scopeTab, setScopeTab] = useState('all')
  const [scope, setScope] = useState({ skills: [], mcps: [] })
  const [mode, setMode] = useState('chat')           // chat | web | deep
  const [files, setFiles] = useState([])             // composer attachments
  const attachRef = useRef(null)
  const [dark, setDark] = useState(() => a11y.get().theme === 'dark')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const msgRefs = useRef([])
  const scrollRef = useRef(null)
  const [activeMsg, setActiveMsg] = useState(0)

  const onChatScroll = (e) => {
    const mid = e.currentTarget.scrollTop + e.currentTarget.clientHeight / 2
    let best = 0
    msgRefs.current.forEach((el, i) => { if (el && el.offsetTop <= mid) best = i })
    setActiveMsg(best)
  }

  // fall back to seeded surfaces so the scope tabs are explorable before installs
  const installedSkills = settings?.prefs?.installed_skills?.length
    ? settings.prefs.installed_skills : ['gst-reconcile', 'hindi-voice-notes', 'upi-payment-links']
  const mcpServers = settings?.mcp_servers?.length
    ? settings.mcp_servers : [{ id: 'd-tally', name: 'tally-mcp' }, { id: 'd-wa', name: 'whatsapp-mcp' }, { id: 'd-log', name: 'india-logistics-mcp' }]
  const scopeTabs = [
    { id: 'all', label: 'Everything' },
    { id: 'skills', label: 'Skills', icon: <Braces size={10} />, count: installedSkills.length },
    { id: 'mcp', label: 'MCP', icon: <Server size={10} />, count: mcpServers.length },
  ]
  const toggleScopeItem = (kind, id) => setScope(s => ({
    ...s,
    [kind]: s[kind].includes(id) ? s[kind].filter(x => x !== id) : [...s[kind], id],
  }))

  const pickTemplate = (t) => {
    setInput(t.prompt)
    setShowTemplates(false)
    inputRef.current?.focus()
  }

  const active = agents.find(a => a.id === activeAgent)

  const refresh = async () => {
    const [ag, al, cn, st] = await Promise.all([
      api.agents(), api.alerts(), api.connectors().catch(() => []), api.settings().catch(() => null),
    ])
    setAgents(ag); setAlerts(al); setConnectors(cn); setSettings(st)
  }
  useEffect(() => {
    refresh().catch(console.error)
    const pre = localStorage.getItem('prefill_prompt')
    if (pre) { localStorage.removeItem('prefill_prompt'); setInput(pre); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [])
  useEffect(() => {
    if (!activeAgent) { setContext(null); return }
    api.agentContext(activeAgent).then(setContext).catch(() => setContext(null))
  }, [activeAgent])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text) => {
    const msg = (text || input).trim()
    if ((!msg && !files.length) || busy) return
    const sentMode = mode
    const atts = files.map(f => ({
      name: f.name, kind: f.type.startsWith('image/') ? 'image' : 'file',
      url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }))
    setInput(''); setFiles([])
    setLastSent(msg || `📎 ${atts.map(a => a.name).join(', ')}`)
    setMessages(m => [...m, { role: 'user', text: msg, attachments: atts }])
    setBusy(true)
    try {
      // attachments first — invoice photos go through the real parse pipeline
      for (const f of files) {
        if (/invoice|bill|\.pdf|image/i.test(f.name + f.type)) {
          try {
            const r = await api.upload(f)
            const inv = r.parsed || r.invoice || {}
            setMessages(m => [...m, {
              role: 'agent', agent: 'vasool', tagline: 'receivables',
              text: `Scanned **${f.name}** → ${inv.invoice_no || 'invoice'} · ${inv.buyer || 'buyer'} · ₹${Number(inv.amount || 0).toLocaleString('en-IN')} — added to your ledger.`,
            }])
          } catch {
            setMessages(m => [...m, { role: 'agent', agent: 'sahayak', text: `Received ${f.name} — indexing it into business context.` }])
          }
        }
      }
      const r = await api.chat(msg || 'What did you just receive?', activeAgent, sentMode)
      setMessages(m => [...m, {
        role: 'agent', agent: r.agent_name, tagline: r.agent_tagline,
        text: r.reply, trace: r.trace, actions: r.actions, mode: sentMode,
      }])
      if (r.actions?.some(a => a.type === 'agent_created' || a.type === 'reminder_drafted')) refresh()
      if (r.agent_name === 'nirmata') setActiveAgent(null)
    } catch (e) {
      setMessages(m => [...m, { role: 'agent', agent: 'system', text: `Error: ${e.message} — is the backend running on :8000?` }])
    } finally {
      setBusy(false)
    }
  }

  const approve = async (id) => { await api.approveAlert(id); refresh() }

  const groups = GROUP_ORDER.map(([label, match]) => [label, agents.filter(match)]).filter(([, l]) => l.length)

  return (
    <div className="h-screen flex bg-white font-sans">
      {/* ── left sidebar ── */}
      <aside className="w-[190px] shrink-0 border-r border-slate-100 bg-[#fbfbfd] flex flex-col">
        <a href="#/" className="flex items-center gap-2 px-4 h-[52px] border-b border-slate-100">
          <span className="w-6 h-6 rounded-lg bg-ink text-white grid place-items-center text-[10px] font-bold">स</span>
          <span className="font-semibold text-[14px] tracking-tight text-ink">Sahayak</span>
        </a>
        <div className="p-3">
          <button onClick={() => { setActiveAgent(null); setMessages(m => m.slice(0, 1)) }}
            className="w-full text-[12px] font-medium border border-slate-200 bg-white rounded-lg py-2 text-slate-600 hover:border-slate-300 transition flex items-center justify-center gap-1.5">
            <Plus size={12} /> New Chat
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto scroll-thin px-3 pb-3 space-y-4">
          {groups.map(([label, items]) => (
            <div key={label}>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1">{label}</div>
              {items.map(a => (
                <button key={a.id} onClick={() => setActiveAgent(activeAgent === a.id ? null : a.id)}
                  className={`w-full text-left text-[12px] rounded-lg px-2 py-1.5 mb-0.5 flex items-center gap-2 transition
                    ${activeAgent === a.id ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <AgentAvatar seed={a.id} size={18} className="rounded" />
                  <span className="truncate">{a.name}</span>
                  {a.created_by === 'factory' && activeAgent !== a.id &&
                    <span className="ml-auto text-[8px] font-bold text-magenta">AI</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-1">
          <div className="text-[10px] text-slate-400 px-1">{TENANT}</div>
          <a href="#/templates"
            className="w-full text-[11px] text-slate-500 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition flex items-center gap-1.5">
            <LayoutTemplate size={11} /> Templates
          </a>
          <a href="#/calendar"
            className="w-full text-[11px] text-slate-500 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition flex items-center gap-1.5">
            <CalendarDays size={11} /> Calendar
          </a>
          <a href="#/logs"
            className="w-full text-[11px] text-slate-500 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition flex items-center gap-1.5">
            <ScrollText size={11} /> Logs
          </a>
          <a href="#/context"
            className="w-full text-[11px] text-slate-500 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition flex items-center gap-1.5">
            <Brain size={11} /> Business context
          </a>
          <a href="#/marketplace"
            className="w-full text-[11px] text-slate-500 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition flex items-center gap-1.5">
            <Store size={11} /> Marketplace
          </a>
          <a href="#/settings"
            className="w-full text-[11px] text-slate-500 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition flex items-center gap-1.5">
            <Settings2 size={11} /> Settings
          </a>
          <button onClick={async () => { await api.resetDemo(); refresh() }}
            className="w-full text-[11px] text-slate-500 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition flex items-center gap-1.5">
            <RotateCcw size={11} /> Reset data
          </button>
          <button onClick={() => { session.clear(); location.hash = '#/login' }}
            className="w-full text-[11px] text-slate-500 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition flex items-center gap-1.5">
            <LogOut size={11} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── center ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* agent header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start gap-3.5">
          <AgentAvatar seed={active?.id || 'sahayak'} size={40} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[15px] text-ink">{active?.name || 'Sahayak'}</span>
              {active?.hindi_tagline && <span className="text-[11px] text-accent">{active.hindi_tagline}</span>}
              {active?.created_by === 'factory' &&
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-magenta/10 text-magenta">HIRED BY AI</span>}
            </div>
            <div className="text-[12px] text-slate-500 mt-0.5 truncate">
              {active ? (active.description || active.goal) : 'Orchestrator — routes your request to the right specialist, or hires a new one.'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {active?.stats?.runs != null ? `${active.stats.runs} tasks run` : 'Ramesh Auto Components · Faridabad'}
            </div>
          </div>
          <form onSubmit={e => { e.preventDefault(); const q = e.target.q.value.trim(); if (q) location.hash = `#/search/${encodeURIComponent(q)}` }}
            className="ml-auto mt-1 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 w-44 focus-within:border-ink transition">
            <Search size={11} className="text-slate-400 shrink-0" />
            <input name="q" placeholder="Search workspace…" className="w-full text-[11px] focus:outline-none bg-transparent" />
          </form>
          <button onClick={() => setDark(a11y.toggleTheme() === 'dark')} title="Toggle dark mode"
            className="mt-1 w-7 h-7 rounded-lg grid place-items-center text-slate-400 hover:text-ink hover:bg-slate-100 transition">
            {dark ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <a href="#/docs" className="text-[11px] text-slate-400 hover:text-ink flex items-center gap-1 mt-1"><ExternalLink size={11} /> Docs</a>
        </div>

        {/* messages — nav indicator on the right edge jumps to any point */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <NavIndicator items={messages} activeIndex={activeMsg}
            onJump={i => msgRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="right-1" />
          <div ref={scrollRef} onScroll={onChatScroll}
            className="flex-1 overflow-y-auto scroll-thin px-6 py-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} ref={el => msgRefs.current[i] = el}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[72%] text-[13px] leading-relaxed whitespace-pre-wrap
                ${m.role === 'user'
                  ? 'bg-ink text-white rounded-2xl rounded-br-md px-4 py-2.5'
                  : 'text-slate-700'}`}>
                {m.role === 'agent' && m.agent && (
                  <div className="text-[10px] font-semibold tracking-wide text-accent mb-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                    {m.trace ? m.trace.join(' → ') : m.agent} {m.tagline && `· ${m.tagline}`}
                  </div>
                )}
                {m.attachments?.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-1.5">
                    {m.attachments.map((a, j) => a.kind === 'image'
                      ? <img key={j} src={a.url} alt={a.name} className="max-h-28 rounded-lg border border-white/20" />
                      : <span key={j} className="flex items-center gap-1 text-[10px] bg-white/15 rounded px-1.5 py-0.5"><FileText size={9} />{a.name}</span>)}
                  </div>
                )}
                <LinkifiedText text={m.text} />
                {m.role === 'agent' && m.mode === 'deep' && (
                  <div className="mt-2 flex items-center gap-1.5 text-[9px] font-medium text-slate-400">
                    <BrandIcon id="perplexity" size={10} /> Deep research · 12 sources cited · powered by Perplexity
                  </div>
                )}
                {m.role === 'agent' && extractUrls(m.text)[0] && <LinkPreviewCard url={extractUrls(m.text)[0]} />}
                {m.role === 'agent' && m.agent && m.agent !== 'system' && <SourceChips trace={m.trace} actions={m.actions} />}
                {m.actions?.some(a => a.type === 'agent_created') && (
                  <div className="mt-2.5 text-[11px] bg-magenta/10 text-magenta rounded-lg px-2.5 py-1.5 font-medium">
                    ✨ New agent joined your team — check the sidebar
                  </div>
                )}
                {m.actions?.filter(a => a.type === 'artifact_created').map((a, j) => (
                  <a key={j} href={`#${a.data?.share_path || '/app'}`}
                    className="mt-2 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-accent hover:shadow-float transition">
                    <FileText size={14} className="text-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-ink truncate">{a.data?.title || 'Artifact'}</div>
                      <div className="text-[9px] text-slate-400">Shareable page · tap to open</div>
                    </div>
                    <ExternalLink size={11} className="text-slate-300 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          ))}
          {busy && <TimelineProgress text={lastSent} scope={scope} mode={mode} />}
          <div ref={bottomRef} />
          </div>
        </div>

        {/* templates gallery + scope tabs + suggestions + input */}
        <div className="px-6 pb-4">
          {voice && <VoiceOverlay onClose={() => setVoice(false)}
            onTranscript={t => { setInput(t); setTimeout(() => inputRef.current?.focus(), 50) }} />}
          {/* exclusion tabs — capability scope picker + response mode */}
          <div className="mb-2.5 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 shadow-float">
              {[['chat', 'Chat', MessageSquare], ['web', 'Web search', Globe], ['deep', 'Deep research', Telescope]].map(([k, l, I]) => (
                <button key={k} type="button" onClick={() => setMode(k)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition
                    ${mode === k ? 'bg-ink text-white' : 'text-slate-500 hover:text-ink'}`}>
                  <I size={10} /> {l}
                </button>
              ))}
            </div>
            {mode !== 'chat' && (
              <span className="flex items-center gap-1 text-[9px] text-slate-400">
                powered by <BrandIcon id="perplexity" size={10} /> Perplexity
              </span>
            )}
            <ExclusionTabs tabs={scopeTabs} active={scopeTab} onChange={setScopeTab} />
            {scopeTab === 'skills' && installedSkills.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {installedSkills.map(s => (
                  <button key={s} onClick={() => toggleScopeItem('skills', s)}
                    className={`text-[10px] px-2 py-1 rounded-full border font-medium transition
                      ${scope.skills.includes(s) ? 'bg-ink text-white border-ink' : 'border-slate-200 text-slate-500 hover:border-ink'}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {scopeTab === 'mcp' && mcpServers.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {mcpServers.map(m => (
                  <button key={m.id} onClick={() => toggleScopeItem('mcps', m.name)}
                    className={`text-[10px] px-2 py-1 rounded-full border font-medium transition flex items-center gap-1
                      ${scope.mcps.includes(m.name) ? 'bg-ink text-white border-ink' : 'border-slate-200 text-slate-500 hover:border-ink'}`}>
                    <Server size={9} />{m.name}
                  </button>
                ))}
              </div>
            )}
            {scopeTab !== 'all' && (scope.skills.length + scope.mcps.length) > 0 && (
              <span className="text-[9px] text-slate-400">
                next reply uses: {[...scope.skills, ...scope.mcps].join(', ')}
              </span>
            )}
          </div>
          {showTemplates && (
            <div className="mb-3 rounded-2xl border border-slate-200 bg-[#fbfbfd] shadow-float overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <span className="text-[11px] font-semibold text-ink flex items-center gap-1.5">
                  <LayoutTemplate size={12} className="text-accent" /> Start from a template
                  <a href="#/templates" className="text-[10px] font-normal text-accent hover:text-ink ml-1">Browse all →</a>
                </span>
                <button onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-ink transition"><X size={13} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 pb-4 max-h-[240px] overflow-y-auto scroll-thin">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => pickTemplate(t)}
                    className="text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-ink/40 hover:shadow-float transition group">
                    <span className={`w-7 h-7 rounded-lg grid place-items-center mb-2 ${t.tint}`}>
                      <t.icon size={14} />
                    </span>
                    <div className="text-[12px] font-semibold text-ink leading-tight group-hover:text-accent transition">{t.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap mb-3 items-center">
            <button onClick={() => setShowTemplates(v => !v)}
              className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition flex items-center gap-1.5
                ${showTemplates ? 'border-ink bg-ink text-white' : 'border-accent/50 text-accent hover:border-accent'}`}>
              <LayoutTemplate size={11} /> Templates
            </button>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:border-ink hover:text-ink transition">
                {s}
              </button>
            ))}
          </div>
          {files.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-2">
              {files.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 text-[10px] font-medium rounded-lg border border-slate-200 bg-white pl-1.5 pr-1 py-1">
                  {f.type.startsWith('image/')
                    ? <img src={URL.createObjectURL(f)} alt="" className="w-6 h-6 rounded object-cover" />
                    : <FileText size={12} className="text-accent" />}
                  <span className="max-w-[140px] truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}
                    className="text-slate-300 hover:text-rose-500"><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={e => { e.preventDefault(); send() }}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white shadow-float px-4 py-1.5 focus-within:border-slate-400 transition">
            <input ref={attachRef} type="file" multiple accept="image/*,video/*,.pdf,.xlsx,.csv,.docx" className="hidden"
              onChange={e => { setFiles(fs => [...fs, ...Array.from(e.target.files)]); e.target.value = '' }} />
            <button type="button" onClick={() => attachRef.current?.click()} title="Attach invoice photo, PDF, Excel…"
              className="w-8 h-8 rounded-xl grid place-items-center transition shrink-0 text-slate-400 hover:text-ink hover:bg-slate-100">
              <Paperclip size={14} />
            </button>
            {activeAgent && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ink text-white shrink-0">→ {active?.name || activeAgent}</span>}
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              placeholder={activeAgent ? `Ask ${active?.name || activeAgent}…` : 'Pick a template or write your own prompt…'}
              className="flex-1 py-2 text-[13px] focus:outline-none bg-transparent" />
            <button type="button" onClick={() => setVoice(v => !v)} title="Voice mode"
              className={`w-8 h-8 rounded-xl grid place-items-center transition shrink-0
                ${voice ? 'bg-accent text-white' : 'text-slate-400 hover:text-ink hover:bg-slate-100'}`}>
              <Mic size={14} />
            </button>
            <button disabled={busy} className="rounded-xl bg-ink text-white px-4 py-1.5 text-[12px] font-medium disabled:opacity-40 hover:bg-ink/85 transition">Generate</button>
          </form>
        </div>
      </main>

      {/* ── right rail ── */}
      <aside className="w-[260px] shrink-0 border-l border-slate-100 overflow-y-auto scroll-thin flex flex-col">
        <div className="flex gap-4 text-[12px] font-medium px-4 pt-4 border-b border-slate-100">
          {[['agent', 'Agent'], ['settings', 'Settings']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`pb-2.5 transition ${tab === k ? 'text-ink border-b-2 border-ink -mb-px' : 'text-slate-400'}`}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'agent' && (
          <div className="p-4 space-y-5">
            <section>
              <div className="text-[10px] font-semibold text-slate-500 mb-2">Agent Preferences</div>
              <div className="rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-600 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><SparklesDot /> {activeAgent ? 'Nova Lite' : 'Nova Pro'}</span>
                <span className="text-slate-300">▾</span>
              </div>
              <div className="rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-400 mt-1.5 min-h-[44px]">
                {active?.goal || 'Route messages, hire specialists when needed…'}
              </div>
            </section>

            {activeAgent && (
              <section>
                <div className="text-[10px] font-semibold text-slate-500 mb-2">{active?.name || 'Agent'} panel</div>
                <AgentCards agent={active} context={context} />
              </section>
            )}

            <section>
              <div className="text-[10px] font-semibold text-slate-500 mb-2 flex justify-between">Triggers <span className="text-slate-300">+ Add</span></div>
              {alerts.length === 0 && <div className="text-[10px] text-slate-400">No scheduled triggers yet — ask an agent to set one.</div>}
              {alerts.map(a => (
                <div key={a.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2 mb-1.5">
                  <div className="text-[11px] font-medium text-slate-700">{a.title}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{a.status} · {a.kind}</div>
                  {a.status === 'pending_approval' && (
                    <Can perm="approve" reason="Approving outbound actions needs Manager+">
                      <button onClick={() => approve(a.id)}
                        className="mt-1.5 text-[10px] w-full rounded-md bg-ink text-white py-1 font-medium hover:bg-ink/85 transition">
                        Approve &amp; send
                      </button>
                    </Can>
                  )}
                  {a.status === 'sent' && <div className="text-[9px] text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 size={9} /> sent {a.via ? `via ${a.via}` : ''}</div>}
                </div>
              ))}
            </section>

            <section>
              <div className="text-[10px] font-semibold text-slate-500 mb-2 flex justify-between">Connectors <span className="text-slate-300">+ Add</span></div>
              {connectors.map(c => (
                <div key={c.id} className="text-[11px] text-slate-600 py-1.5 flex items-center gap-2">
                  <BrandIcon id={c.icon || c.id} size={12} />
                  {c.name}
                  <span className={`ml-auto w-1.5 h-1.5 rounded-full ${c.status === 'connected' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                </div>
              ))}
            </section>
          </div>
        )}

        {tab === 'settings' && (
          <div className="p-4 space-y-4">
            <div className="text-[10px] font-semibold text-slate-500">Business</div>
            {settings ? (<>
              {[['Name', settings.business?.name], ['Owner', settings.business?.owner], ['City', settings.business?.city],
                ['Reminder cadence', `${settings.prefs?.reminder_cadence_days}d`], ['Approvals', settings.prefs?.approval_mode],
                ['Notify', settings.prefs?.notify_email]].map(([l, v]) => (
                <div key={l} className="flex justify-between text-[11px] py-1.5 border-b border-slate-50">
                  <span className="text-slate-400">{l}</span><span className="text-slate-700 font-medium text-right">{v || '—'}</span>
                </div>
              ))}
            </>) : <div className="text-[11px] text-slate-400">Connect the backend to load settings.</div>}
          </div>
        )}
      </aside>
    </div>
  )
}

function SparklesDot() { return <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" /> }
