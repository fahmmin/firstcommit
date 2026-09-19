import { useState } from 'react'
import { ArrowLeft, Terminal, Layers, Bot, Braces, Cloud, PlayCircle, Users } from 'lucide-react'
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
    <pre className="bg-slate-900 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed">{children}</pre>
  )
}

function Method({ m }) {
  const c = { GET: 'bg-sky/40 text-brand', POST: 'bg-emerald-100 text-emerald-700', PATCH: 'bg-amber-100 text-amber-700', DELETE: 'bg-rose-100 text-rose-700' }[m] || 'bg-slate-100 text-slate-600'
  return <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${c}`}>{m}</span>
}

const SECTIONS = {
  quickstart: (
    <>
      <h2 className="text-2xl font-medium tracking-tight">Quickstart</h2>
      <p className="text-sm text-slate-500 mt-2">Runs fully local with zero AWS. Flip <code className="text-xs bg-slate-100 px-1 rounded">USE_AWS=1</code> for the real cloud path.</p>
      <Code>{`cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

cd frontend && npm install && npm run dev    # → http://localhost:5173

cd backend && pytest tests -v                # 51 green
python simulation/simulate_demo.py           # 18/18 — the demo as a test
USE_AWS=1 python simulation/check_aws.py     # verify AWS handoff: 5/5`}</Code>
      <p className="text-sm text-slate-500 mt-3">Demo tenant: <code className="text-xs bg-slate-100 px-1 rounded">ramesh_auto</code> — Ramesh Auto Components, Faridabad.</p>
    </>
  ),
  architecture: (
    <>
      <h2 className="text-2xl font-medium tracking-tight">Architecture</h2>
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
      <p className="text-sm text-slate-500 mt-3">
        One env var swaps every seam. Local mode is the dev/test path — the product is the AWS path.
        The contract between frontend and backend is <code className="text-xs bg-slate-100 px-1 rounded">frontend/mocks/contract.json</code>.
      </p>
    </>
  ),
  agents: (
    <>
      <h2 className="text-2xl font-medium tracking-tight">Agents</h2>
      <div className="mt-4 space-y-3">
        {[
          ['sahayak', 'Orchestrator', 'Routes every message to the right specialist — or to Nirmata.'],
          ['vasool', 'Receivables', 'Overdue invoices, aging report, payment reminders (draft-only).'],
          ['sourcer', 'Procurement', 'Supplier search, price compare, trust scores, MOQ pooling.'],
          ['khata', 'Cash flow', 'Receivables vs payables timeline, 90-day-terms gap analysis.'],
          ['nirmata', 'Agent factory', 'Interviews the owner → previews a spec → hires on confirmation. Generated agents get tool allowlists + draft-only guardrails.'],
        ].map(([id, role, d]) => (
          <div key={id} className="rounded-xl border border-slate-200 p-4 flex gap-4 items-start">
            <code className="text-xs bg-sky/30 text-brand rounded px-2 py-0.5 mt-0.5 shrink-0">{id}</code>
            <div><div className="text-sm font-semibold">{role}</div><p className="text-xs text-slate-500 mt-0.5">{d}</p></div>
          </div>
        ))}
      </div>
    </>
  ),
  api: (
    <>
      <h2 className="text-2xl font-medium tracking-tight">API reference</h2>
      <p className="text-sm text-slate-500 mt-2">Rendered live from <code className="text-xs bg-slate-100 px-1 rounded">contract.json</code> — the single source of truth.</p>
      <div className="mt-4 space-y-3">
        {ENDPOINTS.map(e => (
          <details key={e.path + e.method} className="rounded-xl border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-3">
              <Method m={e.method} />
              <code className="text-xs font-medium">{e.path}</code>
              {e.$comment && <span className="text-[10px] text-slate-400 ml-auto hidden md:block">{e.$comment.slice(0, 60)}…</span>}
            </summary>
            <div className="px-4 pb-4 grid md:grid-cols-2 gap-3">
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
      <h2 className="text-2xl font-medium tracking-tight">AWS setup</h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-4 py-2 font-semibold">Service</th><th className="text-left px-4 py-2 font-semibold">Used for</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {[
              ['Bedrock — Nova Pro / Lite', 'Orchestrator + specialists (Strands BedrockModel); Nova Lite parses invoice photos'],
              ['Strands Agents SDK', 'Agent runtime, agents-as-tools orchestration, session managers'],
              ['DynamoDB', 'All state — 11 tables, PAY_PER_REQUEST, PK tenant_id + SK id'],
              ['S3', 'Agent session persistence + invoice uploads'],
              ['SES', 'Payment reminders & alerts (sandbox = verified recipients only)'],
              ['Lambda + Mangum', 'Serverless API (handler already wired in main.py)'],
              ['EventBridge', 'Scheduled alert promotion (replaces the local scheduler thread)'],
            ].map(([s, u]) => <tr key={s}><td className="px-4 py-2.5 font-medium">{s}</td><td className="px-4 py-2.5 text-slate-500">{u}</td></tr>)}
          </tbody>
        </table>
      </div>
      <h3 className="text-sm font-semibold mt-6 mb-2">Environment</h3>
      <Code>{`USE_AWS=1
AWS_REGION=ap-south-1
ORCHESTRATOR_MODEL=apac.amazon.nova-pro-v1:0
WORKER_MODEL=apac.amazon.nova-lite-v1:0
S3_BUCKET=…               # sessions + uploads
SES_SENDER=…              # must be a verified SES identity
DDB_TABLE_*=sahayak-*     # 11 tables, created by Ayush
# credentials: ~/.aws profile OR AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY`}</Code>
      <p className="text-sm text-slate-500 mt-3">Verify a handoff in one command: <code className="text-xs bg-slate-100 px-1 rounded">USE_AWS=1 python simulation/check_aws.py</code> → creds, tables, bucket, SES sender, Bedrock converse.</p>
    </>
  ),
  demo: (
    <>
      <h2 className="text-2xl font-medium tracking-tight">Demo script</h2>
      <p className="text-sm text-slate-500 mt-2">This is literally <code className="text-xs bg-slate-100 px-1 rounded">simulate_demo.py</code> — if the sim is green, the demo is green.</p>
      <ol className="mt-4 space-y-2.5 text-sm">
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
            <span className="shrink-0 w-5 h-5 rounded-full bg-sky/40 text-brand text-[10px] font-bold grid place-items-center mt-0.5">{i + 1}</span>
            <span className="text-slate-600">{s}</span>
          </li>
        ))}
      </ol>
    </>
  ),
  team: (
    <>
      <h2 className="text-2xl font-medium tracking-tight">Team & ownership</h2>
      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="font-semibold">Fahmin</div>
          <div className="text-xs text-accent font-medium mt-0.5">frontend · product · demo</div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">All UI — landing, dashboard, agent views, chat, calendar, connectors. Builds against contract.json, never waits on backend.</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="font-semibold">Ayush</div>
          <div className="text-xs text-accent font-medium mt-0.5">backend · AWS</div>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">FastAPI surface, agents, store/notifier seams, DynamoDB/SES/S3/Bedrock, deploy. Sees <code className="bg-slate-100 px-1 rounded">AYUSH.md</code> first.</p>
        </div>
      </div>
      <p className="text-sm text-slate-500 mt-4">Merge gate for both: <code className="text-xs bg-slate-100 px-1 rounded">pytest</code> + <code className="text-xs bg-slate-100 px-1 rounded">simulate_demo.py</code> green.</p>
    </>
  ),
}

export default function Docs() {
  const [section, setSection] = useState('quickstart')
  return (
    <div className="min-h-screen bg-white flex">
      <aside className="w-56 shrink-0 border-r border-slate-100 sticky top-0 h-screen flex flex-col">
        <a href="#/" className="flex items-center gap-2.5 px-5 h-14 border-b border-slate-100 hover:bg-slate-50 transition">
          <div className="w-7 h-7 rounded-lg bg-brand text-white grid place-items-center font-bold text-xs">स</div>
          <span className="font-bold text-brand text-sm">Sahayak AI</span>
        </a>
        <nav className="p-3 space-y-0.5 flex-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)}
              className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition text-left
                ${section === n.id ? 'bg-sky/30 text-brand font-medium' : 'text-slate-500 hover:bg-slate-50'}`}>
              <n.icon size={14} /> {n.label}
            </button>
          ))}
        </nav>
        <a href="#/app" className="m-3 flex items-center justify-center gap-1.5 text-xs font-medium bg-brand text-white rounded-xl py-2.5 hover:bg-brand/90 transition">
          <ArrowLeft size={12} /> Open app
        </a>
      </aside>
      <main className="flex-1 max-w-3xl px-10 py-12">
        {SECTIONS[section]}
      </main>
    </div>
  )
}
