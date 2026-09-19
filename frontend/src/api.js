// API client — thin wrapper over the contract (frontend/mocks/contract.json).
// Vite proxies /api → localhost:8000 in dev. Point VITE_API_URL elsewhere for prod.

const BASE = import.meta.env.VITE_API_URL || '/api'
export const TENANT = 'ramesh_auto'

import { demo, demoSearch } from './lib/demo.js'

async function req(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, opts)
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
  importExcel: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('tenant_id', TENANT)
    return req('/import/excel', { method: 'POST', body: fd }).catch(() => demo.importExcel(file?.name))
  },
  calendarEvents: () => req(`/calendar/events?tenant_id=${TENANT}`).catch(() => []),
  tasks: () =>
    req(`/tasks?tenant_id=${TENANT}`).then(demo.tasks.merge).catch(() => demo.tasks.list()),
  addTask: (title, col = 'todo', agent = 'sahayak') =>
    req('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenant_id: TENANT, title, col, agent }) })
      .catch(() => demo.tasks.add(title, col, agent)),
  updateTask: (id, patch) =>
    req(`/tasks/${id}?tenant_id=${TENANT}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      .catch(() => demo.tasks.update(id, patch)),
}
