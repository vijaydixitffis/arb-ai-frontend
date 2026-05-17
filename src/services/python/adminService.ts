import { apiRequest } from './api'
import type {
  SystemConfigItem, ConfigGrouped,
  AdminUser, UserCreatePayload, UserUpdatePayload,
  AdminDomain,
  ArtefactType, PtxGate, Disposition, EAPrinciple,
  ChecklistSubsection, ChecklistQuestion,
  PromptTemplate, PromptHistoryEntry,
  KnowledgeBaseEntry,
  AnalyticsSummary, DomainAnalytics, RecentReview,
  AuditLogEntry,
} from '../../types/admin'

// ── Config ────────────────────────────────────────────────────────────────────

async function getConfig(): Promise<ConfigGrouped> {
  const res = await apiRequest('/admin/config')
  return res.config
}

async function updateConfig(configKey: string, configValue: any, changeReason?: string): Promise<void> {
  await apiRequest(`/admin/config/${encodeURIComponent(configKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ config_value: configValue, change_reason: changeReason }),
  })
}

// ── Users ─────────────────────────────────────────────────────────────────────

async function listUsers(): Promise<AdminUser[]> {
  const res = await apiRequest('/admin/users')
  return res.users
}

async function createUser(data: UserCreatePayload): Promise<{ id: string }> {
  return apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(data) })
}

async function updateUser(userId: string, data: UserUpdatePayload): Promise<void> {
  await apiRequest(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) })
}

async function resetPassword(userId: string, newPassword: string): Promise<void> {
  await apiRequest(`/admin/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword }),
  })
}

async function deactivateUser(userId: string): Promise<void> {
  await apiRequest(`/admin/users/${userId}`, { method: 'DELETE' })
}

// ── Domains ───────────────────────────────────────────────────────────────────

async function listDomains(includeInactive = true): Promise<AdminDomain[]> {
  const res = await apiRequest(`/admin/domains?include_inactive=${includeInactive}`)
  return res.domains
}

async function updateDomain(domainId: string, data: Partial<AdminDomain> & { change_reason?: string }): Promise<void> {
  await apiRequest(`/admin/domains/${domainId}`, { method: 'PUT', body: JSON.stringify(data) })
}

// ── Artefact Types ────────────────────────────────────────────────────────────

async function listArtefactTypes(): Promise<ArtefactType[]> {
  const res = await apiRequest('/admin/artefact-types')
  return res.artefact_types
}

async function createArtefactType(data: Omit<ArtefactType, 'id'>): Promise<void> {
  await apiRequest('/admin/artefact-types', { method: 'POST', body: JSON.stringify(data) })
}

async function updateArtefactType(id: string, data: Partial<ArtefactType>): Promise<void> {
  await apiRequest(`/admin/artefact-types/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

async function deleteArtefactType(id: string): Promise<void> {
  await apiRequest(`/admin/artefact-types/${id}`, { method: 'DELETE' })
}

// ── PTX Gates ─────────────────────────────────────────────────────────────────

async function listPtxGates(): Promise<PtxGate[]> {
  const res = await apiRequest('/admin/ptx-gates')
  return res.ptx_gates
}

async function createPtxGate(data: Omit<PtxGate, 'id'>): Promise<void> {
  await apiRequest('/admin/ptx-gates', { method: 'POST', body: JSON.stringify(data) })
}

async function updatePtxGate(id: string, data: Partial<PtxGate>): Promise<void> {
  await apiRequest(`/admin/ptx-gates/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

async function deletePtxGate(id: string): Promise<void> {
  await apiRequest(`/admin/ptx-gates/${id}`, { method: 'DELETE' })
}

// ── Dispositions ──────────────────────────────────────────────────────────────

async function listDispositions(): Promise<Disposition[]> {
  const res = await apiRequest('/admin/dispositions')
  return res.dispositions
}

async function createDisposition(data: Omit<Disposition, 'id'>): Promise<void> {
  await apiRequest('/admin/dispositions', { method: 'POST', body: JSON.stringify(data) })
}

async function updateDisposition(id: string, data: Partial<Disposition>): Promise<void> {
  await apiRequest(`/admin/dispositions/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

async function deleteDisposition(id: string): Promise<void> {
  await apiRequest(`/admin/dispositions/${id}`, { method: 'DELETE' })
}

// ── EA Principles ─────────────────────────────────────────────────────────────

async function listEAPrinciples(): Promise<EAPrinciple[]> {
  const res = await apiRequest('/admin/ea-principles')
  return res.ea_principles
}

async function createEAPrinciple(data: Omit<EAPrinciple, 'id'>): Promise<void> {
  await apiRequest('/admin/ea-principles', { method: 'POST', body: JSON.stringify(data) })
}

async function updateEAPrinciple(id: string, data: Partial<EAPrinciple>): Promise<void> {
  await apiRequest(`/admin/ea-principles/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

async function deleteEAPrinciple(id: string): Promise<void> {
  await apiRequest(`/admin/ea-principles/${id}`, { method: 'DELETE' })
}

// ── Checklist ─────────────────────────────────────────────────────────────────

async function listSubsections(domainId?: string): Promise<ChecklistSubsection[]> {
  const qs = domainId ? `?domain_id=${domainId}` : ''
  const res = await apiRequest(`/admin/checklist/subsections${qs}`)
  return res.subsections
}

async function createSubsection(data: Omit<ChecklistSubsection, 'id'>): Promise<void> {
  await apiRequest('/admin/checklist/subsections', { method: 'POST', body: JSON.stringify(data) })
}

async function updateSubsection(id: string, data: Partial<ChecklistSubsection>): Promise<void> {
  await apiRequest(`/admin/checklist/subsections/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

async function deleteSubsection(id: string): Promise<void> {
  await apiRequest(`/admin/checklist/subsections/${id}`, { method: 'DELETE' })
}

async function listQuestions(subsectionId?: string): Promise<ChecklistQuestion[]> {
  const qs = subsectionId ? `?subsection_id=${subsectionId}` : ''
  const res = await apiRequest(`/admin/checklist/questions${qs}`)
  return res.questions
}

async function createQuestion(data: Omit<ChecklistQuestion, 'id'>): Promise<void> {
  await apiRequest('/admin/checklist/questions', { method: 'POST', body: JSON.stringify(data) })
}

async function updateQuestion(id: string, data: Partial<ChecklistQuestion>): Promise<void> {
  await apiRequest(`/admin/checklist/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

async function deleteQuestion(id: string): Promise<void> {
  await apiRequest(`/admin/checklist/questions/${id}`, { method: 'DELETE' })
}

// ── Prompts ───────────────────────────────────────────────────────────────────

async function listPrompts(): Promise<PromptTemplate[]> {
  const res = await apiRequest('/admin/prompts')
  return res.prompts
}

async function getPromptHistory(promptKey: string): Promise<PromptHistoryEntry[]> {
  const res = await apiRequest(`/admin/prompts/${encodeURIComponent(promptKey)}/history`)
  return res.history
}

async function savePrompt(promptKey: string, content: string, notes?: string, promptType = 'system'): Promise<void> {
  await apiRequest(`/admin/prompts/${encodeURIComponent(promptKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ prompt_key: promptKey, prompt_type: promptType, content, notes }),
  })
}

async function revertPrompt(promptKey: string, version: number): Promise<void> {
  await apiRequest(`/admin/prompts/${encodeURIComponent(promptKey)}/revert/${version}`, { method: 'POST' })
}

// ── Knowledge Base (super_admin only) ────────────────────────────────────────

async function listKbEntries(includeInactive = false): Promise<KnowledgeBaseEntry[]> {
  const res = await apiRequest(`/admin/kb?include_inactive=${includeInactive}`)
  return res.entries
}

async function createKbEntry(data: { title: string; content: string; category?: string; principle_id?: string }): Promise<KnowledgeBaseEntry> {
  const res = await apiRequest('/admin/kb', { method: 'POST', body: JSON.stringify(data) })
  return res.entry
}

async function updateKbEntry(id: string, data: { title?: string; content?: string; category?: string; principle_id?: string; is_active?: boolean }): Promise<void> {
  await apiRequest(`/admin/kb/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

async function deleteKbEntry(id: string): Promise<void> {
  await apiRequest(`/admin/kb/${id}`, { method: 'DELETE' })
}

// ── Analytics ─────────────────────────────────────────────────────────────────

async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return apiRequest('/admin/analytics/summary')
}

async function getDomainAnalytics(): Promise<DomainAnalytics[]> {
  const res = await apiRequest('/admin/analytics/domains')
  return res.domains
}

async function getRecentReviews(limit = 20): Promise<RecentReview[]> {
  const res = await apiRequest(`/admin/analytics/recent-reviews?limit=${limit}`)
  return res.reviews
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

async function getAuditLog(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
  const res = await apiRequest(`/admin/audit-log?limit=${limit}&offset=${offset}`)
  return res.audit_log
}

// ── Export ────────────────────────────────────────────────────────────────────

export const adminService = {
  getConfig, updateConfig,
  listUsers, createUser, updateUser, resetPassword, deactivateUser,
  listDomains, updateDomain,
  listArtefactTypes, createArtefactType, updateArtefactType, deleteArtefactType,
  listPtxGates, createPtxGate, updatePtxGate, deletePtxGate,
  listDispositions, createDisposition, updateDisposition, deleteDisposition,
  listEAPrinciples, createEAPrinciple, updateEAPrinciple, deleteEAPrinciple,
  listSubsections, createSubsection, updateSubsection, deleteSubsection,
  listQuestions, createQuestion, updateQuestion, deleteQuestion,
  listPrompts, getPromptHistory, savePrompt, revertPrompt,
  listKbEntries, createKbEntry, updateKbEntry, deleteKbEntry,
  getAnalyticsSummary, getDomainAnalytics, getRecentReviews,
  getAuditLog,
}
