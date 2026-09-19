// ReverseUI "speedy-circles" + "role-based-access-control" recreations —
// concentric rings that spin (speeding up on hover/active) and radiating
// permission rings around a centered icon.
import { Lock } from 'lucide-react'

// Speedy circles — dashed concentric rings spinning at staggered speeds.
export function SpeedyCircles({ size = 120, active = false, children, className = '' }) {
  const rings = [
    { inset: '6%', dur: active ? 1.6 : 6, dash: '4 6', op: 0.5 },
    { inset: '18%', dur: active ? 1.1 : 4.5, dash: '2 5', op: 0.35, rev: true },
    { inset: '31%', dur: active ? 0.8 : 3.2, dash: '1 4', op: 0.55 },
  ]
  return (
    <div className={`relative grid place-items-center group ${className}`} style={{ width: size, height: size }}>
      {rings.map((r, i) => (
        <span key={i} className="absolute rounded-full border border-dashed border-accent transition-colors group-hover:border-accent-2"
          style={{
            inset: r.inset, borderStyle: 'dashed', opacity: r.op,
            borderWidth: 1, borderColor: undefined,
            animation: `ruiSpin ${r.dur}s linear infinite ${r.rev ? 'reverse' : ''}`,
          }} />
      ))}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

// Access rings — the RBAC visual: radiating circles around a lock/user mark.
// Denied = rings collapse to a tight locked cluster; allowed = rings breathe.
export function AccessRings({ allowed = true, size = 88 }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {[0.9, 0.68, 0.46].map((s, i) => (
        <span key={i} className={`absolute rounded-full border transition-all duration-500
          ${allowed ? 'border-accent/40 animate-ringBreathe' : 'border-rose-300/50'}`}
          style={{ inset: `${(1 - s) * 50}%`, animationDelay: `${i * 0.4}s` }} />
      ))}
      <span className={`w-9 h-9 rounded-full grid place-items-center z-10 shadow-sm
        ${allowed ? 'bg-ink text-white' : 'bg-rose-500 text-white'}`}>
        <Lock size={13} />
      </span>
    </div>
  )
}
