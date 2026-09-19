import { useEffect, useState } from 'react'
import { api, TENANT } from '../api.js'
import { BrandIcon } from '../components/BrandIcon.jsx'
import {
  ArrowLeft, Server, Braces, Download, Check, Search, TrendingUp,
} from 'lucide-react'

const MCP_CATALOG = [
  { id: 'whatsapp-mcp', name: 'whatsapp-mcp', icon: 'whatsapp', desc: 'Send and read WhatsApp Business messages — reminders land where customers actually reply.', installs: '48.2k', tag: 'messaging' },
  { id: 'sheets-mcp', name: 'google-sheets-mcp', icon: 'sheets', desc: 'Read/write Sheets — your Excel registers become queryable agent tools.', installs: '61.7k', tag: 'data' },
  { id: 'tally-mcp', name: 'tally-mcp', icon: 'tally', desc: 'Tally Prime ledger access — invoices, ledgers, GST reports as tools.', installs: '8.9k', tag: 'accounting' },
  { id: 'razorpay-mcp', name: 'razorpay-mcp', icon: 'razorpay', desc: 'Create payment links and check settlements inside chat.', installs: '22.1k', tag: 'payments' },
  { id: 'drive-mcp', name: 'gdrive-mcp', icon: 'google_drive', desc: 'Search and read files from Google Drive as agent context.', installs: '39.4k', tag: 'storage' },
  { id: 'india-logistics-mcp', name: 'india-logistics-mcp', icon: 'mcp', desc: 'Live tracking webhooks from Indian carriers — Delhivery, VRL, SafeRoad.', installs: '3.2k', tag: 'logistics' },
  { id: 'gmail-mcp', name: 'gmail-mcp', icon: 'gmail', desc: 'Inbox search + send — agents read invoice emails and reply with drafts.', installs: '54.0k', tag: 'messaging' },
  { id: 'zapier-mcp', name: 'zapier-mcp', icon: 'zapier', desc: 'Bridge to 6,000+ apps through Zapier actions.', installs: '71.3k', tag: 'automation' },
  { id: 'fb-marketplace-mcp', name: 'fb-marketplace-mcp', icon: 'facebook', desc: 'Publish + manage Marketplace listings as agent tools.', installs: '11.6k', tag: 'commerce' },
  { id: 'indiamart-mcp', name: 'indiamart-mcp', icon: 'indiamart', desc: 'IndiaMART catalog sync — push products, pull buyer leads.', installs: '6.4k', tag: 'commerce' },
  { id: 'shopify-mcp', name: 'shopify-mcp', icon: 'shopify', desc: 'Create storefronts, manage products and orders via agents.', installs: '33.8k', tag: 'commerce' },
  { id: 'perplexity-mcp', name: 'perplexity-mcp', icon: 'perplexity', desc: 'Web + deep research as a tool — cited answers inside chat.', installs: '27.9k', tag: 'research' },
]

const SKILL_CATALOG = [
  { id: 'gst-reconcile', name: 'GST Reconciliation', icon: 'tally', desc: 'Match GSTR-2A against your purchase register; flag mismatches automatically.', installs: '12.8k', tag: 'compliance' },
  { id: 'voice-notes', name: 'Hindi Voice Notes', icon: 'whatsapp', desc: 'Speak in Hindi/Hinglish — transcribed to actions and ledger entries.', installs: '9.4k', tag: 'input' },
  { id: 'upi-links', name: 'UPI Payment Links', icon: 'phonepe', desc: 'Attach a UPI collect link to every payment reminder.', installs: '18.2k', tag: 'payments' },
  { id: 'festival-forecast', name: 'Festival Demand Forecast', icon: 'mcp', desc: 'Predicts stock needs around Diwali/wedding season from your history.', installs: '6.7k', tag: 'forecast' },
  { id: 'ledger-ocr', name: 'Ledger OCR+', icon: 'excel', desc: 'Reads handwritten bahi-khata photos into structured ledger rows.', installs: '15.1k', tag: 'input' },
  { id: 'credit-score', name: 'Buyer Credit Scoring', icon: 'razorpay', desc: 'Scores buyers on your own payment history before you offer terms.', installs: '11.3k', tag: 'risk' },
  { id: 'catalog-syndication', name: 'Catalog Syndication', icon: 'shopify', desc: 'One product sheet → listings on every marketplace, auto-formatted.', installs: '7.9k', tag: 'commerce' },
  { id: 'geo-seo', name: 'SEO + GEO Optimizer', icon: 'perplexity', desc: 'Keeps listings ranking on Google AND inside AI answers.', installs: '5.5k', tag: 'commerce' },
]

export default function Marketplace() {
  const [tab, setTab] = useState('mcp')
  const [q, setQ] = useState('')
  const [settings, setSettings] = useState(null)
  const [installed, setInstalled] = useState(new Set())

  useEffect(() => {
    api.settings().then(s => {
      setSettings(s)
      const m = new Set((s?.mcp_servers || []).map(x => x.name))
      ;(s?.prefs?.installed_skills || []).forEach(x => m.add(x))
      setInstalled(m)
    }).catch(() => {})
  }, [])

  const install = async (item, kind) => {
    if (installed.has(kind === 'mcp' ? item.id : item.name)) return
    if (kind === 'mcp') {
      const next = [...(settings?.mcp_servers || []),
        { id: item.id, name: item.id, url: `https://skills.sh/${item.id}/sse`, status: 'configured' }]
      await api.updateSettings({ mcp_servers: next }).catch(() => {})
      setSettings(s => ({ ...s, mcp_servers: next }))
      setInstalled(p => new Set(p).add(item.id))
    } else {
      const next = [...(settings?.prefs?.installed_skills || []), item.name]
      await api.updateSettings({ prefs: { installed_skills: next } }).catch(() => {})
      setSettings(s => ({ ...s, prefs: { ...s?.prefs, installed_skills: next } }))
      setInstalled(p => new Set(p).add(item.name))
    }
  }

  const catalog = (tab === 'mcp' ? MCP_CATALOG : SKILL_CATALOG)
    .filter(x => !q || `${x.name} ${x.desc} ${x.tag}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="min-h-screen bg-[#fbfbfd] font-sans">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 h-[52px] flex items-center justify-between">
          <a href="#/app" className="flex items-center gap-2 text-[13px] text-slate-500 hover:text-ink transition">
            <ArrowLeft size={14} /> Back to app
          </a>
          <div className="text-[13px] font-semibold text-ink">Marketplace</div>
          <span className="text-[11px] text-slate-400">{TENANT}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">Extend your agents</h1>
            <p className="text-[12px] text-slate-500 mt-1">MCP servers and skills from the open registry — install once, every agent can use them.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 w-64 focus-within:border-ink transition">
            <Search size={13} className="text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search registry…"
              className="flex-1 text-[12px] focus:outline-none bg-transparent" />
          </div>
        </div>

        <AgentTemplates />

        <div className="flex gap-1 mb-5 rounded-xl border border-slate-200 bg-white p-1 w-fit">
          {[['mcp', 'MCP servers', Server], ['skills', 'Skills', Braces]].map(([k, l, I]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium transition
                ${tab === k ? 'bg-ink text-white' : 'text-slate-500 hover:text-ink'}`}>
              <I size={12} /> {l}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {catalog.map(item => {
            const isInstalled = installed.has(tab === 'mcp' ? item.id : item.name)
            return (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3 hover:shadow-float transition">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 grid place-items-center shrink-0">
                  <BrandIcon id={item.icon} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink font-mono">{item.name}</span>
                    <span className="text-[9px] font-medium text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{item.tag}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">{item.desc}</p>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2">
                    <TrendingUp size={10} /> {item.installs} installs
                  </div>
                </div>
                <button onClick={() => install(item, tab)} disabled={isInstalled}
                  className={`text-[11px] font-medium rounded-lg px-3 py-1.5 shrink-0 transition flex items-center gap-1
                    ${isInstalled ? 'bg-emerald-50 text-emerald-600 cursor-default' : 'bg-ink text-white hover:bg-ink/85'}`}>
                  {isInstalled ? <><Check size={11} /> Installed</> : <><Download size={11} /> Install</>}
                </button>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-slate-400 mt-6 text-center">
          Registry compatible with skills.sh — install any community MCP server or skill by URL.
        </p>
      </main>
    </div>
  )
}

// Hireable agent templates — full agent specs bundled with connectors + skills.
// "Hire" drops the hiring prompt into the workspace composer (Nirmata builds it).
function AgentTemplates() {
  const AGENTS = [
    {
      id: 'digital-presence', name: 'Digital Presence Agent', role: 'Sells your catalogue online',
      desc: 'Publishes products to Facebook Marketplace and IndiaMART, spins up a Shopify storefront, and keeps every listing SEO/GEO-optimized — one prompt, every channel.',
      connectors: ['facebook', 'indiamart', 'shopify', 'instagram'],
      connectorNames: ['Facebook Marketplace', 'IndiaMART', 'Shopify storefront', 'Instagram Shop'],
      skills: ['Catalog syndication', 'SEO + GEO optimization', 'Storefront builder', 'Listing refresh'],
      installs: '4.1k', tag: 'sales',
      prompt: 'I want to sell online. Hire an agent that publishes my products to Facebook Marketplace and IndiaMART, builds me a web storefront, and keeps my listings SEO-optimized.',
    },
    {
      id: 'gst-accountant', name: 'GST Accountant Agent', role: 'Compliance on autopilot',
      desc: 'Watches your ledger for GST mismatches, preps GSTR summaries before filing dates, and flags invoices missing GSTIN.',
      connectors: ['tally', 'gmail'],
      connectorNames: ['Tally Prime', 'Gmail'],
      skills: ['GST reconciliation', 'Filing reminders', 'GSTIN validation'],
      installs: '2.8k', tag: 'compliance',
      prompt: 'Hire an agent that watches my books for GST mismatches and reminds me before every filing deadline.',
    },
  ]
  return (
    <div className="mb-7">
      <div className="text-[11px] font-semibold text-slate-500 mb-2.5 flex items-center gap-1.5">
        <TrendingUp size={11} className="text-accent" /> Featured agent templates
        <span className="text-slate-300 font-normal">— pre-specced, Nirmata hires in one prompt</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {AGENTS.map(a => (
          <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-float transition">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/15 to-magenta/10 border border-slate-100 grid place-items-center text-accent font-bold text-[15px]">
                  {a.name[0]}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-ink">{a.name}</div>
                  <div className="text-[10px] text-slate-400">{a.role} · {a.installs} hires</div>
                </div>
              </div>
              <span className="text-[9px] font-medium text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{a.tag}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2.5 leading-snug">{a.desc}</p>
            <div className="flex items-center gap-3 mt-3 pb-2.5 border-b border-slate-100">
              {a.connectors.map((c, i) => (
                <span key={c} className="flex items-center gap-1 text-[10px] text-slate-500" title={a.connectorNames[i]}>
                  <BrandIcon id={c} size={13} /> {a.connectorNames[i]}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mt-2.5">
              {a.skills.map(s => (
                <span key={s} className="text-[9px] font-medium rounded-full border border-accent/20 bg-accent/5 text-accent px-2 py-0.5">{s}</span>
              ))}
            </div>
            <a href="#/app" onClick={() => localStorage.setItem('prefill_prompt', a.prompt)}
              className="mt-3 w-full rounded-lg bg-ink text-white text-[11px] font-medium py-2 flex items-center justify-center gap-1.5 hover:bg-ink/85 transition">
              <Download size={11} className="rotate-180" /> Hire this agent
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
