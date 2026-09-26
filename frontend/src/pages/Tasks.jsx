import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { AgentAvatar } from '../lib/avatar.jsx'
import { Can } from '../components/rui/Can.jsx'
import { toast } from '../lib/toast.js'
import { AppShell } from '../components/AppShell.jsx'
import { Plus, CheckCheck, Clock, GripVertical } from 'lucide-react'

const COLS = [
  { id: 'todo',        label: 'To do',          accent: 'bg-slate-400' },
  { id: 'in_progress', label: 'In progress',    accent: 'bg-accent' },
  { id: 'approval',    label: 'Needs approval', accent: 'bg-amber-500' },
  { id: 'done',        label: 'Done',           accent: 'bg-emerald-500' },
]

const PRI = { high: 'bg-rose-500', med: 'bg-amber-400', low: 'bg-slate-300' }

// normalize real /tasks rows ({status, agent_id, due: ISO, result?}) → board cards
const norm = (t) => {
  const dueDate = t.due && /^\d{4}-/.test(t.due) ? new Date(t.due) : null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = dueDate
    ? (dueDate <= today ? 'Today' : dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))
    : (t.due || '—')
  return {
    id: t.id, title: t.title, agent: t.agent || t.agent_id || 'sahayak',
    col: COLS.some(c => c.id === (t.col || t.status)) ? (t.col || t.status) : 'todo',
    priority: t.priority || 'med', due, tags: t.tags || [],
    sub: t.result || t.details || null,
  }
}

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [draft, setDraft] = useState('')
  const [over, setOver] = useState(null)

  useEffect(() => { api.tasks().then(ts => setTasks(ts.map(norm))).catch(() => {}) }, [])

  const move = async (id, col) => {
    const t = tasks.find(x => x.id === id)
    if (!t || t.col === col) return
    setTasks(ts => ts.map(x => x.id === id ? { ...x, col } : x))
    try {
      await api.updateTask(id, { col, status: col })
      if (col === 'done') toast.push(`Done — ${t.title.slice(0, 40)}`)
    } catch {  // roll back — the board must mirror the server
      setTasks(ts => ts.map(x => x.id === id ? { ...x, col: t.col } : x))
      toast.push("Couldn't move the task — backend unreachable", 'err')
    }
  }

  const add = async (col) => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    // POST /tasks returns only {id, status} — rebuild the card client-side
    const r = await api.addTask(title, col).catch(() => null)
    if (!r?.id) { setDraft(title); toast.push("Couldn't save the task — backend unreachable", 'err'); return }
    setTasks(ts => [...ts, norm({ id: r.id, title, col, agent: 'sahayak' })])
  }

  const approve = (t) => { move(t.id, 'done') }

  const counts = Object.fromEntries(COLS.map(c => [c.id, tasks.filter(t => t.col === c.id).length]))

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">Agent work board</h1>
            <p className="text-[12px] text-slate-500 mt-1">
              Everything your agents are doing — drag cards between stages. Approvals stay in your hands.
            </p>
          </div>
          <div className="flex gap-2 text-[11px]">
            <span className="rounded-full bg-white border border-slate-200 px-3 py-1.5 text-slate-500"><b className="text-ink">{counts.todo || 0}</b> queued</span>
            <span className="rounded-full bg-white border border-slate-200 px-3 py-1.5 text-slate-500"><b className="text-amber-600">{counts.approval || 0}</b> awaiting you</span>
            <span className="rounded-full bg-white border border-slate-200 px-3 py-1.5 text-slate-500"><b className="text-emerald-600">{counts.done || 0}</b> done</span>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4 items-start">
          {COLS.map(col => (
            <div key={col.id}
              onDragOver={e => { e.preventDefault(); setOver(col.id) }}
              onDragLeave={() => setOver(o => o === col.id ? null : o)}
              onDrop={e => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData('text/task-id'), col.id) }}
              className={`rounded-2xl border p-3 min-h-[300px] transition-colors
                ${over === col.id ? 'border-accent bg-accent/[0.04]' : 'border-slate-200 bg-slate-50/60'}`}>
              <div className="flex items-center gap-2 px-1 mb-3">
                <span className={`w-2 h-2 rounded-full ${col.accent}`} />
                <span className="text-[12px] font-semibold text-ink">{col.label}</span>
                <span className="ml-auto text-[10px] text-slate-400 bg-white border border-slate-100 rounded-full px-1.5 py-0.5">{counts[col.id] || 0}</span>
              </div>

              <div className="space-y-2">
                {tasks.filter(t => t.col === col.id).map(t => (
                  <div key={t.id} draggable onDragStart={e => e.dataTransfer.setData('text/task-id', t.id)}
                    className="rounded-xl border border-slate-200 bg-white p-3 cursor-grab active:cursor-grabbing hover:shadow-float transition group">
                    <div className="flex items-start gap-1.5">
                      <GripVertical size={12} className="text-slate-200 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                      <div className="text-[12px] font-medium text-ink leading-snug flex-1">{t.title}</div>
                    </div>
                    {t.sub && <div className="text-[10px] text-slate-400 mt-1 leading-snug">{t.sub}</div>}
                    {(t.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.tags.map(tag => (
                          <span key={tag} className="text-[9px] text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-1.5 py-0.5">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <AgentAvatar seed={t.agent} size={18} className="rounded-md" />
                      <span className="text-[10px] text-slate-400 truncate">{t.agent}</span>
                      <span className={`ml-auto w-1.5 h-1.5 rounded-full ${PRI[t.priority] || PRI.med}`} title={`${t.priority} priority`} />
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Clock size={9} />{t.due}</span>
                    </div>
                    {col.id === 'approval' && (
                      <Can perm="approve" fallback={
                        <div className="mt-2.5 text-[10px] text-slate-400 italic">Manager or owner approval required</div>
                      }>
                        <button onClick={() => approve(t)}
                          className="mt-2.5 w-full text-[11px] font-medium bg-ink text-white rounded-lg py-1.5 hover:bg-ink/85 transition flex items-center justify-center gap-1">
                          <CheckCheck size={11} /> Approve & complete
                        </button>
                      </Can>
                    )}
                  </div>
                ))}
              </div>

              {col.id === 'todo' && (
                <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-white/60 px-2.5 py-1.5">
                  <Plus size={12} className="text-slate-300 shrink-0" />
                  <input value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && add('todo')}
                    placeholder="Add a task…"
                    className="flex-1 text-[11px] bg-transparent focus:outline-none placeholder:text-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>
        </div>
      </main>
    </AppShell>
  )
}
