// ReverseUI "navigation-indicator" recreation — a vertical column of thin
// dashes pinned to the edge of the chat; each dash = one message. Hover grows
// the dash and reveals a tooltip; click scrolls straight to that message.
import { useEffect, useState } from 'react'

export function NavIndicator({ items, activeIndex, onJump, className = '' }) {
  const [hover, setHover] = useState(-1)
  // items: [{ role, text }] — one dash each; top = first message (jump to start), bottom = latest
  return (
    <div className={`absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex flex-col items-end gap-[7px] ${className}`}>
      {items.map((it, i) => {
        const active = i === activeIndex
        const hov = i === hover
        return (
          <div key={i} className="relative flex items-center"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}>
            {/* tooltip */}
            <span className={`pointer-events-none absolute right-5 whitespace-nowrap max-w-[200px] truncate rounded-lg border border-slate-200 bg-white shadow-float px-2.5 py-1.5 text-[10px] text-slate-600 transition-all
              ${hov ? 'opacity-100 -translate-x-1' : 'opacity-0 translate-x-1'}`}>
              <span className={`font-semibold ${it.role === 'user' ? 'text-ink' : 'text-accent'}`}>{it.role === 'user' ? 'You' : (it.agent || 'Agent')}</span>
              {' · '}{it.text?.slice(0, 42)}{it.text?.length > 42 ? '…' : ''}
            </span>
            <button onClick={() => onJump(i)} aria-label={`Jump to message ${i + 1}`}
              className={`h-[3px] rounded-full transition-all duration-200
                ${active ? 'bg-accent' : it.role === 'user' ? 'bg-slate-400' : 'bg-slate-300'}
                ${hov ? 'w-7 bg-ink' : 'w-3.5'}`} />
          </div>
        )
      })}
    </div>
  )
}
