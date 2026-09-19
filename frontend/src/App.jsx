import { useEffect, useRef, useState } from 'react'
import { api, TENANT } from './api.js'

// ─── SCAFFOLD: functional core loop (chat + agents + alerts).
// Fahmin TODO (see README "Remaining work"): landing page, onboarding wizard,
// invoice/cashflow charts (recharts installed), agent-hiring animation
// (framer-motion installed), Hinglish polish, tenant selector.

const SUGGESTIONS = [
  'Show my overdue invoices',
  'Draft a reminder for the pending bill',
  'Find me steel suppliers',
  'Buyer gives 90 day terms, should I take the order?',
  'Mera transporter nahi aaya',
]

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'agent', agent: 'sahayak', text: 'Namaste! I am Sahayak — your AI back-office. Ask me about invoices, suppliers, cash flow… or tell me a problem and I will hire a specialist for it.' },
  ])
  const [agents, setAgents] = useState([])
  const [alerts, setAlerts] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeAgent, setActiveAgent] = useState(null)
  const bottomRef = useRef(null)

  const refresh = async () => {
    setAgents(await api.agents())
    setAlerts(await api.alerts())
  }
  useEffect(() => { refresh().catch(console.error) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || busy) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: msg }])
    setBusy(true)
    try {
      const r = await api.chat(msg, activeAgent)
      setMessages(m => [...m, {
        role: 'agent', agent: r.agent_name, tagline: r.agent_tagline,
        text: r.reply, trace: r.trace, actions: r.actions,
      }])
      if (r.actions?.some(a => a.type === 'agent_created' || a.type === 'reminder_drafted')) refresh()
      if (r.agent_name === 'nirmata') setActiveAgent(null) // factory chat continues via orchestrator
    } catch (e) {
      setMessages(m => [...m, { role: 'agent', agent: 'system', text: `Error: ${e.message} — is the backend running on :8000?` }])
    } finally {
      setBusy(false)
    }
  }

  const approve = async (id) => {
    await api.approveAlert(id)
    refresh()
  }

  const talkTo = (a) => {
    setActiveAgent(activeAgent === a.id ? null : a.id)
  }

  return (
    <div className="h-screen flex flex-col">
      {/* header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white/80 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-brand text-white grid place-items-center font-bold">स</div>
          <div>
            <div className="font-bold text-brand leading-4">Sahayak AI</div>
            <div className="text-xs text-slate-500">Ramesh Auto Components · Faridabad</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-sky/40 text-brand">tenant: {TENANT}</span>
          <button onClick={async () => { await api.resetDemo(); refresh() }}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-300 hover:bg-slate-100">
            Reset demo
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[1fr_320px] overflow-hidden">
        {/* chat */}
        <main className="flex flex-col p-4 gap-3 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm
                  ${m.role === 'user' ? 'bg-brand text-white rounded-br-md' : 'bg-white rounded-bl-md'}`}>
                  {m.role === 'agent' && m.agent && (
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-accent mb-1">
                      {m.trace ? m.trace.join(' → ') : m.agent} {m.tagline && `· ${m.tagline}`}
                    </div>
                  )}
                  {m.text}
                  {m.actions?.some(a => a.type === 'agent_created') && (
                    <div className="mt-2 text-xs bg-sky/30 text-brand rounded-lg px-2 py-1">
                      ✨ New agent joined your team — see the roster →
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-slate-400 animate-pulse">agents thinking…</div>}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 flex-wrap">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-accent hover:text-brand">
                {s}
              </button>
            ))}
          </div>

          <form onSubmit={e => { e.preventDefault(); send() }} className="flex gap-2">
            {activeAgent && (
              <span className="self-center text-xs px-2 py-1 rounded-full bg-accent/15 text-brand">
                → {activeAgent}
              </span>
            )}
            <input value={input} onChange={e => setInput(e.target.value)}
              placeholder={activeAgent ? `Ask ${activeAgent}…` : 'Ask Sahayak anything… (Hinglish works)'}
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
            <button disabled={busy}
              className="rounded-2xl bg-brand text-white px-5 text-sm font-medium disabled:opacity-50">
              Send
            </button>
          </form>
        </main>

        {/* right rail */}
        <aside className="border-l border-slate-200 bg-white/60 overflow-y-auto p-4 space-y-5">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Your team</h3>
            <div className="space-y-2">
              {agents.map(a => (
                <button key={a.id} onClick={() => talkTo(a)}
                  className={`w-full text-left rounded-2xl border p-3 transition
                    ${activeAgent === a.id ? 'border-accent bg-sky/20' : 'border-slate-200 bg-white hover:border-accent/60'}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-semibold text-sm">{a.name}</span>
                    {a.created_by === 'factory' &&
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold">HIRED BY AI</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{a.hindi_tagline} · {a.description}</div>
                  <div className="flex gap-1 flex-wrap mt-1.5">
                    {(a.tools || []).slice(0, 4).map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{t}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Alerts</h3>
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{a.status} · {a.kind}</div>
                  {a.status === 'pending_approval' && (
                    <button onClick={() => approve(a.id)}
                      className="mt-2 text-xs w-full rounded-xl bg-brand text-white py-1.5 font-medium">
                      Approve & send
                    </button>
                  )}
                  {a.status === 'sent' && <div className="text-[10px] text-emerald-600 mt-1">✓ sent {a.via ? `via ${a.via}` : ''}</div>}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
