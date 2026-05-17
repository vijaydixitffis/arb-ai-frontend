import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useMetadataStore } from '../stores/metadataStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import ARBHeader from '../components/ARB/ARBHeader'
import NFRCriteriaSection from '../components/ARB/NFRCriteriaSection'
import { reviewService } from '../services/python/reviewService'
import { artefactService } from '../services/python/artefactService'
import { validateSubmissionCompleteness, getValidationSummary } from '../utils/schemaValidation'

export default function ARBSubmission() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const { domains, loadDomainMetadata, checklistSubsectionsByDomain, loadMetadata, artefactTypes, artefactTemplatesByDomain, getDomainBySeqNumber, questionOptionsByQuestion } = useMetadataStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [selectedSubsection, setSelectedSubsection] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [ptxGate, setPtxGate] = useState<string>('')
  const [architectureDisposition, setArchitectureDisposition] = useState<string>('')

  useEffect(() => {
    const loadInitialData = async () => {
      await loadMetadata()
      
      // Check if editing an existing review
      const state = location.state as { reviewId?: string }
      if (state?.reviewId) {
        try {
          const draftData = await reviewService.loadDraftData(state.reviewId)
          setSubmissionId(state.reviewId)
          
          // Load form data from draft and ensure reviewId is set
          if (draftData.formData) {
            setFormData({
              ...formData,
              ...draftData.formData,
              reviewId: state.reviewId
            })
          } else {
            // If no formData exists, at least set the reviewId
            setFormData({ ...formData, reviewId: state.reviewId })
          }

          // Load previously uploaded artefacts
          const uploadedArtefacts = await artefactService.getReviewArtefacts(state.reviewId)
          
          // Group artefacts by domain - dynamically create keys for all domains found
          const artefactsByDomain: Record<string, Array<{ id?: string; name: string; type: string; fileName: string; file: File | null }>> = {}
          
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
          
          setArtefacts(artefactsByDomain)
        } catch (error) {
          console.error('Error loading draft:', error)
          alert('Failed to load draft data')
        }
      }
      
      setIsLoading(false)
    }
    loadInitialData()
  }, [])

  useEffect(() => {
    if (location.state) {
      setPtxGate(location.state.ptxGate || '')
      setArchitectureDisposition(location.state.architectureDisposition || '')
    }
  }, [location.state])

  useEffect(() => {
    // Load domain-specific metadata when entering a domain step
    if (currentStep >= 2 && currentStep <= domains.length + 1) {
      const domain = getDomainBySeqNumber(currentStep - 1)
      const domainSlug = domain?.slug
      if (domainSlug) {
        // Always load metadata to ensure it's fresh
        loadDomainMetadata(domainSlug)
        // Initialize domain_data for this domain if not exists
        if (!formData.domain_data[domainSlug]) {
          setFormData({
            ...formData,
            domain_data: {
              ...formData.domain_data,
              [domainSlug]: { checklist: {}, evidence: {} }
            }
          })
        }
      }
    }
  }, [currentStep, loadDomainMetadata, domains, getDomainBySeqNumber])
  const [artefacts, setArtefacts] = useState<Record<string, Array<{ id?: string; name: string; type: string; fileName: string; file: File | null }>>>({})
  const [newArtefact, setNewArtefact] = useState<{ domain: string; name: string; type: string; fileName: string; file: File | null }>({
    domain: '',
    name: '',
    type: '',
    fileName: '',
    file: null,
  })
  const [formData, setFormData] = useState({
    reviewId: '',
    solution_name: '',
    scope_tags: [] as string[],
    project_name: '',
    problem_statement: '',
    stakeholders: [] as string[],
    business_drivers: [] as string[],
    growth_plans: '',
    // Dynamic domain data structure
    domain_data: {} as Record<string, {
      checklist: Record<string, string>      // question_code -> answer
      evidence: Record<string, string>       // question_code -> evidence
    }>,
    // NFR criteria (special case)
    nfr_criteria: [] as Array<{ id: string; category: string; criteria: string; target_value: string; actual_value: string; score: number; evidence?: string }>,
  })

  const handleNext = async () => {
    const totalSteps = domains.length + 1
    if (currentStep < totalSteps) {
      // Save draft before moving to next step
      try {
        // Extract scope tags from form data and artefacts
        const scopeTags = reviewService.extractScopeTags(formData, artefacts)
        
        // Ensure form_data includes all required schema fields
        const completeFormData = {
          ...formData,
          solution_name: formData.solution_name || formData.project_name || '',
          scope_tags: scopeTags
        }

        if (!formData.reviewId) {
          // Create new review
          const draftData = {
            solution_name: completeFormData.solution_name,
            scope_tags: scopeTags,
            sa_user_id: user?.id || '',
            form_data: completeFormData
          }
          const response = await reviewService.createDraft(draftData)
          setFormData({ ...formData, reviewId: response.id, scope_tags: scopeTags })
        } else {
          // Update existing review
          const updateData = {
            form_data: completeFormData,
            scope_tags: scopeTags
          }
          await reviewService.updateDraft(formData.reviewId, updateData)
          setFormData({ ...formData, scope_tags: scopeTags })
        }
      } catch (error) {
        console.error('Failed to save draft:', error)
        alert('Failed to save draft. Please try again.')
        return
      }
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSaveDraft = async () => {
    try {
      const scopeTags = reviewService.extractScopeTags(formData, artefacts)
      const solutionName = formData.solution_name || formData.project_name || 'Untitled Review'

      const draftData = {
        solution_name: solutionName,
        scope_tags: scopeTags,
        sa_user_id: user?.id || '',
        form_data: { ...formData, solution_name: solutionName, scope_tags: scopeTags }
      }

      if (submissionId) {
        await reviewService.updateDraft(submissionId, draftData)
      } else {
        const review = await reviewService.createDraft(draftData)
        setSubmissionId(review.id)
      }
      alert('Draft saved successfully')
    } catch (error) {
      console.error('Error saving draft:', error)
      alert(`Failed to save draft: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleSubmit = async () => {
    try {
      // Extract scope tags from form data and artefacts
      const scopeTags = reviewService.extractScopeTags(formData, artefacts)

      // Flatten all artifacts into a single array
      const allArtifacts = Object.values(artefacts).flat()

      if (allArtifacts.length === 0) {
        alert('Please upload at least one artifact before submitting')
        return
      }

      let reviewId = submissionId

      // 1. Ensure form_data includes all required schema fields
      const completeFormData = {
        ...formData,
        reviewId: reviewId || '',
        solution_name: formData.solution_name || formData.project_name,
        scope_tags: scopeTags
      }

      // Create or update review record
      if (reviewId) {
        // Update existing draft/submitted review
        await reviewService.updateDraft(reviewId, {
          solution_name: completeFormData.solution_name,
          scope_tags: scopeTags,
          sa_user_id: user?.id || '',
          form_data: completeFormData,
          status: 'queued'
        })
      } else {
        // Create new review as queued
        const review = await reviewService.createDraft({
          solution_name: completeFormData.solution_name,
          scope_tags: scopeTags,
          sa_user_id: user?.id || '',
          form_data: completeFormData
        })
        reviewId = review.id
        setSubmissionId(reviewId)
        
        // Update status to submitted
        if (reviewId) {
          await reviewService.updateDraft(reviewId, { status: 'submitted' })
        }
      }

      // Guard clause - ensure reviewId is not null
      if (!reviewId) {
        alert('Failed to create review record')
        return
      }

      // 2. Upload all new artifacts using the Python backend
      // Only upload artifacts that have a file (newly selected, not already uploaded)
      const artifactsToUpload = allArtifacts.filter(a => a.file) as Array<{ name: string; type: string; file: File }>
      
      // Upload artifacts per domain
      for (const [domain, domainArtifacts] of Object.entries(artefacts)) {
        const newArtifactsInDomain = domainArtifacts.filter(a => a.file)
        if (newArtifactsInDomain.length > 0) {
          await reviewService.uploadArtefacts(reviewId, newArtifactsInDomain.map(a => ({
            domain: domain,
            name: a.name,
            type: a.type,
            file: a.file!
          })))
        }
      }

      // 3. Validate schema compliance and completeness
      const schemaValidation = validateSubmissionCompleteness(completeFormData, artefacts)

      if (!schemaValidation.isValid) {
        const validationSummary = getValidationSummary(schemaValidation)
        if (confirm(`Schema validation failed:\n\n${validationSummary}\n\nWould you like to save as draft and fix the issues?`)) {
          // Save as draft but don't submit
          await reviewService.updateDraft(reviewId!, {
            form_data: completeFormData,
            status: 'drafting'
          })
          alert('Saved as draft. Please fix the validation errors before submitting.')
          return
        } else {
          return
        }
      }

      // Show warnings if any
      if (schemaValidation.warnings.length > 0) {
        const warningSummary = schemaValidation.warnings.join('\n• ')
        if (!confirm(`Validation warnings detected:\n\n• ${warningSummary}\n\nContinue with submission?`)) {
          return
        }
      }

      // 4. Backend validation (if available)
      try {
        const backendValidation = await reviewService.validateCompleteness(reviewId)
        if (!backendValidation.isComplete) {
          const errorMessage = backendValidation.errors.join('\n')
          if (confirm(`Backend validation failed:\n\n${errorMessage}\n\nWould you like to save as submitted and complete later?`)) {
            alert('Submission saved as submitted. Please complete the missing fields before marking as ready for review.')
            navigate('/dashboard')
          }
          return
        }
      } catch (error) {
        console.warn('Backend validation not available, proceeding with frontend validation only')
      }

      // 4. Save as submitted - review process will be triggered later from dashboard
      alert('Submission saved as submitted. You can mark it as ready for review from the dashboard to trigger the AI review process.')
      navigate('/dashboard')
    } catch (error) {
      console.error('Error submitting:', error)
      alert(`Failed to submit: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const calculateProgress = () => {
    const completedSteps = domains.filter((d: any) => d.seq_number < currentStep).length + 1
    return Math.round((completedSteps / (domains.length + 1)) * 100)
  }

  const getArtefactIcon = (type: string) => {
    const artefactType = artefactTypes.find((t: any) => t.value === type)
    return artefactType?.icon || '📎'
  }

  const getArtefactTypeLabel = (type: string) => {
    const artefactType = artefactTypes.find((t: any) => t.value === type)
    return artefactType?.label || type
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {(ptxGate || architectureDisposition) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ptxGate && (
                    <div>
                      <label className="block text-sm font-medium text-blue-900 mb-1">PTX Gate</label>
                      <p className="text-sm text-blue-800">{ptxGate}</p>
                    </div>
                  )}
                  {architectureDisposition && (
                    <div>
                      <label className="block text-sm font-medium text-blue-900 mb-1">Architecture Disposition</label>
                      <p className="text-sm text-blue-800">{architectureDisposition}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Project Name</label>
              <Input
                value={formData.project_name}
                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                placeholder="Enter project name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Problem Statement</label>
              <Textarea
                value={formData.problem_statement}
                onChange={(e) => setFormData({ ...formData, problem_statement: e.target.value })}
                placeholder="Describe the problem this solution addresses"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Stakeholders</label>
              <Textarea
                value={formData.stakeholders?.join('\n') || ''}
                onChange={(e) => setFormData({ ...formData, stakeholders: e.target.value.split('\n').filter(s => s.trim()) })}
                placeholder="List key stakeholders (one per line)"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Business Drivers</label>
              <Textarea
                value={formData.business_drivers?.join('\n') || ''}
                onChange={(e) => setFormData({ ...formData, business_drivers: e.target.value.split('\n').filter(s => s.trim()) })}
                placeholder="List key business drivers (one per line)"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Growth Plans</label>
              <Textarea
                value={formData.growth_plans}
                onChange={(e) => setFormData({ ...formData, growth_plans: e.target.value })}
                placeholder="Describe growth plans and scalability requirements"
                rows={3}
              />
            </div>
          </div>
        )
      default:
        // Handle all domain steps dynamically (step 2 onwards)
        const domain = getDomainBySeqNumber(currentStep - 1)
        const domainSlug = domain?.slug
        if (!domainSlug) {
          return <div>Domain not found</div>
        }
        const subsections = checklistSubsectionsByDomain[domainSlug] || []
        const artefactTemplates = artefactTemplatesByDomain[domainSlug] || []
        
        // Show loading if metadata hasn't loaded yet
        if (subsections.length === 0 && artefactTemplates.length === 0) {
          return <div className="text-center py-8">Loading domain metadata...</div>
        }
        
        // Check if this is the NFR step (last step)
        const isNFRStep = currentStep === domains.length + 1
        
        return (
          <div className="space-y-6">
            {/* NFR Quantitative Criteria Section - only for NFR step */}
            {isNFRStep && (
              <NFRCriteriaSection
                nfr_criteria={formData.nfr_criteria}
                onChange={(criteria) => setFormData({ ...formData, nfr_criteria: criteria })}
              />
            )}
            
            {/* Artefact Upload Section */}
            <div>
              <label className="block text-sm font-medium mb-4">Artefacts</label>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Artefact Name</label>
                    <select
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      value={newArtefact.name}
                      onChange={(e) => {
                        const selectedArtefact = artefactTemplates?.find(
                          (a: any) => a.name === e.target.value
                        )
                        setNewArtefact({
                          ...newArtefact,
                          name: e.target.value,
                          type: selectedArtefact?.artefact_type?.value || selectedArtefact?.artefact_type_id || '',
                          domain: domainSlug,
                        })
                      }}
                    >
                      <option value="">Select artefact</option>
                      {artefactTemplates?.map((artefact: any) => (
                        <option key={artefact.name} value={artefact.name}>
                          {artefact.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Artefact Type</label>
                    <select
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      value={newArtefact.type}
                      onChange={(e) => setNewArtefact({ ...newArtefact, type: e.target.value })}
                    >
                      <option value="">Select type</option>
                      {artefactTypes.map((type: any) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">File Name</label>
                    <Input
                      placeholder="Enter file name"
                      value={newArtefact.fileName}
                      onChange={(e) => setNewArtefact({ ...newArtefact, fileName: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Upload File</label>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setNewArtefact({ ...newArtefact, file, fileName: file?.name || newArtefact.fileName })
                      }}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    if (newArtefact.name && newArtefact.type && newArtefact.file) {
                      const reviewId = formData.reviewId
                      if (!reviewId) {
                        alert('Please save the draft first by clicking Next before uploading artefacts')
                        return
                      }

                      try {
                        // Check if artefact with same name already exists in this domain
                        const existingArtefactIndex = artefacts[domainSlug]?.findIndex(
                          a => a.name === newArtefact.name
                        )

                        // If exists, delete it first
                        if (existingArtefactIndex !== undefined && existingArtefactIndex >= 0) {
                          const existingArtefact = artefacts[domainSlug][existingArtefactIndex]
                          if (existingArtefact.id) {
                            await artefactService.deleteArtefact(existingArtefact.id)
                          }
                        }

                        const artefactData = {
                          domain: domainSlug,
                          name: newArtefact.name,
                          type: newArtefact.type,
                          file: newArtefact.file
                        }

                        const uploadedArtefacts = await reviewService.uploadArtefacts(reviewId, [artefactData])
                        const uploadedArtefact = uploadedArtefacts[0]

                        // If we overwrote an existing artefact, replace it in the list
                        if (existingArtefactIndex !== undefined && existingArtefactIndex >= 0) {
                          const updatedArtefacts = [...artefacts[domainSlug]]
                          updatedArtefacts[existingArtefactIndex] = {
                            id: uploadedArtefact.id,
                            name: uploadedArtefact.artefact_name,
                            type: uploadedArtefact.artefact_type,
                            fileName: uploadedArtefact.filename,
                            file: null
                          }
                          setArtefacts({
                            ...artefacts,
                            [domainSlug]: updatedArtefacts
                          })
                        } else {
                          // Add as new artefact
                          setArtefacts({
                            ...artefacts,
                            [domainSlug]: [...(artefacts[domainSlug] || []), {
                              id: uploadedArtefact.id,
                              name: uploadedArtefact.artefact_name,
                              type: uploadedArtefact.artefact_type,
                              fileName: uploadedArtefact.filename,
                              file: null
                            }],
                          })
                        }
                        setNewArtefact({ domain: '', name: '', type: '', fileName: '', file: null })
                      } catch (error) {
                        console.error('Failed to upload artefact:', error)
                        alert('Failed to upload artefact. Please try again.')
                      }
                    }
                  }}
                  className="mt-3"
                  size="sm"
                >
                  Add Artefact
                </Button>
              </div>

              {/* Uploaded Artefacts List */}
              {artefacts[domainSlug]?.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium">Uploaded Artefacts</label>
                  {artefacts[domainSlug].map((artefact, index) => (
                    <div key={index} className="flex items-center justify-between bg-white border rounded-md p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getArtefactIcon(artefact.type)}</span>
                        <div>
                          <p className="text-sm font-medium">{artefact.name}</p>
                          <p className="text-xs text-muted-foreground">{artefact.fileName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{getArtefactTypeLabel(artefact.type)}</span>
                        {artefact.id && (
                          <button
                            onClick={async () => {
                              try {
                                await artefactService.deleteArtefact(artefact.id!)
                                setArtefacts({
                                  ...artefacts,
                                  [domainSlug]: artefacts[domainSlug].filter((_, i) => i !== index)
                                })
                              } catch (error) {
                                console.error('Failed to delete artefact:', error)
                                alert('Failed to delete artefact. Please try again.')
                              }
                            }}
                            className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 border-t pt-6">
              <label className="block text-sm font-medium mb-4">Compliance Checklist</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subsections.map((subsection: any, index: number) => {
                  const colors = [
                    'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
                    'from-purple-50 to-purple-100 border-purple-200 hover:border-purple-400',
                    'from-green-50 to-green-100 border-green-200 hover:border-green-400',
                    'from-orange-50 to-orange-100 border-orange-200 hover:border-orange-400',
                    'from-pink-50 to-pink-100 border-pink-200 hover:border-pink-400',
                    'from-cyan-50 to-cyan-100 border-cyan-200 hover:border-cyan-400',
                  ]
                  const colorClass = colors[index % colors.length]

                  return (
                    <div
                      key={subsection.id}
                      onClick={() => {
                        setSelectedSubsection(subsection.name)
                        setIsDialogOpen(true)
                      }}
                      className={`bg-gradient-to-br ${colorClass} border rounded-xl p-5 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold text-gray-800">{subsection.name}</h4>
                        <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
                          <span className="text-sm font-bold text-gray-600">{subsection.questions?.length || 0}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600">questions</p>
                      <div className="mt-3 flex items-center text-xs text-gray-500">
                        <span className="mr-2">Click to expand</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {isDialogOpen && selectedSubsection && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">{selectedSubsection}</h3>
                    <button
                      onClick={() => setIsDialogOpen(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-6">
                    {subsections.find((s: any) => s.name === selectedSubsection)?.questions?.map((question: any) => {
                      const options = questionOptionsByQuestion[question.question_code]?.map((o: any) => o.value) || ['compliant', 'non_compliant', 'partial', 'na']
                      const optionLabels = questionOptionsByQuestion[question.question_code]?.map((o: any) => o.label) || ['Yes', 'No', 'Partial', 'NA']
                      const currentIndex = options.indexOf(formData.domain_data?.[domainSlug]?.checklist?.[question.question_code] as string) || 0

                      return (
                        <div key={question.id} className="border rounded-lg p-4">
                          <p className="font-medium mb-4">{question.question_text}</p>
                          <div className="mb-4">
                            <div className="relative">
                              <input
                                type="range"
                                min="0"
                                max="3"
                                step="1"
                                value={currentIndex}
                                onChange={(e) => {
                                  setFormData({
                                    ...formData,
                                    domain_data: {
                                      ...formData.domain_data,
                                      [domainSlug]: {
                                        ...formData.domain_data?.[domainSlug],
                                        checklist: {
                                          ...formData.domain_data?.[domainSlug]?.checklist,
                                          [question.question_code]: options[parseInt(e.target.value)],
                                        },
                                      },
                                    },
                                  })
                                }}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                              />
                              <div className="flex justify-between mt-2 text-xs text-gray-600">
                                {optionLabels.map((label, index) => (
                                  <span key={label} className={currentIndex === index ? 'font-bold text-primary' : ''}>
                                    {label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <Input
                            placeholder="Evidence notes"
                            value={formData.domain_data?.[domainSlug]?.evidence?.[question.question_code] || ''}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                domain_data: {
                                  ...formData.domain_data,
                                  [domainSlug]: {
                                    ...formData.domain_data?.[domainSlug],
                                    evidence: {
                                      ...formData.domain_data?.[domainSlug]?.evidence,
                                      [question.question_code]: e.target.value,
                                    },
                                  },
                                },
                              })
                            }}
                            className="text-sm"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
    }
  }

  if (isLoading || !domains || domains.length === 0) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ARBHeader
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        progress={calculateProgress()}
        onSaveDraft={handleSaveDraft}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>
              {(() => {
                if (currentStep === 1) {
                  return 'Project Information'
                }
                const domain = getDomainBySeqNumber(currentStep - 1)
                return domain?.name || 'Domain'
              })()}
            </CardTitle>
            <p className="text-muted-foreground">
              {(() => {
                if (currentStep === 1) {
                  return 'Enter project details and business drivers'
                }
                const domain = getDomainBySeqNumber(currentStep - 1)
                return domain?.description || ''
              })()}
            </p>
          </CardHeader>
          <CardContent>
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          {currentStep === domains.length + 1 ? (
            <Button onClick={handleSubmit}>
              <Send className="w-4 h-4 mr-2" />
              Submit for Review
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}
