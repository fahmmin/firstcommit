// Role/permission model — mirrors backend/app/auth.py ROLE_PERMS.
// The ACTIVE role comes from the signed session token the backend issued; the
// server enforces every permission (403). These helpers only decide what the UI
// shows, so a locked button always matches what the API would allow.
import { useSyncExternalStore } from 'react'
import { session } from './auth.js'

export const ROLES = {
  owner:   { label: 'Owner',      desc: 'Full control',        perms: ['*'] },
  manager: { label: 'Manager',    desc: 'Approve + hire',      perms: ['approve', 'hire', 'chat', 'artifacts'] },
  viewer:  { label: 'Viewer',     desc: 'Read + chat',         perms: ['chat'] },
}
const RANK = { viewer: 0, manager: 1, owner: 2 }

const listeners = new Set()
const emit = () => listeners.forEach(f => f())
export const role = {
  get: () => session.get()?.role || 'owner',
  base: () => session.get()?.base_role || session.get()?.role || 'owner',
  // "View as" — the backend re-issues a token; it refuses anything above base
  set: async (r) => {
    const { api } = await import('../api.js')
    const res = await api.switchRole(r)
    session.set({ ...session.get(), token: res.token, role: res.role, base_role: res.base_role })
    emit()
    return res
  },
  canBecome: (r) => (RANK[r] ?? 9) <= (RANK[role.base()] ?? 0),
  refresh: emit,
  sub: (f) => { listeners.add(f); return () => listeners.delete(f) },
}

export const useRole = () => useSyncExternalStore(role.sub, role.get)

export function can(perm, r = role.get()) {
  const perms = ROLES[r]?.perms || []
  return perms.includes('*') || perms.includes(perm)
}
