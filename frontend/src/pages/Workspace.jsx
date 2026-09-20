import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { api, TENANT } from '../api.js'
import { session } from '../lib/auth.js'
import { motion } from 'framer-motion'
import { ThinkingOrb } from 'thinking-orbs'
import { BorderBeam } from 'border-beam'
import { Liquid } from 'liquid-gooey'
import { MetalFx, MetalBadge } from 'metal-fx'
import { AgentAvatar, agentColor } from '../lib/avatar.jsx'
import { AgentCards } from '../components/cards/index.jsx'
import { SourceChips } from '../components/ThinkingTrace.jsx'
import { TimelineProgress } from '../components/rui/TimelineProgress.jsx'
import { ExclusionTabs } from '../components/rui/ExclusionTabs.jsx'
const VoiceOverlay = lazy(() => import('../components/rui/CloudWave.jsx').then(m => ({ default: m.VoiceOverlay })))
import { Can } from '../components/rui/Can.jsx'
import { LinkifiedText, LinkPreviewCard, extractUrls } from '../components/rui/LinkPreview.jsx'
import { NavIndicator } from '../components/rui/NavIndicator.jsx'
import { BrandIcon } from '../components/BrandIcon.jsx'
import { TEMPLATES } from '../lib/templates.js'
import { a11y } from '../lib/a11y.js'
import { toast } from '../lib/toast.js'
import { CommandPalette } from '../components/CommandPalette.jsx'
import { ApprovalsDrawer, ApprovalBell } from '../components/ApprovalsDrawer.jsx'
import { Digest } from '../components/Digest.jsx'
import { SetupChecklist } from '../components/SetupChecklist.jsx'
import { SpinPlus, TypingDots } from '../components/anim/index.jsx'
import { AppShell } from '../components/AppShell.jsx'
import {
  PlugZap, CheckCircle2, Plus, RotateCcw, ExternalLink, Activity, Settings2,
  LayoutTemplate, X, Search, FileText, LogOut, Store, Brain, Mic, CalendarDays,
  Braces, Server, ScrollText, Paperclip, Globe, MessageSquare, Telescope, ImageIcon,
  Moon, Sun, Volume2, Square, Command, Users, Send, ListTodo, ChevronRight,
} from 'lucide-react'
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
  const [scope, setScope] = useState({ agents: [], tools: [] })
  const [mode, setMode] = useState('chat')           // chat | web | deep
  const [files, setFiles] = useState([])             // composer attachments
  const attachRef = useRef(null)
  const [dark, setDark] = useState(() => a11y.get().theme === 'dark')
  const [palette, setPalette] = useState(false)
  const [approvals, setApprovals] = useState(false)
  const [speaking, setSpeaking] = useState(-1)
  const [memList, setMemList] = useState([])

  // ⌘K / Ctrl+K opens the command palette
  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPalette(v => !v) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const speak = (text, i) => {
    if (speaking === i) { speechSynthesis.cancel(); setSpeaking(-1); return }
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/[*#_`₹]/g, m => m === '₹' ? 'rupees ' : ''))
    u.lang = /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-IN'
    u.onend = () => setSpeaking(-1)
    speechSynthesis.speak(u)
    setSpeaking(i)
  }
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

  // capability scope — real inventory only: agents Sahayak can route to, or the
  // active specialist's tools. Selections are sent to /chat as `scope`, so the
  // next reply genuinely runs with only the picked capabilities.
  const scopeAgents = activeAgent ? [] : agents
  const scopeTools = activeAgent?.tools || []
  const scopeTabs = [
    { id: 'all', label: 'Everything' },
    ...(scopeAgents.length ? [{ id: 'agents', label: 'Agents', icon: <Server size={10} />, count: scopeAgents.length }] : []),
    ...(scopeTools.length ? [{ id: 'tools', label: 'Tools', icon: <Braces size={10} />, count: scopeTools.length }] : []),
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
    const [ag, al, cn, st, mm] = await Promise.all([
      api.agents(), api.alerts(), api.connectors().catch(() => []), api.settings().catch(() => null),
      api.memories().catch(() => []),
    ])
    setAgents(ag); setAlerts(al); setConnectors(cn); setSettings(st); setMemList(mm)
  }
  useEffect(() => {
    refresh().catch(console.error)
    const pre = localStorage.getItem('prefill_prompt')
    if (pre) { localStorage.removeItem('prefill_prompt'); setInput(pre); setTimeout(() => inputRef.current?.focus(), 50) }
    const oa = localStorage.getItem('open_agent')
    if (oa !== null) { localStorage.removeItem('open_agent'); if (oa) setActiveAgent(oa) }
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
      // picked capabilities → real scope on the request (empty pick = no limit)
      const scopePick = activeAgent ? scope.tools : scope.agents
      const r = await api.chat(msg || 'What did you just receive?', activeAgent, sentMode,
        scopePick.length ? scopePick : null)
      setMessages(m => [...m, {
        role: 'agent', agent: r.agent_name, tagline: r.agent_tagline,
        text: r.reply, trace: r.trace, actions: r.actions, mode: sentMode,
      }])
      if (r.actions?.some(a => a.type === 'agent_created' || a.type === 'reminder_drafted')) refresh()
      if (r.agent_name === 'nirmata') setActiveAgent(null)
    } catch (e) {
      const unreachable = /Failed to fetch|NetworkError|Load failed|fetch/i.test(e.message)
      setMessages(m => [...m, { role: 'agent', agent: 'system',
        text: unreachable
          ? 'Backend unreachable — it may be cold-starting; try again in a few seconds.'
          : `Error: ${e.message}` }])
    } finally {
      setBusy(false)
    }
  }

  const approve = async (id) => { await api.approveAlert(id); toast.push('Approved — sending to customer'); refresh() }

  return (
    <AppShell agents={agents} activeAgent={activeAgent}
      onAgentClick={(a) => setActiveAgent(activeAgent === a.id ? null : a.id)}
      onNewChat={() => { setActiveAgent(null); setMessages(m => m.slice(0, 1)) }}
      onReset={async () => { await api.resetDemo(); refresh() }}>
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
                <MetalBadge strength={0.85} theme="light">HIRED BY AI</MetalBadge>}
            </div>
            <div className="text-[12px] text-slate-500 mt-0.5 truncate">
              {active ? (active.description || active.goal) : 'Orchestrator — routes your request to the right specialist, or hires a new one.'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {active?.stats?.runs != null ? `${active.stats.runs} tasks run` : 'Ramesh Auto Components · Faridabad'}
            </div>
          </div>
          <div className="ml-auto self-center flex items-center gap-1.5">
            <form onSubmit={e => { e.preventDefault(); const q = e.target.q.value.trim(); if (q) location.hash = `#/search/${encodeURIComponent(q)}` }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 w-44 focus-within:border-ink transition">
              <Search size={11} className="text-slate-400 shrink-0" />
              <input name="q" placeholder="Search workspace…" className="w-full text-[11px] focus:outline-none bg-transparent" />
            </form>
            <ApprovalBell alerts={alerts} onClick={() => setApprovals(true)} />
            <button onClick={() => setPalette(true)} title="Command palette (⌘K)"
              className="w-7 h-7 rounded-lg grid place-items-center text-slate-400 hover:text-ink hover:bg-slate-100 transition">
              <Command size={13} />
            </button>
            <button onClick={() => setDark(a11y.toggleTheme() === 'dark')} title="Toggle dark mode"
              className="w-7 h-7 rounded-lg grid place-items-center text-slate-400 hover:text-ink hover:bg-slate-100 transition">
              {dark ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            <a href="#/docs" title="API docs"
              className="h-7 rounded-lg grid place-items-center px-2 text-slate-400 hover:text-ink hover:bg-slate-100 transition">
              <FileText size={13} />
            </a>
          </div>
        </div>

        {/* messages — nav indicator on the right edge jumps to any point */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <NavIndicator items={messages} activeIndex={activeMsg}
            onJump={i => msgRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="right-1" />
          <div ref={scrollRef} onScroll={onChatScroll}
            className="flex-1 overflow-y-auto scroll-thin px-6 py-5 space-y-4">
          {messages.map((m, i) => {
            const isAgent = m.role === 'agent' && m.agent && m.agent !== 'system'
            const isSystem = m.role === 'agent' && m.agent === 'system'
            const who = isAgent ? agents.find(a => a.id === m.agent) : null
            const color = agentColor(m.agent)
            return (
            <motion.div key={i} ref={el => msgRefs.current[i] = el}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={`flex items-start ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {isAgent && <AgentAvatar seed={m.agent} size={26} className="rounded-lg mt-1 mr-2.5 shadow-sm self-start" />}
              <div className={`max-w-[72%] text-[13px] leading-relaxed whitespace-pre-wrap
                ${m.role === 'user'
                  ? 'bg-ink text-white rounded-2xl rounded-br-md px-4 py-2.5'
                  : isAgent
                    ? 'rounded-2xl rounded-tl-md border border-slate-100 bg-[#fbfbfd] px-4 py-3 text-slate-700 shadow-sm'
                    : 'text-slate-400 text-[12px] italic mx-auto text-center'}`}>
                {isAgent && (
                  <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11.5px] font-bold tracking-tight" style={{ color }}>
                      {who?.name || m.agent}
                    </span>
                    {m.tagline && <span className="text-[10px] text-slate-400">· {m.tagline}</span>}
                    {m.trace?.length > 1 && (
                      <span className="flex items-center gap-0.5 text-[9px] text-slate-400 font-medium">
                        {m.trace.map((t, k) => (
                          <span key={k} className="flex items-center gap-0.5">
                            {k > 0 && <ChevronRight size={8} className="text-slate-300" />}
                            <span className="px-1 py-px rounded bg-slate-100"
                              style={k === m.trace.length - 1 ? { color } : {}}>{t}</span>
                          </span>
                        ))}
                      </span>
                    )}
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
                {m.role === 'agent' && m.agent !== 'system' && (
                  <button onClick={() => speak(m.text, i)} title={speaking === i ? 'Stop' : 'Read aloud'}
                    className="mt-1.5 flex items-center gap-1 text-[9px] font-medium text-slate-400 hover:text-ink transition">
                    {speaking === i ? <><Square size={9} /> Stop</> : <><Volume2 size={10} /> Listen</>}
                  </button>
                )}
                {m.actions?.some(a => a.type === 'agent_created') && (
                  <div className="mt-2.5 text-[11px] bg-magenta/10 text-magenta rounded-lg px-2.5 py-1.5 font-medium animate-popIn">
                    ✨ New agent joined your team — check the sidebar
                  </div>
                )}
                {m.actions?.filter(a => a.type === 'artifact_created').map((a, j) => (
                  <a key={j} href={`#${a.data?.share_path || '/app'}`}
                    className="mt-2 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-accent hover:shadow-float hover:-translate-y-0.5 transition animate-popIn">
                    <FileText size={14} className="text-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-ink truncate">{a.data?.title || 'Artifact'}</div>
                      <div className="text-[9px] text-slate-400">Shareable page · tap to open</div>
                    </div>
                    <ExternalLink size={11} className="text-slate-300 shrink-0" />
                  </a>
                ))}
              </div>
            </motion.div>
          )})}
          {busy && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-start">
              <AgentAvatar seed={activeAgent || 'sahayak'} size={26} className="rounded-lg mt-1 mr-2.5 shadow-sm" />
              <div className="max-w-[72%]">
                <div className="w-fit rounded-2xl rounded-tl-md border border-slate-100 bg-[#fbfbfd] px-4 py-2.5 shadow-sm flex items-center gap-2">
                  <ThinkingOrb size={20}
                    state={mode === 'deep' ? 'solving' : mode === 'web' ? 'searching' : 'working'}
                    aria-label={`${active?.name || 'Sahayak'} is thinking`} />
                  <span className="text-[11.5px] font-bold tracking-tight"
                    style={{ color: agentColor(activeAgent || 'sahayak') }}>{active?.name || 'Sahayak'}</span>
                  <span className="text-[10px] text-slate-400">is thinking</span>
                </div>
                <div className="mt-2"><TimelineProgress text={lastSent} scope={scope} mode={mode} /></div>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
          </div>
        </div>

        {/* templates gallery + scope tabs + suggestions + input */}
        <div className="px-6 pb-4">
          {voice && <Suspense fallback={null}><VoiceOverlay onClose={() => setVoice(false)}
            onTranscript={t => { setInput(t); setTimeout(() => inputRef.current?.focus(), 50) }} /></Suspense>}
          {/* exclusion tabs — capability scope picker + response mode */}
          <div className="mb-2.5 flex items-center gap-3 flex-wrap">
            <Liquid blur={5} contrast={16} fill="#fff"
              className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 shadow-float w-fit">
              {[['chat', 'Chat', MessageSquare], ['web', 'Web search', Globe], ['deep', 'Deep research', Telescope]].map(([k, l, I]) => (
                <Liquid.Item key={k} transition="bouncy">
                  <button type="button" onClick={() => setMode(k)}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition
                      ${mode === k ? 'bg-ink text-white' : 'text-slate-500 hover:text-ink'}`}>
                    <I size={10} /> {l}
                  </button>
                </Liquid.Item>
              ))}
            </Liquid>
            {mode !== 'chat' && (
              <span className="flex items-center gap-1 text-[9px] text-slate-400">
                powered by <BrandIcon id="perplexity" size={10} /> Perplexity
              </span>
            )}
            <ExclusionTabs tabs={scopeTabs} active={scopeTab} onChange={setScopeTab} />
            {scopeTab === 'agents' && scopeAgents.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {scopeAgents.map(a => (
                  <button key={a.id} onClick={() => toggleScopeItem('agents', a.id)}
                    className={`text-[10px] px-2 py-1 rounded-full border font-medium transition
                      ${scope.agents.includes(a.id) ? 'bg-ink text-white border-ink' : 'border-slate-200 text-slate-500 hover:border-ink'}`}>
                    {a.name}
                  </button>
                ))}
              </div>
            )}
            {scopeTab === 'tools' && scopeTools.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {scopeTools.map(t => (
                  <button key={t} onClick={() => toggleScopeItem('tools', t)}
                    className={`text-[10px] px-2 py-1 rounded-full border font-medium transition
                      ${scope.tools.includes(t) ? 'bg-ink text-white border-ink' : 'border-slate-200 text-slate-500 hover:border-ink'}`}>
                    {t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
            {scopeTab !== 'all' && (scope.agents.length + scope.tools.length) > 0 && (
              <span className="text-[9px] text-slate-400">
                next reply uses only: {[...scope.agents, ...scope.tools].join(', ')}
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
                    className="text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-ink/40 hover:shadow-float hover:-translate-y-0.5 active:scale-[.98] transition group">
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
          {messages.length === 1 && !busy && (
            <div className="mb-3">
              <Digest onAction={(a) => a === 'approvals' ? setApprovals(true) : send(a)} />
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
                className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:border-ink hover:text-ink hover:-translate-y-0.5 active:scale-95 transition">
                {s}
              </button>
            ))}
          </div>
          {files.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-2">
              {files.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 text-[10px] font-medium rounded-lg border border-slate-200 bg-white pl-1.5 pr-1 py-1 animate-popIn">
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
          <BorderBeam size="line" strength={0.55} colorVariant="colorful" className="rounded-2xl">
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
              <MetalFx variant="circle" preset="chromatic" strength={0.8} theme="light">
                <button type="button" onClick={() => setVoice(v => !v)} title="Voice mode"
                  className={`w-8 h-8 rounded-xl grid place-items-center transition shrink-0
                    ${voice ? 'bg-accent text-white' : 'text-slate-400 hover:text-ink hover:bg-slate-100'}`}>
                  <Mic size={14} />
                </button>
              </MetalFx>
              <button disabled={busy} className="group rounded-xl bg-ink text-white px-4 py-1.5 text-[12px] font-medium disabled:opacity-40 hover:bg-ink/85 active:scale-95 transition flex items-center gap-1.5">
                Generate <Send size={10} className="send-fly" />
              </button>
            </form>
          </BorderBeam>
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
            <SetupChecklist connectors={connectors} memories={memList} agents={agents} />
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

      <CommandPalette open={palette} onClose={() => setPalette(false)}
        onSelectAgent={id => setActiveAgent(id)} onSend={t => send(t)} />
      <ApprovalsDrawer open={approvals} onClose={() => setApprovals(false)}
        alerts={alerts} onChanged={refresh} />
    </AppShell>
  )
}

function SparklesDot() { return <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" /> }
