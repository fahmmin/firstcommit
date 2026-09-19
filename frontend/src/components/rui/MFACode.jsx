// ReverseUI "multifactor-authentication" recreation — 6 digit boxes grouped
// 3+3, digits pop in with a spring, hidden input handles typing + paste.
import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function MFACode({ value, onChange, onComplete, length = 6, autoFocus = true }) {
  const ref = useRef(null)
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  const set = (v) => {
    const next = v.replace(/\D/g, '').slice(0, length)
    onChange(next)
    if (next.length === length) onComplete?.(next)
  }

  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input ref={ref} value={value} onChange={e => set(e.target.value)} autoFocus={autoFocus}
        inputMode="numeric" autoComplete="one-time-code"
        className="absolute inset-0 opacity-0 cursor-default" aria-label="Verification code" />
      <div className="flex items-center justify-center gap-2">
        {digits.map((d, i) => (
          <div key={i} className={`flex items-center ${i === 3 ? 'ml-2' : ''}`}>
            {i === 3 && <span className="w-3 h-px bg-slate-300 mr-2" />}
            <div className={`w-11 h-[52px] rounded-xl border grid place-items-center text-[20px] font-semibold transition-colors
              ${d ? 'border-ink bg-white text-ink' : i === value.length ? 'border-accent bg-white text-ink shadow-float' : 'border-slate-200 bg-slate-50 text-slate-300'}`}>
              <AnimatePresence mode="popLayout">
                {d && (
                  <motion.span key={d + i}
                    initial={{ scale: 0.4, opacity: 0, y: 6 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 26 }}>
                    {d}
                  </motion.span>
                )}
              </AnimatePresence>
              {i === value.length && !d && <span className="w-px h-5 bg-accent animate-pulse" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
