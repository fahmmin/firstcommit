// MCP in Settings — both directions, all real:
//  • McpServers: the owner's external MCP servers. Status comes from a real
//    handshake (POST /integrations/mcp/{id}/test → tools/list); tokens are
//    write-only (the API returns ••••). Tools marked read-only run freely;
//    everything else waits in Approvals unless the server is trusted.
//  • ConnectAiTools: mint a scoped token so Claude / Cursor / any MCP client can
//    use Sahayak's own tools at <backend>/mcp.
import { useState } from 'react'
import { api, API_ORIGIN } from '../api.js'
import { toast } from '../lib/toast.js'
import { Can } from './rui/Can.jsx'
import { Server, Trash2, Plus, Loader2, PlugZap, ChevronDown, ShieldCheck, Copy, KeyRound } from 'lucide-react'

const STATUS = {
  connected: 'text-emerald-700 bg-emerald-50', error: 'text-rose-600 bg-rose-50',
  untested: 'text-slate-500 bg-slate-100',
}
const ago = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export function McpServers({ servers, agents = [], onSaved }) {
  const [form, setForm] = useState({ name: '', url: '', auth_token: '' })
  const [busy, setBusy] = useState('')
  const [open, setOpen] = useState(null)

  const save = async (next) => {
    try {
      await api.updateSettings({ mcp_servers: next })
      onSaved?.()
      return true
    } catch (e) { if (e.status !== 403) toast.push(e.message, 'err'); return false }
  }
  const add = async () => {
    if (!form.url.trim()) return toast.push('Enter the server URL', 'err')
    const row = { name: form.name.trim() || undefined, url: form.url.trim(), auth_token: form.auth_token.trim() || undefined }
    if (await save([...servers, row])) { setForm({ name: '', url: '', auth_token: '' }); toast.push('Saved — run Test to handshake') }
  }
  const patchRow = (id, fields) => save(servers.map(s => s.id === id ? { ...s, ...fields } : s))
  const test = async (s) => {
    setBusy(s.id)
    try {
      const r = await api.testMcp(s.id)
      toast.push(r.status === 'connected' ? `${s.name}: connected — ${r.tools.length} tools` : `${s.name}: ${r.error}`, r.status === 'connected' ? 'ok' : 'err')
      onSaved?.()
    } catch (e) { if (e.status !== 403) toast.push(e.message, 'err') }
    setBusy('')
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[12px] text-slate-500 leading-relaxed">
        Give your agents tools from any remote MCP server (streamable HTTP or SSE). Read-only tools run freely;
        anything that changes data waits in Approvals unless you mark the server trusted.
      </p>
      {servers.map(s => (
        <div key={s.id} className="rounded-xl border border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <Server size={13} className="text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-ink flex items-center gap-1.5">
                {s.name}
                {s.trusted && <span title="Trusted: write tools run without approval" className="text-[9px] text-violet-600 bg-violet-50 rounded px-1">trusted</span>}
                {s.has_token && <KeyRound size={10} className="text-slate-400" title="auth token stored" />}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{s.url} · {s.transport}</div>
            </div>
            <span className={`text-[9px] font-medium rounded px-1.5 py-0.5 ${STATUS[s.status] || STATUS.untested}`}
              title={s.error || (s.last_checked ? `checked ${ago(s.last_checked)}` : 'never tested')}>
              {s.status || 'untested'}{s.status === 'connected' ? ` · ${s.tools?.length || 0} tools` : ''}
            </span>
            <Can perm="mcp" reason="Only the owner manages MCP">
              <button onClick={() => test(s)} disabled={busy === s.id}
                className="text-[10px] font-medium rounded-lg border border-slate-200 bg-white px-2 py-1 flex items-center gap-1 hover:border-slate-300 disabled:opacity-50">
                {busy === s.id ? <Loader2 size={10} className="animate-spin" /> : <PlugZap size={10} />} Test
              </button>
            </Can>
            <button onClick={() => setOpen(open === s.id ? null : s.id)} className="text-slate-400 hover:text-ink">
              <ChevronDown size={13} className={`transition ${open === s.id ? 'rotate-180' : ''}`} />
            </button>
            <Can perm="mcp" reason="Only the owner manages MCP">
              <button onClick={() => save(servers.filter(x => x.id !== s.id))} className="text-slate-300 hover:text-rose-500 transition"><Trash2 size={13} /></button>
            </Can>
          </div>
          {open === s.id && (
            <div className="border-t border-slate-100 px-3.5 py-3 space-y-2.5 text-[11px]">
              {s.error && <div className="text-rose-600">Last error: {s.error}</div>}
              <Can perm="mcp" reason="Only the owner manages MCP">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={s.enabled !== false}
                    onChange={e => patchRow(s.id, { enabled: e.target.checked })} /> Enabled</label>
                  <label className="flex items-center gap-1.5" title="Write tools run without an approval step">
                    <input type="checkbox" checked={!!s.trusted} onChange={e => patchRow(s.id, { trusted: e.target.checked })} />
                    Trusted (skip approvals)</label>
                  <label className="flex items-center gap-1.5">Available to
                    <select value={s.agents === 'all' || !s.agents ? 'all' : s.agents[0]}
                      onChange={e => patchRow(s.id, { agents: e.target.value === 'all' ? 'all' : [e.target.value] })}
                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5">
                      <option value="all">every agent</option>
                      <option value="sahayak">front desk only</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </label>
                </div>
              </Can>
              {s.tools?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {s.tools.map(t => (
                    <span key={t.name} title={t.description}
                      className={`font-mono text-[9px] rounded-full px-2 py-0.5 border ${t.read_only ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-amber-200 text-amber-700 bg-amber-50'}`}>
                      {t.name}{t.read_only ? '' : ' · needs approval'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <Can perm="mcp" reason="Adding MCP servers needs Owner">
        <div className="flex gap-2 flex-wrap">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name (optional)"
            className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-[12px] focus:outline-none focus:border-ink" />
          <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…/mcp or …/sse"
            className="flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-mono focus:outline-none focus:border-ink" />
          <input value={form.auth_token} onChange={e => setForm(f => ({ ...f, auth_token: e.target.value }))} placeholder="Bearer token (optional)" type="password"
            className="w-44 rounded-lg border border-slate-200 px-3 py-2 text-[12px] focus:outline-none focus:border-ink" />
          <button onClick={add} className="rounded-lg bg-ink text-white px-4 text-[12px] font-medium flex items-center gap-1 hover:bg-ink/85 transition">
            <Plus size={12} /> Add
          </button>
        </div>
      </Can>
    </div>
  )
}

export function ConnectAiTools() {
  const [tok, setTok] = useState(null)
  const url = `${API_ORIGIN.replace(/\/$/, '')}/mcp`
  const mint = async () => {
    try { setTok(await api.mcpToken()) } catch (e) { if (e.status !== 403) toast.push(e.message, 'err') }
  }
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.push('Copied') }
  const cli = tok && `claude mcp add --transport http sahayak ${url} --header "Authorization: Bearer ${tok.token}"`
  const json = tok && JSON.stringify({ mcpServers: { sahayak: { url, headers: { Authorization: `Bearer ${tok.token}` } } } }, null, 2)
  return (
    <div className="space-y-2.5">
      <p className="text-[12px] text-slate-500 leading-relaxed">
        Use your Sahayak data from Claude, Cursor or any MCP client. Reads are live; writes (new invoice, reminder
        draft) land in your Approvals queue — an outside tool can never act on its own.
      </p>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-mono rounded bg-slate-100 px-2 py-1 text-slate-600 truncate">{url}</span>
        <Can perm="mcp" reason="Only the owner creates MCP access tokens">
          <button onClick={mint} className="rounded-lg bg-ink text-white px-3 py-1.5 font-medium flex items-center gap-1"><ShieldCheck size={11} /> {tok ? 'New token' : 'Create access token'}</button>
        </Can>
      </div>
      {tok && (
        <div className="space-y-2">
          <div className="text-[10px] text-slate-400">Token valid {tok.expires_in_days} days · shown once · tools: {tok.tools.join(', ')}</div>
          {[['Claude Code', cli], ['Clients that take a URL + headers (JSON)', json]].map(([label, text]) => (
            <div key={label}>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">{label}
                <button onClick={() => copy(text)} className="flex items-center gap-1 hover:text-ink"><Copy size={10} /> copy</button></div>
              <pre className="text-[10px] font-mono bg-slate-900 text-slate-100 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">{text}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
