import { useEffect, useRef, useState } from 'react'
import { BookOpen, RefreshCw, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Upload, FileUp, ClipboardType } from 'lucide-react'
import { adminService } from '../../services/backendConfig'
import type { AdminDomain, KnowledgeBaseEntry } from '../../types/admin'

// ── Ingest Modal ──────────────────────────────────────────────────────────────

interface IngestModalProps {
  domains: AdminDomain[]
  onClose: () => void
  onSaved: () => void
}

function IngestModal({ domains, onClose, onSaved }: IngestModalProps) {
  const [tab, setTab] = useState<'file' | 'paste'>('file')
  const [title, setTitle] = useState('')
  const [domainSlug, setDomainSlug] = useState('')
  const [markers, setMarkers] = useState('')
  const [content, setContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
    const reader = new FileReader()
    reader.onload = ev => setContent(ev.target?.result as string ?? '')
    reader.readAsText(file)
  }

  const handleSubmit = async () => {
    if (!title.trim()) { setErr('Title is required.'); return }
    if (!content.trim()) { setErr('Content is required.'); return }
    setSaving(true)
    setErr('')
    try {
      await adminService.createKbEntry({
        title: title.trim(),
        content: content.trim(),
        category: domainSlug || undefined,
        principle_id: markers.trim() || undefined,
      })
      onSaved()
      onClose()
    } catch (e: any) {
      setErr(e.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-50 border border-teal-100 rounded-lg flex items-center justify-center">
              <Upload className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Ingest Knowledge Base Content</h2>
              <p className="text-xs text-slate-400">Upload a file or paste text to add a new KB entry</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title <span className="text-red-500">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Zero Trust Network Access Policy"
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>

          {/* Domain + Markers row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Domain</label>
              <select value={domainSlug} onChange={e => setDomainSlug(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">— No domain —</option>
                {domains.filter(d => d.is_active).map(d => (
                  <option key={d.id} value={d.slug}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Markers / Principle IDs</label>
              <input value={markers} onChange={e => setMarkers(e.target.value)}
                placeholder="e.g. SEC-01, AUTH-02, zero-trust"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <p className="text-xs text-slate-400 mt-1">Comma-separated tags for retrieval</p>
            </div>
          </div>

          {/* Content source tabs */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Content <span className="text-red-500">*</span></label>
            <div className="flex gap-1 mb-3 bg-slate-100 rounded-lg p-1 w-fit">
              <button
                onClick={() => setTab('file')}
                className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium transition-colors ${tab === 'file' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <FileUp className="w-3.5 h-3.5" /> Upload File
              </button>
              <button
                onClick={() => setTab('paste')}
                className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium transition-colors ${tab === 'paste' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <ClipboardType className="w-3.5 h-3.5" /> Paste Text
              </button>
            </div>

            {tab === 'file' ? (
              <div>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-xl p-6 text-center cursor-pointer transition-colors group">
                  <FileUp className="w-7 h-7 mx-auto mb-2 text-slate-300 group-hover:text-teal-500 transition-colors" />
                  {fileName
                    ? <p className="text-sm font-medium text-teal-700">{fileName}</p>
                    : <p className="text-sm text-slate-400">Click to choose a <span className="font-medium">.txt</span> or <span className="font-medium">.md</span> file</p>
                  }
                  {content && <p className="text-xs text-slate-400 mt-1">{content.length.toLocaleString()} characters loaded</p>}
                </div>
                <input ref={fileRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFile} />
                {content && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Preview content</summary>
                    <pre className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 overflow-auto max-h-40 whitespace-pre-wrap">{content.slice(0, 800)}{content.length > 800 ? '…' : ''}</pre>
                  </details>
                )}
              </div>
            ) : (
              <textarea
                value={content} onChange={e => setContent(e.target.value)}
                rows={10} spellCheck={false}
                placeholder="Paste your knowledge base content here (Markdown supported)…"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y" />
            )}
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 h-10 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 h-10 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />
            {saving ? 'Ingesting…' : 'Ingest Content'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Entry Drawer ──────────────────────────────────────────────────────────────

interface EntryDrawerProps {
  entry?: KnowledgeBaseEntry | null
  onClose: () => void
  onSave: () => void
}

function EntryDrawer({ entry, onClose, onSave }: EntryDrawerProps) {
  const isEdit = !!entry
  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [category, setCategory] = useState(entry?.category ?? '')
  const [principleId, setPrincipleId] = useState(entry?.principle_id ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) { setErr('Title and content are required.'); return }
    setSaving(true)
    setErr('')
    try {
      if (isEdit && entry) {
        await adminService.updateKbEntry(entry.id, { title, content, category: category || undefined, principle_id: principleId || undefined })
      } else {
        await adminService.createKbEntry({ title, content, category: category || undefined, principle_id: principleId || undefined })
      }
      onSave()
      onClose()
    } catch (e: any) {
      setErr(e.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? 'Edit Entry' : 'New KB Entry'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. security, data"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Principle ID</label>
              <input value={principleId} onChange={e => setPrincipleId(e.target.value)} placeholder="e.g. SEC-01"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Content</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={20}
              spellCheck={false}
              placeholder="Markdown content…"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y" />
          </div>
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 h-10 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CategoryGroup({ category, entries, onEdit, onToggle, onDelete, toggling, deleting }: {
  category: string
  entries: KnowledgeBaseEntry[]
  onEdit: (e: KnowledgeBaseEntry) => void
  onToggle: (e: KnowledgeBaseEntry) => void
  onDelete: (e: KnowledgeBaseEntry) => void
  toggling: string | null
  deleting: string | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className="text-sm font-semibold text-slate-700 capitalize">{category}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{entries.length}</span>
        </div>
        <span className="text-xs text-slate-400">{entries.filter(e => e.is_active).length} active</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {entries.map(entry => (
            <div key={entry.id} className={`flex items-center justify-between px-5 py-3 gap-4 ${!entry.is_active ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{entry.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {entry.principle_id && (
                    <span className="text-xs font-mono text-slate-400">{entry.principle_id}</span>
                  )}
                  <span className="text-xs text-slate-300">{entry.content.length} chars</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onToggle(entry)}
                  disabled={toggling === entry.id}
                  title={entry.is_active ? 'Deactivate' : 'Activate'}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
                >
                  {entry.is_active
                    ? <ToggleRight className="w-4 h-4 text-teal-600" />
                    : <ToggleLeft className="w-4 h-4 text-slate-400" />
                  }
                </button>
                <button onClick={() => onEdit(entry)}
                  className="p-1.5 hover:bg-teal-50 rounded-lg text-slate-400 hover:text-teal-600 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(entry)} disabled={deleting === entry.id}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function KnowledgeBase() {
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>([])
  const [domains, setDomains] = useState<AdminDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [showIngest, setShowIngest] = useState(false)
  const [drawerEntry, setDrawerEntry] = useState<KnowledgeBaseEntry | null | undefined>(undefined)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setEntries(await adminService.listKbEntries(showInactive))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    adminService.listDomains(false).then(setDomains).catch(() => {})
  }, [showInactive])

  const handleToggle = async (entry: KnowledgeBaseEntry) => {
    setToggling(entry.id)
    try {
      await adminService.updateKbEntry(entry.id, { is_active: !entry.is_active })
      await load()
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async (entry: KnowledgeBaseEntry) => {
    if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) return
    setDeleting(entry.id)
    try {
      await adminService.deleteKbEntry(entry.id)
      await load()
    } finally {
      setDeleting(null)
    }
  }

  const filtered = entries.filter(e =>
    !search ||
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.principle_id ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce<Record<string, KnowledgeBaseEntry[]>>((acc, e) => {
    const cat = e.category ?? 'uncategorised'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(e)
    return acc
  }, {})

  const totalActive = entries.filter(e => e.is_active).length

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 h-9 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setShowIngest(true)}
            className="flex items-center gap-2 px-4 h-9 border border-teal-300 text-teal-700 bg-teal-50 rounded-lg text-sm font-semibold hover:bg-teal-100">
            <Upload className="w-4 h-4" /> Ingest Content
          </button>
        </div>
      </div>
      <p className="text-slate-500 text-sm mb-6 ml-12">
        {entries.length} entries across {Object.keys(grouped).length} categories — {totalActive} active for RAG context.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by title, category, or principle ID…"
          className="h-9 px-3 border border-slate-200 rounded-lg text-sm w-80 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            className="accent-teal-600" />
          Show inactive
        </label>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
          Loading knowledge base…
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-14 text-slate-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No entries found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
            <CategoryGroup
              key={cat}
              category={cat}
              entries={items}
              onEdit={setDrawerEntry}
              onToggle={handleToggle}
              onDelete={handleDelete}
              toggling={toggling}
              deleting={deleting}
            />
          ))}
        </div>
      )}

      {showIngest && (
        <IngestModal
          domains={domains}
          onClose={() => setShowIngest(false)}
          onSaved={load}
        />
      )}

      {drawerEntry !== undefined && (
        <EntryDrawer
          entry={drawerEntry}
          onClose={() => setDrawerEntry(undefined)}
          onSave={load}
        />
      )}
    </div>
  )
}
