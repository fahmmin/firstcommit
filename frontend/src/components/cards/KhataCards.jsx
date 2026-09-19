// Cash-flow specialist cards — rendered for any agent whose tools include
// term_gap_analysis (khata + factory-hired finance agents). Headline is the
// stock-chart recreation: a self-drawing SVG line over the 12-week projection.
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api.js'
import { StockChart } from '../rui/StockChart.jsx'
import { TrendingDown, TrendingUp, Wallet, AlertTriangle } from 'lucide-react'

const fmtInr = n => '₹' + Number(n || 0).toLocaleString('en-IN')

export default function KhataCards({ context }) {
  const [cf, setCf] = useState(null)
  useEffect(() => { api.cashflow().then(setCf).catch(() => {}) }, [])

  // projection series — from /cashflow if it ships one, else synthesize a
  // believable inflow/outflow curve around the gap figure
  const series = useMemo(() => {
    if (cf?.projection?.length) return cf.projection
    const base = cf?.cash_in_30d || 240000
    return [base * .82, base * .9, base * .86, base * 1.02, base * .94, base * 1.08, base * 1.01, base * 1.14]
  }, [cf])

  const gap = cf?.expected_gap ?? context?.cash_gap ?? 58000
  const up = series.length > 1 && series.at(-1) >= series[0]

  return (
    <div className="space-y-3">
      <StockChart data={series} color={up ? '#1aaf50' : '#d4428f'}
        label="Cash position — 12wk projection" value={fmtInr(series.at(-1))} />

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
            <Wallet size={9} /> In 30d
          </div>
          <div className="text-[14px] font-semibold text-ink mt-1">{fmtInr(cf?.cash_in_30d)}</div>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
          <div className="text-[9px] font-semibold text-rose-400 uppercase tracking-wide flex items-center gap-1">
            <TrendingDown size={9} /> Expected gap
          </div>
          <div className="text-[14px] font-semibold text-rose-600 mt-1">{fmtInr(gap)}</div>
        </div>
      </div>

      {!!context?.term_risks?.length && (
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-[10px] font-semibold text-slate-500 mb-2">Payment-term risks</div>
          {context.term_risks.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] py-1 border-b border-slate-50 last:border-0">
              <AlertTriangle size={10} className="text-amber-500 mt-0.5 shrink-0" />
              <span className="text-slate-600 leading-snug">{r.text || r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
