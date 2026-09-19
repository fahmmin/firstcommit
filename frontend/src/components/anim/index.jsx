// Micro-animation atoms — useanimations.com-style stroke-draw/morph icons.
// CSS lives in index.css (drawCheck, popIn, bellRing, dotBounce, sendFly).
import { Check } from 'lucide-react'

// Checkmark that draws itself on mount — use for approve success, toasts, ticks
export const DrawCheck = ({ size = 14, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
    className={`animate-drawCheck ${className}`}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

// Three bouncing dots — "agent is typing" indicator
export const TypingDots = ({ className = 'text-slate-400' }) => (
  <span className={`inline-flex gap-1 items-center px-1 ${className}`}>
    <span className="typing-dot w-1.5 h-1.5 rounded-full bg-current" />
    <span className="typing-dot w-1.5 h-1.5 rounded-full bg-current" />
    <span className="typing-dot w-1.5 h-1.5 rounded-full bg-current" />
  </span>
)

// Bell that swings once when `ring` toggles true (pending count changed)
export const RingBell = ({ ring, children }) => (
  <span className={`inline-flex ${ring ? 'animate-bellRing' : ''}`}>{children}</span>
)

// Plus icon that spins 135° on parent .plus-hover — "becomes a close X"
export const SpinPlus = ({ size = 12 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" className="plus-ic">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
