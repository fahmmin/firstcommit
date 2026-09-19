// ReverseUI "stock-chart" recreation — SVG line that draws itself in with a
// stroke-dash animation, gradient area fill, end-point pulse dot.
import { useMemo } from 'react'

export function StockChart({ data = [], height = 90, color = '#1aaf50', label, value, className = '' }) {
  const W = 300, H = 100
  const { line, area, lastX, lastY } = useMemo(() => {
    if (!data.length) return { line: '', area: '', lastX: 0, lastY: 0 }
    const min = Math.min(...data), max = Math.max(...data), span = (max - min) || 1
    const pts = data.map((v, i) => [
      (i / (data.length - 1)) * W,
      H - 8 - ((v - min) / span) * (H - 20),
    ])
    const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
    return { line: d, area: `${d} L ${W} ${H} L 0 ${H} Z`, lastX: pts.at(-1)[0], lastY: pts.at(-1)[1] }
  }, [data])

  return (
    <div className={`rounded-xl border border-slate-200 p-3 ${className}`}>
      {(label || value) && (
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[10px] font-semibold text-slate-500">{label}</span>
          <span className="text-[13px] font-semibold text-ink tabular-nums">{value}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="scFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#scFill)" className="animate-[fadein_1s_ease_0.5s_both]" />
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
          pathLength="1" strokeDasharray="1" strokeDashoffset="1"
          className="animate-[drawline_1.4s_ease-out_forwards]" />
        <circle cx={lastX} cy={lastY} r="3" fill={color}>
          <animate attributeName="r" values="3;4.5;3" dur="1.8s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  )
}
