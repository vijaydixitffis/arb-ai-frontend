import { useEffect, useState } from 'react'
import { ScrollText, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { useAdminStore } from '../../stores/adminStore'
import type { AuditLogEntry } from '../../types/admin'

const TABLE_LABELS: Record<string, string> = {
  system_config: 'System Config',
  users: 'Users',
  domains: 'Domains',
  prompt_templates: 'Prompts',
  kb_documents: 'Knowledge Base',
}

function DiffCell({ label, value }: { label: string; value?: any }) {
  if (value === undefined || value === null) return <span className="text-slate-300">—</span>
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return (
    <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
      label === 'Before' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
    }`}>
      {str.length > 60 ? str.slice(0, 60) + '…' : str}
    </span>
  )
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const tableLabel = TABLE_LABELS[entry.table_name] ?? entry.table_name

  return (
    <>
      <tr
        className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
          {new Date(entry.changed_at).toLocaleString()}
        </td>
        <td className="px-4 py-3">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">{tableLabel}</span>
        </td>
        <td className="px-4 py-3 text-slate-600 text-xs font-mono max-w-[120px] truncate">{entry.field_name ?? '—'}</td>
        <td className="px-4 py-3 text-slate-500 text-xs max-w-[140px] truncate">{entry.changed_by ?? '—'}</td>
        <td className="px-4 py-3 text-slate-400 text-xs max-w-[160px] truncate">{entry.change_reason ?? '—'}</td>
        <td className="px-4 py-3">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          }
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/60 border-b border-slate-100">
          <td colSpan={6} className="px-6 py-3">
            <div className="flex flex-wrap items-start gap-6 text-xs">
              <div>
                <p className="text-slate-400 font-semibold mb-1 uppercase tracking-wider">Record ID</p>
                <span className="font-mono text-slate-500">{entry.record_id}</span>
              </div>
              <div>
                <p className="text-slate-400 font-semibold mb-1 uppercase tracking-wider">Before</p>
                <DiffCell label="Before" value={entry.old_value} />
              </div>
              <div>
                <p className="text-slate-400 font-semibold mb-1 uppercase tracking-wider">After</p>
                <DiffCell label="After" value={entry.new_value} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function AuditLog() {
  const { auditLog, auditLoading, loadAuditLog } = useAdminStore()
  const [tableFilter, setTableFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { loadAuditLog() }, [])

  const tables = Array.from(new Set(auditLog.map(e => e.table_name))).sort()

  const filtered = auditLog.filter(e => {
    const matchTable = !tableFilter || e.table_name === tableFilter
    const matchSearch = !search || [e.changed_by, e.field_name, e.change_reason, e.record_id]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
    return matchTable && matchSearch
  })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        </div>
        <button
          onClick={loadAuditLog}
          disabled={auditLoading}
          className="flex items-center gap-2 px-3 h-9 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <p className="text-slate-500 text-sm mb-6 ml-12">
        All configuration and admin changes, most recent first.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by user, field, reason…"
          className="h-9 px-3 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <select
          value={tableFilter}
          onChange={e => setTableFilter(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All tables</option>
          {tables.map(t => (
            <option key={t} value={t}>{TABLE_LABELS[t] ?? t}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{filtered.length} entries</span>
      </div>

      {auditLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
          Loading audit log…
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Table</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Field</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Changed By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => <AuditRow key={e.id} entry={e} />)}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No audit entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
