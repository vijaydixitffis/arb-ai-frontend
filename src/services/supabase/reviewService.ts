import { supabase } from './supabase'

// Helper function to ensure Supabase is available
const ensureSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set VITE_BACKEND_TYPE=supabase and provide Supabase credentials.')
  }
  return supabase
}

export interface ArtefactResponse {
  id: string
  review_id: string
  domain_slug: string
  artefact_name: string
  artefact_type: string
  filename: string
  file_type?: string
  file_size_bytes?: number
  uploaded_at: string
  is_active: boolean
}

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
   * Create a new draft review record in Supabase
   */
  async createDraft(data: DraftData) {
    const { data: review, error } = await ensureSupabase()
      .from('reviews')
      .insert({
        solution_name: data.solution_name,
        scope_tags: data.scope_tags,
        sa_user_id: data.sa_user_id,
        status: 'drafting',
        llm_model: 'gemini-2.5-flash-lite',
        report_json: { form_data: data.form_data }
      })
      .select()
      .single()

    if (error) throw error
    return review
  },

  /**
   * Update an existing draft
   */
  async updateDraft(reviewId: string, data: Partial<DraftData>) {
    const updateData: any = {}
    
    if (data.solution_name) updateData.solution_name = data.solution_name
    if (data.scope_tags) updateData.scope_tags = data.scope_tags
    if (data.status) updateData.status = data.status
    if (data.form_data) {
      // Preserve existing form_data and merge with new data
      const { data: existingReview } = await ensureSupabase()
        .from('reviews')
        .select('report_json')
        .eq('id', reviewId)
        .single()
      
      const existingFormData = existingReview?.report_json?.form_data || {}
      updateData.report_json = { 
        ...existingReview?.report_json, 
        form_data: { ...existingFormData, ...data.form_data } 
      }
    }

    const { data: review, error } = await ensureSupabase()
      .from('reviews')
      .update(updateData)
      .eq('id', reviewId)
      .select()
      .maybeSingle()

    if (error) throw error
    return review
  },

  /**
   * Validate submission completeness
   * Returns validation result with missing fields
   * 
   * Requirements:
   * - At least 1 domain must be selected (scope_tags)
   * - At least 1 artefact must be uploaded
   * - Checklists are optional (user can choose to fill or skip)
   */
  async validateCompleteness(reviewId: string): Promise<{
    isComplete: boolean
    missingFields: string[]
    errors: string[]
  }> {
    const { data: review, error } = await ensureSupabase()
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .single()

    if (error) throw error

    const missingFields: string[] = []
    const errors: string[] = []

    // Check if any artefacts have been uploaded (from artefacts table)
    const { data: artefacts, error: artefactError } = await ensureSupabase()
      .from('artefacts')
      .select('id')
      .eq('review_id', reviewId)
      .eq('is_active', true)

    if (!artefactError && (!artefacts || artefacts.length === 0)) {
      missingFields.push('artifact')
      errors.push('At least one artifact must be uploaded')
    }

    // Check if scope tags are present (at least 1 domain selected)
    if (!review.scope_tags || review.scope_tags.length === 0) {
      missingFields.push('scope_tags')
      errors.push('At least one domain must be selected')
    }

    // Check form data completeness
    const formData = review.report_json?.form_data || {}
    
    // Check required fields (support both old and new formats, and top-level solution_name column)
    if (!formData.project_name && !formData.solution_name && !review.solution_name) {
      missingFields.push('project_name')
      errors.push('Project name is required')
    }

    // Note: Checklists are now optional - no validation required

    return {
      isComplete: missingFields.length === 0,
      missingFields,
      errors
    }
  },

  /**
   * Validate and queue a review for processing (does NOT await the orchestrator).
   * Call triggerReviewOrchestrator separately as fire-and-forget.
   */
  async markReadyForReview(reviewId: string): Promise<void> {
    const validation = await this.validateCompleteness(reviewId)

    if (!validation.isComplete) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
    }

    const { error: updateError } = await ensureSupabase()
      .from('reviews')
      .update({
        status: 'queued',
        submitted_at: new Date().toISOString()
      })
      .eq('id', reviewId)

    if (updateError) throw updateError
  },

  /**
   * Create a new review record in Supabase (for direct submission)
   */
  async createReview(data: ReviewData) {
    const { data: review, error } = await ensureSupabase()
      .from('reviews')
      .insert({
        solution_name: data.solution_name,
        scope_tags: data.scope_tags,
        sa_user_id: data.sa_user_id,
        status: 'queued',
        llm_model: data.llm_model || 'gemini-2.5-flash-lite'
      })
      .select()
      .single()

    if (error) throw error
    return review
  },

  /**
   * Upload artifact to Supabase Storage
   */
  async uploadArtifact(reviewId: string, file: File) {
    const filePath = `${reviewId}/${file.name}`
    
    const { data, error } = await ensureSupabase()
      .storage
      .from('review-artifacts')
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type
      })

    if (error) throw error

    return {
      path: data?.path,
      fullPath: `${reviewId}/${file.name}`,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    }
  },

  /**
   * Update review with artifact information
   */
  async updateReviewArtifactInfo(reviewId: string, artifactInfo: {
    artifact_path: string
    artifact_filename: string
    artifact_file_type: string
    artifact_file_size_bytes: number
  }) {
    // Artifact metadata is stored in report_json.artefact_uploads — no direct columns exist
    const { data: existing } = await ensureSupabase()
      .from('reviews')
      .select('report_json')
      .eq('id', reviewId)
      .single()

    const currentJson = existing?.report_json || {}
    const uploads = currentJson.artefact_uploads || []
    uploads.push({
      file_name: artifactInfo.artifact_filename,
      storage_path: artifactInfo.artifact_path,
      file_type: artifactInfo.artifact_file_type,
      file_size_bytes: artifactInfo.artifact_file_size_bytes,
      uploaded_at: new Date().toISOString(),
      is_active: true
    })

    const { error } = await ensureSupabase()
      .from('reviews')
      .update({ report_json: { ...currentJson, artefact_uploads: uploads } })
      .eq('id', reviewId)

    if (error) throw error
  },

  /**
   * Trigger the review-orchestrator edge function
   */
  async triggerReviewOrchestrator(reviewId: string): Promise<ReviewResult> {
    const { data, error } = await ensureSupabase().functions.invoke('review-orchestrator', {
      body: { reviewId }
    })

    if (error) throw error
    return data as ReviewResult
  },

  /**
   * Get review status and related data
   */
  async getReviewStatus(reviewId: string): Promise<ReviewStatus> {
    const { data: review, error: reviewError } = await ensureSupabase()
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .single()

    if (reviewError) throw reviewError

    // Fetch related data in parallel
    const [domainScores, findings, adrs, actions] = await Promise.all([
      ensureSupabase().from('domain_scores').select('*').eq('review_id', reviewId),
      ensureSupabase().from('findings').select('*').eq('review_id', reviewId),
      ensureSupabase().from('adrs').select('*').eq('review_id', reviewId),
      ensureSupabase().from('actions').select('*').eq('review_id', reviewId)
    ])

    return {
      id: review.id,
      status: review.status,
      decision: review.decision,
      report_json: review.report_json,
      domain_scores: domainScores.data || [],
      findings: findings.data || [],
      adrs: adrs.data || [],
      actions: actions.data || [],
      submitted_at: review.submitted_at,
      reviewed_at: review.reviewed_at
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

          // Check if review is complete
          if (['review_ready', 'ea_reviewing', 'approved', 'conditionally_approved', 'rejected', 'deferred', 'closed'].includes(status.status)) {
            resolve(status)
            return
          }

          // Check if max attempts reached
          if (attempts >= maxAttempts) {
            reject(new Error('Polling timeout: Review did not complete in time'))
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
   * Get all reviews for current user (userId optional for compatibility with Python interface)
   */
  async getUserReviews(userId?: string) {
    const { data: { user: supabaseUser } } = await ensureSupabase().auth.getUser()
    
    const targetUserId = userId || supabaseUser?.id
    
    if (!targetUserId) {
      return []
    }
    
    const { data, error } = await ensureSupabase()
      .from('reviews')
      .select('*')
      .eq('sa_user_id', targetUserId)

    if (error) throw error
    return data
  },

  async getAllReviews() {
    const { data, error } = await ensureSupabase()
      .from('reviews')
      .select('*')

    if (error) throw error
    return data
  },

  /**
   * Get review by ID with full details including related table data
   */
  async getReviewById(reviewId: string) {
    const { data, error } = await ensureSupabase()
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .single()

    if (error) throw error

    const [blockers, actions, adrs, nfrScorecard, domainScores] = await Promise.all([
      ensureSupabase().from('blockers').select('*').eq('review_id', reviewId),
      ensureSupabase().from('actions').select('*').eq('review_id', reviewId),
      ensureSupabase().from('adrs').select('*').eq('review_id', reviewId),
      ensureSupabase().from('nfr_scorecard').select('*').eq('review_id', reviewId),
      ensureSupabase().from('domain_scores').select('*').eq('review_id', reviewId),
    ])

    return {
      ...data,
      blockers:      blockers.data      || [],
      actions:       actions.data       || [],
      adrs:          adrs.data          || [],
      nfr_scorecard: nfrScorecard.data  || [],
      domain_scores: domainScores.data  || [],
    }
  },

  /**
   * Load draft data for editing
   */
  async loadDraftData(reviewId: string) {
    const review = await this.getReviewById(reviewId)
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
   * Get artifact download URL
   */
  async getArtifactDownloadUrl(reviewId: string, fileName: string) {
    const { data, error } = await ensureSupabase()
      .storage
      .from('review-artifacts')
      .createSignedUrl(`${reviewId}/${fileName}`, 3600) // 1 hour expiry

    if (error) throw error
    return data.signedUrl
  },

  /**
   * Upload domain-specific artefacts to Supabase Storage and track metadata in
   * report_json.artefact_uploads so the edge function can read them.
   */
  async uploadArtefacts(
    reviewId: string,
    artefacts: { domain: string; name: string; type: string; file: File }[]
  ): Promise<ArtefactResponse[]> {
    const results: ArtefactResponse[] = []

    for (const artefact of artefacts) {
      const artefactId = crypto.randomUUID()
      const safeName = artefact.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${reviewId}/${artefact.domain}/${safeName}`
      const uploadedAt = new Date().toISOString()

      const { error: storageError } = await ensureSupabase()
        .storage
        .from('review-artifacts')
        .upload(storagePath, artefact.file, { upsert: true, contentType: artefact.file.type })

      if (storageError) throw storageError

      // Merge new entry into report_json.artefact_uploads
      const { data: existing, error: fetchError } = await ensureSupabase()
        .from('reviews')
        .select('report_json')
        .eq('id', reviewId)
        .single()

      if (fetchError) throw fetchError

      const existingUploads: any[] = existing.report_json?.artefact_uploads ?? []
      const newEntry = {
        artefact_id:      artefactId,
        file_name:        artefact.file.name,
        artefact_name:    artefact.name,
        artefact_category: artefact.type,
        domain_tags:      [artefact.domain],
        storage_path:     storagePath,
        file_type:        artefact.file.type,
        file_size_bytes:  artefact.file.size,
        parsed_text:      null,
        parse_status:     'pending',
        uploaded_at:      uploadedAt,
        is_active:        true,
      }

      // Insert into artefacts table
      const { error: artefactInsertError } = await ensureSupabase()
        .from('artefacts')
        .insert({
          id: artefactId,
          review_id: reviewId,
          domain_slug: artefact.domain,
          artefact_name: artefact.name,
          artefact_type: artefact.type,
          filename: artefact.file.name,
          storage_path: storagePath,
          file_type: artefact.file.type,
          file_size_bytes: artefact.file.size,
          is_active: true,
        })

      if (artefactInsertError) throw artefactInsertError

      // Also update report_json.artefact_uploads for backward compatibility
      const { error: updateError } = await ensureSupabase()
        .from('reviews')
        .update({ report_json: { ...existing.report_json, artefact_uploads: [...existingUploads, newEntry] } })
        .eq('id', reviewId)

      if (updateError) throw updateError

      results.push({
        id:            artefactId,
        review_id:     reviewId,
        domain_slug:   artefact.domain,
        artefact_name: artefact.name,
        artefact_type: artefact.type,
        filename:      artefact.file.name,
        file_type:     artefact.file.type,
        file_size_bytes: artefact.file.size,
        uploaded_at:   uploadedAt,
        is_active:     true,
      })
    }

    return results
  },

  /**
   * List all active artefacts for a review, read from the artefacts table.
   */
  async getReviewArtefacts(reviewId: string): Promise<ArtefactResponse[]> {
    const { data: artefacts, error } = await ensureSupabase()
      .from('artefacts')
      .select('*')
      .eq('review_id', reviewId)
      .eq('is_active', true)

    if (error) throw error

    return artefacts.map((a: any) => ({
      id:            a.id,
      review_id:     a.review_id,
      domain_slug:   a.domain_slug,
      artefact_name: a.artefact_name,
      artefact_type: a.artefact_type,
      filename:      a.filename,
      file_type:     a.file_type,
      file_size_bytes: a.file_size_bytes,
      uploaded_at:   a.created_at,
      is_active:     a.is_active,
    }))
  },

  /**
   * Soft-delete an artefact by marking it inactive in both the artefacts table
   * and report_json.artefact_uploads.
   * reviewId is required for the Supabase backend to locate the record.
   */
  async deleteArtefact(artefactId: string, reviewId: string): Promise<void> {
    // Mark as inactive in artefacts table
    const { error: artefactUpdateError } = await ensureSupabase()
      .from('artefacts')
      .update({ is_active: false })
      .eq('id', artefactId)
      .eq('review_id', reviewId)

    if (artefactUpdateError) throw artefactUpdateError

    // Also mark as inactive in report_json.artefact_uploads for backward compatibility
    const { data: review, error: fetchError } = await ensureSupabase()
      .from('reviews')
      .select('report_json')
      .eq('id', reviewId)
      .single()

    if (fetchError) throw fetchError

    const uploads: any[] = review.report_json?.artefact_uploads ?? []
    const updated = uploads.map(u =>
      u.artefact_id === artefactId ? { ...u, is_active: false } : u
    )

    const { error: updateError } = await ensureSupabase()
      .from('reviews')
      .update({ report_json: { ...review.report_json, artefact_uploads: updated } })
      .eq('id', reviewId)

    if (updateError) throw updateError
  }
}
