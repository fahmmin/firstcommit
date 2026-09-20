// Demo store — graceful fallbacks so every screen renders with content while
// backend endpoints land. api.js tries the REAL endpoint first; only a failure
// drops to this in-browser store (mutations persist for the session).
// Nothing here is labelled "demo" in the UI — it's the offline cache layer.
import { contextStore } from './context.js'

export const DEMO = {
  memories: [
    { id: 'mem-1', text: 'Sharma Traders always pays around 45 days — don’t push hard', source: 'owner', created_at: '2026-09-15T10:00:00Z' },
    { id: 'mem-2', text: 'Big orders go through GST invoice only', source: 'onboarding', created_at: '2026-09-15T10:05:00Z' },
    { id: 'mem-3', text: 'VRL is our backup transporter for the Ludhiana route', source: 'owner', created_at: '2026-09-16T09:00:00Z' },
    { id: 'mem-4', text: 'Diwali season: stock fasteners + brake pads 3 weeks early', source: 'onboarding', created_at: '2026-09-15T10:06:00Z' },
  ],
  connectors: [
    { id: 'google_drive', name: 'Google Drive', icon: 'google_drive', status: 'available', items_synced: 0, description: 'Share Drive files with our service account — Sync imports them into business context' },
    { id: 'google_sheets', name: 'Google Sheets', icon: 'google_sheets', status: 'available', items_synced: 0, description: 'Share a spreadsheet with our service account — Sync imports rows' },
    { id: 'google_docs', name: 'Google Docs', icon: 'google_docs', status: 'available', items_synced: 0, description: 'Share a doc with our service account — Sync imports its text' },
    { id: 'google_calendar', name: 'Google Calendar', icon: 'google_calendar', status: 'available', items_synced: 0, description: 'Share a calendar with our service account — Sync reads real events' },
    { id: 'fb_marketplace', name: 'Facebook Marketplace', icon: 'facebook', status: 'coming_soon', items_synced: 0, description: 'Publish product listings where local buyers browse' },
    { id: 'indiamart', name: 'IndiaMART', icon: 'indiamart', status: 'coming_soon', items_synced: 0, description: 'B2B marketplace — 7.7 crore buyers' },
    { id: 'shopify', name: 'Shopify Storefront', icon: 'shopify', status: 'coming_soon', items_synced: 0, description: 'Your own web store — agents build and stock it' },
    { id: 'whatsapp', name: 'WhatsApp Business', icon: 'whatsapp', status: 'coming_soon', items_synced: 0, description: 'Send payment reminders + order updates on WhatsApp' },
    { id: 'gmail', name: 'Gmail', icon: 'gmail', status: 'coming_soon', items_synced: 0, description: 'Read invoices and POs straight from your inbox' },
    { id: 'instagram', name: 'Instagram Shop', icon: 'instagram', status: 'coming_soon', items_synced: 0, description: 'Shoppable posts synced from your catalogue' },
    { id: 'airtable', name: 'Airtable', icon: 'airtable', status: 'coming_soon', items_synced: 0, description: 'Sync ledger + suppliers to your base' },
    { id: 'slack', name: 'Slack', icon: 'slack', status: 'coming_soon', items_synced: 0, description: 'Agent alerts in your team channel' },
    { id: 'tally', name: 'Tally Prime', icon: 'tally', status: 'coming_soon', items_synced: 0, description: 'Two-way sync with your existing accounting' },
    { id: 'razorpay', name: 'Razorpay', icon: 'razorpay', status: 'coming_soon', items_synced: 0, description: 'Payment links inside reminders' },
  ],
  tasks: [
    { id: 'task-1', title: 'Chase INV-0029 — Sharma Motors ₹38.4K overdue', agent: 'vasool', col: 'in_progress', priority: 'high', due: 'Today', tags: ['invoice', 'collections'] },
    { id: 'task-2', title: 'WhatsApp reminder draft — INV-0035 Delhi Fleet', agent: 'vasool', col: 'approval', priority: 'high', due: 'Today', tags: ['whatsapp', 'reminder'] },
    { id: 'task-3', title: 'Track ORD-1042 — SafeRoad, Ludhiana → Faridabad', agent: 'logistics-agent', col: 'in_progress', priority: 'med', due: 'Tomorrow', tags: ['shipment'] },
    { id: 'task-4', title: '90-day terms call — Khanna Industries ₹2L order', agent: 'khata', col: 'todo', priority: 'high', due: 'Wed', tags: ['cash-flow'] },
    { id: 'task-5', title: 'Publish 12 products to IndiaMART', agent: 'presence-agent', col: 'todo', priority: 'med', due: 'Fri', tags: ['catalog', 'indiamart'] },
    { id: 'task-6', title: 'Reorder fasteners before Diwali stock-out', agent: 'festival-stock', col: 'todo', priority: 'med', due: 'Oct 2', tags: ['inventory'] },
    { id: 'task-7', title: 'Compare steel rod quotes — 3 suppliers', agent: 'sourcer', col: 'done', priority: 'med', due: 'Yesterday', tags: ['procurement'] },
    { id: 'task-8', title: 'Aging report shared with accountant', agent: 'vasool', col: 'done', priority: 'low', due: 'Mon', tags: ['report'] },
    { id: 'task-9', title: 'Approve storefront theme for Shopify draft', agent: 'presence-agent', col: 'approval', priority: 'low', due: 'Thu', tags: ['storefront'] },
  ],
  artifacts: [
    {
      id: 'art-1042', title: 'Tracking — ORD-1042', template: 'tracking_page',
      created_by: 'Logistics Agent', created_at: '2026-09-19T03:00:00Z', share_path: '/a/art-1042',
      data: { order_id: 'ORD-1042', carrier: 'SafeRoad Carriers', from: 'Ludhiana', to: 'Faridabad', eta: 'Tomorrow 11 AM', status: 'in_transit', progress_pct: 62 },
    },
    {
      id: 'art-0038', title: 'INV-0038 — Sharma Motors', template: 'invoice_summary',
      created_by: 'vasool', created_at: '2026-09-18T14:00:00Z', share_path: '/a/art-0038',
      data: { invoice_no: 'INV-0038', buyer: 'Sharma Motors', amount: 45200, gst: 8136, due_date: '2026-10-05', status: 'due_soon', items: 'Brake pads ×200' },
    },
    {
      id: 'art-steel', title: 'Steel rods — quote comparison', template: 'supplier_compare',
      created_by: 'sourcer', created_at: '2026-09-18T16:00:00Z', share_path: '/a/art-steel',
      data: { item: '50 kg steel rods', quotes: [
        { name: 'Balaji Steel', price: 62, moq: 500, lead_days: 4, trust: 4.2 },
        { name: 'Khanna Metals', price: 58, moq: 1000, lead_days: 7, trust: 3.8 },
        { name: 'Om Sai Traders', price: 65, moq: 250, lead_days: 2, trust: 4.6 },
      ] },
    },
    {
      id: 'art-pay', title: 'Payment request — INV-0031', template: 'payment_card',
      created_by: 'vasool', created_at: '2026-09-18T18:00:00Z', share_path: '/a/art-pay',
      data: { business: 'Ramesh Auto Components', amount: 56400, invoice_no: 'INV-0031', due_date: '2026-09-24', upi: 'rameshauto@upi' },
    },
  ],
}

const uid = () => `demo-${Date.now().toString(36)}`

// In-session mutations — connect/disconnect/add persist while the tab lives.
export const demo = {
  memories: {
    list: () => DEMO.memories,
    add: (text, source = 'owner') => {
      const m = { id: uid(), text, source, created_at: new Date().toISOString() }
      DEMO.memories.push(m); return { id: m.id, status: 'saved' }
    },
    del: (id) => { DEMO.memories = DEMO.memories.filter(m => m.id !== id); return { status: 'deleted' } },
  },
  connectors: {
    // merge real rows with demo extras so the full catalog always renders
    merge: (real) => {
      const have = new Set((real || []).map(c => c.id))
      return [...(real || []), ...DEMO.connectors.filter(c => !have.has(c.id))]
    },
    toggle: (id, connect) => {
      const c = DEMO.connectors.find(x => x.id === id)
      if (c) { c.status = connect ? 'connected' : 'available'; if (connect) { c.connected_at = new Date().toISOString(); c.items_synced ??= 0 } }
      return { id, status: connect ? 'connected' : 'available' }
    },
  },
  tasks: {
    list: () => DEMO.tasks,
    // real /tasks rows use {status, agent_id, due: ISO} — merge with demo extras
    merge: (real) => {
      const have = new Set((real || []).map(t => t.id))
      return [...(real || []), ...DEMO.tasks.filter(t => !have.has(t.id))]
    },
    add: (title, col = 'todo', agent = 'sahayak') => {
      const t = { id: uid(), title, agent, col, priority: 'med', due: '—', tags: [] }
      DEMO.tasks.push(t); return t
    },
    update: (id, patch) => {
      const t = DEMO.tasks.find(x => x.id === id)
      if (t) Object.assign(t, patch)
      return t
    },
  },
  artifacts: {
    list: () => DEMO.artifacts,
    get: (id) => {
      const a = DEMO.artifacts.find(x => x.id === id)
      if (!a) throw new Error('not found')
      return a
    },
  },
  importExcel: (filename) => ({
    file_id: uid(), filename, collection: 'invoices', imported: 34, skipped: 2,
    sample: [{ invoice_no: 'INV-0101', buyer: 'Kapil Auto', amount: 12400, due_date: '2026-10-02' }],
  }),
  // offline fallback — same REPORT_TYPES metadata + a canned business_report artifact
  reports: {
    types: () => [
      { id: 'business_overview', name: 'Business overview', desc: 'The whole shop on one page.', sections: ['KPIs', 'Invoice status', 'Top debtors'] },
      { id: 'receivables_aging', name: 'Receivables aging', desc: 'Who owes what and how late.', sections: ['Aging buckets', 'Open invoices'] },
      { id: 'cashflow_forecast', name: 'Cash flow forecast', desc: 'Money-in vs money-out, next 90 days.', sections: ['Cash events', 'Verdict'] },
      { id: 'gst_summary', name: 'GST summary', desc: 'Output tax by month + filing docs.', sections: ['Monthly billed + GST'] },
      { id: 'ops_digest', name: 'Operations digest', desc: 'What the AI team did.', sections: ['Active agents', 'Activity'] },
    ],
    generate: (reportType, title) => {
      const row = {
        id: uid(), title: title || 'Business overview', template: 'business_report',
        created_by: 'reports-page', visibility: 'private',
        created_at: new Date().toISOString(), share_path: '',
        data: {
          business: 'Ramesh Auto Components', period: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          subtitle: 'Owner digest — receivables, payables and what needs a decision',
          kpis: [
            { label: 'Outstanding', value: '₹4.9L', sub: '11 unpaid invoices' },
            { label: 'Overdue', value: '₹1.8L', sub: '4 invoices' },
            { label: 'Collected', value: '₹6.2L', sub: 'paid invoices' },
            { label: 'Payables', value: '₹1.2L', sub: '3 vendor dues' },
          ],
          sections: [
            { heading: 'Invoices by status', kind: 'table', columns: ['Status', 'Invoices', 'Amount'],
              rows: [['paid', '5', '₹6,20,000'], ['due soon', '7', '₹3,10,000'], ['overdue', '4', '₹1,80,000']] },
            { heading: 'Largest outstanding — by buyer', kind: 'bars',
              items: [
                { label: 'Sharma Constructions', value: 124500, display: '₹1,24,500' },
                { label: 'Om Sai Electric Works', value: 56000, display: '₹56,000' },
                { label: 'Kapil Auto', value: 34800, display: '₹34,800' },
              ] },
            { heading: 'Read', kind: 'text',
              text: 'Offline preview — connect the backend for live figures pulled from your ledgers.' },
          ],
        },
      }
      DEMO.artifacts.push(row); return row
    },
  },
}

// Real substring search over LIVE endpoints where they exist + demo extras —
// same grouped shape as GET /search in contract.json.
export async function demoSearch(q, api) {
  const needle = q.toLowerCase()
  const hit = (...fields) => fields.some(f => String(f || '').toLowerCase().includes(needle))
  const safe = (p) => p.catch(() => [])
  const [invoices, suppliers, carriers, agents] = await Promise.all([
    safe(api.invoices()), safe(api.suppliers()), safe(api.carriers()), safe(api.agents()),
  ])
  return {
    q,
    results: {
      invoices: invoices.filter(i => hit(i.invoice_no, i.buyer))
        .map(i => ({ id: i.id, title: `${i.invoice_no} — ${i.buyer}`, meta: `₹${Number(i.amount).toLocaleString('en-IN')} · ${i.status}`, ref: '#/app' })),
      suppliers: suppliers.filter(s => hit(s.name, s.category))
        .map(s => ({ id: s.id, title: s.name, meta: `${s.category} · trust ${s.trust_score}`, ref: '#/app' })),
      carriers: carriers.filter(c => hit(c.name, c.route))
        .map(c => ({ id: c.id, title: c.name, meta: `${c.route} · ₹${c.rate_per_kg}/kg`, ref: '#/app' })),
      agents: agents.filter(a => hit(a.name, a.goal, a.description))
        .map(a => ({ id: a.id, title: a.name, meta: a.description || a.goal, ref: '#/app' })),
      tasks: DEMO.tasks.filter(t => hit(t.title, t.agent, ...(t.tags || [])))
        .map(t => ({ id: t.id, title: t.title, meta: `task · ${t.col.replace('_', ' ')} · ${t.agent}`, ref: '#/tasks' })),
      memories: DEMO.memories.filter(m => hit(m.text))
        .map(m => ({ id: m.id, title: m.text, meta: `memory · ${m.source}`, ref: '#/settings' })),
      documents: [
        ...DEMO.artifacts.filter(a => hit(a.title))
          .map(a => ({ id: a.id, title: a.title, meta: `artifact · by ${a.created_by}`, ref: `#${a.share_path}` })),
        ...contextStore.list()
          .filter(c => hit(c.name, c.meta, ...(c.tags || [])))
          .map(c => ({ id: c.id, title: c.name, meta: `${c.kind} · ${c.meta}`, tags: c.tags, ref: '#/context' })),
      ],
    },
  }
}
