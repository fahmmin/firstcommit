// ReverseUI "logo-carousel" recreation — a fixed set of logo slots that
// cycles through the roster with a blur/fade swap every few seconds.
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SiGoogle, SiAnthropic, SiRazorpay, SiMeta, SiStripe } from 'react-icons/si'

const LOGOS = [
  { name: 'Google', I: SiGoogle },
  { name: 'Anthropic', I: SiAnthropic },
  { name: 'AWS', word: 'aws' },
  { name: 'Razorpay', I: SiRazorpay },
  { name: 'Meta', I: SiMeta },
  { name: 'Stripe', I: SiStripe },
]
const SLOTS = 3

export function LogoCarousel({ dark = false }) {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setOffset(o => o + 1), 2600)
    return () => clearInterval(t)
  }, [])
  const shown = Array.from({ length: SLOTS }, (_, i) => LOGOS[(offset + i) % LOGOS.length])

  return (
    <div className={`rounded-2xl px-10 py-9 flex items-center justify-center gap-16 overflow-hidden
      ${dark ? 'bg-ink' : 'bg-[#fbfbfd] border border-slate-200'}`}>
      <AnimatePresence mode="popLayout">
        {shown.map((l, i) => (
          <motion.div key={`${offset}-${i}`}
            initial={{ opacity: 0, filter: 'blur(6px)', y: 6 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            exit={{ opacity: 0, filter: 'blur(6px)', y: -6 }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            className={`flex items-center gap-2.5 ${dark ? 'text-white/90' : 'text-ink'}`}>
            {l.I ? <l.I size={20} /> : <span className="font-bold text-[19px] tracking-tight lowercase">{l.word}</span>}
            <span className="text-[17px] font-semibold tracking-tight">{l.name}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
