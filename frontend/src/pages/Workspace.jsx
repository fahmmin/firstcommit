import { useEffect, useRef, useState } from 'react'
import { api, TENANT } from '../api.js'
import { session } from '../lib/auth.js'
import { AgentAvatar } from '../lib/avatar.jsx'
import { AgentCards } from '../components/cards/index.jsx'
import { ThinkingTrace, SourceChips } from '../components/ThinkingTrace.jsx'
import { BrandIcon } from '../components/BrandIcon.jsx'
import { TEMPLATES } from '../lib/templates.js'
import {
  PlugZap, CheckCircle2, Plus, RotateCcw, ExternalLink, Activity, Settings2,
  LayoutTemplate, X, Search, FileText, LogOut, Store, Brain,
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
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

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
    if (!msg || busy) return
    setInput('')
    setLastSent(msg)
    setMessages(m => [...m, { role: 'user', text: msg }])
    setBusy(true)
    try {
      const r = await api.chat(msg, activeAgent)
      setMessages(m => [...m, {
        role: 'agent', agent: r.agent_name, tagline: r.agent_tagline,
        text: r.reply, trace: r.trace, actions: r.actions,
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
          <a href="#/docs" className="text-[11px] text-slate-400 hover:text-ink flex items-center gap-1 mt-1"><ExternalLink size={11} /> Docs</a>
        </div>

        {/* messages */}
        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                {m.text}
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
          {busy && <ThinkingTrace text={lastSent} />}
          <div ref={bottomRef} />
        </div>

        {/* templates gallery + suggestions + input */}
        <div className="px-6 pb-4">
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
          <form onSubmit={e => { e.preventDefault(); send() }}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white shadow-float px-4 py-1.5 focus-within:border-slate-400 transition">
            {activeAgent && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ink text-white shrink-0">→ {active?.name || activeAgent}</span>}
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              placeholder={activeAgent ? `Ask ${active?.name || activeAgent}…` : 'Pick a template or write your own prompt…'}
              className="flex-1 py-2 text-[13px] focus:outline-none bg-transparent" />
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
                    <button onClick={() => approve(a.id)}
                      className="mt-1.5 text-[10px] w-full rounded-md bg-ink text-white py-1 font-medium hover:bg-ink/85 transition">
                      Approve &amp; send
                    </button>
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
