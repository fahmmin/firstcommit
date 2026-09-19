import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { AppShell } from '../components/AppShell.jsx'
import {
  Search as SearchIcon, Receipt, Store, Truck, Bot,
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
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-3xl mx-auto px-6 py-8">
        <form onSubmit={go} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 focus-within:border-ink transition mb-6">
          <SearchIcon size={14} className="text-slate-400" />
          <input value={input} onChange={e => setInput(e.target.value)} autoFocus
            placeholder="Search invoices, suppliers, agents, memory…"
            className="flex-1 text-[13px] focus:outline-none bg-transparent" />
        </form>
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
                  {r.tags && (
                    <div className="ml-auto flex gap-1 shrink-0">
                      {r.tags.map(t => (
                        <span key={t} className="text-[9px] font-medium rounded-full border border-slate-200 bg-slate-50 text-slate-500 px-1.5 py-px">{t}</span>
                      ))}
                    </div>
                  )}
                </a>
              ))}
            </div>
          </section>
        ))}
        {!q && <BrowseCategories />}
        </div>
      </main>
    </AppShell>
  )
}

// Empty state — browsable index of what's searchable, with live counts.
function BrowseCategories() {
  const [counts, setCounts] = useState({})
  useEffect(() => {
    Promise.all([
      api.invoices().catch(() => []), api.suppliers().catch(() => []),
      api.carriers().catch(() => []), api.agents().catch(() => []),
      api.memories().catch(() => []), api.artifacts().catch(() => []),
    ]).then(([inv, sup, car, ag, mem, art]) => setCounts({
      invoices: inv.length, suppliers: sup.length, carriers: car.length,
      agents: ag.length, memories: mem.length, documents: art.length,
    }))
  }, [])
  return (
    <div>
      <div className="text-center py-8">
        <div className="text-[16px] font-medium text-ink">Search your whole workspace</div>
        <div className="text-[11px] text-slate-400 mt-1">Invoices, suppliers, carriers, agents, tasks, business memory, documents — one box.</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {GROUPS.map(([k, label, I]) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white p-4">
            <I size={15} className="text-slate-400 mb-2" />
            <div className="text-[13px] font-semibold text-ink">{label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{counts[k] ?? '…'} searchable</div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-2 flex-wrap justify-center">
        {['tax', 'sharma', 'overdue', 'steel', 'ludhiana'].map(t => (
          <a key={t} href={`#/search/${t}`}
            className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:border-ink hover:text-ink transition">
            try “{t}”
          </a>
        ))}
      </div>
    </div>
  )
}
