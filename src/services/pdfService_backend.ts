import { reviewService } from './backendConfig'
import { toARBRef } from '../utils/reviewRef'
import { brand } from '../brand.config'

interface ReviewData {
  id: string
  solution_name: string
  status: string
  decision?: string
  submitted_at?: string
  reviewed_at?: string
  aggregate_rag_score?: number
  recommended_decision?: string
  decision_rationale?: string
  ea_user_id?: string
  ea_override_notes?: string
  ea_overridden_at?: string
  sa_user_id?: string
  scope_tags?: string[]
  artifact_filename?: string
  domain_summaries?: Record<string, DomainSummary>
  adrs?: any[]
  actions?: any[]
  findings?: any[]
  report_json?: any
}

interface DomainSummary {
  score: number
  rag_label: string
  total_findings: number
  blocker_count: number
  critical_count: number
  action_count: number
  adr_count: number
  findings: any[]
  actions: any[]
  adrs: any[]
  recommendations: any[]
}

export async function generateARBReportPDF(review: ReviewData): Promise<void> {
  try {
    // Call the backend PDF generation endpoint
    const response = await fetch(`${brand.apiRoot}/reviews/${review.id}/dossier/pdf`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to generate PDF: ${response.statusText}`)
    }

    // Get the PDF blob
    const pdfBlob = await response.blob()
    
    // Generate filename
    const arbRef = toARBRef(review.id, review.submitted_at || review.reviewed_at)
    const filename = `${arbRef}-${review.solution_name?.replace(/\s+/g, '_') || 'Dossier'}-${new Date().toISOString().split('T')[0]}.pdf`
    
    // Create download link and trigger download
    const url = window.URL.createObjectURL(pdfBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw error
  }
}
