// API client — thin wrapper over the contract (frontend/mocks/contract.json).
// Vite proxies /api → localhost:8000 in dev. Point VITE_API_URL elsewhere for prod.

const BASE = import.meta.env.VITE_API_URL || '/api'
export const TENANT = 'ramesh_auto'

async function req(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, opts)
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${r.status}`)
  return r.json()
}

export const api = {
  health: () => req('/health'),
  chat: (text, agentId = null) =>
    req('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT, text, agent_id: agentId }),
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
  connectors: () => req(`/connectors?tenant_id=${TENANT}`),
  settings: () => req(`/settings?tenant_id=${TENANT}`),
  dashboard: () => req(`/dashboard/summary?tenant_id=${TENANT}`),
  runScheduler: () => req(`/scheduler/run?tenant_id=${TENANT}`, { method: 'POST' }),
  resetDemo: () => req(`/demo/reset?tenant_id=${TENANT}`, { method: 'POST' }),
}
