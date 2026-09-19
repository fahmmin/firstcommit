import { motion } from 'framer-motion'
import {
  Bot, Receipt, Package, Wallet, Factory, Bell, Camera, ShieldCheck,
  ArrowRight, Sparkles, Users, CalendarClock, PlugZap, CheckCircle2,
} from 'lucide-react'

const CONNECTORS = ['Google Calendar', 'Airtable', 'WhatsApp', 'Tally', 'Razorpay', 'UPI', 'GST Portal', 'Vyapar']

const AGENTS = [
  { icon: Receipt, name: 'Vasool', tag: 'पैसा वसूलने वाला', desc: 'Tracks every invoice, flags who owes what, drafts payment reminders.', tools: 'aging report · reminders · ledger' },
  { icon: Package, name: 'Sourcer', tag: 'सही दाम पे सामान', desc: 'Compares supplier prices, checks trust scores, pools MOQs.', tools: 'catalog · stock · trust score' },
  { icon: Wallet, name: 'Khata', tag: 'कैश का हिसाब', desc: 'Watches the 90-day-terms trap — receivables vs payables, gap alerts.', tools: 'timeline · term gap · advisor' },
  { icon: Factory, name: 'Nirmata', tag: 'एजेंट बनाने वाला', desc: 'The factory. Describe a recurring problem — it hires a new specialist for it.', tools: 'interview · preview · hire' },
]

const FEATURES = [
  { icon: Bot, title: 'Talk to your business', desc: 'One chat. Ask in English or Hinglish — "kitna paisa aana hai?" just works. Sahayak routes to the right specialist.' },
  { icon: Sparkles, title: 'It hires its own staff', desc: 'Problem nobody covers? Nirmata interviews you, drafts a specialist, shows a preview — you confirm, it joins the team.', big: true },
  { icon: ShieldCheck, title: 'Draft-only by default', desc: 'Agents propose, you approve. No reminder is sent, no order placed, until you say haan.' },
  { icon: Bell, title: 'Works while you sleep', desc: 'Scheduled checks turn due dates into ready-to-send reminders. Wake up to approvals, not surprises.' },
  { icon: Camera, title: 'Photo → ledger', desc: 'Snap a paper invoice. Nova vision parses it into your books — buyer, GST, due date, amount.' },
  { icon: Users, title: 'Real numbers only', desc: 'Agents answer from your actual invoices and suppliers — never invented figures. Tenant-isolated per business.' },
]

const STEPS = [
  { n: '01', title: 'Tell it a problem', desc: '"Mera transporter nahi aaya" — plain words, no forms, no training.' },
  { n: '02', title: 'Sahayak routes — or hires', desc: 'Known domain → the right specialist answers. New problem → Nirmata hires a specialist live.' },
  { n: '03', title: 'You approve, it acts', desc: 'Drafts, reminders, bookings land in your notifications. One tap sends them.' },
]

const FAQ = [
  { q: 'Do I need to know technology?', a: 'No. If you can send a WhatsApp message, you can run Sahayak. Everything is plain chat — Hinglish included.' },
  { q: 'Will it send messages on my behalf?', a: 'Never without approval. Every outward action is a draft until you tap approve.' },
  { q: 'What does it connect to?', a: 'Google Calendar, Airtable, WhatsApp today — Tally and Razorpay connectors are on the roadmap.' },
  { q: 'Who built this?', a: 'Fahmin (product/frontend) and Ayush (backend/AWS) — for the First Commit AWS hackathon. Runs on Bedrock Nova + Strands Agents.' },
]

export default function Landing() {
  return (
    <div className="bg-white text-slate-800">
      {/* ── nav ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="#/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand text-white grid place-items-center font-bold text-sm">स</div>
            <span className="font-bold text-brand tracking-tight">Sahayak AI</span>
          </a>
          <div className="hidden md:flex items-center gap-7 text-sm text-slate-500">
            <a href="#features" className="hover:text-brand transition">Features</a>
            <a href="#how" className="hover:text-brand transition">How it works</a>
            <a href="#team" className="hover:text-brand transition">Agents</a>
            <a href="#/docs" className="hover:text-brand transition">Docs</a>
          </div>
          <a href="#/app"
            className="text-sm font-medium bg-brand text-white rounded-full px-4 py-2 hover:bg-brand/90 transition flex items-center gap-1.5">
            Open app <ArrowRight size={14} />
          </a>
        </div>
      </nav>

      {/* ── hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sky/30 via-white to-white" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-8 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand bg-sky/30 border border-sky rounded-full px-3 py-1.5">
              <Sparkles size={12} /> Powered by AWS Bedrock · Strands Agents
            </span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}
            className="mt-6 text-5xl md:text-7xl font-medium tracking-tight text-slate-900 leading-[1.02]">
            Your business,<br />
            <span className="text-brand">staffed by AI agents.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.16 }}
            className="mt-5 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            One chat for invoices, suppliers and cash flow. And when a problem has no specialist,
            Sahayak <em>hires one</em> — live, in front of you.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-8 flex items-center justify-center gap-3">
            <a href="#/app" className="bg-brand text-white rounded-full px-6 py-3 text-sm font-medium hover:bg-brand/90 transition flex items-center gap-2">
              Try the live demo <ArrowRight size={15} />
            </a>
            <a href="#/docs" className="rounded-full px-6 py-3 text-sm font-medium border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition">
              Read the docs
            </a>
          </motion.div>

          {/* product mockup — pure CSS, no assets */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35 }}
            className="mt-14 mx-auto max-w-4xl">
            <div className="rounded-2xl shadow-float-lg bg-white border border-slate-200 overflow-hidden text-left">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-300" /><span className="w-2.5 h-2.5 rounded-full bg-amber-300" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                <span className="ml-3 text-[11px] text-slate-400 bg-white border border-slate-200 rounded-md px-2 py-0.5">sahayak.ai/app</span>
              </div>
              <div className="grid md:grid-cols-[1fr_220px]">
                <div className="p-5 space-y-3">
                  <div className="flex justify-end"><div className="bg-brand text-white text-xs rounded-2xl rounded-br-md px-3.5 py-2 max-w-[70%]">mera transporter nahi aaya 😰</div></div>
                  <div className="flex"><div className="bg-slate-50 border border-slate-100 text-xs rounded-2xl rounded-bl-md px-3.5 py-2 max-w-[80%]">
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-accent mb-1">sahayak → nirmata · एजेंट बनाने वाला</div>
                    Here's the specialist I'd hire — <b>Logistics Agent</b>: finds backup carriers, quotes & books pickups. Say <b>haan</b> and I'll hire it.
                  </div></div>
                  <div className="flex justify-end"><div className="bg-brand text-white text-xs rounded-2xl rounded-br-md px-3.5 py-2">haan, create it</div></div>
                  <div className="flex"><div className="bg-slate-50 border border-slate-100 text-xs rounded-2xl rounded-bl-md px-3.5 py-2 max-w-[80%]">
                    Done — <b>Logistics Agent</b> is live on your dashboard. <span className="text-brand">✨ Hired by AI</span>
                  </div></div>
                </div>
                <div className="hidden md:block border-l border-slate-100 bg-cream/60 p-4 space-y-2">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Your team</div>
                  {['Vasool · पैसा वसूलने वाला', 'Sourcer · सही दाम पे सामान', 'Khata · कैश का हिसाब'].map(t => (
                    <div key={t} className="bg-white rounded-xl border border-slate-150 border-slate-200 px-3 py-2 text-[11px] font-medium">{t}</div>
                  ))}
                  <div className="bg-sky/30 rounded-xl border border-accent/40 px-3 py-2 text-[11px] font-medium text-brand">
                    Logistics Agent <span className="text-[8px] font-bold text-accent">HIRED BY AI</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* connector marquee */}
        <div className="relative border-y border-slate-100 bg-white/60 py-4 overflow-hidden">
          <div className="flex gap-10 whitespace-nowrap animate-marquee w-max">
            {[...CONNECTORS, ...CONNECTORS].map((c, i) => (
              <span key={i} className="text-sm text-slate-400 font-medium flex items-center gap-2">
                <PlugZap size={13} className="text-accent/60" /> {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── stats ── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[['₹1.9L', 'overdue tracked for one demo business'], ['4→5', 'specialists — one hired live by AI'], ['100%', 'actions draft-only until approved'], ['11', 'DynamoDB collections on AWS']].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-3xl font-medium text-brand tracking-tight">{v}</div>
              <div className="text-xs text-slate-500 mt-1">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── features bento ── */}
      <section id="features" className="bg-cream/70 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Built for owners, not operators</h2>
          <p className="text-slate-500 mt-3 max-w-xl">Micro and small businesses don't need an ERP. They need a back-office that speaks their language and does the chasing.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className={`rounded-2xl bg-white border border-slate-200 p-6 shadow-float hover:shadow-float-lg transition-shadow ${f.big ? 'md:col-span-2 bg-gradient-to-br from-white to-sky/20' : ''}`}>
                <f.icon size={20} className="text-accent" />
                <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works ── */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Three steps. No training.</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {STEPS.map(s => (
            <div key={s.n} className="rounded-2xl border border-slate-200 p-6 shadow-float">
              <div className="text-xs font-bold text-accent">{s.n}</div>
              <h3 className="mt-2 font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── agents ── */}
      <section id="team" className="bg-cream/70 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-slate-900">Meet the team</h2>
              <p className="text-slate-500 mt-3 max-w-xl">Three specialists on day one. Nirmata hires the rest — whatever your business needs.</p>
            </div>
            <a href="#/app" className="text-sm font-medium text-brand flex items-center gap-1.5 hover:gap-2.5 transition-all">See them work <ArrowRight size={14} /></a>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {AGENTS.map(a => (
              <div key={a.name} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-float hover:-translate-y-1 transition-transform">
                <a.icon size={20} className="text-accent" />
                <h3 className="mt-3 font-semibold">{a.name}</h3>
                <div className="text-[11px] text-accent font-medium">{a.tag}</div>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">{a.desc}</p>
                <div className="mt-3 text-[10px] text-slate-400">{a.tools}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── faq ── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-medium tracking-tight text-slate-900 text-center">Questions</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map(f => (
            <details key={f.q} className="group rounded-2xl border border-slate-200 bg-white shadow-float open:shadow-float-lg transition-shadow">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium flex items-center justify-between">
                {f.q}
                <span className="text-slate-300 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
              </summary>
              <p className="px-5 pb-4 text-sm text-slate-500 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── cta ── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="rounded-3xl bg-brand text-white px-8 py-14 text-center shadow-float-lg relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-sky/10 blur-3xl" />
          <h2 className="relative text-3xl md:text-4xl font-medium tracking-tight">Stop chasing. Start delegating.</h2>
          <p className="relative mt-3 text-sky/80 text-sm max-w-md mx-auto">The demo is live — seeded with Ramesh Auto Components, a real-feeling Faridabad manufacturer.</p>
          <div className="relative mt-7 flex items-center justify-center gap-3">
            <a href="#/app" className="bg-white text-brand rounded-full px-6 py-3 text-sm font-semibold hover:bg-sky/40 transition flex items-center gap-2">
              Open the app <ArrowRight size={15} />
            </a>
            <a href="#/docs" className="rounded-full px-6 py-3 text-sm font-medium border border-white/30 hover:bg-white/10 transition">Docs</a>
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm text-slate-500">
            <div className="w-6 h-6 rounded-lg bg-brand text-white grid place-items-center text-[10px] font-bold">स</div>
            Sahayak AI · First Commit hackathon · Fahmin × Ayush
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            {['Bedrock', 'Strands', 'DynamoDB', 'S3', 'SES', 'Lambda'].map(s => (
              <span key={s} className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500" />{s}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
