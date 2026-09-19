import { motion } from 'framer-motion'
import {
  Receipt, Package, Wallet, Factory, Bell, Camera, ShieldCheck,
  ArrowRight, Sparkles, CalendarClock, PlugZap, CheckCircle2, X,
  Zap, Puzzle, FileText, Repeat2, BrainCircuit, TrendingUp, Lock, Eye, Layers,
} from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { LogoCarousel } from '../components/rui/LogoCarousel.jsx'

/* ── blobs: the 4-color mark, gumloop-style ── */
const Blobs = ({ size = 'md' }) => {
  const s = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'
  return (
    <div className="flex items-end gap-1">
      <span className={`${s} rounded-full bg-[#a325fc]`} />
      <span className={`${s} rounded-full rounded-bl-md bg-[#1aaf50]`} />
      <span className={`${s} rounded-md rotate-12 bg-[#86cefc]`} />
      <span className={`${s} rounded-full rounded-tr-md bg-[#d4428f]`} />
    </div>
  )
}

const spend = [
  { m: 'Jul 12', v: 12 }, { m: 'Jul 19', v: 18 }, { m: 'Jul 26', v: 15 }, { m: 'Aug 2', v: 24 },
  { m: 'Aug 9', v: 31 }, { m: 'Aug 16', v: 28 }, { m: 'Aug 23', v: 38 }, { m: 'Aug 30', v: 44 },
  { m: 'Sep 6', v: 52 }, { m: 'Sep 13', v: 61 }, { m: 'Sep 19', v: 74 },
]

/* ── the product mockup (pure CSS — mirrors the real workspace) ── */
function AppMockup() {
  return (
    <div className="rounded-2xl shadow-float-lg bg-white border border-slate-200/80 overflow-hidden text-left">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
        <span className="w-2.5 h-2.5 rounded-full bg-[#f96a5f]" /><span className="w-2.5 h-2.5 rounded-full bg-[#fcbd2e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#33c648]" />
        <span className="ml-3 text-[11px] text-slate-400 bg-white border border-slate-200 rounded-md px-2.5 py-0.5">sahayak.ai/app</span>
      </div>
      <div className="grid grid-cols-[150px_1fr_210px] min-h-[380px]">
        {/* sidebar */}
        <div className="border-r border-slate-100 bg-[#fbfbfd] p-3 space-y-4">
          <button className="w-full text-[11px] font-medium border border-slate-200 bg-white rounded-lg py-1.5 text-slate-600">+ New Chat</button>
          {[['Money', ['Vasool', 'Khata']], ['Procurement', ['Sourcer']], ['Hired by AI', ['Logistics Agent']]].map(([g, items]) => (
            <div key={g}>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{g}</div>
              {items.map(i => (
                <div key={i} className={`text-[11px] rounded-md px-2 py-1.5 mb-0.5 flex items-center gap-1.5
                  ${i === 'Vasool' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>
                  <span className={`w-3 h-3 rounded ${i === 'Logistics Agent' ? 'bg-[#d4428f]' : 'bg-[#a325fc]'}`} />
                  {i}
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* center */}
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 grid place-items-center"><Receipt size={18} className="text-white" /></div>
            <div>
              <div className="font-semibold text-[15px] text-slate-900">Vasool</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Receivables, reminders and payment chasing across the ledger.</div>
              <div className="text-[10px] text-slate-400 mt-1">Used by Ramesh · 31 tasks this month</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-150 border-slate-200 p-3">
              <div className="text-[10px] font-medium text-slate-500 flex justify-between">Money recovered <span className="text-slate-400">Sep · ₹74.2K</span></div>
              <div className="h-14 mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spend}><Line type="monotone" dataKey="v" stroke="#1aaf50" strokeWidth={1.5} dot={false} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[10px] font-medium text-slate-500">Adoption</div>
              <div className="mt-2 flex -space-x-1.5">
                {['R', 'S', 'K', 'O'].map((c, i) => (
                  <span key={c} className={`w-6 h-6 rounded-full text-[9px] font-bold text-white grid place-items-center border-2 border-white ${['bg-[#a325fc]', 'bg-[#1aaf50]', 'bg-[#86cefc]', 'bg-[#d4428f]'][i]}`}>{c}</span>
                ))}
              </div>
              <div className="text-[9px] text-slate-400 mt-1.5">4 people · 74 tasks run</div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 p-3">
            <div className="text-[10px] font-medium text-slate-500 mb-2">Recent runs</div>
            {[['Drafted reminder for INV-0031', '2m'], ['Flagged Om Sai Traders · 111 days', '1h'], ['Aging report requested', '3h']].map(([t, w]) => (
              <div key={t} className="flex items-center justify-between text-[10px] text-slate-500 py-1 border-t border-slate-50 first:border-0">
                <span className="flex items-center gap-1.5"><CheckCircle2 size={10} className="text-emerald-500" />{t}</span><span className="text-slate-300">{w}</span>
              </div>
            ))}
          </div>
        </div>
        {/* right rail */}
        <div className="border-l border-slate-100 bg-white p-3.5">
          <div className="flex gap-3 text-[11px] font-medium border-b border-slate-100 pb-2 mb-3">
            <span className="text-slate-900 border-b-2 border-slate-900 pb-1.5 -mb-2">Agent</span>
            <span className="text-slate-400">Settings</span>
          </div>
          <div className="text-[10px] font-semibold text-slate-500 mb-1.5">Agent Preferences</div>
          <div className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-600 flex items-center justify-between">✨ Nova Pro <span className="text-slate-300">▾</span></div>
          <div className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-400 mt-1.5 h-10">Add instructions…</div>
          <div className="text-[10px] font-semibold text-slate-500 mt-4 mb-1.5 flex justify-between">Triggers <span className="text-slate-300">+ Add</span></div>
          {[['Daily receivables digest', 'At 09:00, Mon–Fri'], ['New invoice parsed', 'Polls uploads · every 5m']].map(([t, s]) => (
            <div key={t} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 mb-1.5">
              <div className="text-[10px] font-medium text-slate-600">{t}</div>
              <div className="text-[9px] text-slate-400">{s}</div>
            </div>
          ))}
          <div className="text-[10px] font-semibold text-slate-500 mt-4 mb-1.5 flex justify-between">Connectors <span className="text-slate-300">+ Add</span></div>
          {['Google Calendar', 'Airtable', 'WhatsApp'].map(c => (
            <div key={c} className="text-[10px] text-slate-500 py-1 flex items-center gap-1.5"><PlugZap size={9} className="text-slate-300" />{c}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="bg-white text-slate-800 font-sans">

      {/* ── announcement banner ── */}
      <div className="bg-ink text-white text-center text-[13px] py-2 relative">
        Built on AWS Bedrock + Strands Agents for <b>First Commit</b> hackathon
        <a href="#/docs" className="underline underline-offset-2 ml-2 text-white/80 hover:text-white">Learn more</a>
        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"><X size={14} /></button>
      </div>

      {/* ── nav ── */}
      <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-[52px] flex items-center justify-between">
          <a href="#/" className="flex items-center gap-2">
            <Blobs />
            <span className="font-semibold text-[15px] tracking-tight text-ink">Sahayak</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-[13.5px] text-slate-600">
            <a href="#features" className="hover:text-ink transition">Product</a>
            <a href="#team" className="hover:text-ink transition">Agents</a>
            <a href="#controls" className="hover:text-ink transition">Controls</a>
            <a href="#/docs" className="hover:text-ink transition">Docs</a>
          </div>
          <div className="flex items-center gap-2">
            <a href="#/docs" className="text-[13px] font-medium border border-slate-300 rounded-lg px-3.5 py-1.5 hover:bg-slate-50 transition">Read docs</a>
            <a href="#/app" className="text-[13px] font-medium bg-ink text-white rounded-lg px-3.5 py-1.5 hover:bg-ink/85 transition">Get Started</a>
          </div>
        </div>
      </nav>

      {/* ── hero — left aligned, gumloop style ── */}
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <Blobs size="lg" />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-5 text-[44px] md:text-[64px] leading-[1.02] font-medium tracking-[-0.03em] text-ink max-w-3xl">
          Chat, hire &amp; control your AI staff
        </motion.h1>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.16 }}
          className="mt-7 flex items-center gap-3">
          <a href="#/app" className="bg-ink text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-ink/85 transition">Get Started</a>
          <a href="#demo" className="border border-slate-300 rounded-xl px-6 py-3 text-sm font-medium hover:bg-slate-50 transition">See it work</a>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.28 }}
          className="mt-12">
          <AppMockup />
        </motion.div>
      </section>

      {/* ── proof strip ── */}
      <section className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl md:text-[28px] font-medium tracking-tight text-ink leading-snug">
              The agent back-office powering India&#8217;s smallest businesses
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-8">
            {[['₹1.9L', 'Overdue tracked'], ['4→5', 'Agents — one hired live'], ['18/18', 'Demo checks on AWS'], ['0', 'Actions without approval']].map(([v, l]) => (
              <div key={l}>
                <div className="text-[13px] text-slate-400">{l}</div>
                <div className="text-3xl font-medium tracking-tight text-ink mt-1">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── partner logo carousel ── */}
      <section className="max-w-6xl mx-auto px-6 pb-6">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 text-center mb-4">Works with</div>
        <LogoCarousel />
      </section>

      {/* ── "Build →" section — sidebar label + agent shot ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-[280px_1fr] gap-12">
        <div>
          <div className="text-[13px] text-slate-400 mb-3">Product →</div>
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-ink leading-tight">
            Let your experts build the agents
          </h2>
          <p className="text-sm text-slate-500 mt-4 leading-relaxed">
            Understanding a problem is the only prerequisite to automating it. Describe it once —
            Nirmata drafts the specialist, you approve, it joins the team.
          </p>
          <div className="mt-6 flex gap-3">
            <a href="#/app" className="bg-ink text-white rounded-xl px-4 py-2.5 text-[13px] font-medium">Explore agents</a>
            <a href="#/docs" className="border border-slate-300 rounded-xl px-4 py-2.5 text-[13px] font-medium">Read docs</a>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5">
            {[
              [Zap, 'Alert triggers'], [Puzzle, 'Connectors'],
              [FileText, 'Invoice parsing'], [Repeat2, 'Recurring tasks'],
              [BrainCircuit, 'Skills via tools'], [TrendingUp, 'Self-improving team'],
            ].map(([I, t]) => (
              <div key={t} className="flex items-center gap-2.5 text-[13px] text-slate-600"><I size={14} className="text-slate-400" />{t}</div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 shadow-float overflow-hidden bg-white">
          <div className="grid grid-cols-[90px_1fr]">
            <div className="bg-[#fbfbfd] border-r border-slate-100 p-3 space-y-4">
              {[['Sales', 'bg-[#a325fc]'], ['Support', 'bg-slate-300'], ['Data', 'bg-slate-300'], ['Ops', 'bg-slate-300'], ['Calls', 'bg-slate-300']].map(([l, c], i) => (
                <div key={l} className="flex flex-col items-center gap-1">
                  <span className={`w-6 h-6 rounded-lg ${c}`} />
                  <span className={`text-[9px] ${i === 0 ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>{l}</span>
                </div>
              ))}
            </div>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#a325fc] grid place-items-center"><Package size={16} className="text-white" /></div>
                <div>
                  <div className="font-semibold text-[15px]">Sourcer</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Supplier search, price compare and vendor trust across your buys.</div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2"><Sparkles size={10} className="text-amber-500" /> Nova Lite <span className="text-slate-300">+3 tools</span></div>
                </div>
              </div>
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center gap-2 text-[11px]"><span className="w-5 h-5 rounded-full bg-[#1aaf50] text-white grid place-items-center text-[8px] font-bold">R</span><span className="text-slate-500">Find steel coils under ₹65/kg, 500kg MOQ max</span></div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <div className="text-[10px] text-slate-400 space-y-1">
                    <div>→ Searching catalog · 6 suppliers</div>
                    <div>→ Cross-checking trust scores</div>
                  </div>
                  <div className="mt-2 text-[11px] font-medium text-slate-700">Best: Balaji Steel — ₹62/kg, MOQ 500, trust 4.2★</div>
                  <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead className="bg-slate-50 text-slate-400"><tr>{['Supplier', 'Price', 'MOQ', 'Trust'].map(h => <th key={h} className="text-left px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-50 text-slate-600">
                        {[['Balaji Steel', '₹62', '500', '4.2'], ['Apex Alloys', '₹64', '1000', '3.8'], ['Khanna Metals', '₹59', '2000', '2.1']].map(r => (
                          <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`px-2 py-1.5 ${i === 3 && parseFloat(c) < 3 ? 'text-rose-500 font-medium' : ''}`}>{c}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── context section — 3 cards ── */}
      <section className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-ink">Complete context on your business</h2>
          <p className="text-sm text-slate-500 mt-3 max-w-lg">Your invoices, suppliers, carriers and cash flow connect into one business brain every agent shares.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-[#fbfbfd] p-6 shadow-float min-h-[220px] flex flex-col justify-end">
              <div className="flex-1 grid place-items-center">
                <div className="relative w-28 h-28">
                  <span className="absolute inset-0 rounded-full border border-dashed border-slate-300" />
                  <span className="absolute inset-4 rounded-full border border-slate-200" />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-ink text-white grid place-items-center"><BrainCircuit size={14} /></span>
                  {[0, 60, 120, 180, 240, 300].map(deg => (
                    <span key={deg} className="absolute w-4 h-4 rounded-md bg-white border border-slate-200 shadow-sm"
                      style={{ top: `${50 + 42 * Math.sin(deg * Math.PI / 180)}%`, left: `${50 + 42 * Math.cos(deg * Math.PI / 180)}%`, transform: 'translate(-50%,-50%)' }} />
                  ))}
                </div>
              </div>
              <div><div className="font-semibold text-sm">Business knowledge</div><p className="text-xs text-slate-500 mt-1">Connect your ledger, suppliers and carriers into a brain every agent shares.</p></div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#fbfbfd] p-6 shadow-float min-h-[220px] flex flex-col justify-end">
              <div className="flex-1 space-y-2">
                {[['List overdue invoices', 'tool'], ['Draft reminder', 'draft-only'], ['Schedule alert', 'approved']].map(([t, s]) => (
                  <div key={t} className="rounded-lg bg-white border border-slate-150 border-slate-200 px-3 py-2 text-[11px] flex justify-between items-center">
                    <span className="font-medium text-slate-600">{t}</span><span className="text-[9px] text-slate-400">{s}</span>
                  </div>
                ))}
              </div>
              <div><div className="font-semibold text-sm">Skills via tools</div><p className="text-xs text-slate-500 mt-1">Agents only ever use tools you allow — no free-ranging, ever.</p></div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#fbfbfd] p-6 shadow-float min-h-[220px] flex flex-col justify-end">
              <div className="flex-1 space-y-2">
                {[['Reminder sent · Sharma Motors', '2m'], ['Logistics Agent hired', '1h'], ['₹58K gap flagged', '3h']].map(([t, w]) => (
                  <div key={t} className="text-[11px] flex justify-between items-center border-b border-slate-100 pb-1.5 last:border-0">
                    <span className="text-slate-600">{t}</span><span className="text-slate-300">{w}</span>
                  </div>
                ))}
              </div>
              <div><div className="font-semibold text-sm">Live activity</div><p className="text-xs text-slate-500 mt-1">See which agent did what, when — full audit trail, always.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── dark "Controls →" section ── */}
      <section id="controls" className="bg-ink text-white">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-[13px] text-white/40 mb-3">Controls →</div>
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight">Owner-grade controls</h2>
          <div className="mt-10 grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-ink-2 border border-white/10 p-6">
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                {[['74', 'tasks run'], ['₹74.2K', 'recovered'], ['86%', 'approved first-try']].map(([v, l]) => (
                  <div key={l}><div className="text-[10px] text-white/40">{l}</div><div className="text-lg font-medium mt-0.5">{v}</div></div>
                ))}
              </div>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spend}><Line type="monotone" dataKey="v" stroke="#d4428f" strokeWidth={1.5} dot={false} /></LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 font-semibold text-sm">Usage monitoring</div>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">Every agent run, every tool call, tracked per business — spend and activity you can actually see.</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl bg-ink-2 border border-white/10 p-6">
                <div className="text-[10px] text-white/40 mb-2 flex items-center gap-1.5"><Eye size={11} /> Capturing…</div>
                {[['Ramesh approved reminder → Sharma Motors', ''], ['Nirmata published the Logistics Agent', ''], ['Khata updated the 90-day gap flag', '']].map(([t]) => (
                  <div key={t} className="text-[11px] text-white/70 py-1 flex items-center gap-2"><CheckCircle2 size={11} className="text-emerald-400" />{t}</div>
                ))}
                <div className="mt-3 font-semibold text-sm">Audit logging</div>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">Detailed trails for every action across the team — where data flows, who approved what.</p>
              </div>
              <div className="rounded-2xl bg-ink-2 border border-white/10 p-6">
                <div className="font-semibold text-sm">Runs on AWS</div>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">Bedrock, DynamoDB, S3 and SES — your data stays in your tenant, in your region.</p>
              </div>
            </div>
          </div>
          <div className="mt-12 grid grid-cols-2 md:grid-cols-5 gap-8">
            {[
              [Lock, 'Owner approvals', 'Every outward action is a draft until you say haan.'],
              [ShieldCheck, 'Tool allowlists', 'Each agent sees only the tools you gave it.'],
              [Layers, 'Draft-only mode', 'Reminders, bookings, orders — proposed, never sent.'],
              [Eye, 'Tenant isolation', 'Your books are yours — hard-walled per business.'],
              [FileText, 'No invented figures', 'Agents answer from real ledger data or not at all.'],
            ].map(([I, t, d]) => (
              <div key={t}>
                <I size={16} className="text-white/50" />
                <div className="text-[13px] font-semibold mt-2">{t}</div>
                <p className="text-[11px] text-white/45 mt-1 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── agents strip ── */}
      <section id="team" className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-ink">Meet your team where they work</h2>
          <a href="#/app" className="text-[13px] font-medium text-ink flex items-center gap-1.5 hover:gap-2.5 transition-all">See them work <ArrowRight size={14} /></a>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            [Receipt, 'Vasool', 'पैसा वसूलने वाला', 'Receivables & reminders', '#a325fc'],
            [Package, 'Sourcer', 'सही दाम पे सामान', 'Suppliers & trust', '#1aaf50'],
            [Wallet, 'Khata', 'कैश का हिसाब', 'Cash-flow & 90-day traps', '#86cefc'],
            [Factory, 'Nirmata', 'एजेंट बनाने वाला', 'Hires new specialists', '#d4428f'],
          ].map(([I, n, tag, d, c]) => (
            <div key={n} className="rounded-2xl border border-slate-200 p-5 shadow-float hover:-translate-y-1 transition-transform bg-white">
              <div className="w-8 h-8 rounded-xl grid place-items-center" style={{ background: c }}><I size={15} className="text-white" /></div>
              <h3 className="mt-3 font-semibold text-[15px]">{n}</h3>
              <div className="text-[11px] font-medium" style={{ color: c }}>{tag}</div>
              <p className="mt-2 text-xs text-slate-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── cta ── */}
      <section className="max-w-6xl mx-auto px-6 pb-20" id="demo">
        <div className="rounded-3xl bg-ink text-white px-8 py-16 text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#a325fc]/20 blur-3xl" />
          <div className="absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-[#86cefc]/10 blur-3xl" />
          <h2 className="relative text-3xl md:text-4xl font-medium tracking-tight">Stop chasing. Start delegating.</h2>
          <p className="relative mt-3 text-white/50 text-sm max-w-md mx-auto">Live demo, seeded with Ramesh Auto Components — a Faridabad manufacturer with very real problems.</p>
          <div className="relative mt-7 flex items-center justify-center gap-3">
            <a href="#/app" className="bg-white text-ink rounded-xl px-6 py-3 text-sm font-semibold hover:bg-white/90 transition flex items-center gap-2">Open the app <ArrowRight size={15} /></a>
            <a href="#/docs" className="rounded-xl px-6 py-3 text-sm font-medium border border-white/20 hover:bg-white/10 transition">Docs</a>
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-[13px] text-slate-500">
            <Blobs />
            Sahayak · First Commit hackathon · Fahmin × Ayush
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            {['Bedrock', 'Strands', 'DynamoDB', 'S3', 'SES', 'Lambda'].map(s => (
              <span key={s} className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500" />{s}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
