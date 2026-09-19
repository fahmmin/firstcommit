import { useEffect, useRef, useState } from 'react'
import { api, TENANT } from '../api.js'
import { contextStore } from '../lib/context.js'
import { AppShell } from '../components/AppShell.jsx'
import {
  Brain, Plus, Trash2, Sparkles, CheckCircle2, UploadCloud,
  FileText, FileSpreadsheet, Image as ImageIcon, File as FileIcon, StickyNote, Tag,
} from 'lucide-react'

const KIND_ICON = { PDF: FileText, Spreadsheet: FileSpreadsheet, Image: ImageIcon, Video: FileIcon, Note: StickyNote, Doc: FileText, File: FileIcon }
const TAG_TINT = {
  tax: 'bg-rose-50 text-rose-600 border-rose-100', invoices: 'bg-accent/10 text-accent border-accent/20',
  procurement: 'bg-violet-50 text-violet-600 border-violet-100', logistics: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  finance: 'bg-amber-50 text-amber-600 border-amber-100', sales: 'bg-sky-50 text-sky-600 border-sky-100',
  hr: 'bg-teal-50 text-teal-600 border-teal-100', legal: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  general: 'bg-slate-50 text-slate-500 border-slate-200',
}
const SOURCE_STYLE = { owner: 'bg-ink/5 text-ink', onboarding: 'bg-accent/10 text-accent', agent: 'bg-magenta/10 text-magenta' }
const SUGGESTED = [
  'Sharma Traders always pays around 45 days — don’t push hard',
  'Big orders go through GST invoice only',
  'VRL is our backup transporter for the Ludhiana route',
  'Diwali season: stock fasteners + brake pads 3 weeks early',
]

export default function Context() {
  const [items, setItems] = useState([])
  const [memories, setMemories] = useState([])
  const [text, setText] = useState('')
  const [added, setAdded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const load = () => {
    setItems(contextStore.list())
    api.memories().then(setMemories).catch(() => setMemories([]))
  }
  useEffect(load, [])

  const addNote = async (t) => {
    const v = (t ?? text).trim()
    if (!v) return
    contextStore.addNote(v)                       // tagged + searchable instantly
    await api.addMemory(v).catch(() => {})        // real memory seam for agents
    setText(''); load()
    setAdded(true); setTimeout(() => setAdded(false), 1400)
  }

  const drop = (files) => {
    Array.from(files || []).forEach(f => contextStore.addFile(f))
    load()
  }

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto bg-[#fbfbfd]">
        <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-accent/10 text-accent grid place-items-center shrink-0"><Brain size={18} /></div>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Dump it all here — agents organize it</h1>
            <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
              Drop files, paste notes, forward exports. Sahayak auto-tags everything (tax, invoices, logistics…),
              folds it into agent memory, and cites it as a source when you ask related questions.
            </p>
          </div>
        </div>

        {/* drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); drop(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition mb-4
            ${dragging ? 'border-accent bg-accent/5' : 'border-slate-300 bg-white hover:border-accent/60'}`}>
          <UploadCloud size={22} className={`mx-auto mb-2 ${dragging ? 'text-accent' : 'text-slate-400'}`} />
          <div className="text-[13px] font-medium text-ink">Drop files — PDFs, Excel, images, anything</div>
          <div className="text-[10px] text-slate-400 mt-1">Auto-tagged &amp; indexed on drop · searchable instantly</div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { drop(e.target.files); e.target.value = '' }} />
        </div>

        {/* quick note */}
        <div className="flex gap-2 mb-6">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()}
            placeholder='…or type a note: "Khanna Industries negotiates hard — quote 5% higher first"'
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] focus:outline-none focus:border-ink shadow-float transition" />
          <button onClick={() => addNote()}
            className="rounded-xl bg-ink text-white px-5 text-[13px] font-medium flex items-center gap-1.5 hover:bg-ink/85 transition">
            {added ? <CheckCircle2 size={13} className="text-emerald-300" /> : <Plus size={13} />} Add
          </button>
        </div>

        {/* organized store */}
        <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
          <Tag size={11} className="text-accent" /> Organized library
          <span className="text-slate-300 font-normal">— auto-tagged on drop</span>
        </div>
        <div className="space-y-2 mb-8">
          {items.map(it => {
            const I = KIND_ICON[it.kind] || FileIcon
            return (
              <div key={it.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:shadow-float transition">
                <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                  <I size={13} className="text-slate-500" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-ink truncate">{it.name}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {it.tags.map(t => (
                      <span key={t} className={`text-[9px] font-medium rounded-full border px-1.5 py-px ${TAG_TINT[t] || TAG_TINT.general}`}>{t}</span>
                    ))}
                    <span className="text-[9px] text-slate-400">{it.kind} · {it.meta}</span>
                    <span className="text-[9px] text-emerald-600 font-medium ml-auto flex items-center gap-0.5"><CheckCircle2 size={8} /> fed to agents</span>
                  </div>
                </div>
                <button onClick={() => { contextStore.del(it.id); load() }}
                  className="text-slate-300 hover:text-rose-500 transition shrink-0 mt-1"><Trash2 size={13} /></button>
              </div>
            )
          })}
          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-[12px] text-slate-400">
              Nothing yet — drop a file or add a note.
            </div>
          )}
        </div>

        {/* agent memory */}
        <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
          <Brain size={11} className="text-accent" /> Agent memory
          <span className="text-slate-300 font-normal">— injected into every reply</span>
        </div>
        <div className="space-y-2.5 mb-8">
          {memories.map(m => (
            <div key={m.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:shadow-float transition">
              <Brain size={13} className="text-accent mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-ink leading-snug">{m.text}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[9px] font-medium rounded px-1.5 py-0.5 ${SOURCE_STYLE[m.source] || 'bg-slate-100 text-slate-500'}`}>{m.source || 'owner'}</span>
                  <span className="text-[9px] text-slate-300">{new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
              </div>
              <button onClick={async () => { await api.delMemory(m.id).catch(() => {}); load() }}
                className="text-slate-300 hover:text-rose-500 transition shrink-0"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5"><Sparkles size={11} className="text-accent" /> Suggested</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {SUGGESTED.filter(s => !memories.some(m => m.text === s)).map(s => (
              <button key={s} onClick={() => addNote(s)}
                className="text-left rounded-xl border border-dashed border-slate-300 px-3.5 py-3 text-[12px] text-slate-500 hover:border-accent hover:text-ink transition">
                + {s}
              </button>
            ))}
          </div>
        </div>
        </div>
      </main>
    </AppShell>
  )
}
