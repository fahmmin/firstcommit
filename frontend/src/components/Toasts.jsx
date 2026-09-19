import { useToasts } from '../lib/toast.js'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'

const ICONS = { ok: CheckCircle2, warn: AlertTriangle, info: Info }
const TINT = { ok: 'text-emerald-400', warn: 'text-amber-400', info: 'text-accent-2' }

export function Toasts() {
  const items = useToasts()
  return (
    <div className="fixed bottom-5 right-5 z-[90] space-y-2 pointer-events-none">
      <AnimatePresence>
        {items.map(t => {
          const I = ICONS[t.kind] || Info
          return (
            <motion.div key={t.id}
              initial={{ opacity: 0, y: 12, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pointer-events-auto flex items-center gap-2 rounded-xl bg-ink text-white text-[12px] font-medium px-4 py-2.5 shadow-float-lg">
              <I size={13} className={TINT[t.kind] || TINT.info} />
              {t.text}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
