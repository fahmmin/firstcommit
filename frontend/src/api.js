// API client — thin wrapper over the contract (frontend/mocks/contract.json).
// Vite proxies /api → localhost:8000 in dev. Point VITE_API_URL elsewhere for prod.

const BASE = import.meta.env.VITE_API_URL || '/api'
export const TENANT = 'ramesh_auto'

import { demo, demoSearch } from './lib/demo.js'

// demo gate — the deployed API sits behind DEMO_GATE_TOKEN (auth is demo-only
// by project rule). Share the URL as .../?gate=PASSCODE#/app once and it sticks
// in localStorage; public artifact links never need it.
const qs = new URLSearchParams(location.search)
if (qs.get('gate')) localStorage.setItem('sahayak_gate', qs.get('gate'))
export const setGate = (t) => localStorage.setItem('sahayak_gate', t || '')
export const gateToken = () => localStorage.getItem('sahayak_gate') || ''
// raw probe for the Gate page — no demo fallback: a wrong passcode must fail
export const checkGate = async (code) => {
  try {
    const r = await fetch(`${BASE}/agents?tenant_id=${TENANT}`,
      { headers: { 'x-demo-token': code, 'ngrok-skip-browser-warning': '1' } })
    return r.ok
  } catch { return false }
}

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) }
  const g = gateToken()
  if (g) headers['x-demo-token'] = g
  headers['ngrok-skip-browser-warning'] = '1'  // harmless elsewhere; skips tunnel interstitial
  const r = await fetch(`${BASE}${path}`, { ...opts, headers })
  if (r.status === 401 && !path.startsWith('/public/')) {
    location.hash = '#/gate'
    throw new Error('demo passcode required')
  }
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${r.status}`)
  return r.json()
}

export const api = {
  health: () => req('/health'),
  chat: (text, agentId = null, mode = 'chat') =>
    req('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT, text, agent_id: agentId, mode }),
    }),
  agents: () => req(`/agents?tenant_id=${TENANT}`),
  createAgent: (spec) =>
    req('/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ tenant_id: TENANT, ...spec }) }),
  previewAgent: (spec) =>
    req('/agents/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ tenant_id: TENANT, ...spec }) }),
  invoices: (status) => req(`/invoices?tenant_id=${TENANT}${status ? `&status=${status}` : ''}`),
  upload: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('tenant_id', TENANT)
    return req('/upload', { method: 'POST', body: fd })
  },
  draftReminder: (invoiceId) => req(`/invoices/${invoiceId}/reminder?tenant_id=${TENANT}`, { method: 'POST' }),
  alerts: () => req(`/alerts?tenant_id=${TENANT}`),
  approveAlert: (id) => req(`/alerts/${id}/approve?tenant_id=${TENANT}`, { method: 'POST' }),
  suppliers: (q) => req(`/suppliers?tenant_id=${TENANT}${q ? `&q=${q}` : ''}`),
  carriers: (to) => req(`/carriers?tenant_id=${TENANT}${to ? `&to=${to}` : ''}`),
  cashflow: () => req(`/cashflow?tenant_id=${TENANT}`),
  agentDetail: (id) => req(`/agents/${id}?tenant_id=${TENANT}`),
  agentContext: (id) => req(`/agents/${id}/context?tenant_id=${TENANT}`),
  notifications: () => req(`/notifications?tenant_id=${TENANT}`),
  connectors: () =>
    req(`/connectors?tenant_id=${TENANT}`).then(demo.connectors.merge).catch(() => demo.connectors.merge([])),
  connectConnector: (id) =>
    req(`/connectors/${id}/connect?tenant_id=${TENANT}`, { method: 'POST' }).catch(() => demo.connectors.toggle(id, true)),
  disconnectConnector: (id) =>
    req(`/connectors/${id}/disconnect?tenant_id=${TENANT}`, { method: 'POST' }).catch(() => demo.connectors.toggle(id, false)),
  settings: () => req(`/settings?tenant_id=${TENANT}`),
  updateSettings: (body) =>
    req(`/settings?tenant_id=${TENANT}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  dashboard: () => req(`/dashboard/summary?tenant_id=${TENANT}`),
  runScheduler: () => req(`/scheduler/run?tenant_id=${TENANT}`, { method: 'POST' }),
  resetDemo: () => req(`/demo/reset?tenant_id=${TENANT}`, { method: 'POST' }),

  // ── round 2 — real endpoint first, demo store on failure ──
  login: (body) =>
    req('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  memories: () => req(`/memories?tenant_id=${TENANT}`).catch(() => demo.memories.list()),
  addMemory: (text, source = 'owner') =>
    req('/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ tenant_id: TENANT, text, source }) })
      .catch(() => demo.memories.add(text, source)),
  delMemory: (id) => req(`/memories/${id}`, { method: 'DELETE' }).catch(() => demo.memories.del(id)),
  search: (q) => req(`/search?tenant_id=${TENANT}&q=${encodeURIComponent(q)}`).catch(() => demoSearch(q, api)),
  artifacts: () => req(`/artifacts?tenant_id=${TENANT}`).catch(() => demo.artifacts.list()),
  artifact: (id) => req(`/artifacts/${id}`).catch(() => demo.artifacts.get(id)),
  updateArtifact: (id, patch) =>
    req(`/artifacts/${id}?tenant_id=${TENANT}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),
  // share-link route — only resolves public artifacts (no tenant context needed)
  publicArtifact: (id) => req(`/public/artifacts/${id}`).catch(() => {
    const a = demo.artifacts.get(id)
    if (a.visibility === 'private') throw new Error('private')
    return a
  }),
  importExcel: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('tenant_id', TENANT)
    return req('/import/excel', { method: 'POST', body: fd }).catch(() => demo.importExcel(file?.name))
  },
  calendarEvents: () => req(`/calendar/events?tenant_id=${TENANT}`).catch(() => []),
  tasks: () =>
    req(`/tasks?tenant_id=${TENANT}`).then(demo.tasks.merge).catch(() => demo.tasks.list()),
  // backend TaskReq uses agent_id/status — send both vocabularies so it works today
  // and keeps working when the backend adds status/col support
  addTask: (title, col = 'todo', agent = 'sahayak') =>
    req('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenant_id: TENANT, title, col, agent, status: col, agent_id: agent }) })
      .catch(() => demo.tasks.add(title, col, agent)),
  updateTask: (id, patch) =>
    req(`/tasks/${id}?tenant_id=${TENANT}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      .catch(() => demo.tasks.update(id, patch)),

  // ── rounds 3–4 backend — live endpoints wired to real UI ──
  people: () => req(`/people?tenant_id=${TENANT}`),
  markRead: (id) => req(`/notifications/${id}/read?tenant_id=${TENANT}`, { method: 'POST' }),
  syncConnector: (id) => req(`/connectors/${id}/sync?tenant_id=${TENANT}`),
  logs: (limit = 80) => req(`/logs?tenant_id=${TENANT}&limit=${limit}`).catch(() => []),
  templates: () => req(`/templates?tenant_id=${TENANT}`).catch(() => []),
  installTemplate: (id) =>
    req(`/templates/${id}/install`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ tenant_id: TENANT }) }),
  onboarding: (body) =>
    req('/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ tenant_id: TENANT, ...body }) }),
  contextDocs: () => req(`/context?tenant_id=${TENANT}`),
  uploadContext: (fileOrText) => {
    const fd = new FormData()
    if (typeof fileOrText === 'string') fd.append('text', fileOrText)
    else fd.append('file', fileOrText)
    fd.append('tenant_id', TENANT)
    return req('/context/upload', { method: 'POST', body: fd })
  },
  delContext: (id) => req(`/context/${id}?tenant_id=${TENANT}`, { method: 'DELETE' }),

  // ── reports — real-data docs persisted as business_report artifacts ──
  reportTypes: () => req('/reports/types').catch(() => demo.reports.types()),
  generateReport: (reportType, title = '', visibility = 'private') =>
    req('/reports/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT, report_type: reportType, title, visibility }) })
      .catch(() => demo.reports.generate(reportType, title)),
  // binary download — returns {blob, filename}; caller does URL.createObjectURL
  reportPdf: async (id, isPublic = false) => {
    const path = isPublic ? `/public/artifacts/${id}/pdf` : `/reports/${id}/pdf?tenant_id=${TENANT}`
    const r = await fetch(`${BASE}${path}`, { headers: { 'x-demo-token': gateToken() } })
    if (!r.ok) throw new Error(`pdf → ${r.status}`)
    const fname = (r.headers.get('content-disposition') || '').match(/filename="?([^";]+)/)?.[1] || `report-${id}.pdf`
    return { blob: await r.blob(), filename: fname }
  },
}
