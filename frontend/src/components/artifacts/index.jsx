// Artifact templates — agent-built mini-apps rendered as shareable pages.
// Template-bound (never raw HTML): the agent picks a template + fills data;
// the registry renders it. Unknown/missing data degrades gracefully.
import { Truck, PackageCheck, MapPin, Clock, Receipt, BadgeCheck, IndianRupee, Store, Star, TrendingUp, CheckCircle2 } from 'lucide-react'

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN')

/* ── tracking_page ─────────────────────────────────────────── */
function TrackingPage({ data = {} }) {
  const pct = Math.min(100, Math.max(0, data.progress_pct ?? 50))
  const steps = ['Booked', 'Picked up', 'In transit', 'Out for delivery', 'Delivered']
  const stepIdx = { booked: 0, picked_up: 1, in_transit: 2, out_for_delivery: 3, delivered: 4 }[data.status] ?? 2
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">Order</div>
          <div className="text-[18px] font-semibold text-ink">{data.order_id || '—'}</div>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${data.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
          {(data.status || 'in_transit').replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex items-end justify-between text-[13px]">
        <div><div className="flex items-center gap-1.5 text-slate-400 text-[11px]"><MapPin size={11} /> From</div><div className="font-semibold text-ink mt-0.5">{data.from || '—'}</div></div>
        <div className="flex-1 mx-4 mb-1.5 relative h-0.5 bg-slate-200 rounded">
          <div className="absolute inset-y-0 left-0 bg-accent rounded" style={{ width: `${pct}%` }} />
          <Truck size={16} className="absolute -top-2 text-accent" style={{ left: `calc(${pct}% - 8px)` }} />
        </div>
        <div className="text-right"><div className="flex items-center gap-1.5 text-slate-400 text-[11px] justify-end"><MapPin size={11} /> To</div><div className="font-semibold text-ink mt-0.5">{data.to || '—'}</div></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[['Carrier', data.carrier, Truck], ['ETA', data.eta, Clock], ['Progress', `${pct}%`, PackageCheck]].map(([l, v, I]) => (
          <div key={l} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <div className="flex items-center gap-1 text-[10px] text-slate-400"><I size={10} /> {l}</div>
            <div className="text-[13px] font-semibold text-ink mt-1 truncate">{v || '—'}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-col items-center gap-1.5 flex-1">
            <span className={`w-2.5 h-2.5 rounded-full ${i <= stepIdx ? 'bg-accent' : 'bg-slate-200'}`} />
            <span className={`text-[9px] text-center leading-tight ${i <= stepIdx ? 'text-ink font-medium' : 'text-slate-400'}`}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── invoice_summary ───────────────────────────────────────── */
function InvoiceSummary({ data = {} }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">Invoice</div>
          <div className="text-[18px] font-semibold text-ink">{data.invoice_no || '—'}</div>
          <div className="text-[12px] text-slate-500 mt-0.5">{data.buyer || ''}</div>
        </div>
        <Receipt size={22} className="text-slate-300" />
      </div>
      <div className="rounded-2xl bg-ink text-white p-5">
        <div className="text-[11px] text-white/60">Amount due</div>
        <div className="text-[32px] font-semibold tracking-tight mt-1">{fmt(data.amount)}</div>
        {data.gst != null && <div className="text-[11px] text-white/50 mt-1">incl. GST {fmt(data.gst)}</div>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[['Due date', data.due_date], ['Status', (data.status || 'due').replace(/_/g, ' ')]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <div className="text-[10px] text-slate-400">{l}</div>
            <div className={`text-[13px] font-semibold mt-1 ${data.status === 'overdue' && l === 'Status' ? 'text-rose-600' : 'text-ink'}`}>{v || '—'}</div>
          </div>
        ))}
      </div>
      {data.items && <div className="text-[12px] text-slate-500 border-t border-slate-100 pt-3"><span className="text-slate-400">Items: </span>{data.items}</div>}
    </div>
  )
}

/* ── supplier_compare ──────────────────────────────────────── */
function SupplierCompare({ data = {} }) {
  const quotes = data.quotes || []
  const best = quotes.reduce((b, q) => (!b || (q.price ?? Infinity) < (b.price ?? Infinity) ? q : b), null)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">Comparing quotes for</div>
          <div className="text-[18px] font-semibold text-ink">{data.item || 'Suppliers'}</div>
        </div>
        <Store size={22} className="text-slate-300" />
      </div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
        {quotes.map((q, i) => {
          const isBest = best && q === best
          return (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 ${isBest ? 'bg-emerald-50/60' : 'bg-white'}`}>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
                  {q.name}
                  {isBest && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5">BEST</span>}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                  {q.moq != null && <span>MOQ {q.moq}</span>}
                  {q.lead_days != null && <span>{q.lead_days}d lead</span>}
                  {q.trust != null && <span className="flex items-center gap-0.5"><Star size={9} className="text-amber-400" />{q.trust}</span>}
                </div>
              </div>
              <div className="text-[15px] font-semibold text-ink">{q.price != null ? fmt(q.price) : '—'}</div>
            </div>
          )
        })}
        {quotes.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-slate-400">No quotes yet</div>}
      </div>
    </div>
  )
}

/* ── payment_card ──────────────────────────────────────────── */
function PaymentCard({ data = {} }) {
  return (
    <div className="space-y-5 text-center">
      <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent grid place-items-center mx-auto"><IndianRupee size={22} /></div>
      <div>
        <div className="text-[12px] text-slate-500">Payment request from</div>
        <div className="text-[18px] font-semibold text-ink mt-0.5">{data.business || data.buyer || '—'}</div>
      </div>
      <div className="rounded-2xl bg-ink text-white p-5">
        <div className="text-[32px] font-semibold tracking-tight">{fmt(data.amount)}</div>
        {data.invoice_no && <div className="text-[11px] text-white/50 mt-1">{data.invoice_no}{data.due_date ? ` · due ${data.due_date}` : ''}</div>}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white py-3 text-[13px] font-medium text-ink flex items-center justify-center gap-2">
        <BadgeCheck size={14} className="text-emerald-500" /> Pay securely{data.upi ? ` · UPI ${data.upi}` : ''}
      </div>
      <p className="text-[10px] text-slate-400">This link was generated by Sahayak AI on behalf of the seller.</p>
    </div>
  )
}

/* ── financial_report ──────────────────────────────────────── */
// Interactive projection report — the "share to investors / landlord" artifact.
function FinancialReport({ data = {} }) {
  const proj = data.projections || []
  const max = Math.max(1, ...proj.flatMap(p => [p.revenue || 0, p.expenses || 0]))
  const stats = [
    ['Revenue', data.revenue != null ? fmt(data.revenue) : '—'],
    ['Expenses', data.expenses != null ? fmt(data.expenses) : '—'],
    ['Net margin', data.net_margin_pct != null ? `${data.net_margin_pct}%` : '—'],
    ['Cash on hand', data.cash_on_hand != null ? fmt(data.cash_on_hand) : '—'],
  ]
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">Financial report</div>
          <div className="text-[18px] font-semibold text-ink">{data.business || '—'}</div>
          {data.period && <div className="text-[11px] text-slate-500 mt-0.5">{data.period}</div>}
        </div>
        <TrendingUp size={22} className="text-slate-300" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {stats.map(([l, v]) => (
          <div key={l} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <div className="text-[10px] text-slate-400">{l}</div>
            <div className="text-[15px] font-semibold text-ink mt-1">{v}</div>
          </div>
        ))}
      </div>

      {proj.length > 0 && (
        <div>
          <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
            <span>Monthly projection</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent" /> Revenue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-300" /> Expenses</span>
            </span>
          </div>
          <div className="flex items-end gap-2 h-28">
            {proj.map((p, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center gap-0.5 h-24">
                  <div className="w-2.5 rounded-t bg-accent" title={`Revenue ${fmt(p.revenue)}`}
                    style={{ height: `${Math.max(3, (p.revenue || 0) / max * 100)}%` }} />
                  <div className="w-2.5 rounded-t bg-slate-300" title={`Expenses ${fmt(p.expenses)}`}
                    style={{ height: `${Math.max(3, (p.expenses || 0) / max * 100)}%` }} />
                </div>
                <div className="text-[9px] text-slate-400">{p.month}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data.highlights || []).length > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 pt-3">
          {data.highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px] text-slate-600">
              <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" /> {h}
            </div>
          ))}
        </div>
      )}

      {data.ask && (
        <div className="rounded-2xl bg-ink text-white p-4">
          <div className="text-[10px] text-white/50 uppercase tracking-wide mb-1">The ask</div>
          <div className="text-[13px] leading-relaxed">{data.ask}</div>
        </div>
      )}
    </div>
  )
}

export const ARTIFACT_TEMPLATES = {
  tracking_page: TrackingPage,
  invoice_summary: InvoiceSummary,
  supplier_compare: SupplierCompare,
  payment_card: PaymentCard,
  financial_report: FinancialReport,
}
