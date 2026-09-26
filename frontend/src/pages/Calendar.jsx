// Calendar — ReverseUI "adaptive-precision" recreation: a day timeline where
// the cursor snaps to the granularity chosen on the fractional slider
// (15/30/60 min), events render as positioned blocks, drag on empty space
// creates a new event slot. Events come from /calendar/events w/ demo fallback.
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import { FractionalSlider } from '../components/rui/FractionalSlider.jsx'
import { AppShell } from '../components/AppShell.jsx'
import {
  ChevronLeft, ChevronRight, CalendarDays, Bell, Receipt, Truck, Sparkles,
} from 'lucide-react'

const START_H = 8, END_H = 20, ROW_PX = 56
const KIND_ICON = { reminder: Bell, invoice: Receipt, logistics: Truck, agent: Sparkles, task: CalendarDays }
// backend /calendar/events kinds → display kinds
const KIND_MAP = { invoice_due: 'invoice', alert: 'reminder', booking: 'logistics' }
const KIND_TINT = {
  reminder: 'bg-accent/10 border-accent/30 text-accent',
  invoice: 'bg-magenta/10 border-magenta/30 text-magenta',
  logistics: 'bg-emerald-50 border-emerald-300/60 text-emerald-700',
  agent: 'bg-violet-50 border-violet-300/60 text-violet-700',
  task: 'bg-slate-100 border-slate-300 text-slate-600',
}

const toMin = (t) => { const [h, m] = (t || '09:00').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
// backend events carry {date: 'YYYY-MM-DD', kind: invoice_due|alert|task} —
// map kind → display kind, keep `day` for per-day filtering. Date-only events
// have no time, so stagger them through the morning instead of stacking at 09:00.
const normEvent = (ev, i) => {
  const kind = KIND_MAP[ev.kind] || ev.kind || 'task'
  const iso = ev.start?.includes?.('T') ? ev.start : (ev.at || ev.date || '').includes('T') ? (ev.at || ev.date) : null
  if (iso) {
    const d = new Date(iso)
    const start = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    const e2 = new Date(d.getTime() + (ev.duration_min || 30) * 60000)
    return { ...ev, id: ev.id || `ev-${i}`, kind, day: ev.date?.slice(0, 10), start, end: fmt(e2.getHours() * 60 + e2.getMinutes()) }
  }
  const slot = ev.start || ev.time || fmt(9 * 60 + (i % 8) * 45)
  return {
    ...ev, id: ev.id || `ev-${i}`, kind, day: ev.date || ev.day,
    start: slot,
    end: ev.end || fmt(toMin(slot) + 30),
  }
}
const fmt = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
const fmtLabel = (mins) => { const h = Math.floor(mins / 60), ap = h >= 12 ? 'PM' : 'AM', hh = ((h + 11) % 12) + 1; return `${hh}:${String(mins % 60).padStart(2, '0')} ${ap}` }

export default function Calendar() {
  const [events, setEvents] = useState([])
  const [granularity, setGranularity] = useState(15)          // 15/30/60 via fractional slider
  const [dayOffset, setDayOffset] = useState(0)
  const [draft, setDraft] = useState(null)                    // {start,end} mins while dragging
  const [cursor, setCursor] = useState(null)                  // snapped minute under cursor
  const [cursorY, setCursorY] = useState(0)
  const gridRef = useRef(null)

  const date = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + dayOffset); return d }, [dayOffset])
  const dateLabel = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  // real events carry `day` (YYYY-MM-DD) — only show the displayed day's events;
  // demo/local events have no day → always render (offline fallback)
  const dayStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const dayEvents = events.filter(ev => !ev.day || ev.day === dayStr)

  useEffect(() => {
    api.calendarEvents?.()
      .then(ev => setEvents((ev || []).map(normEvent)))
      .catch(() => setEvents([]))
  }, [])

  const hours = useMemo(() => Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i), [])
  const snap = (mins) => Math.round(mins / granularity) * granularity
  const clamp = (m) => Math.min(END_H * 60, Math.max(START_H * 60, m))

  const yToMin = (clientY) => {
    const r = gridRef.current.getBoundingClientRect()
    return clamp(START_H * 60 + ((clientY - r.top) / r.height) * (END_H - START_H) * 60)
  }

  const onMove = (e) => {
    const m = yToMin(e.clientY)
    setCursor(snap(m)); setCursorY(e.clientY - gridRef.current.getBoundingClientRect().top)
    if (draft) setDraft(d => ({ ...d, end: Math.max(d.start + granularity, snap(m)) }))
  }

  const startDraft = (e) => {
    if (e.target.closest('[data-event]')) return
    const s = snap(yToMin(e.clientY))
    setDraft({ start: s, end: s + granularity })
  }

  const commitDraft = () => {
    if (draft) {
      const title = window.prompt('New event title', 'Follow-up')
      if (title) setEvents(ev => [...ev, { id: `local-${Date.now()}`, title, kind: 'task', start: fmt(draft.start), end: fmt(draft.end) }])
    }
    setDraft(null)
  }

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-4xl mx-auto px-6 py-6">
        {/* controls row */}
        <div className="flex items-end justify-between gap-8 mb-5 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => setDayOffset(d => d - 1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white grid place-items-center hover:border-slate-300 transition"><ChevronLeft size={14} /></button>
            <div className="min-w-[150px]">
              <div className="text-[18px] font-semibold tracking-tight text-ink">{dateLabel}</div>
              <div className="text-[10px] text-slate-400">{dayOffset === 0 ? 'today' : dayOffset > 0 ? `in ${dayOffset}d` : `${-dayOffset}d ago`} · {dayEvents.length} events</div>
            </div>
            <button onClick={() => setDayOffset(d => d + 1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white grid place-items-center hover:border-slate-300 transition"><ChevronRight size={14} /></button>
            <button onClick={() => setDayOffset(0)} className="text-[11px] font-medium text-accent hover:text-ink transition ml-1">Today</button>
          </div>
          <div className="w-56">
            <FractionalSlider label="Snap granularity" unit="m" min={15} max={60} step={15} major={15}
              value={granularity} onChange={setGranularity} />
          </div>
        </div>

        {/* adaptive-precision timeline */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-float overflow-hidden">
          <div ref={gridRef} onPointerDown={startDraft} onPointerMove={onMove} onPointerUp={commitDraft}
            onPointerLeave={() => { setCursor(null); commitDraft() }}
            className="relative select-none" style={{ height: (END_H - START_H) * ROW_PX }}>
            {/* hour rows */}
            {hours.map(h => (
              <div key={h} className="absolute inset-x-0 flex items-start pointer-events-none"
                style={{ top: (h - START_H) * ROW_PX }}>
                <span className="w-14 shrink-0 text-[10px] text-slate-400 text-right pr-3 -translate-y-1.5 tabular-nums">
                  {h < END_H ? fmtLabel(h * 60).replace(':00', '') : ''}
                </span>
                <span className="flex-1 h-px bg-slate-100" />
              </div>
            ))}
            {/* sub-grid lines at granularity */}
            {granularity < 60 && hours.slice(0, -1).flatMap(h =>
              Array.from({ length: 60 / granularity - 1 }, (_, i) => (h * 60) + (i + 1) * granularity).map(m => (
                <span key={m} className="absolute left-14 right-0 h-px bg-slate-50 pointer-events-none"
                  style={{ top: ((m - START_H * 60) / 60) * ROW_PX }} />
              ))
            )}
            {/* snapped cursor */}
            {cursor != null && !draft && (
              <div className="absolute left-14 right-4 pointer-events-none z-20"
                style={{ top: ((cursor - START_H * 60) / 60) * ROW_PX }}>
                <span className="absolute -top-px inset-x-0 h-px bg-accent/50" />
                <span className="absolute -top-[9px] left-2 text-[9px] font-mono font-semibold text-accent bg-white px-1 rounded">
                  {fmtLabel(cursor)}
                </span>
              </div>
            )}
            {/* events */}
            {dayEvents.map(ev => {
              const top = ((toMin(ev.start) - START_H * 60) / 60) * ROW_PX
              const h = Math.max(24, ((toMin(ev.end) - toMin(ev.start)) / 60) * ROW_PX)
              const I = KIND_ICON[ev.kind] || CalendarDays
              return (
                <div key={ev.id} data-event
                  className={`absolute left-16 right-4 rounded-lg border px-2.5 py-1.5 overflow-hidden cursor-default hover:shadow-float transition ${KIND_TINT[ev.kind] || KIND_TINT.task}`}
                  style={{ top, height: h }}>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold truncate"><I size={11} className="shrink-0" />{ev.title}</div>
                  <div className="text-[9px] opacity-70 mt-0.5">{fmtLabel(toMin(ev.start))} – {fmtLabel(toMin(ev.end))}</div>
                </div>
              )
            })}
            {/* honest empty state — no fabricated stand-ins */}
            {!dayEvents.length && !draft && (
              <div className="absolute left-16 right-4 top-4 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[10px] text-slate-400 pointer-events-none">
                Nothing scheduled — invoice due-dates, reminder fires and task deadlines land here.
              </div>
            )}
            {/* draft block */}
            {draft && (
              <div className="absolute left-16 right-4 rounded-lg border-2 border-dashed border-accent bg-accent/10 z-10 pointer-events-none"
                style={{ top: ((draft.start - START_H * 60) / 60) * ROW_PX, height: ((draft.end - draft.start) / 60) * ROW_PX }}>
                <span className="absolute -top-5 left-0 text-[9px] font-semibold text-accent">
                  New event · {fmtLabel(draft.start)} – {fmtLabel(draft.end)}
                </span>
              </div>
            )}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-4">
            <span>Drag on empty space to create an event</span>
            <span className="ml-auto">Cursor snaps to {granularity} min</span>
          </div>
        </div>
        </div>
      </main>
    </AppShell>
  )
}
