/**
 * Supabase-backed admin service.
 * All operations are routed through the admin-api edge function (service-role),
 * matching the same interface as the Python adminService.
 */
import { supabase } from './supabase'
import type {
  ConfigGrouped, AdminUser, UserCreatePayload, UserUpdatePayload,
  AdminDomain, ArtefactType, PtxGate, Disposition, EAPrinciple,
  ChecklistSubsection, ChecklistQuestion,
  PromptTemplate, PromptHistoryEntry, KnowledgeBaseEntry,
  AnalyticsSummary, DomainAnalytics, RecentReview, AuditLogEntry,
} from '../../types/admin'

function getSb() {
  if (!supabase) throw new Error('Supabase client not configured')
  return supabase
}

async function callAdminApi(action: string, payload: Record<string, any> = {}): Promise<any> {
  const sb = getSb()
  const { data, error } = await sb.functions.invoke('admin-api', {
    body: { action, payload },
  })
  if (error) throw new Error(error.message ?? String(error))
  if (data?.error) throw new Error(data.error)
  return data
}

// ── Config ────────────────────────────────────────────────────────────────────

async function getConfig(): Promise<ConfigGrouped> {
  const res = await callAdminApi('getConfig')
  return res.config
}

async function updateConfig(configKey: string, configValue: any, changeReason?: string): Promise<void> {
  await callAdminApi('updateConfig', { config_key: configKey, config_value: configValue, change_reason: changeReason })
}

// ── Users ─────────────────────────────────────────────────────────────────────

async function listUsers(): Promise<AdminUser[]> {
  const res = await callAdminApi('listUsers')
  return res.users
}

async function createUser(data: UserCreatePayload): Promise<{ id: string }> {
  return callAdminApi('createUser', data)
}

async function updateUser(userId: string, data: UserUpdatePayload): Promise<void> {
  await callAdminApi('updateUser', { user_id: userId, ...data })
}

async function resetPassword(userId: string, newPassword: string): Promise<void> {
  await callAdminApi('resetPassword', { user_id: userId, new_password: newPassword })
}

async function deactivateUser(userId: string): Promise<void> {
  await callAdminApi('deactivateUser', { user_id: userId })
}

// ── Domains ───────────────────────────────────────────────────────────────────

async function listDomains(includeInactive = true): Promise<AdminDomain[]> {
  const res = await callAdminApi('listDomains', { include_inactive: includeInactive })
  return res.domains
}

async function updateDomain(domainId: string, data: Partial<AdminDomain> & { change_reason?: string }): Promise<void> {
  await callAdminApi('updateDomain', { domain_id: domainId, ...data })
}

// ── Artefact Types ────────────────────────────────────────────────────────────

async function listArtefactTypes(): Promise<ArtefactType[]> {
  const res = await callAdminApi('listArtefactTypes')
  return res.artefact_types
}

async function createArtefactType(data: Omit<ArtefactType, 'id'>): Promise<void> {
  await callAdminApi('createArtefactType', data)
}

async function updateArtefactType(id: string, data: Partial<ArtefactType>): Promise<void> {
  await callAdminApi('updateArtefactType', { id, ...data })
}

async function deleteArtefactType(id: string): Promise<void> {
  await callAdminApi('deleteArtefactType', { id })
}

// ── PTX Gates ─────────────────────────────────────────────────────────────────

async function listPtxGates(): Promise<PtxGate[]> {
  const res = await callAdminApi('listPtxGates')
  return res.ptx_gates
}

async function createPtxGate(data: Omit<PtxGate, 'id'>): Promise<void> {
  await callAdminApi('createPtxGate', data)
}

async function updatePtxGate(id: string, data: Partial<PtxGate>): Promise<void> {
  await callAdminApi('updatePtxGate', { id, ...data })
}

async function deletePtxGate(id: string): Promise<void> {
  await callAdminApi('deletePtxGate', { id })
}

// ── Dispositions ──────────────────────────────────────────────────────────────

async function listDispositions(): Promise<Disposition[]> {
  const res = await callAdminApi('listDispositions')
  return res.dispositions
}

async function createDisposition(data: Omit<Disposition, 'id'>): Promise<void> {
  await callAdminApi('createDisposition', data)
}

async function updateDisposition(id: string, data: Partial<Disposition>): Promise<void> {
  await callAdminApi('updateDisposition', { id, ...data })
}

async function deleteDisposition(id: string): Promise<void> {
  await callAdminApi('deleteDisposition', { id })
}

// ── EA Principles ─────────────────────────────────────────────────────────────

async function listEAPrinciples(): Promise<EAPrinciple[]> {
  const res = await callAdminApi('listEAPrinciples')
  return res.ea_principles
}

async function createEAPrinciple(data: Omit<EAPrinciple, 'id'>): Promise<void> {
  await callAdminApi('createEAPrinciple', data)
}

async function updateEAPrinciple(id: string, data: Partial<EAPrinciple>): Promise<void> {
  await callAdminApi('updateEAPrinciple', { id, ...data })
}

async function deleteEAPrinciple(id: string): Promise<void> {
  await callAdminApi('deleteEAPrinciple', { id })
}

// ── Checklist ─────────────────────────────────────────────────────────────────

async function listSubsections(domainId?: string): Promise<ChecklistSubsection[]> {
  const res = await callAdminApi('listSubsections', domainId ? { domain_id: domainId } : {})
  return res.subsections
}

async function createSubsection(data: Omit<ChecklistSubsection, 'id'>): Promise<void> {
  await callAdminApi('createSubsection', data)
}

async function updateSubsection(id: string, data: Partial<ChecklistSubsection>): Promise<void> {
  await callAdminApi('updateSubsection', { id, ...data })
}

async function deleteSubsection(id: string): Promise<void> {
  await callAdminApi('deleteSubsection', { id })
}

async function listQuestions(subsectionId?: string): Promise<ChecklistQuestion[]> {
  const res = await callAdminApi('listQuestions', subsectionId ? { subsection_id: subsectionId } : {})
  return res.questions
}

async function createQuestion(data: Omit<ChecklistQuestion, 'id'>): Promise<void> {
  await callAdminApi('createQuestion', data)
}

async function updateQuestion(id: string, data: Partial<ChecklistQuestion>): Promise<void> {
  await callAdminApi('updateQuestion', { id, ...data })
}

async function deleteQuestion(id: string): Promise<void> {
  await callAdminApi('deleteQuestion', { id })
}

// ── Prompts (super_admin only) ────────────────────────────────────────────────

async function listPrompts(): Promise<PromptTemplate[]> {
  const res = await callAdminApi('listPrompts')
  return res.prompts
}

async function getPromptHistory(promptKey: string): Promise<PromptHistoryEntry[]> {
  const res = await callAdminApi('getPromptHistory', { prompt_key: promptKey })
  return res.history
}

async function savePrompt(promptKey: string, content: string, notes?: string, promptType = 'system'): Promise<void> {
  await callAdminApi('savePrompt', { prompt_key: promptKey, content, notes, prompt_type: promptType })
}

async function revertPrompt(promptKey: string, version: number): Promise<void> {
  await callAdminApi('revertPrompt', { prompt_key: promptKey, version })
}

// ── Knowledge Base (super_admin only) ────────────────────────────────────────

async function listKbEntries(includeInactive = false): Promise<KnowledgeBaseEntry[]> {
  const res = await callAdminApi('listKbEntries', { include_inactive: includeInactive })
  return res.entries
}

async function createKbEntry(data: { title: string; content: string; category?: string; principle_id?: string }): Promise<KnowledgeBaseEntry> {
  const res = await callAdminApi('createKbEntry', data)
  return res.entry
}

async function updateKbEntry(id: string, data: { title?: string; content?: string; category?: string; principle_id?: string; is_active?: boolean }): Promise<void> {
  await callAdminApi('updateKbEntry', { id, ...data })
}

async function deleteKbEntry(id: string): Promise<void> {
  await callAdminApi('deleteKbEntry', { id })
}

// ── Analytics ─────────────────────────────────────────────────────────────────

async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return callAdminApi('getAnalyticsSummary')
}

async function getDomainAnalytics(): Promise<DomainAnalytics[]> {
  const res = await callAdminApi('getDomainAnalytics')
  return res.domains
}

async function getRecentReviews(limit = 20): Promise<RecentReview[]> {
  const res = await callAdminApi('getRecentReviews', { limit })
  return res.reviews
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

async function getAuditLog(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
  const res = await callAdminApi('getAuditLog', { limit, offset })
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
