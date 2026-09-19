import { useEffect, useState } from 'react'
import { api, TENANT } from '../api.js'
import { ArrowLeft, Brain, Plus, Trash2, Sparkles, CheckCircle2 } from 'lucide-react'

const SUGGESTED = [
  'Sharma Traders always pays around 45 days — don’t push hard',
  'Big orders go through GST invoice only',
  'VRL is our backup transporter for the Ludhiana route',
  'Diwali season: stock fasteners + brake pads 3 weeks early',
]

const SOURCE_STYLE = { owner: 'bg-ink/5 text-ink', onboarding: 'bg-accent/10 text-accent', agent: 'bg-magenta/10 text-magenta' }

export default function Context() {
  const [memories, setMemories] = useState([])
  const [text, setText] = useState('')
  const [added, setAdded] = useState(false)

  const load = () => api.memories().then(setMemories).catch(() => setMemories([]))
  useEffect(load, [])

  const add = async (t) => {
    const v = (t ?? text).trim()
    if (!v) return
    await api.addMemory(v).catch(() => {})
    setText(''); load()
    setAdded(true); setTimeout(() => setAdded(false), 1400)
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] font-sans">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 h-[52px] flex items-center justify-between">
          <a href="#/app" className="flex items-center gap-2 text-[13px] text-slate-500 hover:text-ink transition">
            <ArrowLeft size={14} /> Back to app
          </a>
          <div className="text-[13px] font-semibold text-ink">Business context</div>
          <span className="text-[11px] text-slate-400">{TENANT}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-accent/10 text-accent grid place-items-center shrink-0"><Brain size={18} /></div>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">What Sahayak knows about your business</h1>
            <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
              Every note below is injected into your agents' context — they genuinely use it in replies,
              drafts and decisions. Add anything an experienced employee would know.
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder='e.g. "Khanna Industries negotiates hard — quote 5% higher first"'
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] focus:outline-none focus:border-ink shadow-float transition" />
          <button onClick={() => add()}
            className="rounded-xl bg-ink text-white px-5 text-[13px] font-medium flex items-center gap-1.5 hover:bg-ink/85 transition">
            {added ? <CheckCircle2 size={13} className="text-emerald-300" /> : <Plus size={13} />} Add
          </button>
        </div>

        <div className="space-y-2.5 mb-8">
          {memories.map(m => (
            <div key={m.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 hover:shadow-float transition">
              <Brain size={14} className="text-accent mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-ink leading-snug">{m.text}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[9px] font-medium rounded px-1.5 py-0.5 ${SOURCE_STYLE[m.source] || 'bg-slate-100 text-slate-500'}`}>{m.source || 'owner'}</span>
                  <span className="text-[9px] text-slate-300">{new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
              </div>
              <button onClick={async () => { await api.delMemory(m.id).catch(() => {}); load() }}
                className="text-slate-300 hover:text-rose-500 transition shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
          {memories.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-[12px] text-slate-400">
              Nothing yet — your agents are running blind.
            </div>
          )}
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5"><Sparkles size={11} className="text-accent" /> Suggested</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {SUGGESTED.filter(s => !memories.some(m => m.text === s)).map(s => (
              <button key={s} onClick={() => add(s)}
                className="text-left rounded-xl border border-dashed border-slate-300 px-3.5 py-3 text-[12px] text-slate-500 hover:border-accent hover:text-ink transition">
                + {s}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
