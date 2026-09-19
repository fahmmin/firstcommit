import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, ResponsiveContainer, Cell, XAxis } from 'recharts'
import { api } from '../../api.js'
import { TrackInvoices } from '../rui/TrackInvoices.jsx'
import { IndianRupee, AlertTriangle, TrendingUp } from 'lucide-react'

const fmtInr = n => '₹' + Number(n || 0).toLocaleString('en-IN')
const bucket = d => d <= 30 ? '0–30d' : d <= 60 ? '31–60d' : d <= 90 ? '61–90d' : '90d+'

/* Invoice/receivables specialist cards — rendered for any agent whose
   tools include list_overdue (vasool + future factory-hired collectors). */
export default function VasoolCards({ context }) {
  const [invoices, setInvoices] = useState([])
  useEffect(() => { api.invoices().then(setInvoices).catch(() => {}) }, [])

  const aging = useMemo(() => {
    const b = { '0–30d': 0, '31–60d': 0, '61–90d': 0, '90d+': 0 }
    invoices.filter(i => i.status === 'overdue').forEach(i => { b[bucket(i.days_overdue || 0)] += i.amount })
    return Object.entries(b).map(([k, v]) => ({ bucket: k, amount: v }))
  }, [invoices])

  const s = context?.invoice_summary
  return (
    <div className="space-y-3">
      <TrackInvoices invoices={invoices.filter(i => i.status !== 'paid')} />
      {s && (
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Outstanding" value={fmtInr(s.total_outstanding)} icon={IndianRupee} />
          <Tile label="Overdue" value={fmtInr(s.overdue_total)} icon={AlertTriangle} warn />
          <Tile label="Oldest overdue" value={`${s.oldest_overdue_days}d`} icon={TrendingUp} warn />
          <Tile label="Locked in 60d+ terms" value={fmtInr(context.capital_locked_90d)} icon={IndianRupee} warn />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="text-[10px] font-semibold text-slate-500 mb-2">Receivables aging</div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aging} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {aging.map((a, i) => (
                  <Cell key={i} fill={['#86cefc', '#3494f4', '#d4428f', '#a325fc'][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!!context?.top_defaulters?.length && (
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-[10px] font-semibold text-slate-500 mb-2">Top defaulters</div>
          {context.top_defaulters.map(d => (
            <div key={d.buyer} className="flex justify-between items-center text-[11px] py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-slate-600 font-medium">{d.buyer}</span>
              <span className="text-slate-700">{fmtInr(d.amount)} <span className="text-magenta text-[10px]">{d.days}d</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, icon: I, warn }) {
  return (
    <div className="rounded-xl border border-slate-200 p-2.5">
      <div className="flex items-center gap-1 text-[9px] text-slate-400"><I size={9} className={warn ? 'text-magenta' : ''} />{label}</div>
      <div className={`text-[13px] font-semibold mt-0.5 ${warn ? 'text-magenta' : 'text-ink'}`}>{value}</div>
    </div>
  )
}
