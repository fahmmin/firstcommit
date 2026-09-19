// Business context store — the "dump your data" surface.
// Every dropped file / pasted note is auto-organized: keyword tagger assigns
// domain tags + metadata on ingest, items feed agent memory AND search.
// Persists to localStorage; notes also POST to /memories (real seam).
// Backend spec for real auto-tagging lives in AYUSH.md § Round 3.

const KEY = 'sahayak_context_items'

// keyword → tag rules — same rules Ayush implements server-side
const TAG_RULES = [
  [/tax|gst|gstr|itr|tds|compliance|filing/i, 'tax'],
  [/invoice|bill|receivable|ledger|outstanding/i, 'invoices'],
  [/supplier|vendor|catalog|price|quote|moq|purchase|procure/i, 'procurement'],
  [/transport|logistic|carrier|deliver|shipment|freight|pickup|lr/i, 'logistics'],
  [/cash|bank|statement|payment|upi|reconcile|account/i, 'finance'],
  [/employee|staff|salary|payroll|attendance/i, 'hr'],
  [/customer|buyer|client|order|sale/i, 'sales'],
  [/contract|agreement|legal|license|registration|udyam/i, 'legal'],
]
const KIND = { pdf: 'PDF', xlsx: 'Spreadsheet', xls: 'Spreadsheet', csv: 'Spreadsheet', png: 'Image', jpg: 'Image', jpeg: 'Image', mp4: 'Video', mov: 'Video', txt: 'Note', docx: 'Doc', doc: 'Doc' }

export function autoTag(text, filename = '') {
  const hay = `${filename} ${text}`
  const tags = TAG_RULES.filter(([re]) => re.test(hay)).map(([, t]) => t)
  return tags.length ? [...new Set(tags)] : ['general']
}

const SEED = [
  { id: 'ctx-1', name: 'GSTR-3B_FY25.xlsx', kind: 'Spreadsheet', tags: ['tax', 'finance'], meta: '18 rows · GSTIN linked', source: 'upload', created_at: '2026-09-18T11:00:00Z' },
  { id: 'ctx-2', name: 'tax-records-ay2526.pdf', kind: 'PDF', tags: ['tax', 'legal'], meta: '12 pages · ITR + advance tax', source: 'upload', created_at: '2026-09-18T11:02:00Z' },
  { id: 'ctx-3', name: 'supplier-rates-sept.csv', kind: 'Spreadsheet', tags: ['procurement'], meta: '34 suppliers · price list', source: 'upload', created_at: '2026-09-18T11:05:00Z' },
  { id: 'ctx-4', name: 'transport-contract-vrl.pdf', kind: 'PDF', tags: ['logistics', 'legal'], meta: 'Ludhiana route · expires Mar', source: 'upload', created_at: '2026-09-19T08:00:00Z' },
]

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null }
}
const save = (items) => localStorage.setItem(KEY, JSON.stringify(items))

export const contextStore = {
  list() {
    let items = load()
    if (!items) { items = SEED; save(items) }
    return items
  },
  addFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const item = {
      id: `ctx-${Date.now().toString(36)}`,
      name: file.name,
      kind: KIND[ext] || 'File',
      tags: autoTag('', file.name),
      meta: `${(file.size / 1024).toFixed(0)} KB · auto-indexed`,
      source: 'upload',
      created_at: new Date().toISOString(),
    }
    const items = [item, ...contextStore.list()]
    save(items)
    return item
  },
  addNote(text) {
    const item = {
      id: `ctx-${Date.now().toString(36)}`,
      name: text.length > 60 ? text.slice(0, 60) + '…' : text,
      kind: 'Note', tags: autoTag(text), meta: `${text.length} chars`,
      source: 'owner', created_at: new Date().toISOString(),
    }
    save([item, ...contextStore.list()])
    return item
  },
  del(id) { save(contextStore.list().filter(i => i.id !== id)) },
}
