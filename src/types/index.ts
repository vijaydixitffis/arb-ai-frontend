export interface User {
  id: string
  email: string
  name: string
  role: 'solution_architect' | 'enterprise_architect' | 'arb_admin'
}

export interface ChecklistItem {
  id: string
  question: string
  answer: 'compliant' | 'non_compliant' | 'partial' | 'na'
  evidence_notes?: string
}

export interface IntegrationCatalogueItem {
  id: string
  system_name: string
  interface_type: string
  protocol: string
  data_format: string
  frequency: string
  security: string
  notes?: string
}

export interface Artefact {
  id: string
  file_name: string
  file_type: string
  file_size: number
  system_label: string
  upload_date: string
  file_path: string
}

export interface DomainSection {
  domain: string
  checklist_items: ChecklistItem[]
  integration_catalogue?: IntegrationCatalogueItem[]
  artefacts: Artefact[]
  notes?: string
}

export interface NFRCriteria {
  category: string
  criteria: string
  target_value: string
  actual_value: string
  score: number
  evidence?: string
}

export interface ARBSubmission {
  id?: string
  project_name: string
  solution_architect_id: string
  status: string
  created_date?: string
  submitted_date?: string
  problem_statement: string
  stakeholders: string[]
  business_drivers: string[]
  growth_plans?: string
  application_architecture?: DomainSection
  integration_architecture?: DomainSection
  data_architecture?: DomainSection
  security_architecture?: DomainSection
  infrastructure_architecture?: DomainSection
  devsecops?: DomainSection
  nfr_criteria: NFRCriteria[]
  overall_progress: number
}

export interface ARBReview {
  id?: string
  submission_id: string
  enterprise_architect_id: string
  review_date?: string
  agent_recommendation: string
  agent_rationale: string
  ea_decision: string
  ea_override_rationale?: string
  adrs: any[]
  action_register: any[]
  status: string
}
