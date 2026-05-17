import { brand } from '../../brand.config'
import { apiRequest } from './api'
import { artefactService, type ArtefactResponse } from './artefactService'

export type { ArtefactResponse } from './artefactService'

export interface ReviewData {
  solution_name: string
  scope_tags: string[]
  sa_user_id: string
  llm_model?: string
}

export interface DraftData {
  solution_name: string
  scope_tags: string[]
  sa_user_id: string
  form_data?: any
  status?: 'drafting' | 'queued' | 'returned' | 'draft' | 'submitted'
}

export interface ReviewResult {
  success: boolean
  reviewId: string
  report: any
  decision: string
}

export interface ReviewStatus {
  id: string
  status: 'drafting' | 'queued' | 'analysing' | 'review_ready' | 'ea_reviewing' | 'returned' | 'approved' | 'conditionally_approved' | 'deferred' | 'rejected' | 'closed' | string
  decision: string | null
  report_json: any
  domain_scores: any[]
  findings: any[]
  adrs: any[]
  actions: any[]
  submitted_at: string | null
  reviewed_at: string | null
}

export const reviewService = {
  /**
   * Create a new draft review record via Python backend
   */
  async createDraft(data: DraftData) {
    return await apiRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify({
        solution_name: data.solution_name,
        scope_tags: data.scope_tags,
        sa_user_id: data.sa_user_id,
        status: 'drafting',
        report_json: { form_data: data.form_data }
      })
    })
  },

  /**
   * Update an existing draft via Python backend
   */
  async updateDraft(reviewId: string, data: Partial<DraftData>) {
    return await apiRequest(`/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  /**
   * Validate submission completeness
   * Returns validation result with missing fields
   */
  async validateCompleteness(reviewId: string): Promise<{
    isComplete: boolean
    missingFields: string[]
    errors: string[]
  }> {
    // For now, return basic validation
    // This should be implemented in Python backend
    return {
      isComplete: true,
      missingFields: [],
      errors: []
    }
  },

  /**
   * Mark review as ready for review and trigger backend
   */
  async markReadyForReview(reviewId: string): Promise<void> {
    console.log('[FRONTEND] Marking review as ready for review:', reviewId)
    await apiRequest(`/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'submitted' })
    })
    console.log('[FRONTEND] Review status updated to submitted')
  },

  /**
   * Create a new review record via Python backend
   */
  async createReview(data: ReviewData) {
    return await apiRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  /**
   * Upload a single artifact (for compatibility with Supabase interface)
   */
  async uploadArtifact(reviewId: string, file: File) {
    const result = await artefactService.uploadArtefact({
      review_id: reviewId,
      domain_slug: 'solution',
      artefact_name: file.name,
      artefact_type: file.type,
      file
    })
    // Transform to match Supabase return structure
    return {
      path: result.filename,
      fullPath: `${reviewId}/${result.filename}`,
      fileName: result.filename,
      fileType: result.file_type || file.type,
      fileSize: result.file_size_bytes || file.size
    }
  },

  /**
   * Upload artefacts using the new artefact service
   */
  async uploadArtefacts(reviewId: string, artefacts: {
    domain: string
    name: string
    type: string
    file: File
  }[]): Promise<ArtefactResponse[]> {
    return await artefactService.uploadMultipleArtefacts(reviewId, artefacts)
  },

  /**
   * Update review with artifact information (for compatibility with Supabase interface)
   */
  async updateReviewArtifactInfo(reviewId: string, artifactInfo: {
    artifact_path: string
    artifact_filename: string
    artifact_file_type: string
    artifact_file_size_bytes: number
  }) {
    return await apiRequest(`/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(artifactInfo)
    })
  },

  /**
   * Get artefacts for a review
   */
  async getReviewArtefacts(reviewId: string): Promise<ArtefactResponse[]> {
    return await artefactService.getReviewArtefacts(reviewId)
  },

  /**
   * Trigger the review orchestrator via Python backend
   */
  async triggerReviewOrchestrator(reviewId: string): Promise<ReviewResult> {
    console.log('[FRONTEND] Triggering review orchestrator for reviewId:', reviewId)
    try {
      const result = await apiRequest('/agent/review', {
        method: 'POST',
        body: JSON.stringify({ reviewId })
      })
      console.log('[FRONTEND] Review orchestrator triggered successfully:', result)
      return result
    } catch (error) {
      console.error('[FRONTEND] Failed to trigger review orchestrator:', error)
      throw error
    }
  },

  /**
   * Get review status and related data via Python backend
   */
  async getReviewStatus(reviewId: string): Promise<ReviewStatus> {
    const data = await apiRequest(`/reviews/${reviewId}`)
    
    // Backend now returns related data directly
    return {
      id: data.id,
      status: data.status,
      decision: data.decision,
      report_json: data.report_json,
      domain_scores: data.domain_scores || [],
      findings: data.findings || [],
      adrs: data.adrs || [],
      actions: data.actions || [],
      submitted_at: data.submitted_at,
      reviewed_at: data.reviewed_at
    }
  },

  /**
   * Poll for review status updates
   */
  async pollReviewStatus(
    reviewId: string,
    onUpdate: (status: ReviewStatus) => void,
    intervalMs: number = 5000,
    maxAttempts: number = 60
  ): Promise<ReviewStatus> {
    let attempts = 0

    return new Promise((resolve, reject) => {
      const poll = async () => {
        attempts++
        
        try {
          const status = await this.getReviewStatus(reviewId)
          onUpdate(status)
          
          // Stop polling once the agent has finished (success, partial, or failed)
          // or a governance decision has been recorded.
          const terminalStates = [
            'review_ready', 'agent_failed',
            'ea_reviewing', 'ea_review',
            'approved', 'conditionally_approved',
            'rejected', 'deferred', 'closed',
          ]
          if (terminalStates.includes(status.status)) {
            resolve(status)
            return
          }
          
          // If max attempts reached, resolve with current status
          if (attempts >= maxAttempts) {
            resolve(status)
            return
          }
          
          // Continue polling
          setTimeout(poll, intervalMs)
        } catch (error) {
          reject(error)
        }
      }
      
      poll()
    })
  },

  /**
   * Get reviews by user (userId optional for compatibility with Supabase interface)
   */
  async getUserReviews(userId?: string) {
    if (userId) {
      return await apiRequest(`/reviews?user_id=${userId}`)
    }
    // If no userId provided, get all reviews (backend should filter by auth token)
    return await apiRequest('/reviews')
  },

  async getAllReviews() {
    return await apiRequest('/reviews')
  },

  /**
   * Get review by ID with full details via Python backend
   */
  async getReviewById(reviewId: string) {
    return await apiRequest(`/reviews/${reviewId}`)
  },

  /**
   * Load draft data for editing
   */
  async loadDraftData(reviewId: string) {
    const review = await this.getReviewById(reviewId)
    // report_json is { form_data: {...}, ai_review: {...} }
    // Return the inner form_data so the wizard state matches what was saved
    return {
      review,
      formData: review.report_json?.form_data || {}
    }
  },

  /**
   * Extract scope tags from form data and artefacts
   * Maps frontend domain sections and artefact domains to scope tags
   * Uses dynamic domain_data structure and artefact domains
   */
  extractScopeTags(formData: any, artefacts?: Record<string, any[]>): string[] {
    const tags: Set<string> = new Set()
    const VALID_DOMAINS = [
      'solution', 'business', 'application', 'integration',
      'data', 'infrastructure', 'devsecops', 'nfr'
    ]

    // Check for dynamic domain_data structure - add domains with checklist data (new format)
    if (formData.domain_data) {
      Object.keys(formData.domain_data).forEach(domain => {
        // Validate domain name
        if (!VALID_DOMAINS.includes(domain)) {
          console.warn(`Invalid domain '${domain}' found in domain_data, skipping`)
          return
        }

        const domainInfo = formData.domain_data[domain]
        const hasChecklist = domainInfo?.checklist && 
            Object.keys(domainInfo.checklist).length > 0
        const hasEvidence = domainInfo?.evidence && 
            Object.keys(domainInfo.evidence).length > 0
        const hasValidAnswers = hasChecklist && 
            Object.values(domainInfo.checklist).some((answer: any) => 
              answer && ['compliant', 'non_compliant', 'partial', 'na'].includes(answer)
            )

        if (hasChecklist || hasEvidence || hasValidAnswers) {
          tags.add(domain)
        }
      })
    }

    // Check for old format checklist data at root level (backward compatibility)
    Object.keys(formData).forEach(key => {
      if (key.endsWith('_checklist') || key.endsWith('_evidence')) {
        const domain = key.replace(/_(checklist|evidence)$/, '')
        
        // Validate domain name
        if (!VALID_DOMAINS.includes(domain)) {
          console.warn(`Invalid domain '${domain}' found in legacy format, skipping`)
          return
        }

        const data = formData[key]
        if (data && Object.keys(data).length > 0) {
          // For checklist, validate that we have actual compliance answers
          if (key.endsWith('_checklist')) {
            const hasValidAnswers = Object.values(data).some((answer: any) => 
              answer && ['compliant', 'non_compliant', 'partial', 'na'].includes(answer)
            )
            if (hasValidAnswers) {
              tags.add(domain)
            }
          } else {
            // For evidence, any non-empty evidence counts
            tags.add(domain)
          }
        }
      }
    })

    // Add domains from artefacts - if artefacts exist for a domain, include it
    if (artefacts) {
      Object.entries(artefacts).forEach(([domain, domainArtefacts]) => {
        // Validate domain name
        if (!VALID_DOMAINS.includes(domain)) {
          console.warn(`Invalid domain '${domain}' found in artefacts, skipping`)
          return
        }

        if (domainArtefacts && domainArtefacts.length > 0) {
          // Only count domains with successfully uploaded artefacts (have IDs or file data)
          const hasValidArtefacts = domainArtefacts.some((artefact: any) => 
            artefact.id || artefact.file
          )
          if (hasValidArtefacts) {
            tags.add(domain)
          }
        }
      })
    }

    // Special handling for NFR criteria - if any NFR criteria are defined, add 'nfr' tag
    if (formData.nfr_criteria && formData.nfr_criteria.length > 0) {
      const hasValidCriteria = formData.nfr_criteria.some((criterion: any) => 
        criterion.category && criterion.criteria && criterion.target_value
      )
      if (hasValidCriteria) {
        tags.add('nfr')
      }
    }

    // Ensure at least one tag exists for AI review to run
    if (tags.size === 0) {
      console.warn('No valid scope tags found, defaulting to "solution"')
      tags.add('solution')
    }

    // Sort tags for consistency
    const sortedTags = Array.from(tags).sort()

    // Log extraction summary for debugging
    console.log(`Scope tags extracted: [${sortedTags.join(', ')}] from:`, {
      domainDataDomains: Object.keys(formData.domain_data || {}),
      artefactDomains: Object.keys(artefacts || {}),
      nfrCriteriaCount: formData.nfr_criteria?.length || 0
    })

    return sortedTags
  },

  /**
   * Get artifact download URL via Python backend
   */
  async getArtifactDownloadUrl(reviewId: string, fileName: string) {
    return `${brand.apiRoot}/reviews/${reviewId}/artifact/${fileName}`
  },

  async deleteArtefact(artefactId: string, _reviewId?: string) {
    return artefactService.deleteArtefact(artefactId)
  }
}
