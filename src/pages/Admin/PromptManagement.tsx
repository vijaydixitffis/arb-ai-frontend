import { useEffect, useState } from 'react'
import { FileText, Save, History, RotateCcw, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { adminService } from '../../services/backendConfig'
import type { PromptTemplate, PromptHistoryEntry } from '../../types/admin'
import { brand } from '../../brand.config'

const PROMPT_TYPE_LABELS: Record<string, string> = {
  system: 'System Prompt',
  user: 'User Prompt',
  synthesizer: 'Synthesizer',
  orchestrator: 'Orchestrator',
}

interface HistoryDrawerProps {
  promptKey: string
  onRevert: () => void
  onClose: () => void
}

function HistoryDrawer({ promptKey, onRevert, onClose }: HistoryDrawerProps) {
  const [history, setHistory] = useState<PromptHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [reverting, setReverting] = useState<number | null>(null)

  useEffect(() => {
    adminService.getPromptHistory(promptKey)
      .then(setHistory)
      .finally(() => setLoading(false))
  }, [promptKey])

  const handleRevert = async (version: number) => {
    setReverting(version)
    try {
      await adminService.revertPrompt(promptKey, version)
      onRevert()
      onClose()
    } finally {
      setReverting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Version History</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{promptKey}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 py-4">
              <div className="w-4 h-4 border-2 border-slate-200 border-t-turquoise-500 rounded-full animate-spin" />
              Loading history…
            </div>
          ) : history.map(h => (
            <div key={h.id}
              className={`border rounded-lg px-3 py-2.5 ${h.is_active ? 'border-turquoise-300 bg-turquoise-50' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-700">v{h.version}</span>
                  {h.is_active && <span className="ml-2 text-xs text-turquoise-600 font-medium">• active</span>}
                </div>
                {!h.is_active && (
                  <button
                    onClick={() => handleRevert(h.version)}
                    disabled={reverting === h.version}
                    className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-turquoise-50 hover:border-turquoise-300 hover:text-turquoise-700 disabled:opacity-40"
                  >
                    {reverting === h.version ? '…' : 'Revert'}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">{new Date(h.created_at).toLocaleString()}</p>
              {h.notes && <p className="text-xs text-slate-500 mt-1 italic">{h.notes}</p>}
            </div>
          ))}
          {!loading && history.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">No history yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface PromptCardProps {
  prompt: PromptTemplate
  onSaved: () => void
}

function PromptCard({ prompt, onSaved }: PromptCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [content, setContent] = useState(prompt.content)
  const [notes, setNotes] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const handleChange = (val: string) => {
    setContent(val)
    setDirty(val !== prompt.content)
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminService.savePrompt(prompt.prompt_key, content, notes)
      setDirty(false)
      setNotes('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setContent(prompt.content)
    setDirty(false)
    setNotes('')
  }

  return (
    <>
      <div className={`bg-white border rounded-xl overflow-hidden transition-colors ${dirty ? 'border-amber-300' : 'border-slate-200'}`}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50/50"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-turquoise-50 border border-turquoise-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-turquoise-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">{prompt.prompt_key}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400">{PROMPT_TYPE_LABELS[prompt.prompt_type] ?? prompt.prompt_type}</span>
                {prompt.domain_code && (
                  <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-slate-100 text-slate-500">{prompt.domain_code}</span>
                )}
                <span className="text-xs text-slate-300">v{prompt.version}</span>
                {dirty && <span className="text-xs text-amber-600 font-medium">• unsaved changes</span>}
                {saved && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1 px-2.5 h-8 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50"
            >
              <History className="w-3 h-3" /> History
            </button>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />
            }
          </div>
        </div>

        {/* Editor */}
        {expanded && (
          <div className="border-t border-slate-100 p-5 space-y-3">
            <textarea
              value={content}
              onChange={e => handleChange(e.target.value)}
              rows={14}
              spellCheck={false}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-turquoise-500 resize-y"
            />
            <div className="flex items-center gap-2">
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Version notes (optional)"
                disabled={!dirty}
                className="flex-1 h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-turquoise-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className="flex items-center gap-1.5 px-4 h-9 bg-turquoise-600 text-white rounded-lg text-sm font-semibold hover:bg-turquoise-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Save New Version'}
              </button>
              <button onClick={handleReset} disabled={!dirty} title="Discard changes"
                className="flex items-center gap-1 px-3 h-9 border border-slate-200 rounded-lg text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showHistory && (
        <HistoryDrawer
          promptKey={prompt.prompt_key}
          onRevert={onSaved}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  )
}

export default function PromptManagement() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await adminService.listPrompts()
      setPrompts(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDownload = () => {
    const sep = '='.repeat(80)
    const lines: string[] = [
      `${brand.name} — Prompt Backup`,
      `Generated: ${new Date().toISOString()}`,
      `Total prompts: ${prompts.length}`,
      '',
    ]
    for (const p of prompts) {
      lines.push(sep)
      lines.push(`KEY:     ${p.prompt_key}`)
      lines.push(`TYPE:    ${PROMPT_TYPE_LABELS[p.prompt_type] ?? p.prompt_type}`)
      if (p.domain_code) lines.push(`DOMAIN:  ${p.domain_code}`)
      lines.push(`VERSION: ${p.version}`)
      lines.push(sep)
      lines.push(p.content)
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arb-prompts-backup-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = prompts.filter(p =>
    !filter || p.prompt_key.toLowerCase().includes(filter.toLowerCase()) ||
    (p.domain_code ?? '').toLowerCase().includes(filter.toLowerCase())
  )

  const grouped = filtered.reduce<Record<string, PromptTemplate[]>>((acc, p) => {
    const cat = p.prompt_type
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-turquoise-600 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Prompt Management</h1>
      </div>
      <p className="text-slate-500 text-sm mb-6 ml-12">
        Edit system, user, and orchestrator prompts. Each save creates a new version.
      </p>

      <div className="flex items-center gap-3 mb-5">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by key or domain…"
          className="h-9 px-3 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-turquoise-500"
        />
        <button
          onClick={handleDownload}
          disabled={prompts.length === 0}
          className="flex items-center gap-1.5 px-3 h-9 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:border-turquoise-300 hover:text-turquoise-700 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Download all prompts as a text backup"
        >
          <Download className="w-3.5 h-3.5" />
          Download Backup
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-turquoise-500 rounded-full animate-spin" />
          Loading prompts…
        </div>
      ) : Object.entries(grouped).length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No prompts found. Run the DB migration to seed defaults.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="mb-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
              {PROMPT_TYPE_LABELS[type] ?? type}
            </h2>
            <div className="space-y-2">
              {items.map(p => (
                <PromptCard key={p.prompt_key} prompt={p} onSaved={load} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
