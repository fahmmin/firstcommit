// Demo store — graceful fallbacks so every screen renders with content while
// backend endpoints land. api.js tries the REAL endpoint first; only a failure
// drops to this in-browser store (mutations persist for the session).
// Nothing here is labelled "demo" in the UI — it's the offline cache layer.

export const DEMO = {
  memories: [
    { id: 'mem-1', text: 'Sharma Traders always pays around 45 days — don’t push hard', source: 'owner', created_at: '2026-09-15T10:00:00Z' },
    { id: 'mem-2', text: 'Big orders go through GST invoice only', source: 'onboarding', created_at: '2026-09-15T10:05:00Z' },
    { id: 'mem-3', text: 'VRL is our backup transporter for the Ludhiana route', source: 'owner', created_at: '2026-09-16T09:00:00Z' },
    { id: 'mem-4', text: 'Diwali season: stock fasteners + brake pads 3 weeks early', source: 'onboarding', created_at: '2026-09-15T10:06:00Z' },
  ],
  connectors: [
    { id: 'whatsapp', name: 'WhatsApp Business', icon: 'whatsapp', status: 'connected', connected_at: '2026-09-15T10:00:00Z', last_sync: '2026-09-19T02:00:00Z', items_synced: 128, description: 'Send payment reminders + order updates on WhatsApp' },
    { id: 'gmail', name: 'Gmail', icon: 'gmail', status: 'connected', connected_at: '2026-09-15T10:00:00Z', last_sync: '2026-09-19T01:00:00Z', items_synced: 212, description: 'Read invoices and POs straight from your inbox' },
    { id: 'google_drive', name: 'Google Drive', icon: 'google_drive', status: 'connected', connected_at: '2026-09-15T10:00:00Z', last_sync: '2026-09-19T01:30:00Z', items_synced: 56, description: 'Ledger exports and uploaded docs live in Drive' },
    { id: 'google_calendar', name: 'Google Calendar', icon: 'google_calendar', status: 'connected', connected_at: '2026-09-16T10:00:00Z', last_sync: '2026-09-19T01:00:00Z', items_synced: 18, description: 'Invoice dues and reminders on your calendar' },
    { id: 'excel', name: 'Excel / Tally import', icon: 'excel', status: 'connected', connected_at: '2026-09-17T10:00:00Z', last_sync: '2026-09-18T20:00:00Z', items_synced: 34, description: 'One-click ledger import from .xlsx' },
    { id: 'slack', name: 'Slack', icon: 'slack', status: 'available', description: 'Agent alerts in your team channel' },
    { id: 'airtable', name: 'Airtable', icon: 'airtable', status: 'available', description: 'Sync ledger + suppliers to your base' },
    { id: 'tally', name: 'Tally Prime', icon: 'tally', status: 'available', description: 'Two-way sync with your existing accounting' },
    { id: 'razorpay', name: 'Razorpay', icon: 'razorpay', status: 'available', description: 'Payment links inside reminders' },
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
      tasks: [],
      memories: DEMO.memories.filter(m => hit(m.text))
        .map(m => ({ id: m.id, title: m.text, meta: `memory · ${m.source}`, ref: '#/settings' })),
      documents: DEMO.artifacts.filter(a => hit(a.title))
        .map(a => ({ id: a.id, title: a.title, meta: `artifact · by ${a.created_by}`, ref: `#${a.share_path}` })),
    },
  }
}
