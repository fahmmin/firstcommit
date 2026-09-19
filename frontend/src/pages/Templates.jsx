import { api } from '../api.js'
import { TEMPLATES } from '../lib/templates.js'
import { AgentAvatar } from '../lib/avatar.jsx'
import { AppShell } from '../components/AppShell.jsx'
import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'

const CATS = ['All', 'Money', 'Procurement', 'Logistics', 'New agent', 'Presence']

// Template gallery — pick one → prefills the workspace composer → Generate.
export default function Templates() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')

  const match = t =>
    (!q || `${t.title} ${t.desc} ${t.prompt}`.toLowerCase().includes(q.toLowerCase())) &&
    (cat === 'All' || t.cat === cat)
  const featured = TEMPLATES.find(t => t.featured && match(t))
  const list = TEMPLATES.filter(t => !t.featured && match(t))

  const use = (t) => {
    localStorage.setItem('prefill_prompt', t.prompt)
    location.hash = '#/app'
  }

  const Header = ({ t, h = 'h-24' }) => (
    <div className={`relative ${h} overflow-hidden`} style={t.bg}>
      {/* dot-grid texture over the mesh */}
      <div className="absolute inset-0 opacity-[0.35]"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
      <span className={`absolute -bottom-3 left-4 w-10 h-10 rounded-xl grid place-items-center shadow-float border border-white/60 backdrop-blur ${t.tint}`}>
        <t.icon size={17} />
      </span>
      <span className="absolute top-3 right-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600/70 bg-white/50 backdrop-blur px-2 py-0.5 rounded-full">
        {t.cat}
      </span>
    </div>
  )

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-ink">Start from a template</h1>
            <p className="text-[12px] text-slate-500 mt-1">Proven prompts for common jobs — pick one, edit it, hit Generate.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 w-64 focus-within:border-ink transition">
            <Search size={13} className="text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates…"
              className="flex-1 text-[12px] focus:outline-none bg-transparent" />
          </div>
        </div>

        {/* category filter chips */}
        <div className="flex items-center gap-1.5 mb-7 flex-wrap">
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`text-[11px] font-medium rounded-full px-3 py-1.5 transition border
                ${cat === c ? 'bg-ink text-white border-ink' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
              {c}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-400">{list.length + (featured ? 1 : 0)} templates</span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* featured card — spans 2 cols with a taller backdrop */}
          {featured && (
            <button onClick={() => use(featured)}
              className="sm:col-span-2 text-left rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-ink/40 hover:shadow-float-lg transition group flex flex-col">
              <Header t={featured} h="h-32" />
              <div className="p-5 pt-6 flex flex-col flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                  <Sparkles size={10} /> Featured
                </div>
                <div className="text-[16px] font-semibold text-ink leading-tight mt-1 group-hover:text-accent transition">{featured.title}</div>
                <div className="text-[12px] text-slate-500 mt-1 leading-snug">{featured.desc}</div>
                <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400 italic leading-snug line-clamp-2 flex-1">
                  “{featured.prompt}”
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <AgentAvatar seed={featured.agent} size={18} className="rounded-md" /> runs on {featured.agent}
                  </span>
                  <span className="text-[11px] font-medium text-accent flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    Use this <ArrowRight size={11} />
                  </span>
                </div>
              </div>
            </button>
          )}

          {list.map(t => (
            <button key={t.id} onClick={() => use(t)}
              className="text-left rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-ink/40 hover:shadow-float transition group flex flex-col">
              <Header t={t} />
              <div className="p-4 pt-6 flex flex-col flex-1">
                <div className="text-[13px] font-semibold text-ink leading-tight group-hover:text-accent transition">{t.title}</div>
                <div className="text-[11px] text-slate-400 mt-1 leading-snug">{t.desc}</div>
                <div className="mt-3 pt-3 border-t border-slate-50 text-[10px] text-slate-400 italic leading-snug line-clamp-2 flex-1">
                  “{t.prompt}”
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <AgentAvatar seed={t.agent} size={16} className="rounded" /> {t.agent}
                  </span>
                  <span className="text-[11px] font-medium text-accent flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    Use this <ArrowRight size={11} />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {list.length === 0 && !featured && (
          <div className="text-center py-16 text-slate-400 text-sm">No templates match “{q}”.</div>
        )}
        </div>
      </main>
    </AppShell>
  )
}
