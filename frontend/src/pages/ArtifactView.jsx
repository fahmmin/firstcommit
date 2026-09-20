import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { Blobs } from '../components/Logo.jsx'
import { ARTIFACT_TEMPLATES } from '../components/artifacts/index.jsx'
import { Share2, Check, Sparkles, Globe, Lock } from 'lucide-react'

// Shareable artifact page — #/a/:id. Public: no auth required.
export default function ArtifactView({ param }) {
  const [art, setArt] = useState(null)
  const [err, setErr] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!param) { setErr('No artifact id'); return }
    api.publicArtifact(param).then(setArt)
      .catch(() => setErr('Artifact not found — it may be private, or the link is wrong.'))
  }, [param])

  const copy = () => {
    navigator.clipboard?.writeText(location.href)
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }

  const Template = art && ARTIFACT_TEMPLATES[art.template]

  return (
    <div className="min-h-screen bg-[#fbfbfd] font-sans flex flex-col">
      <header className="px-6 h-[52px] flex items-center justify-between border-b border-slate-100 bg-white/85 backdrop-blur sticky top-0">
        <a href="#/" className="flex items-center gap-2">
          <Blobs />
          <span className="font-semibold text-[14px] tracking-tight text-ink">Sahayak</span>
        </a>
        {art && (
          <button onClick={copy}
            className="flex items-center gap-1.5 text-[11px] font-medium rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-ink hover:text-ink transition">
            {copied ? <><Check size={11} className="text-emerald-500" /> Copied</> : <><Share2 size={11} /> Share link</>}
          </button>
        )}
      </header>

      <main className="flex-1 grid place-items-center px-6 py-10">
        <div className="w-full max-w-[440px]">
          {err && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-[13px] text-slate-500">{err}</div>}
          {!art && !err && <div className="text-center text-[12px] text-slate-400 animate-pulse">Loading artifact…</div>}
          {art && (
            <div className="rounded-3xl border border-slate-200 bg-white shadow-float p-6">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
                <div className="text-[15px] font-semibold text-ink">{art.title}</div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 uppercase tracking-wide flex items-center gap-1 ${
                    art.visibility === 'public' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-100'}`}>
                    {art.visibility === 'public' ? <><Globe size={9} /> Public</> : <><Lock size={9} /> Private</>}
                  </span>
                  <span className="text-[9px] font-bold text-accent bg-accent/10 rounded px-1.5 py-0.5 uppercase tracking-wide">Live</span>
                </div>
              </div>
              {Template ? <Template data={art.data} /> : (
                <pre className="text-[11px] text-slate-500 whitespace-pre-wrap">{JSON.stringify(art.data, null, 2)}</pre>
              )}
            </div>
          )}
          {art && (
            <div className="text-center text-[10px] text-slate-400 mt-5 flex items-center justify-center gap-1">
              <Sparkles size={10} className="text-accent" />
              Built by {art.created_by || 'a Sahayak agent'} · {new Date(art.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
