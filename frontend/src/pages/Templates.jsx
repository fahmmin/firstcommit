import { api } from '../api.js'
import { TEMPLATES } from '../lib/templates.js'
import { ArrowLeft, ArrowRight, Search } from 'lucide-react'
import { useState } from 'react'

// Template gallery — pick one → prefills the workspace composer → Generate.
export default function Templates() {
  const [q, setQ] = useState('')
  const list = TEMPLATES.filter(t => !q || `${t.title} ${t.desc} ${t.prompt}`.toLowerCase().includes(q.toLowerCase()))

  const use = (t) => {
    localStorage.setItem('prefill_prompt', t.prompt)
    location.hash = '#/app'
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] font-sans">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 h-[52px] flex items-center justify-between">
          <a href="#/app" className="flex items-center gap-2 text-[13px] text-slate-500 hover:text-ink transition">
            <ArrowLeft size={14} /> Back to app
          </a>
          <div className="text-[13px] font-semibold text-ink">Templates</div>
          <span className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Start from a template</h1>
            <p className="text-[12px] text-slate-500 mt-1">Proven prompts for common jobs — pick one, edit it, hit Generate.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 w-64 focus-within:border-ink transition">
            <Search size={13} className="text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates…"
              className="flex-1 text-[12px] focus:outline-none bg-transparent" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map(t => (
            <button key={t.id} onClick={() => use(t)}
              className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-ink/40 hover:shadow-float transition group flex flex-col">
              <span className={`w-9 h-9 rounded-xl grid place-items-center mb-3 ${t.tint}`}>
                <t.icon size={16} />
              </span>
              <div className="text-[13px] font-semibold text-ink leading-tight group-hover:text-accent transition">{t.title}</div>
              <div className="text-[11px] text-slate-400 mt-1 leading-snug">{t.desc}</div>
              <div className="mt-3 pt-3 border-t border-slate-50 text-[10px] text-slate-400 italic leading-snug line-clamp-2 flex-1">
                “{t.prompt}”
              </div>
              <div className="mt-3 text-[11px] font-medium text-accent flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                Use this <ArrowRight size={11} />
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
