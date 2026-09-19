// ReverseUI "cloud-wave-orb" recreation — a layered-noise orb that ripples
// like cloud cover catching light. SVG feTurbulence does the WebGL-ish work;
// `active` makes it breathe faster and pushes energy into the ripple rings.
import { useEffect, useId, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { SpeedyCircles } from './Circles.jsx'

export function CloudWaveOrb({ size = 132, active = false }) {
  const id = useId().replace(/:/g, '')
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* ripple rings while listening */}
      {active && [0, 1, 2].map(i => (
        <span key={i} className="absolute inset-0 rounded-full border border-accent-2/40 animate-orbRing"
          style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
      <svg width={size} height={size} viewBox="0 0 200 200"
        className={active ? 'animate-orbPulse' : ''} style={{ transition: 'transform .4s' }}>
        <defs>
          <radialGradient id={`g${id}`} cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#cfeaff" />
            <stop offset="45%" stopColor="#5aa8f0" />
            <stop offset="100%" stopColor="#0b3a75" />
          </radialGradient>
          <filter id={`cloud${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="3" seed="7" result="n">
              <animate attributeName="baseFrequency"
                values={active ? '0.014 0.028;0.02 0.034;0.014 0.028' : '0.012 0.02;0.014 0.024;0.012 0.02'}
                dur={active ? '2.2s' : '7s'} repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale={active ? 34 : 22} />
          </filter>
          <filter id={`soft${id}`}><feGaussianBlur stdDeviation="2.5" /></filter>
        </defs>
        <circle cx="100" cy="100" r="82" fill={`url(#g${id})`} filter={`url(#cloud${id})`} />
        {/* highlight blob — the "light catching" layer */}
        <ellipse cx="76" cy="66" rx="40" ry="26" fill="#ffffff" opacity="0.5"
          filter={`url(#soft${id})`}>
          <animate attributeName="cx" values="76;88;76" dur={active ? '3s' : '9s'} repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="130" cy="132" rx="34" ry="20" fill="#0a2c5e" opacity="0.35" filter={`url(#soft${id})`}>
          <animate attributeName="cx" values="130;118;130" dur={active ? '3.4s' : '10s'} repeatCount="indefinite" />
        </ellipse>
      </svg>
    </div>
  )
}

// Voice mode overlay — real Web Speech API when the browser has it,
// graceful simulated listening otherwise. Result lands in the composer.
export function VoiceOverlay({ onClose, onTranscript }) {
  const [listening, setListening] = useState(true)
  const [heard, setHeard] = useState('')
  const [supported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  const recRef = useRef(null)

  useEffect(() => {
    if (!supported) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'en-IN'
    rec.interimResults = true
    rec.onresult = (e) => {
      const t = [...e.results].map(r => r[0].transcript).join('')
      setHeard(t)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    try { rec.start() } catch { setListening(false) }
    return () => { try { rec.stop() } catch {} }
  }, [supported])

  const stop = () => { try { recRef.current?.stop() } catch {}; setListening(false) }
  const use = () => { if (heard.trim()) onTranscript(heard.trim()); onClose() }

  return (
    <div className="mb-3 rounded-2xl border border-slate-200 bg-ink text-white shadow-float-lg px-5 py-5 flex items-center gap-5">
      <SpeedyCircles size={120} active={listening}>
        <CloudWaveOrb size={92} active={listening} />
      </SpeedyCircles>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold flex items-center gap-2">
          {listening ? <Mic size={13} className="text-accent-2 animate-pulse" /> : <MicOff size={13} className="text-white/50" />}
          {listening ? 'Listening… speak now' : 'Paused'}
        </div>
        <div className="text-[12px] text-white/60 mt-1 min-h-[18px] truncate">
          {heard || (supported ? 'Try: “show my overdue invoices”' : 'Voice capture needs Chrome — transcript will appear here')}
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={use} disabled={!heard.trim()}
            className="text-[11px] font-medium rounded-lg bg-white text-ink px-3 py-1.5 hover:bg-white/90 transition disabled:opacity-40">
            Use transcript
          </button>
          <button onClick={() => { setHeard(''); setListening(true); try { recRef.current?.start() } catch {} }}
            className="text-[11px] font-medium rounded-lg border border-white/25 px-3 py-1.5 hover:bg-white/10 transition">
            Retry
          </button>
          <button onClick={onClose}
            className="text-[11px] font-medium rounded-lg border border-white/25 px-3 py-1.5 hover:bg-white/10 transition ml-auto">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
