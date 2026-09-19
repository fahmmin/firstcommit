// Permission gate — wraps an action element; without the permission it
// renders locked (dimmed, non-interactive) with an access-rings tooltip.
import { useState } from 'react'
import { can, useRole, ROLES } from '../../lib/role.js'
import { AccessRings } from './Circles.jsx'

export function Can({ perm, children, reason }) {
  const r = useRole()
  const [hover, setHover] = useState(false)
  if (can(perm, r)) return children
  return (
    <span className="relative inline-block"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span className="pointer-events-none opacity-40 inline-block">{children}</span>
      {hover && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 w-48 rounded-xl border border-slate-200 bg-white shadow-float-lg p-3 text-center pointer-events-none">
          <span className="flex justify-center mb-1"><AccessRings allowed={false} size={46} /></span>
          <span className="block text-[10px] font-semibold text-ink">{reason || 'Owner access required'}</span>
          <span className="block text-[9px] text-slate-400 mt-0.5">Signed in as {ROLES[r]?.label} — switch role in Settings</span>
        </span>
      )}
    </span>
  )
}
