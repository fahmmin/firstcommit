import { useEffect, useState } from 'react'
import { api, TENANT } from '../api.js'
import { AgentAvatar } from '../lib/avatar.jsx'
import { session } from '../lib/auth.js'
import { GROUP_ORDER } from '../lib/agentGroups.js'
import {
  PlugZap, LayoutTemplate, RotateCcw, Activity, Settings2, FileText, LogOut,
  Store, Brain, CalendarDays, ScrollText, Users, ListTodo, Search,
} from 'lucide-react'
import { SpinPlus } from './anim/index.jsx'

const NAV = [
  ['#/templates', 'Templates', LayoutTemplate],
  ['#/calendar', 'Calendar', CalendarDays],
  ['#/tasks', 'Tasks', ListTodo],
  ['#/notifications', 'Notifications', Activity],
  ['#/people', 'People', Users],
  ['#/analytics', 'Analytics', Activity],
  ['#/logs', 'Logs', ScrollText],
  ['#/context', 'Business context', Brain],
  ['#/artifacts', 'Artifacts', FileText],
  ['#/search', 'Search', Search],
  ['#/marketplace', 'Marketplace', Store],
  ['#/settings', 'Settings', Settings2],
]

// Shared app chrome — sidebar (agents + pages) + scrollable content column.
// Workspace passes its own agent/nav handlers; other pages get defaults that
// deep-link into #/app (open_agent prefill) so the sidebar always works.
export function AppShell({ children, agents: agentsProp, activeAgent, onAgentClick, onNewChat, onReset }) {
  const [agents, setAgents] = useState(agentsProp || [])
  useEffect(() => { if (!agentsProp) api.agents().then(setAgents).catch(() => {}) }, [agentsProp])
  useEffect(() => { if (agentsProp) setAgents(agentsProp) }, [agentsProp])

  const hash = location.hash
  const isActive = (href) => hash === href || hash.startsWith(href + '/')

  const clickAgent = (a) => {
    if (onAgentClick) return onAgentClick(a)
    localStorage.setItem('open_agent', a.id)
    location.hash = '#/app'
  }
  const newChat = () => {
    if (onNewChat) return onNewChat()
    localStorage.setItem('open_agent', '')
    location.hash = '#/app'
  }
  const reset = async () => {
    if (onReset) return onReset()
    await api.resetDemo().catch(() => {})
    location.reload()
  }

  const groups = GROUP_ORDER.map(([label, match]) => [label, agents.filter(match)]).filter(([, l]) => l.length)

  return (
    <div className="h-screen flex bg-white font-sans">
      <aside className="w-[190px] shrink-0 border-r border-slate-100 bg-[#fbfbfd] flex flex-col">
        <a href="#/" className="flex items-center gap-2 px-4 h-[52px] border-b border-slate-100">
          <span className="w-6 h-6 rounded-lg bg-ink text-white grid place-items-center text-[10px] font-bold">स</span>
          <span className="font-semibold text-[14px] tracking-tight text-ink">Sahayak</span>
        </a>
        <div className="p-3">
          <button onClick={newChat}
            className="plus-hover w-full text-[12px] font-medium border border-slate-200 bg-white rounded-lg py-2 text-slate-600 hover:border-slate-300 transition flex items-center justify-center gap-1.5">
            <SpinPlus size={12} /> New Chat
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto scroll-thin px-3 pb-3 space-y-4">
          {groups.map(([label, items]) => (
            <div key={label}>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1">{label}</div>
              {items.map(a => (
                <button key={a.id} onClick={() => clickAgent(a)}
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
        <div className="p-3 border-t border-slate-100 space-y-1 max-h-[45vh] overflow-y-auto scroll-thin">
          <div className="text-[10px] text-slate-400 px-1">{TENANT}</div>
          {NAV.map(([href, label, I]) => (
            <a key={href} href={href}
              className={`w-full text-[11px] rounded-lg px-2 py-1.5 transition flex items-center gap-1.5
                ${isActive(href) ? 'bg-slate-900 text-white font-medium' : 'text-slate-500 hover:bg-slate-100'}`}>
              <I size={11} /> {label}
            </a>
          ))}
          <button onClick={reset}
            className="w-full text-[11px] text-slate-500 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition flex items-center gap-1.5">
            <RotateCcw size={11} /> Reset data
          </button>
          <button onClick={() => { session.clear(); location.hash = '#/login' }}
            className="w-full text-[11px] text-slate-500 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition flex items-center gap-1.5">
            <LogOut size={11} /> Sign out
          </button>
        </div>
      </aside>
      {children}
    </div>
  )
}
