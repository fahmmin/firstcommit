import { useEffect, useState } from 'react'
import { api } from '../api.js'
import {
  ArrowLeft, Search as SearchIcon, Receipt, Store, Truck, Bot,
  ClipboardList, Brain, FileText,
} from 'lucide-react'

const GROUPS = [
  ['invoices', 'Invoices', Receipt],
  ['suppliers', 'Suppliers', Store],
  ['carriers', 'Carriers', Truck],
  ['agents', 'Agents', Bot],
  ['tasks', 'Tasks', ClipboardList],
  ['memories', 'Business memory', Brain],
  ['documents', 'Documents', FileText],
]

export default function Search({ param }) {
  const q = decodeURIComponent(param || '')
  const [input, setInput] = useState(q)
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!q) { setRes(null); return }
    setLoading(true)
    api.search(q).then(setRes).catch(() => setRes(null)).finally(() => setLoading(false))
  }, [q])

  const go = (e) => { e.preventDefault(); if (input.trim()) location.hash = `#/search/${encodeURIComponent(input.trim())}` }
  const groups = GROUPS.map(([k, l, I]) => [k, l, I, res?.results?.[k] || []]).filter(([, , , rows]) => rows.length)

  return (
    <div className="min-h-screen bg-[#fbfbfd] font-sans">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 h-[52px] flex items-center gap-4">
          <a href="#/app" className="text-slate-400 hover:text-ink transition"><ArrowLeft size={15} /></a>
          <form onSubmit={go} className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 focus-within:border-ink transition">
            <SearchIcon size={14} className="text-slate-400" />
            <input value={input} onChange={e => setInput(e.target.value)} autoFocus
              placeholder="Search invoices, suppliers, agents, memory…"
              className="flex-1 text-[13px] focus:outline-none bg-transparent" />
          </form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {loading && <div className="text-[12px] text-slate-400 animate-pulse">Searching…</div>}
        {!loading && q && res && groups.length === 0 &&
          <div className="text-center py-16">
            <div className="text-[14px] text-slate-500">Nothing found for “{q}”</div>
            <div className="text-[11px] text-slate-400 mt-1">Search matches titles, descriptions and metadata across your workspace.</div>
          </div>}
        {groups.map(([k, label, I, rows]) => (
          <section key={k} className="mb-6">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <I size={11} /> {label} <span className="text-slate-300">({rows.length})</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-50 overflow-hidden">
              {rows.map(r => (
                <a key={r.id} href={r.ref || '#/app'}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition">
                  <I size={14} className="text-slate-300 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink truncate">{r.title}</div>
                    {r.meta && <div className="text-[11px] text-slate-400 truncate">{r.meta}</div>}
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}
        {!q && <div className="text-center py-16 text-[13px] text-slate-400">Type to search across your entire workspace.</div>}
      </main>
    </div>
  )
}
