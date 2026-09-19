import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import { Truck, MapPin, Navigation, Clock, IndianRupee, Star } from 'lucide-react'

/* Logistics specialist cards — rendered for any agent whose tools include
   list_carriers (factory-hired logistics agents get these automatically).
   "Order is coming, keep it on track" → tracking card per booking:
   origin → destination, live progress, ETA, carrier. */
export default function LogisticsCards({ context }) {
  const [carriers, setCarriers] = useState([])
  useEffect(() => { api.carriers().then(setCarriers).catch(() => {}) }, [])

  const bookings = context?.recent_bookings?.length ? context.recent_bookings : [
    { id: 'demo-route', title: 'Consignment → Ludhiana', route: 'Faridabad → Ludhiana',
      carrier: context?.cheapest_route?.name || 'SafeRoad Carriers', km: 310, progress: 0.65,
      eta: '4h 20m', status: 'in_transit' },
  ]

  return (
    <div className="space-y-3">
      {bookings.map(b => <TrackingCard key={b.id} b={b} />)}

      {!!carriers.length && (
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-[10px] font-semibold text-slate-500 mb-2">Backup fleet · {carriers.length} carriers</div>
          {carriers.slice(0, 4).map(c => (
            <div key={c.id || c.name} className="flex items-center justify-between text-[11px] py-1.5 border-b border-slate-50 last:border-0">
              <div>
                <div className="font-medium text-slate-700">{c.name}</div>
                <div className="text-[9px] text-slate-400">{c.route} · {c.next_slot}</div>
              </div>
              <div className="text-right">
                <div className="text-slate-700 flex items-center gap-0.5 justify-end"><IndianRupee size={9} />{c.rate_per_kg}/kg</div>
                <div className="text-[9px] text-amber-500 flex items-center gap-0.5 justify-end"><Star size={8} fill="currentColor" />{c.reliability}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TrackingCard({ b }) {
  const pct = Math.round((b.progress ?? 0.5) * 100)
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
          <Navigation size={10} className="text-accent" /> Live tracking
        </div>
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
          {(b.status || 'in_transit').replace('_', ' ')}
        </span>
      </div>
      <div className="text-[11px] font-medium text-slate-700 mb-3">{b.title || 'Consignment'}</div>

      {/* route viz */}
      <div className="relative h-12 mx-1">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 rounded" />
        <div className="absolute top-1/2 left-0 h-0.5 bg-accent -translate-y-1/2 rounded transition-all" style={{ width: `${pct}%` }} />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center">
          <MapPin size={14} className="text-slate-400" />
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all" style={{ left: `${pct}%` }}>
          <span className="w-6 h-6 rounded-full bg-accent text-white grid place-items-center shadow-float"><Truck size={11} /></span>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2"><MapPin size={14} className="text-magenta" /></div>
      </div>
      <div className="flex justify-between text-[9px] text-slate-400 -mt-0.5">
        <span>{(b.route || 'Faridabad → ?').split('→')[0].trim()}</span>
        <span>{(b.route || 'Faridabad → Ludhiana').split('→')[1]?.trim() || 'Ludhiana'}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[['Distance', `${b.km || 310} km`], ['ETA', b.eta || '~4h'], ['Carrier', b.carrier || '—']].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-slate-50 py-1.5">
            <div className="text-[8px] text-slate-400 uppercase tracking-wide">{l}</div>
            <div className="text-[10px] font-semibold text-slate-700 mt-0.5 truncate px-1">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[9px] text-slate-400 flex items-center gap-1"><Clock size={8} /> pinged by delivery API · order ref {b.id}</div>
    </div>
  )
}
