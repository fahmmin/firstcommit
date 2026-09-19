// ReverseUI "track-invoices" recreation — a 3D layered stack of invoice cards
// with an accent top-edge per status; cycles the deck on an interval, fans on hover.
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { IndianRupee } from 'lucide-react'

const STATUS = {
  overdue: { bar: '#d4428f', label: 'OVERDUE', cls: 'text-rose-600 bg-rose-50' },
  due_soon: { bar: '#e8a13d', label: 'DUE SOON', cls: 'text-amber-600 bg-amber-50' },
  pending: { bar: '#3494f4', label: 'SENT', cls: 'text-accent bg-accent/10' },
  paid: { bar: '#1aaf50', label: 'PAID', cls: 'text-emerald-600 bg-emerald-50' },
}
const fmtInr = n => '₹' + Number(n || 0).toLocaleString('en-IN')

export function TrackInvoices({ invoices = [], className = '' }) {
  const deck = invoices.slice(0, 4)
  const [top, setTop] = useState(0)
  const [hover, setHover] = useState(false)
  useEffect(() => {
    if (hover || deck.length < 2) return
    const t = setInterval(() => setTop(i => (i + 1) % deck.length), 2400)
    return () => clearInterval(t)
  }, [deck.length, hover])
  if (!deck.length) return null

  return (
    <div className={`rounded-xl border border-slate-200 p-3 ${className}`}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="text-[10px] font-semibold text-slate-500 mb-2 flex justify-between">
        <span>Tracking {deck.length} invoices</span><span className="text-slate-300">hover to fan</span>
      </div>
      <div className="relative h-[132px]" style={{ perspective: 600 }}>
        {deck.map((inv, j) => {
          const pos = (j - top + deck.length) % deck.length          // 0 = top card
          const s = STATUS[inv.status] || STATUS.pending
          const fanX = hover ? (pos - (deck.length - 1) / 2) * 26 : 0
          return (
            <motion.div key={inv.id || j}
              animate={{
                y: pos * -8, scale: 1 - pos * 0.05, x: fanX,
                rotateX: hover ? 6 : 0, opacity: pos > 2 ? 0 : 1,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="absolute inset-x-0 top-1 rounded-lg border border-slate-200 bg-white shadow-float overflow-hidden"
              style={{ zIndex: deck.length - pos, transformOrigin: 'top center' }}>
              <div className="h-1" style={{ background: s.bar }} />
              <div className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-ink font-mono">{inv.invoice_no}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${s.cls}`}>{s.label}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">{inv.buyer}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[12px] font-semibold text-ink flex items-center gap-0.5"><IndianRupee size={10} />{fmtInr(inv.amount).slice(1)}</span>
                  <span className="text-[9px] text-slate-400">{inv.days_overdue ? `${inv.days_overdue}d late` : inv.due_date || ''}</span>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
