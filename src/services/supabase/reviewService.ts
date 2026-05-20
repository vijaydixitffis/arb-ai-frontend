import { supabase } from './supabase'

// Helper function to ensure Supabase is available
const ensureSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set VITE_BACKEND_TYPE=supabase and provide Supabase credentials.')
  }
  return supabase
}

// ── Domain short-code normalisation (LLM outputs "SOL", "APP" etc.) ──────────
const DOMAIN_CODE_TO_SLUG: Record<string, string> = {
  SOL: 'solution', BUS: 'business', APP: 'application',
  INT: 'integration', DAT: 'data', INF: 'infrastructure',
  DSO: 'devsecops', NFR: 'nfr',
}
const LEGACY_SLUG_MAP: Record<string, string> = {
  infra:        'infrastructure',
  security:     'infrastructure',
  engg_quality: 'devsecops',
  software:     'application',
  api:          'integration',
}
function normSlug(v: string | null | undefined): string {
  if (!v) return ''
  return DOMAIN_CODE_TO_SLUG[v.toUpperCase()] ?? LEGACY_SLUG_MAP[v.toLowerCase()] ?? v
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
  tokensUsed?: number
  hasDomainErrors?: boolean
  failedDomains?: string[]
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

    const { data: artefacts, error: artefactError } = await ensureSupabase()
      .from('artefacts')
      .select('id')
      .eq('review_id', reviewId)
      .eq('is_active', true)

    if (!artefactError && (!artefacts || artefacts.length === 0)) {
      missingFields.push('artifact')
      errors.push('At least one artifact must be uploaded')
    }

    if (!review.scope_tags || review.scope_tags.length === 0) {
      missingFields.push('scope_tags')
      errors.push('At least one domain must be selected')
    }

    const formData = review.report_json?.form_data || {}
    if (!formData.project_name && !formData.solution_name && !review.solution_name) {
      missingFields.push('project_name')
      errors.push('Project name is required')
    }

    return {
      isComplete: missingFields.length === 0,
      missingFields,
      errors
    }
  },

  /**
   * Validate and queue a review for processing
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
   * Trigger the review-orchestrator edge function.
   * Pass retryDomains to re-run only specific failed domains without touching other domains' results.
   */
  async triggerReviewOrchestrator(reviewId: string, retryDomains?: string[]): Promise<ReviewResult> {
    const body: Record<string, unknown> = { reviewId }
    if (retryDomains && retryDomains.length > 0) body.retryDomains = retryDomains

    const { data, error } = await ensureSupabase().functions.invoke('review-orchestrator', { body })

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

          if (attempts >= maxAttempts) {
            reject(new Error('Polling timeout: Review did not complete in time'))
            return
          }

          setTimeout(poll, intervalMs)
        } catch (error) {
          reject(error)
        }
      }

      poll()
    })
  },

  /**
   * Get all reviews for current user
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
   * Get review by ID with full dossier data, structured to match the Python
   * backend response shape (domain_summaries, normalised domain slugs, etc.)
   */
  async getReviewById(reviewId: string) {
    const { data, error } = await ensureSupabase()
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .single()

    if (error) throw error

    const [blockers, actions, adrs, nfrScorecard, domainScores, findings, eaReview] = await Promise.all([
      ensureSupabase().from('blockers').select('*').eq('review_id', reviewId),
      ensureSupabase().from('actions').select('*').eq('review_id', reviewId),
      ensureSupabase().from('adrs').select('*').eq('review_id', reviewId),
      ensureSupabase().from('nfr_scorecard').select('*').eq('review_id', reviewId),
      ensureSupabase().from('domain_scores').select('*').eq('review_id', reviewId),
      ensureSupabase().from('findings').select('*').eq('review_id', reviewId),
      ensureSupabase().from('ea_review').select('*').eq('review_id', reviewId).maybeSingle(),
    ])

    // Normalise domain short-codes (e.g. "SOL" → "solution") on every item
    const actionsList  = (actions.data  || []).map((a: any) => ({ ...a, _domainSlug: normSlug(a.domain), domain_slug: normSlug(a.domain) }))
    const adrsList     = (adrs.data     || []).map((a: any) => ({ ...a, _domainSlug: normSlug(a.domain), domain_slug: normSlug(a.domain) }))
    const findingsList = (findings.data || []).map((f: any) => ({ ...f, domain_slug: normSlug(f.domain) }))
    const scoresList   = domainScores.data || []

    // Group by normalised slug — mirrors the Python backend's _group() logic
    const _group = (items: any[]) => {
      const grouped: Record<string, any[]> = {}
      for (const item of items) {
        const slug = normSlug(item.domain)
        if (slug) { grouped[slug] = grouped[slug] || []; grouped[slug].push(item) }
      }
      return grouped
    }

    const findingsByDomain = _group(findingsList)
    const actionsByDomain  = _group(actionsList)
    const adrsByDomain     = _group(adrsList)

    // AI review summaries from report_json, keyed by normalised slug
    const rawAiSums = data.report_json?.ai_review?.domain_summaries || {}
    const aiSums: Record<string, any> = {}
    for (const [k, v] of Object.entries(rawAiSums)) {
      aiSums[normSlug(k)] = v
    }

    // Collect all domain slugs across every data source
    const allSlugs = new Set<string>([
      ...scoresList.map((s: any) => normSlug(s.domain)),
      ...Object.keys(findingsByDomain),
      ...Object.keys(actionsByDomain),
      ...Object.keys(adrsByDomain),
      ...Object.keys(aiSums),
    ].filter(Boolean))

    // Build domain_summaries in the same shape the Python backend returns
    const domainSummaries: Record<string, any> = {}
    for (const slug of allSlugs) {
      const scoreRow = scoresList.find((s: any) => normSlug(s.domain) === slug)
      const score    = scoreRow?.score ?? aiSums[slug]?.rag_score ?? 3
      const f_list   = findingsByDomain[slug] || []
      const a_list   = actionsByDomain[slug]  || []
      const r_list   = adrsByDomain[slug]     || []
      const ai_sum   = aiSums[slug]           || {}

      domainSummaries[slug] = {
        score:             parseInt(score),
        rag_label:         score >= 4 ? 'GREEN' : score === 3 ? 'AMBER' : 'RED',
        total_findings:    f_list.length,
        blocker_count:     f_list.filter((f: any) => (f.rag_score || 5) <= 1).length,
        critical_count:    f_list.filter((f: any) => (f.rag_score || 5) <= 2).length,
        action_count:      a_list.length,
        adr_count:         r_list.length,
        findings:          [...f_list].sort((a, b) => (a.rag_score || 3) - (b.rag_score || 3)),
        actions:           a_list,
        adrs:              r_list,
        executive_summary: ai_sum.executive_summary ?? ai_sum.rationale,
        compliant_areas:   ai_sum.compliant_areas,
        gap_areas:         ai_sum.gap_areas,
        evidence_quality:  ai_sum.evidence_quality,
        domain_specific_scores: ai_sum.domain_specific_scores,
      }
    }

    return {
      ...data,
      blockers:         blockers.data || [],
      actions:          actionsList,
      adrs:             adrsList,
      nfr_scorecard:    nfrScorecard.data  || [],
      domain_scores:    scoresList,
      domain_summaries: Object.keys(domainSummaries).length > 0 ? domainSummaries : undefined,
      ea_review:        eaReview.data ?? null,
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
   */
  extractScopeTags(formData: any, artefacts?: Record<string, any[]>): string[] {
    const tags: Set<string> = new Set()

    if (formData.domain_data) {
      Object.keys(formData.domain_data).forEach(domain => {
        const domainInfo = formData.domain_data[domain]
        const hasChecklist = domainInfo?.checklist && Object.keys(domainInfo.checklist).length > 0
        const hasEvidence  = domainInfo?.evidence  && Object.keys(domainInfo.evidence).length  > 0
        const hasValidAnswers = hasChecklist &&
          Object.values(domainInfo.checklist).some((answer: any) =>
            answer && ['compliant', 'non_compliant', 'partial', 'na'].includes(answer)
          )
        if (hasChecklist || hasEvidence || hasValidAnswers) tags.add(domain)
      })
    }

    // Backward compatibility: old _checklist / _evidence root keys
    Object.keys(formData).forEach(key => {
      if (key.endsWith('_checklist') || key.endsWith('_evidence')) {
        const domain = key.replace(/_(checklist|evidence)$/, '')
        const data = formData[key]
        if (data && Object.keys(data).length > 0) {
          if (key.endsWith('_checklist')) {
            const hasValidAnswers = Object.values(data).some((answer: any) =>
              answer && ['compliant', 'non_compliant', 'partial', 'na'].includes(answer)
            )
            if (hasValidAnswers) tags.add(domain)
          } else {
            tags.add(domain)
          }
        }
      }
    })

    if (artefacts) {
      Object.entries(artefacts).forEach(([domain, domainArtefacts]) => {
        if (domainArtefacts && domainArtefacts.length > 0) {
          const hasValidArtefacts = domainArtefacts.some((a: any) => a.id || a.file)
          if (hasValidArtefacts) tags.add(domain)
        }
      })
    }

    if (formData.nfr_criteria && formData.nfr_criteria.length > 0) {
      const hasValidCriteria = formData.nfr_criteria.some((c: any) =>
        c.category && c.criteria && c.target_value
      )
      if (hasValidCriteria) tags.add('nfr')
    }

    if (tags.size === 0) tags.add('solution')

    return Array.from(tags).sort()
  },

  /**
   * Get artifact download URL
   */
  async getArtifactDownloadUrl(reviewId: string, fileName: string) {
    const { data, error } = await ensureSupabase()
      .storage
      .from('review-artifacts')
      .createSignedUrl(`${reviewId}/${fileName}`, 3600)

    if (error) throw error
    return data.signedUrl
  },

  /**
   * Upload domain-specific artefacts to Supabase Storage
   */
  async uploadArtefacts(
    reviewId: string,
    artefacts: { domain: string; name: string; type: string; file: File }[]
  ): Promise<ArtefactResponse[]> {
    const results: ArtefactResponse[] = []

    for (const artefact of artefacts) {
      const artefactId  = crypto.randomUUID()
      const safeName    = artefact.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${reviewId}/${artefact.domain}/${safeName}`
      const uploadedAt  = new Date().toISOString()

      const { error: storageError } = await ensureSupabase()
        .storage
        .from('review-artifacts')
        .upload(storagePath, artefact.file, { upsert: true, contentType: artefact.file.type })

      if (storageError) throw storageError

      const { data: existing, error: fetchError } = await ensureSupabase()
        .from('reviews')
        .select('report_json')
        .eq('id', reviewId)
        .single()

      if (fetchError) throw fetchError

      const existingUploads: any[] = existing.report_json?.artefact_uploads ?? []
      const newEntry = {
        artefact_id:       artefactId,
        file_name:         artefact.file.name,
        artefact_name:     artefact.name,
        artefact_category: artefact.type,
        domain_tags:       [artefact.domain],
        storage_path:      storagePath,
        file_type:         artefact.file.type,
        file_size_bytes:   artefact.file.size,
        parsed_text:       null,
        parse_status:      'pending',
        uploaded_at:       uploadedAt,
        is_active:         true,
      }

      const { error: artefactInsertError } = await ensureSupabase()
        .from('artefacts')
        .insert({
          id:            artefactId,
          review_id:     reviewId,
          domain_slug:   artefact.domain,
          artefact_name: artefact.name,
          artefact_type: artefact.type,
          filename:      artefact.file.name,
          storage_path:  storagePath,
          file_type:     artefact.file.type,
          file_size_bytes: artefact.file.size,
          is_active:     true,
        })

      if (artefactInsertError) throw artefactInsertError

      const { error: updateError } = await ensureSupabase()
        .from('reviews')
        .update({ report_json: { ...existing.report_json, artefact_uploads: [...existingUploads, newEntry] } })
        .eq('id', reviewId)

      if (updateError) throw updateError

      results.push({
        id:              artefactId,
        review_id:       reviewId,
        domain_slug:     artefact.domain,
        artefact_name:   artefact.name,
        artefact_type:   artefact.type,
        filename:        artefact.file.name,
        file_type:       artefact.file.type,
        file_size_bytes: artefact.file.size,
        uploaded_at:     uploadedAt,
        is_active:       true,
      })
    }

    return results
  },

  /**
   * List all active artefacts for a review
   */
  async getReviewArtefacts(reviewId: string): Promise<ArtefactResponse[]> {
    const { data: artefacts, error } = await ensureSupabase()
      .from('artefacts')
      .select('*')
      .eq('review_id', reviewId)
      .eq('is_active', true)

    if (error) throw error

    return artefacts.map((a: any) => ({
      id:              a.id,
      review_id:       a.review_id,
      domain_slug:     a.domain_slug,
      artefact_name:   a.artefact_name,
      artefact_type:   a.artefact_type,
      filename:        a.filename,
      file_type:       a.file_type,
      file_size_bytes: a.file_size_bytes,
      uploaded_at:     a.created_at,
      is_active:       a.is_active,
    }))
  },

  async getEAOverrides(reviewId: string) {
    const { data, error } = await ensureSupabase()
      .from('ea_overrides')
      .select('*')
      .eq('review_id', reviewId)

    if (error) throw error

    // Return in the same shape as the Python backend: { overrides: { [type]: [...] } }
    const byType: Record<string, any[]> = {}
    for (const o of (data || [])) {
      byType[o.override_type] = byType[o.override_type] || []
      byType[o.override_type].push(o)
    }
    return { overrides: byType }
  },

  async saveEAOverride(reviewId: string, override: {
    override_type: string; target_id: string; original_value: any; override_value: any; rationale: string
  }) {
    const { data: { user } } = await ensureSupabase().auth.getUser()

    // Delete any existing override for the same target before inserting
    await ensureSupabase()
      .from('ea_overrides')
      .delete()
      .eq('review_id', reviewId)
      .eq('target_id', override.target_id)
      .eq('override_type', override.override_type)

    const { data, error } = await ensureSupabase()
      .from('ea_overrides')
      .insert({
        review_id:      reviewId,
        ea_user_id:     user?.id,
        override_type:  override.override_type,
        target_id:      override.target_id,
        original_value: override.original_value,
        override_value: override.override_value,
        rationale:      override.rationale,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async openForEA(reviewId: string) {
    const { data, error } = await ensureSupabase()
      .from('reviews')
      .update({ status: 'ea_reviewing' })
      .eq('id', reviewId)
      .select('id')

    if (error) throw error
    if (!data || data.length === 0) throw new Error('Could not open for EA review — row-level security may be blocking this user. Apply migration 20260519_fix_reviews_rls_for_supabase_jwt.sql.')
  },

  async submitEADecision(reviewId: string, payload: {
    ea_decision: string; ea_annotations?: string | null; ea_name: string
    return_domains?: string[]; rework_gaps?: string[]; decision_rationale?: string
  }) {
    const decisionToStatus: Record<string, string> = {
      APPROVE:               'approved',
      CONDITIONALLY_APPROVE: 'conditionally_approved',
      RETURN:                'returned',
      DEFER:                 'rejected',
    }
    const newStatus = decisionToStatus[payload.ea_decision] || 'closed'

    const { error: eaError } = await ensureSupabase()
      .from('ea_review')
      .upsert({
        review_id:      reviewId,
        ea_name:        payload.ea_name,
        ea_decision:    payload.ea_decision,
        ea_annotations: payload.ea_annotations || null,
        return_domains: payload.return_domains || [],
        rework_gaps:    payload.rework_gaps    || [],
        final_decision: payload.ea_decision,
        reviewed_at:    new Date().toISOString(),
      }, { onConflict: 'review_id' })

    if (eaError) throw eaError

    const { error: reviewError } = await ensureSupabase()
      .from('reviews')
      .update({ status: newStatus, decision: payload.ea_decision })
      .eq('id', reviewId)

    if (reviewError) throw reviewError
  },

  /**
   * Soft-delete an artefact
   */
  async deleteArtefact(artefactId: string, reviewId: string): Promise<void> {
    const { error: artefactUpdateError } = await ensureSupabase()
      .from('artefacts')
      .update({ is_active: false })
      .eq('id', artefactId)
      .eq('review_id', reviewId)

    if (artefactUpdateError) throw artefactUpdateError

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
