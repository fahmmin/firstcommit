// ⌘K command palette — fuzzy jumps across pages, agents, templates, actions.
// Mounted in Workspace; listens for Cmd/Ctrl+K globally.
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api.js'
import { TEMPLATES } from '../lib/templates.js'
import { AgentAvatar } from '../lib/avatar.jsx'
import {
  Search, LayoutTemplate, CalendarDays, ScrollText, Brain, Store, Settings2,
  Bot, CornerDownLeft, Sparkles, Bell, FileText, Home, BookOpen,
} from 'lucide-react'

const PAGES = [
  { id: 'p-app', label: 'Workspace', icon: Home, go: '#/app', hint: 'chat with agents' },
  { id: 'p-templates', label: 'Templates', icon: LayoutTemplate, go: '#/templates', hint: 'starter prompts' },
  { id: 'p-context', label: 'Business context', icon: Brain, go: '#/context', hint: 'dump + auto-organize' },
  { id: 'p-search', label: 'Enterprise search', icon: Search, go: '#/search', hint: 'search everything' },
  { id: 'p-artifacts', label: 'Artifacts', icon: FileText, go: '#/artifacts', hint: 'shareable mini-pages' },
  { id: 'p-calendar', label: 'Calendar', icon: CalendarDays, go: '#/calendar', hint: 'events & reminders' },
  { id: 'p-market', label: 'Marketplace', icon: Store, go: '#/marketplace', hint: 'MCP + skills + agents' },
  { id: 'p-logs', label: 'Logs', icon: ScrollText, go: '#/logs', hint: 'agent activity stream' },
  { id: 'p-settings', label: 'Settings', icon: Settings2, go: '#/settings', hint: 'business, connectors, a11y' },
  { id: 'p-docs', label: 'Docs', icon: BookOpen, go: '#/docs', hint: 'how it works' },
]

export function CommandPalette({ open, onClose, onSelectAgent, onSend }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const [agents, setAgents] = useState([])
  const inputRef = useRef(null)

  useEffect(() => { if (open) { setQ(''); setIdx(0); api.agents().then(setAgents).catch(() => {}); setTimeout(() => inputRef.current?.focus(), 30) } }, [open])

  const items = useMemo(() => {
    const needle = q.toLowerCase()
    const match = (...f) => !needle || f.some(x => String(x || '').toLowerCase().includes(needle))
    return [
      ...PAGES.filter(p => match(p.label, p.hint))
        .map(p => ({ ...p, kind: 'page', run: () => location.hash = p.go })),
      ...agents.filter(a => match(a.name, a.goal, a.description))
        .map(a => ({ id: `a-${a.id}`, label: `Talk to ${a.name}`, icon: null, agent: a, kind: 'agent',
          hint: a.hindi_tagline || a.description?.slice(0, 40), run: () => onSelectAgent?.(a.id) })),
      ...TEMPLATES.filter(t => match(t.title, t.desc, t.prompt)).slice(0, 5)
        .map(t => ({ id: `t-${t.id}`, label: t.title, icon: t.icon, kind: 'template',
          hint: 'template prompt', run: () => onSend?.(t.prompt) })),
      ...(match('pending approvals', 'approve') ? [{ id: 'x-approvals', label: 'Review pending approvals', icon: Bell, kind: 'action', hint: 'human-in-the-loop queue', run: () => location.hash = '#/app' }] : []),
    ]
  }, [q, agents])

  const run = (it) => { it.run(); onClose() }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-ink/30 backdrop-blur-[2px] flex items-start justify-center pt-[16vh]"
          onClick={onClose}>
          <motion.div initial={{ opacity: 0, y: -8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: .98 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-float-lg overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
              <Search size={14} className="text-slate-400" />
              <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setIdx(0) }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
                  if (e.key === 'Enter' && items[idx]) run(items[idx])
                  if (e.key === 'Escape') onClose()
                }}
                placeholder="Jump to a page, agent, template or action…"
                className="flex-1 text-[13px] focus:outline-none bg-transparent" />
              <kbd className="text-[9px] font-mono text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">esc</kbd>
            </div>
            <div className="max-h-[320px] overflow-y-auto scroll-thin py-1.5">
              {items.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-slate-400">Nothing matches “{q}”</div>}
              {items.map((it, i) => (
                <button key={it.id} onClick={() => run(it)} onMouseEnter={() => setIdx(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${i === idx ? 'bg-slate-50' : ''}`}>
                  <span className="w-7 h-7 rounded-lg border border-slate-100 bg-slate-50 grid place-items-center shrink-0">
                    {it.agent ? <AgentAvatar seed={it.agent.id} size={16} className="rounded" />
                      : it.icon ? <it.icon size={13} className="text-slate-500" /> : <Bot size={13} className="text-slate-500" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] font-medium text-ink truncate">{it.label}</span>
                    {it.hint && <span className="block text-[10px] text-slate-400 truncate">{it.hint}</span>}
                  </span>
                  <span className="text-[9px] font-medium text-slate-300 uppercase tracking-wide shrink-0">{it.kind}</span>
                  {i === idx && <CornerDownLeft size={11} className="text-slate-300 shrink-0" />}
                </button>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-3 text-[9px] text-slate-400">
              <span className="flex items-center gap-1"><Sparkles size={9} className="text-accent" /> ⌘K anywhere</span>
              <span>↑↓ navigate · ↵ select</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
