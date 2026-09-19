// ReverseUI "data-feeding-in" recreation — source chips at top, curved dashed
// SVG paths pulse-trace downward, converging into a table whose rows stream in.
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BrandIcon } from '../BrandIcon.jsx'

const SOURCES = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'excel', label: 'Excel' },
  { id: 'gmail', label: 'Gmail' },
  { id: 'tally', label: 'Tally' },
  { id: 'razorpay', label: 'Razorpay' },
]
const ROWS = [
  ['INV-0044', 'Patel Auto Parts', '₹88,700', 'due 5d'],
  ['MSG', 'Sharma Motors', '“payment kal”', 'parsed'],
  ['PO-118', 'Balaji Steel', '₹31,000', 'matched'],
  ['INV-0031', 'Sharma Motors', '₹56,400', 'overdue'],
  ['UPI-9921', 'Om Sai Traders', '₹12,800', 'reconciled'],
  ['PO-121', 'Khanna Metals', '₹58,000', 'pending'],
]

export function DataFeed({ dark = false, className = '' }) {
  const [count, setCount] = useState(2)
  useEffect(() => {
    const t = setInterval(() => setCount(c => (c + 1) % (ROWS.length + 1) || 1), 1400)
    return () => clearInterval(t)
  }, [])

  const W = 640, H = 210, cols = SOURCES.length
  const paths = useMemo(() => SOURCES.map((_, i) => {
    const x0 = 60 + i * ((W - 120) / (cols - 1))
    const x1 = W / 2 + (i - (cols - 1) / 2) * 26
    return `M ${x0} 0 C ${x0} ${H * 0.62}, ${x1} ${H * 0.38}, ${x1} ${H}`
  }), [])

  return (
    <div className={`relative ${className}`}>
      {/* source chips */}
      <div className="flex justify-between px-8 relative z-10">
        {SOURCES.map(s => (
          <div key={s.id} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium
            ${dark ? 'bg-ink-2 border-white/10 text-white/80' : 'bg-white border-slate-200 text-slate-600 shadow-float'}`}>
            <BrandIcon id={s.id} size={12} /> {s.label}
          </div>
        ))}
      </div>
      {/* pulse-traced paths */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[190px] mt-1" preserveAspectRatio="none">
        {paths.map((d, i) => (
          <g key={i}>
            <path d={d} fill="none" stroke={dark ? 'rgba(255,255,255,.12)' : '#cbd5e1'} strokeWidth="1" strokeDasharray="3 4" />
            <circle r="2.5" fill="#3494f4">
              <animateMotion dur={`${2 + i * 0.35}s`} repeatCount="indefinite" path={d} />
            </circle>
            <circle r="1.5" fill="#a9daf5">
              <animateMotion dur={`${2 + i * 0.35}s`} begin="0.9s" repeatCount="indefinite" path={d} />
            </circle>
          </g>
        ))}
      </svg>
      {/* converging table */}
      <div className={`rounded-xl border overflow-hidden mx-auto max-w-lg
        ${dark ? 'bg-ink-2 border-white/10' : 'bg-white border-slate-200 shadow-float'}`}>
        <div className={`grid grid-cols-[64px_1fr_72px_64px] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider
          ${dark ? 'text-white/40 border-b border-white/10' : 'text-slate-400 border-b border-slate-100 bg-slate-50/60'}`}>
          <span>Ref</span><span>Party</span><span className="text-right">Amount</span><span className="text-right">Status</span>
        </div>
        <AnimatePresence initial={false}>
          {ROWS.slice(0, count).map((r, i) => (
            <motion.div key={r[0] + i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className={`grid grid-cols-[64px_1fr_72px_64px] px-3 items-center text-[10px] h-8
                ${dark ? 'text-white/70 border-b border-white/5' : 'text-slate-600 border-b border-slate-50'} last:border-0`}>
              <span className="font-mono text-accent truncate">{r[0]}</span>
              <span className="truncate">{r[1]}</span>
              <span className="text-right font-medium tabular-nums">{r[2]}</span>
              <span className={`text-right ${r[3].includes('overdue') ? 'text-rose-500 font-semibold' : dark ? 'text-white/40' : 'text-slate-400'}`}>{r[3]}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
