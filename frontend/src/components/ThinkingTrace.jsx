// Source chips rendered under a finished reply — built ONLY from what the
// backend reports for that turn: `actions[]` (record_action events) and
// `usage.tools` (tools the agent actually invoked, tracing.run_metrics).
// No chip is added unless something real produced it.

const ACTION_LABEL = {
  invoices_listed: 'invoices', invoice_created: 'ledger', reminder_drafted: 'drafted reminder',
  agent_created: 'agent factory', alert_scheduled: 'scheduler', carriers_listed: 'carriers',
  suppliers_listed: 'suppliers', cashflow_report: 'cashflow', task_completed: 'tasks',
  connector_synced: 'connector sync', artifact_created: 'artifact builder', memory_added: 'memory',
  action_queued: 'awaiting approval', catalog_synced: 'catalog', listings_published: 'listings',
  seo_audit: 'seo audit', context_added: 'business context', excel_imported: 'excel import',
}
// tool name (usage.tools) → chip, for tools that don't emit an action
const TOOL_LABEL = {
  recall_context: 'business memory', search_documents: 'documents', list_overdue: 'invoices',
  aging_report: 'aging report', search_catalog: 'suppliers', compare_prices: 'suppliers',
  list_carriers: 'carriers', quote_pickup: 'carriers', term_gap_analysis: 'cashflow',
  cashflow_summary: 'cashflow',
}

export function SourceChips({ actions, usage }) {
  const chips = new Set()
  ;(actions || []).forEach(a => {
    if (a.type === 'web_searched') {
      if (a.data?.configured === false) chips.add('web search · not configured')
      else chips.add(`web · ${a.data?.n_results ?? 0} results`)
    } else if (ACTION_LABEL[a.type]) chips.add(ACTION_LABEL[a.type])
  })
  ;(usage?.tools || []).forEach(t => {
    if (TOOL_LABEL[t]) chips.add(TOOL_LABEL[t])
    else if (t.startsWith('mcp_')) chips.add(`mcp · ${t.slice(4).replace(/_/g, ' ')}`)
  })
  if (!chips.size) return null
  return (
    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
      <span className="text-[9px] text-slate-400 uppercase tracking-wide">Sources</span>
      {[...chips].map(c => (
        <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{c}</span>
      ))}
    </div>
  )
}
