// ReverseUI "fractional-slider" recreation — a ruler with dithered tick marks;
// drag or scroll to change the value, ticks left of the marker fill with
// accent (the clip-path "selected band"), edges rubber-band via clamped drag.
import { useCallback, useRef } from 'react'

export function FractionalSlider({ value, min = 0, max = 100, step = 1, major = 5, onChange, label, unit = '', className = '' }) {
  const trackRef = useRef(null)
  const ticks = []
  for (let v = min; v <= max; v += step) ticks.push(v)

  const fromX = useCallback((clientX) => {
    const r = trackRef.current.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const raw = min + ratio * (max - min)
    return Math.round(raw / step) * step
  }, [min, max, step])

  const drag = (e) => {
    e.preventDefault()
    onChange(fromX(e.clientX))
    const move = (ev) => onChange(fromX(ev.clientX))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className={className}>
      {label && (
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] font-medium text-slate-500">{label}</span>
          <span className="text-[13px] font-semibold text-ink tabular-nums">{value}{unit}</span>
        </div>
      )}
      <div ref={trackRef} onPointerDown={drag}
        onWheel={e => { e.preventDefault(); onChange(Math.min(max, Math.max(min, value + (e.deltaY > 0 ? -step : step)))) }}
        className="relative h-9 select-none cursor-ew-resize touch-none group">
        {/* unselected ticks */}
        <div className="absolute inset-x-0 top-0 bottom-0 flex items-end justify-between">
          {ticks.map(v => (
            <span key={v} className={`w-px bg-slate-300 ${v % major === 0 ? 'h-5' : 'h-2.5'}`} />
          ))}
        </div>
        {/* selected band — accent ticks clipped to value */}
        <div className="absolute inset-x-0 top-0 bottom-0 flex items-end justify-between"
          style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
          {ticks.map(v => (
            <span key={v} className={`w-px bg-accent ${v % major === 0 ? 'h-5' : 'h-2.5'}`} />
          ))}
        </div>
        {/* labels on majors */}
        <div className="absolute inset-x-0 top-6 flex justify-between pointer-events-none">
          {ticks.filter(v => v % major === 0).map(v => (
            <span key={v} className={`text-[8px] tabular-nums -translate-x-1/2 ${v <= value ? 'text-accent font-semibold' : 'text-slate-400'}`}
              style={{ position: 'relative', left: 0 }}>
              {v}
            </span>
          ))}
        </div>
        {/* marker */}
        <span className="absolute top-[-2px] w-2.5 h-2.5 rounded-full bg-accent border-2 border-white shadow transition-transform group-active:scale-125"
          style={{ left: `calc(${pct}% - 5px)` }} />
      </div>
      <div className="text-[9px] text-slate-400 mt-0.5">scroll or drag</div>
    </div>
  )
}
