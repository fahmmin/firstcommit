// Lightweight role/permission model — demo-visible RBAC.
// Role persists in localStorage; Can/RoleGate components gate UI actions.
import { useSyncExternalStore } from 'react'

export const ROLES = {
  owner:   { label: 'Owner',      desc: 'Full control',        perms: ['*'] },
  manager: { label: 'Manager',    desc: 'Approve + hire',      perms: ['approve', 'hire', 'chat', 'artifacts'] },
  viewer:  { label: 'Viewer',     desc: 'Read-only',           perms: ['chat'] },
}

const KEY = 'sahayak_role'
const listeners = new Set()
export const role = {
  get: () => localStorage.getItem(KEY) || 'owner',
  set: (r) => { localStorage.setItem(KEY, r); listeners.forEach(f => f()) },
  sub: (f) => { listeners.add(f); return () => listeners.delete(f) },
}

export const useRole = () => useSyncExternalStore(role.sub, role.get)

export function can(perm, r = role.get()) {
  const perms = ROLES[r]?.perms || []
  return perms.includes('*') || perms.includes(perm)
}
