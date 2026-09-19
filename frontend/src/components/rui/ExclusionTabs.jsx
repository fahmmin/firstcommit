// ReverseUI "exclusion-tabs" recreation — a pill tab bar on a dark track with
// a white indicator that slides/springs to the active tab; the label inverts
// via mix-blend-mode: exclusion (white text − white pill = dark text).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export function ExclusionTabs({ tabs, active, onChange, className = '' }) {
  const [pos, setPos] = useState({ left: 0, width: 0 })
  const refs = useRef({})

  useLayoutEffect(() => {
    const el = refs.current[active]
    if (el) setPos({ left: el.offsetLeft, width: el.offsetWidth })
  }, [active, tabs])

  return (
    <div className={`relative inline-flex items-center rounded-full bg-ink p-[3px] ${className}`}
      role="tablist">
      {/* sliding white pill */}
      <span className="absolute top-[3px] bottom-[3px] rounded-full bg-white transition-all duration-300 ease-[cubic-bezier(.3,1.4,.4,1)]"
        style={{ left: pos.left, width: pos.width, opacity: pos.width ? 1 : 0 }} />
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={active === t.id}
          ref={el => refs.current[t.id] = el}
          onClick={() => onChange(t.id)}
          className="relative z-10 px-3.5 py-1.5 text-[11px] font-semibold text-white rounded-full transition">
          <span className="mix-blend-exclusion flex items-center gap-1.5">
            {t.icon}
            {t.label}
            {t.count != null && <span className="text-[9px] opacity-70">{t.count}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
