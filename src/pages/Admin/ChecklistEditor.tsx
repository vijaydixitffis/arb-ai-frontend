import { useEffect, useState } from 'react'
import { ListChecks, ChevronRight, Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { useAdminStore } from '../../stores/adminStore'
import { adminService } from '../../services/backendConfig'
import type { AdminDomain, ChecklistSubsection, ChecklistQuestion } from '../../types/admin'

interface SubsectionDrawerProps { sub?: ChecklistSubsection | null; domains: AdminDomain[]; onClose: () => void; onSave: () => void }
function SubsectionDrawer({ sub, domains, onClose, onSave }: SubsectionDrawerProps) {
  const isEdit = !!sub
  const [domainId, setDomainId] = useState(sub?.domain_id ?? domains[0]?.id ?? '')
  const [name, setName] = useState(sub?.name ?? '')
  const [description, setDesc] = useState(sub?.description ?? '')
  const [colorTheme, setColor] = useState(sub?.color_theme ?? '')
  const [sortOrder, setSort] = useState(sub?.sort_order ?? 0)
  const [isActive, setIsActive] = useState(sub?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    try {
      if (isEdit && sub) {
        await adminService.updateSubsection(sub.id, { name, description, color_theme: colorTheme, sort_order: sortOrder, is_active: isActive })
      } else {
        await adminService.createSubsection({ domain_id: domainId as any, name, description, color_theme: colorTheme, sort_order: sortOrder, is_active: isActive })
      }
      onSave(); onClose()
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? 'Edit Subsection' : 'New Subsection'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Domain</label>
              <select value={domainId} onChange={e => setDomainId(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                {domains.filter(d => d.is_active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Color Theme</label>
              <input value={colorTheme} onChange={e => setColor(e.target.value)} placeholder="#3b82f6"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Sort Order</label>
              <input type="number" value={sortOrder} onChange={e => setSort(parseInt(e.target.value) || 0)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsActive(!isActive)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-teal-500' : 'bg-slate-200'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-slate-600">{isActive ? 'Active' : 'Inactive'}</span>
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

interface QuestionDrawerProps { question?: ChecklistQuestion | null; subsections: ChecklistSubsection[]; onClose: () => void; onSave: () => void }
function QuestionDrawer({ question, subsections, onClose, onSave }: QuestionDrawerProps) {
  const isEdit = !!question
  const [subsectionId, setSubId] = useState(question?.subsection_id ?? subsections[0]?.id ?? '')
  const [questionCode, setCode] = useState(question?.question_code ?? '')
  const [questionText, setText] = useState(question?.question_text ?? '')
  const [questionType, setType] = useState(question?.question_type ?? 'compliance')
  const [helpText, setHelp] = useState(question?.help_text ?? '')
  const [isRequired, setRequired] = useState(question?.is_required ?? false)
  const [sortOrder, setSort] = useState(question?.sort_order ?? 0)
  const [isActive, setIsActive] = useState(question?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    try {
      if (isEdit && question) {
        await adminService.updateQuestion(question.id, { question_text: questionText, question_type: questionType, help_text: helpText, is_required: isRequired, sort_order: sortOrder, is_active: isActive })
      } else {
        await adminService.createQuestion({ subsection_id: subsectionId as any, question_code: questionCode, question_text: questionText, question_type: questionType, help_text: helpText, is_required: isRequired, sort_order: sortOrder, is_active: isActive })
      }
      onSave(); onClose()
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? 'Edit Question' : 'New Question'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Subsection</label>
                <select value={subsectionId} onChange={e => setSubId(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                  {subsections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Question Code</label>
                <input value={questionCode} onChange={e => setCode(e.target.value)} placeholder="SEC-Q01"
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono" />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Question Text</label>
            <textarea value={questionText} onChange={e => setText(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Help Text</label>
            <textarea value={helpText} onChange={e => setHelp(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
              <select value={questionType} onChange={e => setType(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                <option value="compliance">Compliance</option>
                <option value="evidence">Evidence</option>
                <option value="text">Free Text</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Sort Order</label>
              <input type="number" value={sortOrder} onChange={e => setSort(parseInt(e.target.value) || 0)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isRequired} onChange={e => setRequired(e.target.checked)} className="w-4 h-4 accent-teal-600" />
              Required question
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 accent-teal-600" />
              Active
            </label>
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

export default function ChecklistEditor() {
  const { domains, loadDomains } = useAdminStore()
  const [selectedDomain, setSelectedDomain] = useState<string>('')
  const [subsections, setSubsections] = useState<ChecklistSubsection[]>([])
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([])
  const [expandedSub, setExpandedSub] = useState<string | null>(null)
  const [subDrawer, setSubDrawer] = useState<ChecklistSubsection | null | undefined>(undefined)
  const [qDrawer, setQDrawer] = useState<ChecklistQuestion | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadDomains() }, [])
  useEffect(() => {
    if (!selectedDomain) return
    setLoading(true)
    adminService.listSubsections(selectedDomain)
      .then(s => { setSubsections(s); setExpandedSub(null) })
      .finally(() => setLoading(false))
  }, [selectedDomain])

  const loadQuestions = async (subId: string) => {
    const qs = await adminService.listQuestions(subId)
    setQuestions(prev => [...prev.filter(q => q.subsection_id !== subId), ...qs])
  }

  const toggleSub = (subId: string) => {
    if (expandedSub === subId) { setExpandedSub(null); return }
    setExpandedSub(subId)
    loadQuestions(subId)
  }

  const activeDomains = domains.filter(d => d.is_active)
  const selectedDomainObj = domains.find(d => d.id === selectedDomain)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
          <ListChecks className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Checklist Editor</h1>
      </div>
      <p className="text-slate-500 text-sm mb-6 ml-12">Manage subsections and compliance questions per domain.</p>

      {/* Domain selector */}
      <div className="flex items-center gap-3 mb-6">
        <select value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)}
          className="h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white min-w-[200px]">
          <option value="">— Select domain —</option>
          {activeDomains.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
        </select>
        {selectedDomain && (
          <button onClick={() => setSubDrawer(null)}
            className="flex items-center gap-2 px-3 h-10 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700">
            <Plus className="w-4 h-4" /> Add Subsection
          </button>
        )}
      </div>

      {!selectedDomain && (
        <div className="text-center py-16 text-slate-400">
          <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Select a domain to view and edit its checklist</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 py-8">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
          Loading…
        </div>
      )}

      {selectedDomain && !loading && (
        <div className="space-y-2">
          {subsections.length === 0 && (
            <p className="text-slate-400 text-sm py-8 text-center">No subsections yet. Add the first one.</p>
          )}
          {subsections.map(sub => {
            const subQuestions = questions.filter(q => q.subsection_id === sub.id)
            const isExpanded = expandedSub === sub.id
            return (
              <div key={sub.id} className={`bg-white border rounded-xl overflow-hidden transition-colors ${sub.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer" onClick={() => toggleSub(sub.id)}>
                  <div className="flex items-center gap-3">
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <span className="font-medium text-slate-800">{sub.name}</span>
                    {sub.description && <span className="text-xs text-slate-400">{sub.description}</span>}
                    <span className="text-xs text-slate-300">({subQuestions.length} questions)</span>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSubDrawer(sub)}
                      className="p-1.5 hover:bg-teal-50 rounded text-slate-400 hover:text-teal-600">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-3">
                    <div className="flex justify-end mb-2">
                      <button onClick={() => setQDrawer(null)}
                        className="flex items-center gap-1 px-2.5 h-7 border border-slate-200 rounded text-xs text-slate-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700">
                        <Plus className="w-3 h-3" /> Add Question
                      </button>
                    </div>
                    {subQuestions.length === 0 ? (
                      <p className="text-slate-400 text-xs py-3 text-center">No questions yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {subQuestions.map(q => (
                          <div key={q.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${q.is_active ? 'bg-slate-50' : 'bg-slate-50/40 opacity-60'}`}>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-xs font-mono text-slate-400 flex-shrink-0">{q.question_code}</span>
                              <span className="text-slate-700 truncate">{q.question_text}</span>
                              {q.is_required && <span className="text-xs text-red-500 flex-shrink-0">required</span>}
                            </div>
                            <button onClick={() => setQDrawer(q)}
                              className="p-1 hover:bg-teal-50 rounded text-slate-400 hover:text-teal-600 flex-shrink-0">
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {subDrawer !== undefined && (
        <SubsectionDrawer
          sub={subDrawer} domains={activeDomains}
          onClose={() => setSubDrawer(undefined)}
          onSave={() => { if (selectedDomain) adminService.listSubsections(selectedDomain).then(setSubsections) }}
        />
      )}
      {qDrawer !== undefined && expandedSub && (
        <QuestionDrawer
          question={qDrawer}
          subsections={subsections.filter(s => s.id === expandedSub)}
          onClose={() => setQDrawer(undefined)}
          onSave={() => expandedSub && loadQuestions(expandedSub)}
        />
      )}
    </div>
  )
}
