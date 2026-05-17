import React, { useEffect, useState } from 'react'
import { useMetadataStore } from '../../stores/metadataStore'
import { useLocation } from 'react-router-dom'
import { reviewService } from '../../services/python/reviewService'

interface DynamicStepContentProps {
  currentStep: number
  formData: any
  setFormData: (data: any) => void
}

export default function DynamicStepContent({ currentStep, formData, setFormData }: DynamicStepContentProps) {
  const { domains, loadDomainMetadata, artefactTemplatesByDomain, checklistSubsectionsByDomain } = useMetadataStore()
  const location = useLocation()
  const [uploading, setUploading] = useState(false)
  
  const ptxGate = location.state?.ptxGate || ''
  const architectureDisposition = location.state?.architectureDisposition || ''

  useEffect(() => {
    // Load domain-specific metadata when entering a domain step
    if (currentStep >= 2 && currentStep <= 8) {
      const domain = domains[currentStep - 2]
      if (domain && !artefactTemplatesByDomain[domain.slug]) {
        loadDomainMetadata(domain.slug)
      }
    }
    // Load NFR metadata for step 9
    if (currentStep === 9 && !artefactTemplatesByDomain['nfr']) {
      loadDomainMetadata('nfr')
    }
  }, [currentStep, domains, artefactTemplatesByDomain, loadDomainMetadata])

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <SolutionContextStep formData={formData} setFormData={setFormData} ptxGate={ptxGate} architectureDisposition={architectureDisposition} />
      case 9:
        return <NFRStep formData={formData} setFormData={setFormData} artefactTemplates={artefactTemplatesByDomain['nfr'] || []} checklistSubsections={checklistSubsectionsByDomain['nfr'] || []} uploading={uploading} setUploading={setUploading} />
      default:
        const domain = domains[currentStep - 2]
        if (!domain) return null
        return (
          <DomainStep 
            domain={domain}
            formData={formData}
            setFormData={setFormData}
            artefactTemplates={artefactTemplatesByDomain[domain.slug] || []}
            checklistSubsections={checklistSubsectionsByDomain[domain.slug] || []}
            uploading={uploading}
            setUploading={setUploading}
          />
        )
    }
  }

  return <div className="space-y-6">{renderStepContent()}</div>
}

// Solution Context Step Component
function SolutionContextStep({ formData, setFormData, ptxGate, architectureDisposition }: any) {
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
        <input
          type="text"
          value={formData.project_name || ''}
          onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
          placeholder="Enter project name"
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Problem Statement</label>
        <textarea
          value={formData.problem_statement || ''}
          onChange={(e) => setFormData({ ...formData, problem_statement: e.target.value })}
          placeholder="Describe the problem this solution addresses"
          rows={4}
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Stakeholders</label>
        <textarea
          value={(formData.stakeholders || []).join('\n')}
          onChange={(e) => setFormData({ ...formData, stakeholders: e.target.value.split('\n').filter(s => s.trim()) })}
          placeholder="List key stakeholders (one per line)"
          rows={4}
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Business Drivers</label>
        <textarea
          value={(formData.business_drivers || []).join('\n')}
          onChange={(e) => setFormData({ ...formData, business_drivers: e.target.value.split('\n').filter(s => s.trim()) })}
          placeholder="List business drivers (one per line)"
          rows={4}
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Growth Plans</label>
        <textarea
          value={formData.growth_plans || ''}
          onChange={(e) => setFormData({ ...formData, growth_plans: e.target.value })}
          placeholder="Describe growth plans and scalability requirements"
          rows={3}
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>
    </div>
  )
}

// NFR Step Component
function NFRStep({ formData, setFormData, artefactTemplates, checklistSubsections, uploading, setUploading }: any) {
  return (
    <div className="space-y-6">
      <ArtefactUploadSection 
        domain="nfr"
        artefactTemplates={artefactTemplates}
        formData={formData}
        setFormData={setFormData}
        uploading={uploading}
        setUploading={setUploading}
      />
      <ComplianceChecklistSection 
        domain="nfr"
        subsections={checklistSubsections}
        formData={formData}
        setFormData={setFormData}
      />
    </div>
  )
}

// Domain Step Component
function DomainStep({ domain, formData, setFormData, artefactTemplates, checklistSubsections, uploading, setUploading }: any) {
  return (
    <div className="space-y-6">
      <ArtefactUploadSection 
        domain={domain.slug}
        artefactTemplates={artefactTemplates}
        formData={formData}
        setFormData={setFormData}
        uploading={uploading}
        setUploading={setUploading}
      />
      <ComplianceChecklistSection 
        domain={domain.slug}
        subsections={checklistSubsections}
        formData={formData}
        setFormData={setFormData}
      />
    </div>
  )
}

// Artefact Upload Section Component
function ArtefactUploadSection({ domain, artefactTemplates, formData, setFormData, uploading, setUploading }: any) {
  return (
    <div>
      <label className="block text-sm font-medium mb-4">Artefacts</label>
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Artefact Name</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={formData.newArtefact?.name || ''}
              onChange={(e) => {
                const selectedTemplate = artefactTemplates.find((t: any) => t.name === e.target.value)
                setFormData({
                  ...formData,
                  newArtefact: {
                    ...formData.newArtefact,
                    name: e.target.value,
                    type: selectedTemplate?.artefact_type?.value || '',
                    domain,
                  }
                })
              }}
            >
              <option value="">Select artefact</option>
              {artefactTemplates.map((template: any) => (
                <option key={template.id} value={template.name}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Artefact Type</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={formData.newArtefact?.type || ''}
              onChange={(e) => setFormData({
                ...formData,
                newArtefact: { ...formData.newArtefact, type: e.target.value }
              })}
            >
              <option value="">Select type</option>
              <option value="t-doc">Doc</option>
              <option value="t-diag">Diagram</option>
              <option value="t-xls">Sheet</option>
              <option value="t-deck">Deck</option>
              <option value="t-log">Log</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">File Name</label>
            <input
              type="text"
              placeholder="Enter file name"
              value={formData.newArtefact?.fileName || ''}
              onChange={(e) => setFormData({
                ...formData,
                newArtefact: { ...formData.newArtefact, fileName: e.target.value }
              })}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Upload File</label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                setFormData({
                  ...formData,
                  newArtefact: { 
                    ...formData.newArtefact, 
                    file, 
                    fileName: file?.name || formData.newArtefact?.fileName 
                  }
                })
              }}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>
        <button
          onClick={async () => {
            if (formData.newArtefact?.name && formData.newArtefact?.type && formData.newArtefact?.file) {
              setUploading(true)
              try {
                // Upload artefact to backend
                const reviewId = formData.reviewId
                if (!reviewId) {
                  alert('Please save the draft first before uploading artefacts')
                  setUploading(false)
                  return
                }

                const artefactData = {
                  domain: domain,
                  name: formData.newArtefact.name,
                  type: formData.newArtefact.type,
                  file: formData.newArtefact.file
                }

                await reviewService.uploadArtefacts(reviewId, [artefactData])

                // Add to local state after successful upload
                const currentArtefacts = formData.artefacts?.[domain] || []
                setFormData({
                  ...formData,
                  artefacts: {
                    ...formData.artefacts,
                    [domain]: [...currentArtefacts, formData.newArtefact]
                  },
                  newArtefact: { domain: '', name: '', type: '', fileName: '', file: null }
                })
              } catch (error) {
                console.error('Failed to upload artefact:', error)
                alert('Failed to upload artefact. Please try again.')
              } finally {
                setUploading(false)
              }
            }
          }}
          disabled={uploading}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-400"
        >
          {uploading ? 'Uploading...' : 'Add Artefact'}
        </button>
      </div>

      {/* Uploaded Artefacts List */}
      {formData.artefacts?.[domain]?.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium">Uploaded Artefacts</label>
          {formData.artefacts[domain].map((artefact: any, index: number) => (
            <div key={index} className="flex items-center justify-between bg-white border rounded-md p-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">{getArtefactIcon(artefact.type)}</span>
                <div>
                  <p className="text-sm font-medium">{artefact.name}</p>
                  <p className="text-xs text-gray-500">{artefact.fileName}</p>
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{getArtefactTypeLabel(artefact.type)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Compliance Checklist Section Component
function ComplianceChecklistSection({ domain, subsections, formData, setFormData }: any) {
  const [selectedSubsection, setSelectedSubsection] = React.useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const colors = [
    'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-400',
    'from-purple-50 to-purple-100 border-purple-200 hover:border-purple-400',
    'from-green-50 to-green-100 border-green-200 hover:border-green-400',
    'from-orange-50 to-orange-100 border-orange-200 hover:border-orange-400',
    'from-pink-50 to-pink-100 border-pink-200 hover:border-pink-400',
    'from-cyan-50 to-cyan-100 border-cyan-200 hover:border-cyan-400',
  ]

  return (
    <div className="mt-8 border-t pt-6">
      <label className="block text-sm font-medium mb-4">Compliance Checklist</label>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subsections.map((subsection: any, index: number) => (
          <div
            key={subsection.id}
            onClick={() => {
              setSelectedSubsection(subsection)
              setIsDialogOpen(true)
            }}
            className={`bg-gradient-to-br ${colors[index % colors.length]} border rounded-xl p-5 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200`}
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
        ))}
      </div>

      {isDialogOpen && selectedSubsection && (
        <QuestionDialog 
          subsection={selectedSubsection}
          domain={domain}
          formData={formData}
          setFormData={setFormData}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </div>
  )
}

// Question Dialog Component
function QuestionDialog({ subsection, domain, formData, setFormData, onClose }: any) {
  const { questionOptions } = useMetadataStore()
  
  const options = questionOptions.length > 0 
    ? questionOptions.map(qo => qo.option_value)
    : ['compliant', 'non_compliant', 'partial', 'na']
  
  const optionLabels = questionOptions.length > 0
    ? questionOptions.map(qo => qo.option_label)
    : ['Yes', 'No', 'Partial', 'NA']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{subsection.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="space-y-6">
          {subsection.questions?.map((question: any) => {
            const currentAnswer = formData.domain_data?.[domain]?.checklist?.[question.question_code]
            const currentIndex = options.indexOf(currentAnswer) >= 0 ? options.indexOf(currentAnswer) : 0

            return (
              <div key={question.id} className="border rounded-lg p-4">
                <p className="font-medium mb-4">{question.question_text}</p>
                <div className="mb-4">
                  <input
                    type="range"
                    min="0"
                    max={options.length - 1}
                    step="1"
                    value={currentIndex}
                    onChange={(e) => {
                      const answer = options[parseInt(e.target.value)]
                      setFormData({
                        ...formData,
                        domain_data: {
                          ...formData.domain_data,
                          [domain]: {
                            ...formData.domain_data?.[domain],
                            checklist: {
                              ...formData.domain_data?.[domain]?.checklist,
                              [question.question_code]: answer,
                            },
                          },
                        },
                      })
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between mt-2 text-xs text-gray-600">
                    {optionLabels.map((label, index) => (
                      <span key={label} className={currentIndex === index ? 'font-bold text-blue-600' : ''}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Evidence notes"
                  value={formData.domain_data?.[domain]?.evidence?.[question.question_code] || ''}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      domain_data: {
                        ...formData.domain_data,
                        [domain]: {
                          ...formData.domain_data?.[domain],
                          evidence: {
                            ...formData.domain_data?.[domain]?.evidence,
                            [question.question_code]: e.target.value,
                          },
                        },
                      },
                    })
                  }}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Helper functions
function getArtefactIcon(type: string) {
  const icons: Record<string, string> = {
    't-doc': '📄',
    't-diag': '🗺️',
    't-xls': '📊',
    't-deck': '🗺️',
    't-log': '📋',
  }
  return icons[type] || '📄'
}

function getArtefactTypeLabel(type: string) {
  const labels: Record<string, string> = {
    't-doc': 'Doc',
    't-diag': 'Diagram',
    't-xls': 'Sheet',
    't-deck': 'Deck',
    't-log': 'Log',
  }
  return labels[type] || type
}
