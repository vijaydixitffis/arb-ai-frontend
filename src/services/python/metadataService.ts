import { apiRequest } from './api'

export interface Step {
  id: string
  step_order: number
  title: string
  description: string
  icon: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Domain {
  id: string
  slug: string
  name: string
  description: string
  color: string
  icon: string
  seq_number: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ArtefactType {
  id: string
  value: string
  label: string
  description: string
  icon: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ArtefactTemplate {
  id: string
  domain_id: string
  artefact_type_id: string
  name: string
  description: string
  is_required: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  artefact_type?: ArtefactType
}

export interface ChecklistSubsection {
  id: string
  domain_id: string
  name: string
  description: string
  color_theme: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  questions?: ChecklistQuestion[]
}

export interface ChecklistQuestion {
  id: string
  subsection_id: string
  question_code: string
  question_text: string
  question_type: string
  help_text: string
  is_required: boolean
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  options?: QuestionOption[]
}

export interface QuestionOption {
  id: string
  question_id: string
  option_value: string
  option_label: string
  description: string
  color_code: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface EAPrinciple {
  id: string
  principle_code: string
  principle_name: string
  category: string
  statement: string
  rationale: string
  implications: string
  items_to_verify: string[]
  arb_weight: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PrincipleDomain {
  id: string
  principle_id: string
  domain_id: string
  relevance_score: number
  created_at: string
}

export interface FormField {
  id: string
  step_id: string
  field_name: string
  field_label: string
  field_type: string
  placeholder: string
  is_required: boolean
  validation_rules: Record<string, any>
  options: Record<string, any>
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export const metadataService = {
  async getSteps(): Promise<Step[]> {
    return await apiRequest('/metadata/steps')
  },

  async getDomains(): Promise<Domain[]> {
    return await apiRequest('/metadata/domains')
  },

  async getDomainBySeqNumber(seqNumber: number): Promise<Domain | null> {
    try {
      return await apiRequest(`/metadata/domains/seq-number/${seqNumber}`)
    } catch {
      return null
    }
  },

  async getDomainsForStep(stepId: string): Promise<Domain[]> {
    return await apiRequest(`/metadata/domains/step/${stepId}`)
  },

  async getStepToDomainMapping(): Promise<Record<number, string>> {
    return await apiRequest('/metadata/domains/step-mapping')
  },

  async getArtefactTypes(): Promise<ArtefactType[]> {
    return await apiRequest('/metadata/artefact-types')
  },

  async getArtefactTemplates(domainSlug: string): Promise<ArtefactTemplate[]> {
    return await apiRequest(`/metadata/artefact-templates/domain/${domainSlug}`)
  },

  async getChecklistSubsections(domainSlug: string): Promise<ChecklistSubsection[]> {
    return await apiRequest(`/metadata/checklist-subsections/domain/${domainSlug}`)
  },

  async getPtxGates(): Promise<{ value: string; label: string }[]> {
    return await apiRequest('/metadata/ptx-gates')
  },

  async getArchitectureDispositions(): Promise<{ value: string; label: string }[]> {
    return await apiRequest('/metadata/architecture-dispositions')
  },

  async getEAPrinciples(): Promise<EAPrinciple[]> {
    return await apiRequest('/metadata/ea-principles')
  },

  async getEAPrinciplesForDomain(domainSlug: string): Promise<EAPrinciple[]> {
    return await apiRequest(`/metadata/ea-principles/domain/${domainSlug}`)
  },

  async getFormFields(stepId: string): Promise<FormField[]> {
    return await apiRequest(`/metadata/form-fields/step/${stepId}`)
  },

  async getQuestionOptions(questionId: string): Promise<QuestionOption[]> {
    return await apiRequest(`/metadata/question-options/question/${questionId}`)
  },

  async getAllQuestionOptions(): Promise<QuestionOption[]> {
    return await apiRequest('/metadata/question-options')
  },

  async getAllMetadata() {
    return await apiRequest('/metadata/all')
  }
}
