import { useState } from 'react'
import { ArrowLeft, Terminal, Layers, Bot, Braces, Cloud, PlayCircle, Users } from 'lucide-react'
import { AgentAvatar } from '../lib/avatar.jsx'
import { Blobs } from '../components/Logo.jsx'
import contract from '../../mocks/contract.json'

const NAV = [
  { id: 'quickstart', label: 'Quickstart', icon: Terminal },
  { id: 'architecture', label: 'Architecture', icon: Layers },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'api', label: 'API reference', icon: Braces },
  { id: 'aws', label: 'AWS setup', icon: Cloud },
  { id: 'demo', label: 'Demo script', icon: PlayCircle },
  { id: 'team', label: 'Team & ownership', icon: Users },
]

const ENDPOINTS = Object.entries(contract.endpoints).map(([k, v]) => {
  const m = k.match(/^(GET|POST|PATCH|PUT|DELETE)\s+(\S+)/)
  return { method: m?.[1] || '', path: m?.[2] || k, tag: k.match(/\[(.+)\]/)?.[1] || '', ...v }
})

function Code({ children }) {
  return (
    <pre className="bg-slate-900 text-slate-100 text-xs rounded-2xl p-4 overflow-x-auto leading-relaxed border border-slate-800 mt-3">{children}</pre>
  )
}

function Method({ m }) {
  const c = { GET: 'bg-sky-100 text-sky-700', POST: 'bg-emerald-100 text-emerald-700', PATCH: 'bg-amber-100 text-amber-700', DELETE: 'bg-rose-100 text-rose-700' }[m] || 'bg-slate-100 text-slate-600'
  return <span className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 ${c}`}>{m}</span>
}

const H = ({ children }) => <h2 className="text-2xl font-medium tracking-tight text-ink">{children}</h2>
const P = ({ children, className = '' }) => <p className={`text-sm text-slate-500 mt-3 leading-relaxed ${className}`}>{children}</p>
const Chip = ({ children }) => <code className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md">{children}</code>

const SECTIONS = {
  quickstart: (
    <>
      <H>Quickstart</H>
      <P>Runs fully local with zero AWS. Flip <Chip>USE_AWS=1</Chip> for the real cloud path.</P>
      <Code>{`cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

cd frontend && npm install && npm run dev    # → http://localhost:5173

cd backend && pytest tests -v                # 51 green
python simulation/simulate_demo.py           # 18/18 — the demo as a test
USE_AWS=1 python simulation/check_aws.py     # verify AWS handoff: 5/5`}</Code>
      <P>Demo tenant: <Chip>ramesh_auto</Chip> — Ramesh Auto Components, Faridabad.</P>
    </>
  ),
  architecture: (
    <>
      <H>Architecture</H>
      <Code>{`Browser ──▶ FastAPI ──▶ Sahayak (orchestrator, Nova Pro)
   │            │            ├─ Vasool    → invoices tools
   │            │            ├─ Sourcer   → supplier tools
   │            │            ├─ Khata     → cashflow tools
   │            │            └─ Nirmata   → factory (previews + hires agents)
   │            │
   │            ├─ Store    ── USE_AWS=0: LocalStore (JSON)
   │            │              USE_AWS=1: DynamoStore  (11 tables)
   │            ├─ Notifier ── ConsoleNotifier → SESNotifier (SES)
   │            ├─ Sessions ── FileSessionManager → S3SessionManager
   │            └─ Models   ── MockModel (deterministic) → Bedrock Nova`}</Code>
      <P>
        One env var swaps every seam. Local mode is the dev/test path — the product is the AWS path.
        The contract between frontend and backend is <Chip>frontend/mocks/contract.json</Chip>.
      </P>
    </>
  ),
  agents: (
    <>
      <H>Agents</H>
      <div className="mt-5 space-y-3">
        {[
          ['sahayak', 'Orchestrator', 'Routes every message to the right specialist — or to Nirmata.'],
          ['vasool', 'Receivables', 'Overdue invoices, aging report, payment reminders (draft-only).'],
          ['sourcer', 'Procurement', 'Supplier search, price compare, trust scores, MOQ pooling.'],
          ['khata', 'Cash flow', 'Receivables vs payables timeline, 90-day-terms gap analysis.'],
          ['nirmata', 'Agent factory', 'Interviews the owner → previews a spec → hires on confirmation. Generated agents get tool allowlists + draft-only guardrails.'],
        ].map(([id, role, d]) => (
          <div key={id} className="rounded-2xl border border-slate-200 bg-white p-4 flex gap-4 items-center shadow-float">
            <AgentAvatar seed={id} size={40} />
            <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-ink">{role} <code className="text-[11px] text-slate-400 font-normal ml-1">@{id}</code></div><p className="text-xs text-slate-500 mt-0.5">{d}</p></div>
          </div>
        ))}
      </div>
    </>
  ),
  api: (
    <>
      <H>API reference</H>
      <P>Rendered live from <Chip>contract.json</Chip> — the single source of truth.</P>
      <div className="mt-5 space-y-3">
        {ENDPOINTS.map(e => (
          <details key={e.path + e.method} className="rounded-2xl border border-slate-200 bg-white shadow-float overflow-hidden">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition">
              <Method m={e.method} />
              <code className="text-xs font-medium text-ink">{e.path}</code>
              {e.$comment && <span className="text-[10px] text-slate-400 ml-auto hidden md:block truncate max-w-[200px]">{e.$comment.slice(0, 60)}…</span>}
            </summary>
            <div className="px-4 pb-4 grid md:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
              {e.request !== undefined && (
                <div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">request</div>
                  <Code>{typeof e.request === 'string' ? e.request : JSON.stringify(e.request, null, 2)}</Code></div>
              )}
              {(e.response || e.response_for_vasool) && (
                <div><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">response</div>
                  <Code>{JSON.stringify(e.response || e.response_for_vasool, null, 2)}</Code></div>
              )}
            </div>
          </details>
        ))}
      </div>
    </>
  ),
  aws: (
    <>
      <H>AWS setup</H>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-float">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-4 py-2.5 font-semibold">Service</th><th className="text-left px-4 py-2.5 font-semibold">Used for</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {[
              ['Bedrock — Nova Pro / Lite', 'Orchestrator + specialists (Strands BedrockModel); Nova Lite parses invoice photos'],
              ['Strands Agents SDK', 'Agent runtime, agents-as-tools orchestration, session managers'],
              ['DynamoDB', 'All state — 11 tables, PAY_PER_REQUEST, PK tenant_id + SK id'],
              ['S3', 'Agent session persistence + invoice uploads'],
              ['SES', 'Payment reminders & alerts (sandbox = verified recipients only)'],
              ['Lambda + Mangum', 'Serverless API (handler already wired in main.py)'],
              ['EventBridge', 'Scheduled alert promotion (replaces the local scheduler thread)'],
            ].map(([s, u]) => <tr key={s}><td className="px-4 py-2.5 font-medium text-ink">{s}</td><td className="px-4 py-2.5 text-slate-500">{u}</td></tr>)}
          </tbody>
        </table>
      </div>
      <h3 className="text-sm font-semibold text-ink mt-7">Environment</h3>
      <Code>{`USE_AWS=1
AWS_REGION=ap-south-1
ORCHESTRATOR_MODEL=apac.amazon.nova-pro-v1:0
WORKER_MODEL=apac.amazon.nova-lite-v1:0
S3_BUCKET=…               # sessions + uploads
SES_SENDER=…              # must be a verified SES identity
DDB_TABLE_*=sahayak-*     # 11 tables, created by Ayush
# credentials: ~/.aws profile OR AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY`}</Code>
      <P>Verify a handoff in one command: <Chip>USE_AWS=1 python simulation/check_aws.py</Chip> → creds, tables, bucket, SES sender, Bedrock converse.</P>
    </>
  ),
  demo: (
    <>
      <H>Demo script</H>
      <P>This is literally <Chip>simulate_demo.py</Chip> — if the sim is green, the demo is green.</P>
      <ol className="mt-5 space-y-2.5 text-sm">
        {[
          'Reset demo → roster shows Vasool, Sourcer, Khata',
          '"show my overdue invoices" → Sahayak routes to Vasool, real ₹ amounts',
          'Upload invoice photo → parsed into the ledger',
          'Draft a reminder → approve → sent (SES / console)',
          '"mera transporter nahi aaya" → Nirmata previews a Logistics Agent',
          '"haan, create it" → agent materializes in the roster — HIRED BY AI badge',
          '"cheapest pickup to ludhiana?" → the new agent answers with real carriers',
          'Alerts + cashflow views → "it works while you sleep"',
        ].map((s, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="shrink-0 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold grid place-items-center mt-0.5">{i + 1}</span>
            <span className="text-slate-600">{s}</span>
          </li>
        ))}
      </ol>
    </>
  ),
  team: (
    <>
      <H>Team & ownership</H>
      <div className="mt-5 grid md:grid-cols-2 gap-4">
        {[
          ['fahmin', 'Fahmin', 'frontend · product · demo', 'All UI — landing, dashboard, agent views, chat, calendar, connectors. Builds against contract.json, never waits on backend.'],
          ['ayush', 'Ayush', 'backend · AWS', 'FastAPI surface, agents, store/notifier seams, DynamoDB/SES/S3/Bedrock, deploy. Sees AYUSH.md first.'],
        ].map(([seed, name, role, d]) => (
          <div key={seed} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-float">
            <div className="flex items-center gap-3">
              <AgentAvatar seed={seed} size={40} className="rounded-full" />
              <div><div className="font-semibold text-ink">{name}</div><div className="text-xs text-accent font-medium">{role}</div></div>
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
      <P>Merge gate for both: <Chip>pytest</Chip> + <Chip>simulate_demo.py</Chip> green.</P>
    </>
  ),
}

export default function Docs() {
  const [section, setSection] = useState('quickstart')
  return (
    <div className="min-h-screen bg-[#fbfbfd] text-slate-800 font-sans flex">
      <aside className="w-60 shrink-0 border-r border-slate-100 sticky top-0 h-screen flex flex-col bg-white">
        <a href="#/" className="flex items-center gap-2 px-5 h-[52px] border-b border-slate-100 hover:bg-slate-50 transition">
          <Blobs />
          <span className="font-semibold text-[15px] tracking-tight text-ink">Sahayak</span>
          <span className="ml-auto text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Docs</span>
        </a>
        <nav className="p-3 space-y-0.5 flex-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition text-left
                ${section === n.id ? 'bg-slate-900 text-white font-medium' : 'text-slate-500 hover:bg-slate-50 hover:text-ink'}`}>
              <n.icon size={14} /> {n.label}
            </button>
          ))}
        </nav>
        <a href="#/app" className="m-3 flex items-center justify-center gap-1.5 text-[13px] font-medium bg-ink text-white rounded-xl py-2.5 hover:bg-ink/85 transition">
          <ArrowLeft size={12} /> Open app
        </a>
      </aside>
      <main className="flex-1 px-10 py-12">
        <div className="max-w-3xl">{SECTIONS[section]}</div>
      </main>
    </div>
  )
}
