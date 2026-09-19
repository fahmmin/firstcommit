// ReverseUI "cloud-syncing" recreation — cloud mark in a rounded tile with
// expanding ripple rings, plus a status pill ("Syncing" spins, "Synced" checks).
import { Cloud, Check, Loader2 } from 'lucide-react'

export function CloudSync({ syncing = true, size = 46, status }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative grid place-items-center" style={{ width: size * 1.9, height: size * 1.9 }}>
        {syncing && [0, 1, 2].map(i => (
          <span key={i} className="absolute rounded-full border border-accent/50"
            style={{ inset: 0, animation: `orbRing 2.4s ease-out infinite`, animationDelay: `${i * 0.8}s` }} />
        ))}
        <span className={`w-[46px] h-[46px] rounded-2xl grid place-items-center border shadow-float transition-colors
          ${syncing ? 'bg-white border-accent/30 text-accent' : 'bg-emerald-50 border-emerald-200 text-emerald-500'}`}
          style={{ width: size, height: size }}>
          {syncing ? <Cloud size={size * 0.42} /> : <Check size={size * 0.42} />}
        </span>
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium
        ${syncing ? 'border-accent/30 bg-accent/5 text-accent' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`}>
        {syncing ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        {status || (syncing ? 'Syncing' : 'Synced')}
      </span>
    </div>
  )
}
