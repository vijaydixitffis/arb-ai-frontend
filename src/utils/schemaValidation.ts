// ARB Report Schema Validation Utility

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

interface FormData {
  reviewId?: string
  solution_name?: string
  scope_tags?: string[]
  project_name?: string
  problem_statement?: string
  stakeholders?: string[]
  business_drivers?: string[]
  growth_plans?: string
  domain_data?: Record<string, {
    checklist?: Record<string, string>
    evidence?: Record<string, string>
  }>
  nfr_criteria?: Array<{
    id?: string
    category?: string
    criteria?: string
    target_value?: string
    actual_value?: string
    score?: number
    evidence?: string
  }>
}

const VALID_DOMAINS = [
  'solution', 'business', 'application', 'integration',
  'data', 'infrastructure', 'devsecops', 'nfr'
]

const VALID_COMPLIANCE_ANSWERS = [
  'compliant', 'non_compliant', 'partial', 'na'
]

const NFR_CATEGORIES = [
  'Performance', 'Scalability', 'Availability', 'Security',
  'Reliability', 'Maintainability', 'Usability', 'Compliance'
]

export function validateARBFormData(formData: FormData): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required fields validation
  if (!formData.project_name || formData.project_name.trim() === '') {
    errors.push('Project name is required')
  }

  if (!formData.problem_statement || formData.problem_statement.trim() === '') {
    errors.push('Problem statement is required')
  }

  if (!formData.stakeholders || formData.stakeholders.length === 0) {
    errors.push('At least one stakeholder is required')
  }

  if (!formData.business_drivers || formData.business_drivers.length === 0) {
    errors.push('At least one business driver is required')
  }

  if (!formData.domain_data || Object.keys(formData.domain_data).length === 0) {
    errors.push('Domain data is required')
  }

  if (!formData.nfr_criteria || formData.nfr_criteria.length === 0) {
    warnings.push('No NFR criteria defined - consider adding quantitative measures')
  }

  // ReviewId validation (should be UUID or empty string for first draft)
  if (formData.reviewId && formData.reviewId !== '') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(formData.reviewId)) {
      errors.push('ReviewId must be a valid UUID or empty string')
    }
  }

  // Scope tags validation
  if (formData.scope_tags && formData.scope_tags.length > 0) {
    const invalidTags = formData.scope_tags.filter(tag => !VALID_DOMAINS.includes(tag))
    if (invalidTags.length > 0) {
      warnings.push(`Invalid scope tags detected: ${invalidTags.join(', ')}`)
    }
  }

  // Domain data validation
  if (formData.domain_data) {
    Object.entries(formData.domain_data).forEach(([domain, data]) => {
      if (!VALID_DOMAINS.includes(domain)) {
        warnings.push(`Unknown domain '${domain}' found in domain_data`)
      }

      // Validate checklist answers
      if (data.checklist) {
        Object.entries(data.checklist).forEach(([questionCode, answer]) => {
          if (!VALID_COMPLIANCE_ANSWERS.includes(answer)) {
            errors.push(`Invalid compliance answer '${answer}' for question ${questionCode} in domain ${domain}. Valid values: ${VALID_COMPLIANCE_ANSWERS.join(', ')}`)
          }
        })
      }

      // Validate evidence structure
      if (data.evidence) {
        Object.entries(data.evidence).forEach(([questionCode, evidence]) => {
          if (typeof evidence !== 'string') {
            errors.push(`Evidence for question ${questionCode} in domain ${domain} must be a string`)
          }
        })
      }
    })
  }

  // NFR criteria validation
  if (formData.nfr_criteria) {
    formData.nfr_criteria.forEach((criterion, index) => {
      const prefix = `NFR criterion ${index + 1}`

      if (!criterion.category || criterion.category.trim() === '') {
        errors.push(`${prefix}: Category is required`)
      } else if (!NFR_CATEGORIES.includes(criterion.category)) {
        warnings.push(`${prefix}: Unknown category '${criterion.category}'. Valid categories: ${NFR_CATEGORIES.join(', ')}`)
      }

      if (!criterion.criteria || criterion.criteria.trim() === '') {
        errors.push(`${prefix}: Criteria description is required`)
      }

      if (!criterion.target_value || criterion.target_value.trim() === '') {
        errors.push(`${prefix}: Target value is required`)
      }

      if (!criterion.actual_value || criterion.actual_value.trim() === '') {
        warnings.push(`${prefix}: Actual value is missing (will be set to 'Not measured')`)
      }

      if (typeof criterion.score !== 'number' || criterion.score < 0 || criterion.score > 10) {
        errors.push(`${prefix}: Score must be a number between 0 and 10`)
      }

      if (criterion.evidence && typeof criterion.evidence !== 'string') {
        errors.push(`${prefix}: Evidence must be a string`)
      }
    })
  }

  // Cross-validation warnings
  if (formData.domain_data) {
    const domainsWithChecklist = Object.keys(formData.domain_data).filter(
      domain => formData.domain_data![domain].checklist && 
      Object.keys(formData.domain_data![domain].checklist!).length > 0
    )

    if (domainsWithChecklist.length === 0) {
      warnings.push('No domain checklists completed - consider adding compliance assessments')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

export function validateSubmissionCompleteness(formData: FormData, artefacts: Record<string, any[]> = {}): ValidationResult {
  const baseValidation = validateARBFormData(formData)
  const errors: string[] = [...baseValidation.errors]
  const warnings: string[] = [...baseValidation.warnings]

  // Check if at least one artifact is uploaded
  const totalArtifacts = Object.values(artefacts).reduce((sum, domainArtefacts) => sum + domainArtefacts.length, 0)
  if (totalArtifacts === 0) {
    errors.push('At least one artifact must be uploaded')
  }

  // Check if scope tags are properly extracted
  if (!formData.scope_tags || formData.scope_tags.length === 0) {
    errors.push('Scope tags must be extracted from domain data and artifacts')
  }

  // Ensure solution_name is set
  if (!formData.solution_name || formData.solution_name.trim() === '') {
    errors.push('Solution name is required')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

export function getValidationSummary(validation: ValidationResult): string {
  if (validation.isValid && validation.warnings.length === 0) {
    return '✅ Form is valid and ready for submission'
  }

  let summary = ''

  if (validation.errors.length > 0) {
    summary += `❌ ${validation.errors.length} error(s) must be fixed:\n`
    validation.errors.forEach(error => {
      summary += `  • ${error}\n`
    })
  }

  if (validation.warnings.length > 0) {
    summary += `\n⚠️ ${validation.warnings.length} warning(s) to consider:\n`
    validation.warnings.forEach(warning => {
      summary += `  • ${warning}\n`
    })
  }

  return summary.trim()
}
