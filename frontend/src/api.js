// API client — thin wrapper over the contract (frontend/mocks/contract.json).
// Vite proxies /api → localhost:8000 in dev. Point VITE_API_URL elsewhere for prod.

const BASE = import.meta.env.VITE_API_URL || '/api'
// Multi-tenant: the logged-in session carries tenant_id (guests → ramesh_auto
// showcase). `export let` is a live binding, so reassigning it on login updates
// every page that reads TENANT — no per-call plumbing needed.
const _session = () => { try { return JSON.parse(localStorage.getItem('sahayak_session')) } catch { return null } }
export let TENANT = _session()?.tenant_id || 'ramesh_auto'
export const setTenant = (id) => { TENANT = id || 'ramesh_auto' }

import { demo, demoSearch } from './lib/demo.js'
import { session } from './lib/auth.js'
import { toast } from './lib/toast.js'

// Offline flag — set whenever a read falls back to the sample store because the
// backend was unreachable. The UI shows an "Offline — sample data" pill so sample
// rows are never mistaken for the tenant's real data. A later success clears it.
let _offline = false
const _subs = new Set()
const _setOffline = (v) => { if (v !== _offline) { _offline = v; _subs.forEach(f => f(v)) } }
export const markOffline = () => _setOffline(true)
export const offline = { get: () => _offline, subscribe: (f) => { _subs.add(f); return () => _subs.delete(f) } }
// read with a labelled sample fallback (never used for writes — a failed write must fail)
const withSample = (p, sample) => p.then(r => { _setOffline(false); return r })
  .catch(() => { _setOffline(true); return typeof sample === 'function' ? sample() : sample })

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
    // the gate runs before auth: a right passcode gets past it (then auth may
    // still say "sign in required"); a wrong one is rejected by the gate itself
    const r = await fetch(`${BASE}/auth/me`,
      { headers: { 'x-demo-token': code, 'ngrok-skip-browser-warning': '1' } })
    if (r.ok) return true
    const d = (await r.json().catch(() => ({})))?.detail || ''
    return !/passcode/.test(d)
  } catch { return false }
}

// signed session token (backend/app/auth.py) — the server enforces tenant + role
export const authToken = () => session.get()?.token || ''

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) }
  const g = gateToken()
  if (g) headers['x-demo-token'] = g
  const t = authToken()
  if (t && !headers.Authorization) headers.Authorization = `Bearer ${t}`
  headers['ngrok-skip-browser-warning'] = '1'  // harmless elsewhere; skips tunnel interstitial
  const r = await fetch(`${BASE}${path}`, { ...opts, headers })
  if (r.status === 401 && !path.startsWith('/public/')) {
    const detail = (await r.json().catch(() => ({})))?.detail || ''
    if (/passcode/.test(detail)) { location.hash = '#/gate'; throw new Error('demo passcode required') }
    // missing/expired/forged token → sign in again (the server said no, not the UI)
    session.clear()
    if (!/^#\/(login|gate|a\/|join)/.test(location.hash)) location.hash = '#/login'
    throw new Error('sign in required')
  }
  if (r.status === 403) {
    const detail = (await r.json().catch(() => ({})))?.detail || 'not allowed'
    toast.push(detail.charAt(0).toUpperCase() + detail.slice(1), 'err')
    const e = new Error(detail); e.status = 403; throw e
  }
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${r.status}`)
  return r.json()
}

export const api = {
  health: () => req('/health'),
  chat: (text, agentId = null, mode = 'chat', scope = null) =>
    req('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT, text, agent_id: agentId, mode, scope }),
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
  // server returns the full catalog with real statuses (coming_soon included)
  connectors: () => withSample(req(`/connectors?tenant_id=${TENANT}`), () => demo.connectors.list()),
  connectConnector: (id) => req(`/connectors/${id}/connect?tenant_id=${TENANT}`, { method: 'POST' }),
  disconnectConnector: (id) => req(`/connectors/${id}/disconnect?tenant_id=${TENANT}`, { method: 'POST' }),
  settings: () => req(`/settings?tenant_id=${TENANT}`),
  updateSettings: (body) =>
    req(`/settings?tenant_id=${TENANT}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  dashboard: () => req(`/dashboard/summary?tenant_id=${TENANT}`),
  runScheduler: () => req(`/scheduler/run?tenant_id=${TENANT}`, { method: 'POST' }),
  resetDemo: () => req(`/demo/reset?tenant_id=${TENANT}`, { method: 'POST' }),

  // ── round 2 — real endpoint first; reads fall back to labelled sample data ──
  login: (body) =>
    req('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  me: (token) => req('/auth/me', token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  switchRole: (role) =>
    req('/auth/role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) }),
  invite: (role) =>
    req('/auth/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) }),
  memories: () => withSample(req(`/memories?tenant_id=${TENANT}`), () => demo.memories.list()),
  addMemory: (text, source = 'owner') =>
    req('/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ tenant_id: TENANT, text, source }) }),
  delMemory: (id) => req(`/memories/${id}?tenant_id=${TENANT}`, { method: 'DELETE' }),
  search: (q) => withSample(req(`/search?tenant_id=${TENANT}&q=${encodeURIComponent(q)}`), () => demoSearch(q, api)),
  artifacts: () => withSample(req(`/artifacts?tenant_id=${TENANT}`), () => demo.artifacts.list()),
  artifact: (id) => withSample(req(`/artifacts/${id}?tenant_id=${TENANT}`), () => demo.artifacts.get(id)),
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
    return req('/import/excel', { method: 'POST', body: fd })
  },
  calendarEvents: () => req(`/calendar/events?tenant_id=${TENANT}`).catch(() => []),
  tasks: () => withSample(req(`/tasks?tenant_id=${TENANT}`), () => demo.tasks.list()),
  // backend TaskReq uses agent_id/status — send both vocabularies so it works today
  // and keeps working when the backend adds status/col support
  addTask: (title, col = 'todo', agent = 'sahayak') =>
    req('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenant_id: TENANT, title, col, agent, status: col, agent_id: agent }) }),
  updateTask: (id, patch) =>
    req(`/tasks/${id}?tenant_id=${TENANT}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }),

  // ── rounds 3–4 backend — live endpoints wired to real UI ──
  people: () => req(`/people?tenant_id=${TENANT}`),
  markRead: (id) => req(`/notifications/${id}/read?tenant_id=${TENANT}`, { method: 'POST' }),
  syncConnector: (id) => req(`/connectors/${id}/sync?tenant_id=${TENANT}`),
  // throws on failure so the Logs stream can show "paused" instead of pretending
  logs: (limit = 80, since = '') =>
    req(`/logs?tenant_id=${TENANT}&limit=${limit}${since ? `&since=${encodeURIComponent(since)}` : ''}`),
  metrics: () => req(`/metrics?tenant_id=${TENANT}`),
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
  contextPreview: (id) => req(`/context/${id}/preview?tenant_id=${TENANT}`),
  // direct URL for iframe/img — the gate accepts ?gate= so media renders in-app
  contextFileUrl: (id) =>
    `${BASE}/context/${id}/file?tenant_id=${TENANT}&access_token=${encodeURIComponent(authToken())}${gateToken() ? `&gate=${encodeURIComponent(gateToken())}` : ''}`,

  // ── reports — real-data docs persisted as business_report artifacts ──
  reportTypes: () => withSample(req('/reports/types'), () => demo.reports.types()),
  generateReport: (reportType, title = '', visibility = 'private') =>
    req('/reports/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT, report_type: reportType, title, visibility }) }),
  // binary download — returns {blob, filename}; caller does URL.createObjectURL
  reportPdf: async (id, isPublic = false) => {
    const path = isPublic ? `/public/artifacts/${id}/pdf` : `/reports/${id}/pdf?tenant_id=${TENANT}`
    const r = await fetch(`${BASE}${path}`, { headers: { 'x-demo-token': gateToken(), ...(isPublic ? {} : { Authorization: `Bearer ${authToken()}` }) } })
    if (!r.ok) throw new Error(`pdf → ${r.status}`)
    const fname = (r.headers.get('content-disposition') || '').match(/filename="?([^";]+)/)?.[1] || `report-${id}.pdf`
    return { blob: await r.blob(), filename: fname }
  },
}
