import { useEffect, useState } from 'react'
import { api, TENANT, offline } from '../api.js'
import { AgentAvatar } from '../lib/avatar.jsx'
import { session } from '../lib/auth.js'
import { groupAgents } from '../lib/agentGroups.js'
import {
  PlugZap, LayoutTemplate, RotateCcw, Activity, Settings2, FileText, LogOut,
  Store, Brain, CalendarDays, ScrollText, Users, ListTodo, Search, FileBarChart,
} from 'lucide-react'
import { SpinPlus } from './anim/index.jsx'
import { Blobs } from './Logo.jsx'

const NAV = [
  ['#/templates', 'Templates', LayoutTemplate],
  ['#/calendar', 'Calendar', CalendarDays],
  ['#/tasks', 'Tasks', ListTodo],
  ['#/notifications', 'Notifications', Activity],
  ['#/people', 'People', Users],
  ['#/analytics', 'Analytics', Activity],
  ['#/reports', 'Reports', FileBarChart],
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

  const groups = groupAgents(agents)
  const isOffline = useOffline()

  return (
    <div className="h-screen flex bg-white font-sans">
      <aside className="w-[208px] shrink-0 border-r border-slate-100 bg-[#fbfbfd] flex flex-col">
        <a href="#/" className="flex items-center gap-2 px-4 h-[52px] border-b border-slate-100">
          <Blobs />
          <span className="font-semibold text-[15px] tracking-tight text-ink">Sahayak</span>
        </a>
        <div className="p-3">
          <button onClick={newChat}
            className="plus-hover w-full text-[13px] font-medium border border-slate-200 bg-white rounded-lg py-2 text-slate-600 hover:border-slate-300 transition flex items-center justify-center gap-1.5">
            <SpinPlus size={13} /> New Chat
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto scroll-thin px-3 pb-3 space-y-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">Agents</div>
          {groups.map(([label, items], gi) => (
            <div key={label} className="animate-riseIn" style={{ animationDelay: `${gi * 60}ms` }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1 flex items-center justify-between">
                {label}
                <span className="text-[9px] font-medium text-slate-300 normal-case">{items.length}</span>
              </div>
              {items.map(a => (
                <button key={a.id} onClick={() => clickAgent(a)}
                  className={`w-full text-left text-[13px] rounded-lg px-2 py-1.5 mb-0.5 flex items-center gap-2 transition active:scale-[.98]
                    ${activeAgent === a.id ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <AgentAvatar seed={a.id} size={18} className="rounded" />
                  <span className="truncate">{a.name}</span>
                  {a.created_by === 'factory' && activeAgent !== a.id &&
                    <span className="ml-auto text-[9px] font-bold text-magenta">AI</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-3 pt-2 border-t border-slate-100 max-h-[45vh] overflow-y-auto scroll-thin">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-1.5">Workspace</div>
          <div className="space-y-0.5">
            {NAV.map(([href, label, I]) => (
              <a key={href} href={href}
                className={`w-full text-[12.5px] rounded-lg px-2 py-[5px] transition flex items-center gap-2
                  ${isActive(href) ? 'bg-slate-900 text-white font-medium' : 'text-slate-500 hover:bg-slate-100'}`}>
                <I size={12} className="shrink-0" /> {label}
              </a>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5">
            <div className="text-[10px] text-slate-400 px-2 pb-0.5 truncate" title={TENANT}>{TENANT}</div>
            <button onClick={reset}
              className="w-full text-[12px] text-slate-500 rounded-lg px-2 py-[5px] hover:bg-slate-100 transition flex items-center gap-2">
              <RotateCcw size={12} /> Reset data
            </button>
            <button onClick={() => { session.clear(); location.hash = '#/login' }}
              className="w-full text-[12px] text-slate-500 rounded-lg px-2 py-[5px] hover:bg-slate-100 transition flex items-center gap-2">
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </div>
      </aside>
      {children}
      {isOffline && (
        <div role="status" title="The backend didn't answer — lists show sample rows until it does. Nothing you see here is your data."
          className="fixed top-3 right-4 z-[80] flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-medium text-amber-700 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Offline — sample data
        </div>
      )}
    </div>
  )
}

// true while the last read fell back to sample data (see api.js withSample)
function useOffline() {
  const [v, setV] = useState(offline.get())
  useEffect(() => offline.subscribe(setV), [])
  return v
}
