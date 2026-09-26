import { useEffect, useState } from 'react'
import { api, setTenant } from '../api.js'
import { session } from '../lib/auth.js'
import { ROLES, role } from '../lib/role.js'
import { Blobs } from '../components/Logo.jsx'

// #/join/<token> — a teammate opens the owner's invite link. The backend
// verifies the signed token (/auth/me); its role ceiling is fixed by the owner.
export default function Join({ param }) {
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!param) { setErr('This invite link is incomplete.'); return }
    api.me(param).then(me => {
      session.set({ token: param, tenant_id: me.tenant_id, role: me.role, base_role: me.base_role,
                    onboarded: true, user: { name: ROLES[me.role]?.label || me.role } })
      setTenant(me.tenant_id)
      role.refresh()
      location.hash = '#/app'
    }).catch(() => setErr('This invite link is invalid or has expired — ask the owner for a new one.'))
  }, [param])
  return (
    <div className="min-h-screen grid place-items-center bg-[#fbfbfd] font-sans">
      <div className="text-center">
        <div className="flex justify-center mb-3"><Blobs /></div>
        <p className="text-[13px] text-slate-500">{err || 'Joining workspace…'}</p>
        {err && <a href="#/login" className="text-[12px] text-accent mt-2 inline-block">Go to sign in</a>}
      </div>
    </div>
  )
}
