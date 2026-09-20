// Reports — pick a report type, backend aggregates real tenant data into a
// business_report artifact, rendered here + exportable as a branded PDF.
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { AppShell } from '../components/AppShell.jsx'
import { ARTIFACT_TEMPLATES } from '../components/artifacts/index.jsx'
import { ThinkingOrb } from 'thinking-orbs'
import { toast } from '../lib/toast.js'
import {
  FileBarChart, Hourglass, TrendingUp, Receipt, Bot, Download,
  Share2, Globe, Lock, ChevronRight, Sparkles,
} from 'lucide-react'

const TYPE_ICON = {
  business_overview: FileBarChart, receivables_aging: Hourglass,
  cashflow_forecast: TrendingUp, gst_summary: Receipt, ops_digest: Bot,
}
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export default function Reports() {
  const [types, setTypes] = useState([])
  const [sel, setSel] = useState('business_overview')
  const [title, setTitle] = useState('')
  const [share, setShare] = useState(false)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState(null)      // artifact row being viewed
  const [history, setHistory] = useState([])
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => { api.reportTypes().then(setTypes).catch(() => {}) }, [])
  const loadHistory = () =>
    api.artifacts().then(a => setHistory(a.filter(x => x.template === 'business_report')
      .sort((x, y) => y.created_at.localeCompare(x.created_at)))).catch(() => {})
  useEffect(() => { loadHistory() }, [])

  const generate = async () => {
    setBusy(true)
    try {
      const row = await api.generateReport(sel, title.trim(), share ? 'public' : 'private')
      setReport(row); setTitle(''); loadHistory()
      toast('Report generated', 'ok')
    } catch (e) { toast(`Couldn't generate — ${e.message}`, 'err') }
    setBusy(false)
  }

  const exportPdf = async (row = report) => {
    if (!row) return
    setPdfBusy(true)
    try {
      const { blob, filename } = await api.reportPdf(row.id, row.visibility === 'public')
      downloadBlob(blob, filename)
      toast('PDF downloaded', 'ok')
    } catch { toast('PDF export needs the backend', 'err') }
    setPdfBusy(false)
  }

  const toggleShare = async () => {
    if (!report) return
    const vis = report.visibility === 'public' ? 'private' : 'public'
    try {
      const row = await api.updateArtifact(report.id, { visibility: vis })
      setReport(row); loadHistory()
      if (vis === 'public') {
        const link = `${location.origin}${location.pathname}#${row.share_path}`
        navigator.clipboard?.writeText(link)
        toast('Public link copied — anyone with it can view + download PDF', 'ok')
      } else toast('Report made private', 'ok')
    } catch (e) { toast(e.message, 'err') }
  }

  const Report = report && ARTIFACT_TEMPLATES[report.template]
  const selType = types.find(t => t.id === sel)

  return (
    <AppShell>
      <main className="flex-1 overflow-y-auto scroll-thin bg-[#fbfbfd]">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">Reports</h1>
          <p className="text-[12px] text-slate-500 mt-1 mb-6">
            Real documents built from live data — every number traced to your ledgers. Export as PDF or share as a live link.
          </p>

          {/* ── builder ── */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4">
            {types.map((t, i) => {
              const I = TYPE_ICON[t.id] || FileBarChart
              const on = sel === t.id
              return (
                <button key={t.id} onClick={() => setSel(t.id)}
                  className={`text-left rounded-2xl border p-3.5 transition animate-popIn active:scale-[.98]
                    ${on ? 'border-ink bg-white shadow-float ring-1 ring-ink' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  style={{ animationDelay: `${i * 40}ms` }}>
                  <span className={`w-7 h-7 rounded-lg grid place-items-center mb-2 ${on ? 'bg-ink text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <I size={13} />
                  </span>
                  <div className="text-[12px] font-semibold text-ink leading-tight">{t.name}</div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">{t.desc}</div>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 mb-8 flex-wrap">
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={selType ? `${selType.name} — optional custom title` : 'Optional custom title'}
              className="flex-1 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] focus:outline-none focus:border-ink transition" />
            <button onClick={() => setShare(s => !s)} type="button"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11.5px] font-medium transition
                ${share ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
              {share ? <><Globe size={12} /> Share publicly</> : <><Lock size={12} /> Keep private</>}
            </button>
            <button onClick={generate} disabled={busy}
              className="rounded-xl bg-ink text-white px-5 py-2 text-[12.5px] font-medium hover:bg-ink/85 active:scale-95 transition disabled:opacity-40 flex items-center gap-2">
              {busy ? <><ThinkingOrb size={20} state="composing" /> Building…</> : <><Sparkles size={12} /> Generate report</>}
            </button>
          </div>

          {/* ── the generated document ── */}
          {report && Report && (
            <div className="mb-10 animate-riseIn">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-float-lg overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-accent/10 text-accent grid place-items-center shrink-0"><FileBarChart size={12} /></span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-ink truncate">{report.title}</div>
                      <div className="text-[9px] text-slate-400">
                        {report.data?.business} · generated {fmtDate(report.created_at)}
                        {report.visibility === 'public' && ' · public link live'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => exportPdf()} disabled={pdfBusy}
                      className="flex items-center gap-1.5 rounded-lg bg-ink text-white px-3 py-1.5 text-[11px] font-medium hover:bg-ink/85 active:scale-95 transition disabled:opacity-40">
                      <Download size={11} /> {pdfBusy ? 'Building…' : 'Export PDF'}
                    </button>
                    <button onClick={toggleShare}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition
                        ${report.visibility === 'public'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-slate-200 text-slate-600 hover:border-ink'}`}>
                      {report.visibility === 'public' ? <><Globe size={11} /> Public · make private</> : <><Share2 size={11} /> Share link</>}
                    </button>
                  </div>
                </div>
                <div className="px-7 py-6 max-w-3xl mx-auto">
                  <div className="text-[9px] font-bold text-accent uppercase tracking-[0.2em] mb-1">Sahayak</div>
                  <div className="text-[20px] font-semibold tracking-tight text-ink mb-4">{report.title}</div>
                  <Report data={report.data} />
                </div>
                <div className="px-7 py-3 border-t border-slate-100 text-[9px] text-slate-400 flex items-center justify-between">
                  <span>Generated by Sahayak · figures from live tenant data</span>
                  <span>{report.id}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── history ── */}
          {history.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Previous reports</div>
              <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition">
                    <FileBarChart size={14} className="text-slate-300 shrink-0" />
                    <button onClick={() => setReport(h)} className="flex-1 min-w-0 text-left">
                      <div className="text-[12.5px] font-medium text-ink truncate">{h.title}</div>
                      <div className="text-[9px] text-slate-400">{fmtDate(h.created_at)} · {h.created_by}</div>
                    </button>
                    {h.visibility === 'public' &&
                      <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5 uppercase">Public</span>}
                    <button onClick={() => exportPdf(h)} title="Download PDF"
                      className="w-7 h-7 rounded-lg grid place-items-center text-slate-400 hover:text-ink hover:bg-slate-100 transition">
                      <Download size={12} />
                    </button>
                    {h.visibility === 'public' && h.share_path && (
                      <a href={`#${h.share_path}`} title="Open public page"
                        className="w-7 h-7 rounded-lg grid place-items-center text-slate-400 hover:text-ink hover:bg-slate-100 transition">
                        <ChevronRight size={12} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!report && history.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-10 text-center text-[12px] text-slate-400">
              Pick a report above and hit <b>Generate</b> — the backend aggregates your live invoices,
              payables, alerts and agent activity into a shareable document.
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
