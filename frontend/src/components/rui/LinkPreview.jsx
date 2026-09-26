// ReverseUI "link-preview" recreation — inline links get a hover-activated
// floating card (favicon, domain, resolved title) that tracks the link.
// URLs found in message text render as links; the first also gets a card.
import { useMemo } from 'react'
import { ExternalLink, Globe } from 'lucide-react'

const URL_RE = /(https?:\/\/[^\s"'<>)\]]+|www\.[^\s"'<>)\]]+)/g

// Deterministic titles for known demo domains; others get a prettified slug.
const KNOWN = {
  'porter.in': 'Porter — intra-city logistics',
  'delhivery.com': 'Delhivery — courier & freight',
  'vrlgroup.in': 'VRL Logistics',
  'razorpay.com': 'Razorpay — payments',
  'gst.gov.in': 'GST portal',
  'morth.nic.in': 'MoRTH — transport authority',
}

const meta = (raw) => {
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    const host = u.hostname.replace(/^www\./, '')
    const slug = decodeURIComponent(u.pathname).split('/').filter(Boolean).pop()
    const title = KNOWN[host] || (slug ? slug.replace(/[-_]/g, ' ').replace(/\.\w+$/, '') : host)
    return { host, title, href: u.href, favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=64` }
  } catch { return null }
}

export function extractUrls(text) {
  return (text || '').match(URL_RE) || []
}

// Renders message text with live links + hover previews.
export function LinkifiedText({ text }) {
  const parts = useMemo(() => (text || '').split(URL_RE), [text])
  return (
    <>
      {parts.map((p, i) => {
        const mm = /^https?:\/\/|^www\./.test(p) ? meta(p) : null
        if (!mm) return <Bold key={i} text={p} />
        return (
          <span key={i} className="relative group inline-block">
            <a href={mm.href} target="_blank" rel="noreferrer"
              className="text-accent font-medium underline decoration-accent/40 underline-offset-2 hover:decoration-accent break-all">
              {p}
            </a>
            {/* hover card */}
            <span className="pointer-events-none absolute left-0 bottom-full mb-2 w-56 rounded-xl border border-slate-200 bg-white shadow-float-lg p-3 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition z-30">
              <span className="flex items-center gap-2">
                <img src={mm.favicon} alt="" className="w-4 h-4 rounded" loading="lazy"
                  onError={e => { e.currentTarget.style.display = 'none' }} />
                <span className="text-[10px] text-slate-400 font-medium truncate">{mm.host}</span>
              </span>
              <span className="block text-[12px] font-semibold text-ink mt-1.5 leading-snug capitalize">{mm.title}</span>
              <span className="mt-1 text-[9px] text-accent flex items-center gap-1"><ExternalLink size={8} /> opens in new tab</span>
            </span>
          </span>
        )
      })}
    </>
  )
}

// Rich preview card pinned under a message for the first URL found.
export function LinkPreviewCard({ url }) {
  const m = meta(url)
  if (!m) return null
  return (
    <a href={m.href} target="_blank" rel="noreferrer"
      className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-accent hover:shadow-float transition max-w-sm">
      <span className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 grid place-items-center shrink-0 overflow-hidden">
        <img src={m.favicon} alt="" className="w-5 h-5" loading="lazy"
          onError={e => { e.currentTarget.style.display = 'none' }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-semibold text-ink truncate capitalize">{m.title}</span>
        <span className="block text-[10px] text-slate-400 truncate">{m.host}</span>
      </span>
      <Globe size={12} className="text-slate-300 shrink-0" />
    </a>
  )
}

// agents answer in light markdown — render **bold** instead of showing asterisks
function Bold({ text }) {
  const bits = text.split(/\*\*(.+?)\*\*/g)
  return bits.map((b, i) => (i % 2 ? <strong key={i} className="font-semibold text-ink">{b}</strong> : b))
}
