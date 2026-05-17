import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useMetadataStore } from '../stores/metadataStore'
import { Input } from '../components/ui/Input'
import { Upload, CheckSquare, X, ArrowLeft, Send, Save, ChevronRight, Layers, Tag, Briefcase, FileText, Info, AlertTriangle } from 'lucide-react'
import { reviewService } from '../services/backendConfig'

interface DomainData {
  artefacts: Array<{
    id?: string
    name: string
    type: string
    fileName: string
    file: File | null
  }>
  checklist: Record<string, string>
  evidence: Record<string, string>
}

export default function EARRSubmission() {
  const navigate = useNavigate()
  const location = useLocation()
  const { reviewId: urlReviewId } = useParams()
  const user = useAuthStore((state) => state.user)
  const { domains, loadDomainMetadata, checklistSubsectionsByDomain, artefactTypes, artefactTemplatesByDomain, questionOptionsByQuestion } = useMetadataStore()

  const [isLoading, setIsLoading] = useState(true)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [reviewStatus, setReviewStatus] = useState<string | null>(null)
  const [selectedDomainForModal, setSelectedDomainForModal] = useState<string | null>(null)
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false)
  const [selectedSubsection, setSelectedSubsection] = useState<string | null>(null)
  const [activeModalTab, setActiveModalTab] = useState<'artefacts' | 'checklist'>('artefacts')

  const [projectInfo, setProjectInfo] = useState({
    project_name: '',
    problem_statement: '',
    stakeholders: [] as string[],
    business_drivers: [] as string[],
    target_business_outcomes: ''
  })

  const [reviewType, setReviewType] = useState({
    ptxGate: '',
    architectureDisposition: ''
  })

  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [domainData, setDomainData] = useState<Record<string, DomainData>>({})
  const [returnDomains, setReturnDomains] = useState<string[]>([])
  const [reworkGaps,    setReworkGaps]    = useState<string[]>([])
  const [isReturned,    setIsReturned]    = useState(false)

  const [newArtefact, setNewArtefact] = useState({
    name: '',
    type: '',
    fileName: '',
    file: null as File | null
  })

  useEffect(() => {
    const loadData = async () => {
      if (urlReviewId) {
        setSubmissionId(urlReviewId)
        try {
          const draftData = await reviewService.loadDraftData(urlReviewId)
          const formData = draftData.formData || {}

          // scope_tags are always loaded regardless of whether form_data is present
          // (already-processed reviews have LLM output in report_json but no form_data)
          const domainSlugs: string[] = (draftData.review?.scope_tags || []).map((s: string) => s.toLowerCase())
          setSelectedDomains(domainSlugs)
          setReviewStatus(draftData.review?.status ?? null)
          domainSlugs.forEach((domainSlug: string) => loadDomainMetadata(domainSlug))

          // EA return context is also independent of form_data
          if (draftData.review?.status === 'returned') {
            setIsReturned(true)
            setReturnDomains(draftData.review?.ea_review?.return_domains || [])
            setReworkGaps(draftData.review?.ea_review?.rework_gaps || [])
          }

          if (formData && Object.keys(formData).length > 0) {
            setProjectInfo({
              project_name: formData.project_name || formData.solution_name || '',
              problem_statement: formData.problem_statement || '',
              stakeholders: formData.stakeholders || [],
              business_drivers: formData.business_drivers || [],
              target_business_outcomes: formData.target_business_outcomes || formData.growth_plans || ''
            })

            setReviewType({
              ptxGate: formData.ptx_gate || '',
              architectureDisposition: formData.architecture_disposition || ''
            })

            const loadedDomainData: Record<string, DomainData> = formData.domain_data || {}
            setDomainData(loadedDomainData)
          }

          const uploadedArtefacts = await reviewService.getReviewArtefacts(urlReviewId)
          const artefactsByDomain: Record<string, DomainData['artefacts']> = {}
          uploadedArtefacts.forEach(artefact => {
            if (!artefactsByDomain[artefact.domain_slug]) {
              artefactsByDomain[artefact.domain_slug] = []
            }
            artefactsByDomain[artefact.domain_slug].push({
              id: artefact.id,
              name: artefact.artefact_name,
              type: artefact.artefact_type,
              fileName: artefact.filename,
              file: null
            })
          })

          setDomainData(prev => {
            const updated: Record<string, DomainData> = { ...prev }
            Object.keys(artefactsByDomain).forEach(domainSlug => {
              updated[domainSlug] = {
                ...(updated[domainSlug] || { checklist: {}, evidence: {} }),
                artefacts: artefactsByDomain[domainSlug]
              }
            })
            return updated
          })
        } catch (error) {
          console.error('Error loading draft:', error)
          alert('Failed to load draft data')
        }
      } else {
        const state = location.state as {
          projectInfo?: typeof projectInfo
          ptxGate?: string
          architectureDisposition?: string
          selectedDomains?: string[]
        }

        if (state?.projectInfo) setProjectInfo(state.projectInfo)

        if (state?.ptxGate && state?.architectureDisposition) {
          setReviewType({ ptxGate: state.ptxGate, architectureDisposition: state.architectureDisposition })
        }

        if (state?.selectedDomains) {
          setSelectedDomains(state.selectedDomains)
          const initialDomainData: Record<string, DomainData> = {}
          state.selectedDomains.forEach(domainSlug => {
            initialDomainData[domainSlug] = { artefacts: [], checklist: {}, evidence: {} }
          })
          setDomainData(initialDomainData)
          state.selectedDomains.forEach(domainSlug => loadDomainMetadata(domainSlug))
        }
      }

      setIsLoading(false)
    }

    loadData()
  }, [location.state, loadDomainMetadata, urlReviewId, domains])

  const getDomainBySlug = (slug: string) => domains.find(d => d.slug === slug)

  const getArtefactIcon = (type: string) => {
    const artefactType = artefactTypes.find((t: any) => t.value === type)
    return artefactType?.icon || '📎'
  }

  const getArtefactTypeLabel = (type: string) => {
    const artefactType = artefactTypes.find((t: any) => t.value === type)
    return artefactType?.label || type
  }

  const openDomainModal = (domainSlug: string) => {
    setSelectedDomainForModal(domainSlug)
    setIsDomainModalOpen(true)
    setActiveModalTab('artefacts')
    setSelectedSubsection(null)
    setNewArtefact({ name: '', type: '', fileName: '', file: null })
  }

  const closeDomainModal = () => {
    setIsDomainModalOpen(false)
    setSelectedDomainForModal(null)
    setSelectedSubsection(null)
  }

  const handleAddArtefact = async () => {
    if (!selectedDomainForModal || !newArtefact.name || !newArtefact.type || !newArtefact.file) return

    if (!submissionId) {
      try {
        const scopeTags = selectedDomains.includes(selectedDomainForModal)
          ? selectedDomains
          : [...selectedDomains, selectedDomainForModal]
        const draftData = {
          solution_name: projectInfo.project_name,
          scope_tags: scopeTags,
          sa_user_id: user?.id || '',
          form_data: {
            project_name: projectInfo.project_name,
            problem_statement: projectInfo.problem_statement,
            stakeholders: projectInfo.stakeholders,
            business_drivers: projectInfo.business_drivers,
            target_business_outcomes: projectInfo.target_business_outcomes,
            ptx_gate: reviewType.ptxGate,
            architecture_disposition: reviewType.architectureDisposition,
            domain_data: domainData
          }
        }
        const response = await reviewService.createDraft(draftData)
        setSubmissionId(response.id)

        const artefactData = { domain: selectedDomainForModal, name: newArtefact.name, type: newArtefact.type, file: newArtefact.file }
        const uploadedArtefacts = await reviewService.uploadArtefacts(response.id, [artefactData])
        const uploadedArtefact = uploadedArtefacts[0]

        setDomainData(prev => ({
          ...prev,
          [selectedDomainForModal]: {
            ...prev[selectedDomainForModal],
            artefacts: [...prev[selectedDomainForModal].artefacts, {
              id: uploadedArtefact.id,
              name: uploadedArtefact.artefact_name,
              type: uploadedArtefact.artefact_type,
              fileName: uploadedArtefact.filename,
              file: null
            }]
          }
        }))
        setNewArtefact({ name: '', type: '', fileName: '', file: null })
      } catch (error) {
        console.error('Failed to create review and upload artefact:', error)
        alert('Failed to save. Please try again.')
      }
    } else {
      try {
        const artefactData = { domain: selectedDomainForModal, name: newArtefact.name, type: newArtefact.type, file: newArtefact.file }
        const uploadedArtefacts = await reviewService.uploadArtefacts(submissionId, [artefactData])
        const uploadedArtefact = uploadedArtefacts[0]

        setDomainData(prev => ({
          ...prev,
          [selectedDomainForModal]: {
            ...prev[selectedDomainForModal],
            artefacts: [...prev[selectedDomainForModal].artefacts, {
              id: uploadedArtefact.id,
              name: uploadedArtefact.artefact_name,
              type: uploadedArtefact.artefact_type,
              fileName: uploadedArtefact.filename,
              file: null
            }]
          }
        }))
        setNewArtefact({ name: '', type: '', fileName: '', file: null })
      } catch (error) {
        console.error('Failed to upload artefact:', error)
        alert('Failed to upload artefact. Please try again.')
      }
    }
  }

  const handleDeleteArtefact = async (artefactId: string, index: number) => {
    if (!selectedDomainForModal) return
    try {
      await reviewService.deleteArtefact(artefactId, submissionId || '')
      setDomainData(prev => ({
        ...prev,
        [selectedDomainForModal]: {
          ...prev[selectedDomainForModal],
          artefacts: prev[selectedDomainForModal].artefacts.filter((_, i) => i !== index)
        }
      }))
    } catch (error) {
      console.error('Failed to delete artefact:', error)
      alert('Failed to delete artefact. Please try again.')
    }
  }

  const handleChecklistChange = (questionCode: string, value: string) => {
    if (!selectedDomainForModal) return
    setDomainData(prev => {
      const current = { ...prev[selectedDomainForModal].checklist }
      if (value === '') {
        delete current[questionCode]
      } else {
        current[questionCode] = value
      }
      return {
        ...prev,
        [selectedDomainForModal]: {
          ...prev[selectedDomainForModal],
          checklist: current
        }
      }
    })
  }

  const handleEvidenceChange = (questionCode: string, value: string) => {
    if (!selectedDomainForModal) return
    setDomainData(prev => ({
      ...prev,
      [selectedDomainForModal]: {
        ...prev[selectedDomainForModal],
        evidence: { ...prev[selectedDomainForModal].evidence, [questionCode]: value }
      }
    }))
  }

  const handleSave = async () => {
    try {
      const scopeTags = selectedDomains
      const formData = buildFormData()

      if (submissionId) {
        await reviewService.updateDraft(submissionId, { form_data: formData, scope_tags: scopeTags })
      } else {
        const draftData = { solution_name: projectInfo.project_name, scope_tags: scopeTags, sa_user_id: user?.id || '', form_data: formData }
        const response = await reviewService.createDraft(draftData)
        setSubmissionId(response.id)
      }

      alert('Draft saved successfully')
    } catch (error) {
      console.error('Failed to save draft:', error)
      alert('Failed to save draft. Please try again.')
    }
  }

  // Builds the current form_data object from component state
  const buildFormData = () => ({
    project_name: projectInfo.project_name,
    problem_statement: projectInfo.problem_statement,
    stakeholders: projectInfo.stakeholders,
    business_drivers: projectInfo.business_drivers,
    target_business_outcomes: projectInfo.target_business_outcomes,
    ptx_gate: reviewType.ptxGate,
    architecture_disposition: reviewType.architectureDisposition,
    domain_data: domainData
  })

  // Save form changes without altering review status (for already-processed reviews)
  const handleSaveChanges = async () => {
    try {
      const scopeTags = selectedDomains
      const formData = buildFormData()
      if (!submissionId) return
      await reviewService.updateDraft(submissionId, { form_data: formData, scope_tags: scopeTags })
      alert('Changes saved successfully.')
    } catch (error) {
      console.error('Failed to save changes:', error)
      alert('Failed to save changes. Please try again.')
    }
  }

  const handleSubmit = async () => {
    try {
      // For already-processed reviews, just save form_data without re-queuing
      const isProcessed = reviewStatus && !['drafting', 'draft', 'queued', 'returned'].includes(reviewStatus)
      if (isProcessed && submissionId) {
        await handleSaveChanges()
        navigate('/dashboard')
        return
      }

      // Check 1: at least one selected domain must have some input (artefact or checklist answer)
      const domainsWithInput = selectedDomains.filter(slug => {
        const data = domainData[slug]
        return (data?.artefacts?.length || 0) > 0 || Object.keys(data?.checklist || {}).length > 0
      })
      if (domainsWithInput.length === 0) {
        alert('Please provide input for at least one domain (upload artefacts or fill in checklist answers) before submitting.')
        return
      }

      // Check 2: every domain that has any input must also have at least one artefact
      const domainsWithInputButNoArtefact = domainsWithInput.filter(slug => (domainData[slug]?.artefacts?.length || 0) === 0)
      if (domainsWithInputButNoArtefact.length > 0) {
        const names = domainsWithInputButNoArtefact.map(slug => getDomainBySlug(slug)?.name || slug).join(', ')
        alert(`The following domain(s) have checklist answers but no artefacts uploaded:\n\n${names}\n\nPlease upload at least one artefact for each domain before submitting.`)
        return
      }

      const scopeTags = selectedDomains
      const formData = buildFormData()

      let reviewId = submissionId

      if (reviewId) {
        await reviewService.updateDraft(reviewId, { form_data: formData, scope_tags: scopeTags, status: 'queued' })
      } else {
        const draftData = { solution_name: projectInfo.project_name, scope_tags: scopeTags, sa_user_id: user?.id || '', form_data: formData }
        const response = await reviewService.createDraft(draftData)
        reviewId = response.id
        if (!reviewId) throw new Error('Failed to create review')
        await reviewService.updateDraft(reviewId, { status: 'queued' })
      }

      alert('Submission saved as submitted. You can mark it as ready for review from the dashboard.')
      navigate('/dashboard')
    } catch (error) {
      console.error('Failed to submit:', error)
      alert('Failed to submit. Please try again.')
    }
  }

  // Compute overall completion stats
  const totalArtefacts = Object.values(domainData).reduce((sum, d) => sum + (d?.artefacts?.length || 0), 0)
  const domainsWithArtefacts = selectedDomains.filter(slug => (domainData[slug]?.artefacts?.length || 0) > 0).length

  const selectedDomainObj = selectedDomainForModal ? getDomainBySlug(selectedDomainForModal) : null
  const subsections = selectedDomainForModal ? checklistSubsectionsByDomain[selectedDomainForModal] || [] : []
  const artefactTemplates = selectedDomainForModal ? artefactTemplatesByDomain[selectedDomainForModal] || [] : []

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading submission&hellip;</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top header bar */}
      <div className="bg-white border-b border-slate-200 px-8 py-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 leading-tight flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-slate-400 flex-shrink-0" />
              {projectInfo.project_name || 'Untitled Project'}
            </h1>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {reviewType.ptxGate && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                  <Tag className="w-3 h-3" />
                  {reviewType.ptxGate}
                </span>
              )}
              {reviewType.architectureDisposition && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                  <Layers className="w-3 h-3" />
                  {reviewType.architectureDisposition}
                </span>
              )}
              <span className="text-xs text-slate-400">
                {selectedDomains.length} domains &middot; {totalArtefacts} artefact{totalArtefacts !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Overall progress pill */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <span className="text-xs text-slate-500 font-medium">Domain coverage</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: selectedDomains.length > 0 ? `${(domainsWithArtefacts / selectedDomains.length) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-700">
                {domainsWithArtefacts}/{selectedDomains.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-8 py-6">

        {/* EA Return notice */}
        {isReturned && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 mb-1">
                  Returned by EA — rework required before resubmission
                </p>

                {/* Flagged domains */}
                {returnDomains.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-amber-700 mb-1.5">Domains to address:</p>
                    <div className="flex flex-wrap gap-2">
                      {returnDomains.map(slug => (
                        <span key={slug} className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-semibold border border-amber-300 capitalize">
                          {slug.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rework gaps */}
                {reworkGaps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-700 mb-1.5">EA feedback:</p>
                    <ul className="space-y-1">
                      {reworkGaps.map((gap, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-amber-900">
                          <span className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-full bg-amber-300 flex items-center justify-center text-[10px] font-bold">
                            {i + 1}
                          </span>
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Domain grid */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">
            Selected Domains
            <span className="ml-2 text-xs font-normal text-slate-400">({selectedDomains.length})</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedDomains.map((domainSlug) => {
            const domain = getDomainBySlug(domainSlug)
            if (!domain) return null

            const data = domainData[domainSlug]
            const artefactCount  = data?.artefacts?.length || 0
            const checklistCount = Object.keys(data?.checklist || {}).length
            const hasContent     = artefactCount > 0
            const needsRework    = returnDomains.includes(domainSlug)

            return (
              <button
                key={domainSlug}
                onClick={() => openDomainModal(domainSlug)}
                className={`text-left bg-white border rounded-xl p-5 cursor-pointer transition-all hover:shadow-md group focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  needsRework
                    ? 'border-l-4 border-l-amber-400 border-amber-200 hover:border-amber-400 focus:ring-amber-400'
                    : hasContent
                    ? 'border-l-4 border-l-emerald-400 border-slate-200 hover:border-emerald-300 focus:ring-indigo-400'
                    : 'border-l-4 border-l-slate-300 border-slate-200 hover:border-indigo-300 focus:ring-indigo-400'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className={`font-semibold text-sm leading-snug transition-colors flex items-center gap-1.5 ${
                    needsRework ? 'text-amber-800 group-hover:text-amber-900' : 'text-slate-800 group-hover:text-indigo-700'
                  }`}>
                    {domain.icon && <span className="text-base leading-none flex-shrink-0">{domain.icon}</span>}
                    {domain.name}
                  </h3>
                  <div className="flex gap-1.5 flex-shrink-0 ml-2 flex-wrap justify-end">
                    {needsRework && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Rework
                      </span>
                    )}
                    {artefactCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                        {artefactCount} file{artefactCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {checklistCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                        {checklistCount} checks
                      </span>
                    )}
                  </div>
                </div>

                {domain.description && (
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{domain.description}</p>
                )}

                <div className="flex items-center justify-between mt-auto">
                  <span className={`text-xs font-medium ${
                    needsRework ? 'text-amber-600' : hasContent ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {needsRework && !hasContent ? 'Rework required — upload artefacts' :
                     needsRework && hasContent  ? 'Rework required — artefacts updated' :
                     hasContent                 ? 'Artefacts uploaded' : 'No artefacts yet'}
                  </span>
                  <ChevronRight className={`w-4 h-4 transition-colors ${
                    needsRework ? 'text-amber-300 group-hover:text-amber-600' : 'text-slate-300 group-hover:text-indigo-500'
                  }`} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Action buttons — inline below domain grid */}
        {(() => {
          const isProcessed = reviewStatus && !['drafting', 'draft', 'queued', 'returned'].includes(reviewStatus)
          return (
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200">
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
              <button
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
                {isProcessed ? 'Save Changes' : 'Submit for Review'}
              </button>
            </div>
          )
        })()}
      </div>

      {/* Domain detail modal */}
      {isDomainModalOpen && selectedDomainForModal && selectedDomainObj && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  {selectedDomainObj.icon && <span className="text-lg leading-none flex-shrink-0">{selectedDomainObj.icon}</span>}
                  {selectedDomainObj.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {domainData[selectedDomainForModal]?.artefacts?.length || 0} artefact(s) &middot;&nbsp;
                  {Object.keys(domainData[selectedDomainForModal]?.checklist || {}).length} checklist answers
                </p>
              </div>
              <button
                onClick={closeDomainModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal tabs */}
            <div className="flex border-b border-slate-200 px-6 flex-shrink-0">
              <button
                onClick={() => setActiveModalTab('artefacts')}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeModalTab === 'artefacts'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Upload className="w-4 h-4" />
                Artefacts
              </button>
              <button
                onClick={() => setActiveModalTab('checklist')}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeModalTab === 'checklist'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                Compliance Checklist
              </button>
            </div>

            {/* Modal scrollable body */}
            <div className="overflow-y-auto flex-1 p-6">

              {/* Artefacts tab */}
              {activeModalTab === 'artefacts' && (
                <div className="space-y-5">
                  {/* Upload form */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Artefact</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Artefact Name</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                          value={newArtefact.name}
                          onChange={(e) => {
                            const selectedArtefact = artefactTemplates?.find((a: any) => a.name === e.target.value)
                            setNewArtefact({
                              ...newArtefact,
                              name: e.target.value,
                              type: selectedArtefact?.artefact_type?.value || selectedArtefact?.artefact_type_id || '',
                            })
                          }}
                        >
                          <option value="">Select artefact&hellip;</option>
                          {artefactTemplates?.map((artefact: any) => (
                            <option key={artefact.name} value={artefact.name}>{artefact.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                          value={newArtefact.type}
                          onChange={(e) => setNewArtefact({ ...newArtefact, type: e.target.value })}
                        >
                          <option value="">Select type&hellip;</option>
                          {artefactTypes.map((type: any) => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">File Name</label>
                        <Input
                          placeholder="Enter file name"
                          value={newArtefact.fileName}
                          onChange={(e) => setNewArtefact({ ...newArtefact, fileName: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Upload</label>
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null
                            setNewArtefact({ ...newArtefact, file, fileName: file?.name || newArtefact.fileName })
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddArtefact}
                      disabled={!newArtefact.name || !newArtefact.type || !newArtefact.file}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Add Artefact
                    </button>
                  </div>

                  {/* Uploaded artefacts list */}
                  {(domainData[selectedDomainForModal]?.artefacts?.length || 0) > 0 ? (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Uploaded ({domainData[selectedDomainForModal].artefacts.length})
                      </h4>
                      <div className="space-y-2">
                        {domainData[selectedDomainForModal].artefacts.map((artefact, index) => (
                          <div key={index} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-slate-300 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{getArtefactIcon(artefact.type)}</span>
                              <div>
                                <p className="text-sm font-medium text-slate-800">{artefact.name}</p>
                                <p className="text-xs text-slate-400">{artefact.fileName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                {getArtefactTypeLabel(artefact.type)}
                              </span>
                              {artefact.id && (
                                <button
                                  onClick={() => handleDeleteArtefact(artefact.id!, index)}
                                  className="text-xs text-rose-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400">
                      <Upload className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No artefacts uploaded yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* Checklist tab — two-panel master-detail */}
              {activeModalTab === 'checklist' && (() => {
                const activeSubsectionName = selectedSubsection ?? subsections[0]?.name ?? null
                const activeSubsectionData = subsections.find((s: any) => s.name === activeSubsectionName)

                const getPillClass = (optValue: string, isActive: boolean) => {
                  if (!isActive) return 'border-slate-200 text-slate-500 bg-white hover:border-slate-300 hover:bg-slate-50'
                  if (optValue === 'compliant' || optValue === 'yes') return 'border-emerald-400 text-emerald-700 bg-emerald-50'
                  if (optValue === 'non_compliant' || optValue === 'no') return 'border-rose-400 text-rose-700 bg-rose-50'
                  if (optValue === 'partial') return 'border-amber-400 text-amber-700 bg-amber-50'
                  if (optValue === 'na') return 'border-slate-300 text-slate-600 bg-slate-100'
                  return 'border-indigo-400 text-indigo-700 bg-indigo-50'
                }

                return (
                  <div>
                    {subsections.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">
                        <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Loading checklist&hellip;</p>
                      </div>
                    ) : (
                      <>
                        {/* Optional banner */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4">
                          <Info className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400" />
                          All checklist items are optional &mdash; fill in only what is applicable to your project.
                        </div>

                        {/* Two-panel layout */}
                        <div className="flex border border-slate-200 rounded-xl overflow-hidden">
                          {/* Left nav: subsection list */}
                          <div className="w-52 flex-shrink-0 bg-slate-50 border-r border-slate-200 overflow-y-auto max-h-[54vh]">
                            {subsections.map((subsection: any) => {
                              const questionCount = subsection.questions?.length || 0
                              const answeredCount = subsection.questions?.filter((q: any) =>
                                domainData[selectedDomainForModal]?.checklist?.[q.question_code]
                              ).length || 0
                              const isActive = activeSubsectionName === subsection.name
                              const isComplete = questionCount > 0 && answeredCount === questionCount

                              return (
                                <button
                                  key={subsection.id}
                                  onClick={() => setSelectedSubsection(subsection.name)}
                                  className={`w-full text-left px-4 py-3 border-b border-slate-200/70 transition-colors last:border-0 ${
                                    isActive ? 'bg-white border-l-2 border-l-indigo-500' : 'hover:bg-white/70'
                                  }`}
                                >
                                  <p className={`text-sm leading-snug mb-1 ${isActive ? 'font-semibold text-indigo-700' : 'font-medium text-slate-700'}`}>
                                    {subsection.name}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-400' : 'bg-indigo-300'}`}
                                        style={{ width: questionCount > 0 ? `${(answeredCount / questionCount) * 100}%` : '0%' }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-400 flex-shrink-0">{answeredCount}/{questionCount}</span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>

                          {/* Right panel: questions */}
                          <div className="flex-1 overflow-y-auto max-h-[54vh] p-5">
                            {activeSubsectionData ? (
                              <div className="space-y-5">
                                <h4 className="text-sm font-semibold text-slate-800 pb-3 border-b border-slate-100">
                                  {activeSubsectionData.name}
                                </h4>
                                {activeSubsectionData.questions?.map((question: any) => {
                                  const options: string[] = questionOptionsByQuestion[question.question_code]?.map((o: any) => o.value) || ['compliant', 'non_compliant', 'partial', 'na']
                                  const optionLabels: string[] = questionOptionsByQuestion[question.question_code]?.map((o: any) => o.label) || ['Compliant', 'Non-Compliant', 'Partial', 'N/A']
                                  const currentValue = domainData[selectedDomainForModal]?.checklist?.[question.question_code] || ''

                                  return (
                                    <div key={question.id} className="pb-5 border-b border-slate-100 last:border-0 last:pb-0">
                                      <div className="flex items-start justify-between gap-3 mb-3">
                                        <p className="text-sm text-slate-700 leading-relaxed">{question.question_text}</p>
                                        {currentValue && (
                                          <button
                                            onClick={() => handleChecklistChange(question.question_code, '')}
                                            className="text-xs text-slate-400 hover:text-rose-500 flex-shrink-0 transition-colors"
                                          >
                                            Clear
                                          </button>
                                        )}
                                      </div>

                                      {/* Pill toggle buttons */}
                                      <div className="flex flex-wrap gap-2 mb-2.5">
                                        {options.map((opt, idx) => (
                                          <button
                                            key={opt}
                                            onClick={() => handleChecklistChange(question.question_code, currentValue === opt ? '' : opt)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${getPillClass(opt, currentValue === opt)}`}
                                          >
                                            {optionLabels[idx]}
                                          </button>
                                        ))}
                                      </div>

                                      {/* Optional evidence note */}
                                      <Input
                                        placeholder="Evidence notes (optional)"
                                        value={domainData[selectedDomainForModal]?.evidence?.[question.question_code] || ''}
                                        onChange={(e) => handleEvidenceChange(question.question_code, e.target.value)}
                                        className="text-xs text-slate-500 mt-1"
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400">
                                <CheckSquare className="w-8 h-8 mb-2 opacity-30" />
                                <p className="text-sm">Select a section on the left</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end px-6 py-4 border-t border-slate-200 flex-shrink-0">
              <button
                onClick={closeDomainModal}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
