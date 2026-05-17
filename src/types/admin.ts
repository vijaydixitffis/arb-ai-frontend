// ============================================================================
// Role constants
// ============================================================================
export const ADMIN_ROLES = ['arb_admin', 'super_admin'] as const
export const SUPER_ADMIN_ROLES = ['super_admin'] as const
export const ALL_ROLES = ['solution_architect', 'enterprise_architect', 'arb_admin', 'super_admin'] as const

export type UserRole = typeof ALL_ROLES[number]

export function isAdmin(role: string): boolean {
  return ADMIN_ROLES.includes(role as any)
}
export function isSuperAdmin(role: string): boolean {
  return SUPER_ADMIN_ROLES.includes(role as any)
}

// ============================================================================
// System Config
// ============================================================================
export interface SystemConfigItem {
  id: string
  config_key: string
  config_value: any
  data_type: 'string' | 'number' | 'boolean' | 'json' | 'select'
  category: 'llm' | 'agent' | 'workflow' | 'general'
  label: string
  description?: string
  is_editable_by_admin: boolean
  updated_at?: string
}

export type ConfigGrouped = Record<string, SystemConfigItem[]>

// ============================================================================
// User Management
// ============================================================================
export interface AdminUser {
  id: string
  email: string
  role: UserRole
  is_active: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface UserCreatePayload {
  email: string
  password: string
  role: UserRole
  is_active: boolean
}

export interface UserUpdatePayload {
  role?: UserRole
  is_active?: boolean
}

// ============================================================================
// Domain
// ============================================================================
export interface AdminDomain {
  id: string
  slug: string
  name: string
  description?: string
  color?: string
  icon?: string
  seq_number?: number
  is_active: boolean
}

// ============================================================================
// Artefact Types
// ============================================================================
export interface ArtefactType {
  id: string
  value: string
  label: string
  description?: string
  icon?: string
  is_active: boolean
}

// ============================================================================
// PTX Gates
// ============================================================================
export interface PtxGate {
  id: string
  value: string
  label: string
  description?: string
  sort_order: number
  is_active: boolean
}

// ============================================================================
// Architecture Dispositions
// ============================================================================
export interface Disposition {
  id: string
  value: string
  label: string
  description?: string
  sort_order: number
  is_active: boolean
}

// ============================================================================
// EA Principles
// ============================================================================
export interface EAPrinciple {
  id: string
  principle_code: string
  principle_name: string
  category: string
  statement: string
  rationale?: string
  arb_weight?: string
  is_active: boolean
}

// ============================================================================
// Checklist
// ============================================================================
export interface ChecklistSubsection {
  id: string
  domain_id: string
  name: string
  description?: string
  color_theme?: string
  sort_order: number
  is_active: boolean
}

export interface ChecklistQuestion {
  id: string
  subsection_id: string
  question_code: string
  question_text: string
  question_type: string
  help_text?: string
  is_required: boolean
  sort_order: number
  is_active: boolean
}

// ============================================================================
// Prompt Templates
// ============================================================================
export interface PromptTemplate {
  id: string
  prompt_key: string
  prompt_type: string
  domain_code?: string
  version: number
  content: string
  is_active: boolean
  notes?: string
  created_at: string
}

export interface PromptHistoryEntry {
  id: string
  version: number
  is_active: boolean
  notes?: string
  created_at: string
}

// ============================================================================
// Knowledge Base
// ============================================================================
export interface KnowledgeBaseEntry {
  id: string
  title: string
  content: string
  category?: string
  principle_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// Analytics
// ============================================================================
export interface AnalyticsSummary {
  total_reviews: number
  pending_reviews: number
  approved_reviews: number
  rejected_reviews: number
  deferred_reviews: number
  reviews_this_month: number
  avg_domain_score?: number
  approval_rate?: number
}

export interface DomainAnalytics {
  domain_slug: string
  domain_name: string
  avg_score?: number
  total_reviews: number
  blocker_count: number
}

export interface RecentReview {
  id: string
  solution_name: string
  status: string
  decision?: string
  aggregate_rag_score?: number
  llm_model?: string
  created_at: string
  agent_run_at?: string
}

// ============================================================================
// Audit Log
// ============================================================================
export interface AuditLogEntry {
  id: string
  table_name: string
  record_id: string
  field_name?: string
  old_value?: any
  new_value?: any
  changed_by?: string
  changed_at: string
  change_reason?: string
}
