import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft, X, CheckCircle, XCircle, AlertCircle, Clock,
  AlertTriangle, Shield, Database, Server, Code, GitMerge,
  Layers, Activity, Briefcase, ChevronRight, FileText, Zap, Download,
  Flag, Award, Plus, Trash2, Pencil, Check,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Textarea } from '../components/ui/Textarea'
import { reviewService } from '../services/backendConfig'
import { generateARBReportPDF } from '../services/pdfService'
import { toARBRef } from '../utils/reviewRef'
import { useAuthStore } from '../stores/authStore'
import { brand } from '../brand.config'

// ── Domain metadata ──────────────────────────────────────────────────────────

const DOMAIN_META: Record<string, { label: string; Icon: React.ElementType }> = {
  solution:       { label: 'Solution',                    Icon: Layers },
  business:       { label: 'Business Domain',             Icon: Briefcase },
  application:    { label: 'Application Domain',          Icon: Code },
  integration:    { label: 'Integration Domain',          Icon: GitMerge },
  data:           { label: 'Data Domain',                 Icon: Database },
  infrastructure: { label: 'Infrastructure & Platform',   Icon: Server },
  devsecops:      { label: 'DevSecOps',                   Icon: Shield },
  nfr:            { label: 'Non-Functional Requirements',  Icon: Activity },
  security:       { label: 'Security Domain',             Icon: Shield },
}

const DOMAIN_ORDER = ['solution', 'business', 'application', 'integration', 'data', 'infrastructure', 'devsecops', 'nfr', 'security']

// ── RAG helpers ───────────────────────────────────────────────────────────────

interface RagStyle { bg: string; text: string; border: string; dot: string; pill: string }

function ragStyle(score: number): RagStyle {
  if (score <= 2) return {
    bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200',
    dot: 'bg-red-500', pill: 'bg-red-100 text-red-800',
  }
  if (score === 3) return {
    bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200',
    dot: 'bg-amber-500', pill: 'bg-amber-100 text-amber-800',
  }
  return {
    bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200',
    dot: 'bg-green-500', pill: 'bg-green-100 text-green-800',
  }
}

const DECISION_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  approve:                  { label: 'Approve',                  color: 'bg-green-100 text-green-800',  Icon: CheckCircle },
  approve_with_conditions:  { label: 'Approve with Conditions',  color: 'bg-amber-100 text-amber-800',  Icon: AlertCircle },
  defer:                    { label: 'Defer',                    color: 'bg-orange-100 text-orange-800', Icon: Clock },
  reject:                   { label: 'Reject',                   color: 'bg-red-100 text-red-800',      Icon: XCircle },
}

function decisionMeta(decision: string | null | undefined) {
  const key = (decision || '').toLowerCase().replace(/ /g, '_')
  return DECISION_META[key] || { label: decision || 'Pending', color: 'bg-gray-100 text-gray-700', Icon: Clock }
}

// ── Evidence quality badge ────────────────────────────────────────────────────

function evidenceQualityStyle(quality?: string): string {
  switch ((quality || '').toUpperCase()) {
    case 'STRONG':   return 'bg-green-100 text-green-700'
    case 'ADEQUATE': return 'bg-blue-100 text-blue-700'
    case 'WEAK':     return 'bg-amber-100 text-amber-700'
    case 'ABSENT':   return 'bg-red-100 text-red-700'
    default:         return 'bg-gray-100 text-gray-600'
  }
}

// ── Severity badge ────────────────────────────────────────────────────────────

function SeverityBadge({ ragScore }: { ragScore?: number }) {
  const score = ragScore ?? 3
  const label = score <= 1 ? 'Blocker' : score === 2 ? 'Critical' : score === 3 ? 'Major' : 'Minor'
  const cls   = score <= 1 ? 'bg-red-600 text-white'
              : score === 2 ? 'bg-red-100 text-red-800'
              : score === 3 ? 'bg-amber-100 text-amber-800'
              : 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ── EA Override constants ─────────────────────────────────────────────────────

const SCORE_OPTIONS = [
  { value: 5, label: '5 — GREEN (Full Compliance)' },
  { value: 4, label: '4 — GREEN+ (Minor Gaps)' },
  { value: 3, label: '3 — AMBER (Significant Gaps)' },
  { value: 2, label: '2 — RED (Critical Gap)' },
  { value: 1, label: '1 — BLOCKER (Cannot Proceed)' },
]

const PRIORITY_OPTIONS = [
  { value: 'CRITICAL', label: 'CRITICAL' },
  { value: 'HIGH',     label: 'HIGH' },
  { value: 'MEDIUM',   label: 'MEDIUM' },
  { value: 'LOW',      label: 'LOW' },
]

const ADR_STATUS_OPTIONS = [
  { value: 'accepted',    label: 'Accepted' },
  { value: 'rejected',    label: 'Rejected' },
  { value: 'conditional', label: 'Conditional' },
  { value: 'superseded',  label: 'Superseded' },
  { value: 'pending',     label: 'Pending' },
]

// ── EAOverrideWidget ──────────────────────────────────────────────────────────

function EAOverrideWidget({
  label, overrideType, targetId, currentValue, reviewId,
  options, existingOverride, onSaved,
}: {
  label: string
  overrideType: string
  targetId: string
  currentValue: any
  reviewId: string
  options: { value: any; label: string }[]
  existingOverride?: any
  onSaved: (override: any) => void
}) {
  const [open,      setOpen]      = useState(false)
  const [value,     setValue]     = useState('')
  const [rationale, setRationale] = useState('')
  const [saving,    setSaving]    = useState(false)
  const apiBase = brand.apiRoot

  const handleSave = async () => {
    if (!value || rationale.trim().length < 10) return
    setSaving(true)
    try {
      const parsedValue = options.find(o => String(o.value) === value)?.value ?? value
      const resp = await fetch(`${apiBase}/reviews/${reviewId}/overrides`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          override_type:  overrideType,
          target_id:      targetId,
          original_value: currentValue,
          override_value: parsedValue,
          rationale:      rationale.trim(),
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const result = await resp.json()
      onSaved(result)
      setOpen(false)
      setValue('')
      setRationale('')
    } catch (e: any) {
      alert(`Override failed: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (existingOverride) {
    const overrideLabel = options.find(o => String(o.value) === String(existingOverride.override_value))?.label
      ?? String(existingOverride.override_value)
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold flex items-center gap-1">
          <Award className="w-3 h-3" /> EA Override: {overrideLabel}
        </span>
        <span className="text-xs text-gray-400 italic truncate max-w-xs">{existingOverride.rationale}</span>
      </div>
    )
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs px-2 py-0.5 rounded border border-purple-200 text-purple-600 hover:bg-purple-50 flex items-center gap-1 font-medium transition-colors"
        >
          <Pencil className="w-3 h-3" /> Override
        </button>
      ) : (
        <div className="border border-purple-200 rounded-lg p-3 bg-purple-50 space-y-2 mt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-purple-700">{label}</p>
            <button onClick={() => setOpen(false)} className="text-purple-400 hover:text-purple-600">
              <X className="w-3 h-3" />
            </button>
          </div>
          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full text-xs border border-purple-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-300"
          >
            <option value="">Select new value…</option>
            {options.map(o => (
              <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
            ))}
          </select>
          <Textarea
            value={rationale}
            onChange={e => setRationale(e.target.value)}
            placeholder="Rationale for override (min 10 characters required)…"
            rows={2}
            className="text-xs"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !value || rationale.trim().length < 10}
              className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
            >
              {saving ? 'Saving…' : 'Save Override'}
            </Button>
            <span className={`text-xs ${rationale.trim().length < 10 ? 'text-red-400' : 'text-green-600'}`}>
              {rationale.trim().length}/10
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Domain Detail Panel ───────────────────────────────────────────────────────

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
  executive_summary?: string
  overall_readiness?: string
  compliant_areas?: string[]
  gap_areas?: string[]
  evidence_quality?: string
  domain_specific_scores?: Record<string, number>
}

const SLUG_PREFIX: Record<string, string> = {
  solution: 'SOL', business: 'BUS', application: 'APP', integration: 'INT',
  data: 'DAT', infrastructure: 'INF', devsecops: 'DEV', nfr: 'NFR', security: 'SEC',
}
function domainPrefix(slug: string) {
  return SLUG_PREFIX[slug] || slug.substring(0, 3).toUpperCase()
}
function seq(n: number) { return String(n + 1).padStart(2, '0') }

function DomainDetailPanel({
  slug, summary, onClose, reviewId, isEA, eaOverrides, onOverrideSaved,
}: {
  slug: string
  summary: DomainSummary
  onClose: () => void
  reviewId: string
  isEA: boolean
  eaOverrides: Record<string, any>
  onOverrideSaved: (override: any) => void
}) {
  const meta  = DOMAIN_META[slug] || { label: slug, Icon: FileText }
  const domainOverride = eaOverrides[`domain:${slug}`]
  const effectiveScore = domainOverride ? Number(domainOverride.override_value) : summary.score
  const style = ragStyle(effectiveScore)
  const Icon  = meta.Icon

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${style.bg} ${style.border} border-b`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${style.pill}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{meta.label}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span className={`text-xs font-semibold ${style.text}`}>
                  {domainOverride
                    ? `EA Override: ${SCORE_OPTIONS.find(o => o.value === effectiveScore)?.label?.split(' — ')[1] ?? effectiveScore} — Score ${effectiveScore}/5`
                    : `${summary.rag_label} — Score ${summary.score}/5`
                  }
                </span>
                {summary.evidence_quality && (
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${evidenceQualityStyle(summary.evidence_quality)}`}>
                    Evidence: {summary.evidence_quality}
                  </span>
                )}
              </div>
              {/* Domain score override widget */}
              {isEA && (
                <div className="mt-2">
                  <EAOverrideWidget
                    label="Override Domain Score"
                    overrideType="finding_severity"
                    targetId={`domain:${slug}`}
                    currentValue={summary.score}
                    reviewId={reviewId}
                    options={SCORE_OPTIONS}
                    existingOverride={domainOverride}
                    onSaved={onOverrideSaved}
                  />
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/60 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Executive Summary */}
          {summary.executive_summary && (
            <section className={`rounded-lg border p-4 ${style.bg} ${style.border}`}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Executive Summary</h3>
              <p className={`text-sm leading-relaxed ${style.text}`}>{summary.executive_summary}</p>
            </section>
          )}

          {/* Compliant / Gap areas */}
          {((summary.compliant_areas?.length ?? 0) > 0 || (summary.gap_areas?.length ?? 0) > 0) && (
            <section className="grid grid-cols-2 gap-4">
              {(summary.compliant_areas?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Compliant Areas
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {summary.compliant_areas!.map((area, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(summary.gap_areas?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Gap Areas
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {summary.gap_areas!.map((area, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Domain-specific sub-scores */}
          {summary.domain_specific_scores && Object.keys(summary.domain_specific_scores).length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sub-scores</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(summary.domain_specific_scores).map(([key, val]) => {
                  // Handle both numeric values and objects with rag_score
                  const score = typeof val === 'number' ? val : ((val as any)?.rag_score || 3)
                  const s = ragStyle(score)
                  return (
                    <div key={key} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${s.bg} ${s.border}`}>
                      <span className="text-xs text-gray-700 truncate">{key.replace(/_/g, ' ')}</span>
                      <span className={`text-sm font-bold ${s.text}`}>{score}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Findings', value: summary.total_findings },
              { label: 'Blockers', value: summary.blocker_count, red: true },
              { label: 'Actions',  value: summary.action_count },
              { label: 'ADRs',     value: summary.adr_count },
            ].map(s => (
              <div key={s.label} className={`rounded-lg p-3 text-center border ${s.red && s.value > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className={`text-2xl font-bold ${s.red && s.value > 0 ? 'text-red-700' : 'text-gray-800'}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Findings */}
          {summary.findings.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Findings</h3>
              <div className="space-y-3">
                {summary.findings.map((f, i) => (
                  <div key={i} className={`rounded-lg border p-4 ${f.rag_score <= 1 ? 'border-red-200 bg-red-50' : f.rag_score <= 2 ? 'border-orange-200 bg-orange-50' : f.rag_score === 3 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <span className="text-xs font-mono text-gray-500">{f.finding_id || f.principle_id || `${domainPrefix(slug)}-F${seq(i)}`}</span>
                        {f.title && <p className="text-sm font-semibold text-gray-800 mt-0.5">{f.title}</p>}
                      </div>
                      <SeverityBadge ragScore={f.rag_score} />
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{f.finding}</p>
                    {f.evidence_source && (
                      <p className="text-xs text-gray-500 mt-1.5">Evidence: <span className="font-medium">{f.evidence_source}</span></p>
                    )}
                    {f.standard_violated && (
                      <p className="text-xs text-red-600 mt-0.5">Standard violated: <span className="font-medium">{f.standard_violated}</span></p>
                    )}
                    {f.impact && (
                      <p className="text-xs text-gray-600 mt-0.5">Impact: <span className="font-medium">{f.impact}</span></p>
                    )}
                    {f.check_category && (
                      <p className="text-xs text-gray-500 mt-1">Category: <span className="font-medium">{f.check_category}</span></p>
                    )}
                    {f.artifact_ref && (
                      <p className="text-xs text-gray-500 mt-0.5">Artefact: <span className="font-medium">{f.artifact_ref}</span></p>
                    )}
                    {f.kb_ref && (
                      <p className="text-xs text-gray-500 mt-0.5">KB Ref: <span className="font-medium">{f.kb_ref}</span></p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Actions */}
          {summary.actions.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Required Actions</h3>
              <div className="space-y-2">
                {summary.actions.map((a, i) => {
                  const actionKey = a.id || a.action_id || `${domainPrefix(slug)}-A${seq(i)}`
                  const actionOverride = eaOverrides[actionKey]
                  const effectivePriority = actionOverride ? actionOverride.override_value : a.priority
                  return (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 bg-white">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <span className="text-xs font-mono text-gray-400">{a.action_id || `${domainPrefix(slug)}-A${seq(i)}`}</span>
                          {a.title && <p className="text-xs font-medium text-gray-700 mt-0.5">{a.title}</p>}
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {a.action_type && (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{a.action_type}</span>
                          )}
                          {effectivePriority && (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              effectivePriority === 'CRITICAL' ? 'bg-red-200 text-red-800' :
                              effectivePriority === 'HIGH'     ? 'bg-red-100 text-red-700' :
                              effectivePriority === 'MEDIUM'   ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {actionOverride ? <><Award className="w-2.5 h-2.5 inline mr-0.5" />{effectivePriority}</> : effectivePriority}
                            </span>
                          )}
                          {a.is_conditional_approval_gate && (
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">Gate</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-800">{a.action_text || a.action}</p>
                      {a.verification_method && (
                        <p className="text-xs text-gray-500 mt-1">Verify: <span className="font-medium">{a.verification_method}</span></p>
                      )}
                      {(a.owner_role || a.proposed_owner || a.due_days || a.proposed_due_date) && (
                        <p className="text-xs text-gray-500 mt-1">
                          {(a.owner_role || a.proposed_owner) && (
                            <span>Owner: <span className="font-medium">{a.owner_role || a.proposed_owner}</span></span>
                          )}
                          {(a.due_days || a.proposed_due_date) && (
                            <span className="ml-2">Due: <span className="font-medium">{a.proposed_due_date || `${a.due_days}d`}</span></span>
                          )}
                        </p>
                      )}
                      {isEA && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <EAOverrideWidget
                            label="Override Action Priority"
                            overrideType="action_modification"
                            targetId={actionKey}
                            currentValue={a.priority}
                            reviewId={reviewId}
                            options={PRIORITY_OPTIONS}
                            existingOverride={actionOverride}
                            onSaved={onOverrideSaved}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ADRs */}
          {summary.adrs.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Architecture Decision Records</h3>
              <div className="space-y-2">
                {summary.adrs.map((adr, i) => {
                  const adrKey = adr.id || adr.adr_id || `ADR-${domainPrefix(slug)}-${seq(i)}`
                  const adrOverride = eaOverrides[adrKey]
                  const effectiveStatus = adrOverride ? String(adrOverride.override_value) : adr.status
                  return (
                    <div key={i} className="border border-blue-100 rounded-lg p-3 bg-blue-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-semibold text-blue-700">{adr.adr_id || `ADR-${domainPrefix(slug)}-${seq(i)}`}</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {adr.domain && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                              {adr.domain}
                            </span>
                          )}
                          {(adr.adr_type || adr.type) && (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                              {adr.adr_type || adr.type}
                            </span>
                          )}
                          {effectiveStatus && (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              effectiveStatus === 'accepted'    ? 'bg-green-100 text-green-700' :
                              effectiveStatus === 'rejected'    ? 'bg-red-100 text-red-700'     :
                              effectiveStatus === 'conditional' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {adrOverride && <Award className="w-2.5 h-2.5 inline mr-0.5" />}{effectiveStatus}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-800">{adr.title || adr.decision}</p>
                      {adr.rationale && <p className="text-xs text-gray-600 mt-1">{adr.rationale}</p>}
                      {adr.waiver_expiry_date && (
                        <p className="text-xs text-amber-700 mt-1 font-medium">Waiver expires: {adr.waiver_expiry_date}</p>
                      )}
                      {isEA && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <EAOverrideWidget
                            label="Override ADR Status"
                            overrideType="adr_content"
                            targetId={adrKey}
                            currentValue={adr.status}
                            reviewId={reviewId}
                            options={ADR_STATUS_OPTIONS}
                            existingOverride={adrOverride}
                            onSaved={onOverrideSaved}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Recommendations */}
          {summary.recommendations.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Recommendations</h3>
              <div className="space-y-2">
                {summary.recommendations.map((r, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span className="text-xs font-mono text-gray-400">{r.recommendation_id || `${domainPrefix(slug)}-R${seq(i)}`}</span>
                        {r.title && <p className="text-xs font-medium text-gray-700 mt-0.5">{r.title}</p>}
                      </div>
                      {r.priority && (
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${r.priority === 'HIGH' ? 'bg-red-100 text-red-700' : r.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                          {r.priority}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800">{r.rationale || r.recommendation}</p>
                    {r.approved_pattern_ref && (
                      <p className="text-xs text-blue-600 mt-1">Pattern: {r.approved_pattern_ref}</p>
                    )}
                    {r.benefit && (
                      <p className="text-xs text-green-700 mt-0.5">Benefit: {r.benefit}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {summary.findings.length === 0 && summary.actions.length === 0 && summary.adrs.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
              <p className="text-sm">No issues found in this domain</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Domain Card ───────────────────────────────────────────────────────────────

function DomainCard({
  slug, summary, onClick,
}: {
  slug: string
  summary: DomainSummary
  onClick: () => void
}) {
  const meta  = DOMAIN_META[slug] || { label: slug, Icon: FileText }
  const style = ragStyle(summary.score)
  const Icon  = meta.Icon

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${style.border} ${style.bg} group`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${style.pill}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{meta.label}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              <span className={`text-xs font-bold ${style.text}`}>{summary.rag_label}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-2xl font-black ${style.text}`}>{summary.score}</span>
          <span className="text-xs text-gray-400">/5</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{summary.total_findings}</div>
          <div className="text-xs text-gray-500">Findings</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold ${summary.blocker_count > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {summary.blocker_count}
          </div>
          <div className="text-xs text-gray-500">Blockers</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{summary.action_count}</div>
          <div className="text-xs text-gray-500">Actions</div>
        </div>
      </div>

      <div className={`flex items-center justify-between text-xs font-medium ${style.text} group-hover:gap-2 transition-all`}>
        <span>View domain details</span>
        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReviewDashboard() {
  const navigate         = useNavigate()
  const { submissionId } = useParams<{ submissionId: string }>()
  const { user }         = useAuthStore()

  const [review,         setReview]         = useState<any>(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [activeSlug,     setActiveSlug]     = useState<string | null>(null)
  const [eaMode,         setEaMode]         = useState<string>('')
  const [eaAnnotations,  setEaAnnotations]  = useState<string>('')
  const [reworkGaps,     setReworkGaps]     = useState<string[]>([])
  const [reworkGapInput, setReworkGapInput] = useState<string>('')
  const [returnDomains,  setReturnDomains]  = useState<string[]>([])
  const [submitting,     setSubmitting]     = useState(false)
  const [eaOverrides,    setEaOverrides]    = useState<Record<string, any>>({})

  const isEA = ['enterprise_architect', 'arb_admin'].includes(user?.role || '')
  const apiBase = brand.apiRoot

  useEffect(() => {
    if (!submissionId) return
    reviewService.getReviewById(submissionId)
      .then(data => { setReview(data); setLoading(false) })
      .catch(err  => { setError(err.message || 'Failed to load review'); setLoading(false) })
  }, [submissionId])

  // Load existing EA overrides when review is available and user is EA/admin
  useEffect(() => {
    if (!submissionId || !isEA) return
    fetch(`${apiBase}/reviews/${submissionId}/overrides`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        const byTargetId: Record<string, any> = {}
        Object.values(data.overrides as Record<string, any[]>).flat().forEach((o: any) => {
          byTargetId[o.target_id] = o
        })
        setEaOverrides(byTargetId)
      })
      .catch(() => {})
  }, [submissionId, isEA])

  const handleOverrideSaved = (override: any) => {
    setEaOverrides(prev => ({ ...prev, [override.target_id]: override }))
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const domainSummaries: Record<string, DomainSummary> = (() => {
    if (review?.domain_summaries && Object.keys(review.domain_summaries).length > 0) {
      return review.domain_summaries
    }
    const ai_review = review?.report_json?.ai_review || {}
    const findings_raw = [...(ai_review.findings || []), ...(ai_review.blockers || [])]
    const actions_raw  = ai_review.actions || []
    const adrs_raw     = ai_review.adrs    || []
    const recs_raw     = ai_review.recommendations || []
    const domain_scores_raw = ai_review.domain_scores || {}

    const groupBySlug = (items: any[]) => {
      const grouped: Record<string, any[]> = {}
      for (const item of items) {
        const slug = item.domain_slug || item.domain || ''
        if (slug) { grouped[slug] = grouped[slug] || []; grouped[slug].push(item) }
      }
      return grouped
    }
    const findingsByDomain = groupBySlug(findings_raw)
    const actionsByDomain  = groupBySlug(actions_raw)
    const adrsByDomain     = groupBySlug(adrs_raw)
    const recsByDomain     = groupBySlug(recs_raw)

    const allSlugs = new Set([
      ...Object.keys(domain_scores_raw),
      ...Object.keys(findingsByDomain),
      ...Object.keys(actionsByDomain),
      ...Object.keys(adrsByDomain),
      ...Object.keys(recsByDomain),
    ])

    const summaries: Record<string, DomainSummary> = {}
    for (const slug of allSlugs) {
      const f_list   = findingsByDomain[slug] || []
      const a_list   = actionsByDomain[slug]  || []
      const r_list   = adrsByDomain[slug]     || []
      const rec_list = recsByDomain[slug]     || []
      const score    = domain_scores_raw[slug] || 3
      const f_sorted = [...f_list].sort((a, b) => (a.rag_score || 3) - (b.rag_score || 3))
      summaries[slug] = {
        score,
        rag_label:      score <= 2 ? 'RED' : score === 3 ? 'AMBER' : 'GREEN',
        total_findings: f_list.length,
        blocker_count:  f_list.filter(f => (f.rag_score || 5) <= 1).length,
        critical_count: f_list.filter(f => (f.rag_score || 5) <= 2).length,
        action_count:   a_list.length,
        adr_count:      r_list.length,
        findings:       f_sorted,
        actions:        a_list,
        adrs:           r_list,
        recommendations: rec_list,
      }
    }
    return summaries
  })()

  const orderedSlugs = DOMAIN_ORDER.filter(s => domainSummaries[s])
    .concat(Object.keys(domainSummaries).filter(s => !DOMAIN_ORDER.includes(s)))

  const recDecision = review?.recommended_decision || review?.report_json?.ai_review?.decision
  const aggScore    = review?.aggregate_rag_score ?? review?.report_json?.ai_review?.aggregate_score ?? 0
  const recMeta     = decisionMeta(recDecision)
  const RecIcon     = recMeta.Icon
  const aggStyle    = ragStyle(aggScore)

  // Prefer table-fetched data; fall back to what's embedded in report_json.ai_review
  const displayActions = (review?.actions || []).length > 0
    ? review.actions
    : review?.report_json?.ai_review?.actions || []
  const displayAdrs = (review?.adrs || []).length > 0
    ? review.adrs
    : review?.report_json?.ai_review?.adrs || []

  const totalFindings = orderedSlugs.reduce((n, s) => n + (domainSummaries[s]?.total_findings || 0), 0)
  const totalBlockers = (review?.blockers || []).length || orderedSlugs.reduce((n, s) => n + (domainSummaries[s]?.blocker_count || 0), 0)
  const totalActions  = displayActions.length
  const totalADRs     = displayAdrs.length

  // ── EA submission ─────────────────────────────────────────────────────────────

  const handleOpenForEA = async () => {
    if (!submissionId) return
    setSubmitting(true)
    const apiBase = brand.apiRoot
    try {
      const resp = await fetch(`${apiBase}/reviews/${submissionId}/open`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      if (!resp.ok) throw new Error(await resp.text())
      const updated = await reviewService.getReviewById(submissionId)
      setReview(updated)
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEaDecision = async () => {
    if (!submissionId || !eaMode) return
    setSubmitting(true)
    const apiBase = brand.apiRoot
    try {
      const payload: any = { ea_decision: eaMode, ea_annotations: eaAnnotations || null }

      if (eaMode === 'CONDITIONALLY_APPROVE') {
        if (!eaAnnotations.trim()) { alert('Provide conditions / rationale for conditional approval'); setSubmitting(false); return }
      } else if (eaMode === 'RETURN') {
        if (returnDomains.length === 0) { alert('Select at least one domain that needs rework'); setSubmitting(false); return }
        if (reworkGaps.length === 0) { alert('Add at least one rework gap before returning'); setSubmitting(false); return }
        payload.return_domains = returnDomains
        payload.rework_gaps = reworkGaps
      } else if (eaMode === 'DEFER') {
        if (eaAnnotations.trim().length < 50) { alert('Deferral requires a rationale of at least 50 characters'); setSubmitting(false); return }
        payload.decision_rationale = eaAnnotations
      }

      const resp = await fetch(`${apiBase}/reviews/${submissionId}/ea-decision`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) throw new Error(await resp.text())
      navigate('/dashboard')
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading ARB dossier…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{error}</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Dashboard
            </Button>
            <div className="h-5 w-px bg-gray-200" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-gray-900 leading-tight">
                  {review?.solution_name || 'ARB Review'}
                </h1>
                {review?.classification && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">
                    {review.classification}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-mono">
                {review?.arb_ref || (submissionId ? toARBRef(submissionId, review?.created_at) : '')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              review?.status === 'ea_reviewing'          ? 'bg-purple-100 text-purple-700' :
              review?.status === 'review_ready'          ? 'bg-blue-100 text-blue-700'     :
              review?.status === 'analysing'             ? 'bg-blue-100 text-blue-600'     :
              review?.status === 'approved'              ? 'bg-green-100 text-green-700'   :
              review?.status === 'conditionally_approved'? 'bg-teal-100 text-teal-700'     :
              review?.status === 'rejected'              ? 'bg-red-100 text-red-700'       :
              review?.status === 'returned'              ? 'bg-amber-100 text-amber-700'   :
              review?.status === 'deferred'              ? 'bg-orange-100 text-orange-700' :
              review?.status === 'closed'                ? 'bg-gray-200 text-gray-700'     :
              'bg-gray-100 text-gray-600'
            }`}>
              {(review?.status || '').replace(/_/g, ' ').toUpperCase()}
            </span>
            {review?.reviewed_at && (
              <span className="text-xs text-gray-400">
                Reviewed {new Date(review.reviewed_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── AI Recommendation Banner ── */}
        {recDecision ? (
          <div className={`rounded-xl border-2 p-5 ${aggStyle.border} ${aggStyle.bg}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${aggStyle.pill}`}>
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Agent Recommendation</p>
                  <div className="flex items-center gap-2 mt-1">
                    <RecIcon className="w-5 h-5" />
                    <span className={`text-xl font-black ${aggStyle.text}`}>{recMeta.label.toUpperCase()}</span>
                    {review?.aggregate_rag_label && (
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${aggStyle.pill}`}>
                        {review.aggregate_rag_label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => generateARBReportPDF(review)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                <div className="h-8 w-px bg-gray-300" />
                <div className="flex gap-6 text-center">
                  <div>
                    <div className={`text-3xl font-black ${aggStyle.text}`}>{aggScore}</div>
                    <div className="text-xs text-gray-500">Agg. Score /5</div>
                  </div>
                  <div>
                    <div className={`text-3xl font-black ${totalBlockers > 0 ? 'text-red-700' : 'text-gray-700'}`}>{totalBlockers}</div>
                    <div className="text-xs text-gray-500">Blockers</div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-gray-700">{totalFindings}</div>
                    <div className="text-xs text-gray-500">Findings</div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-gray-700">{totalActions}</div>
                    <div className="text-xs text-gray-500">Actions</div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-gray-700">{totalADRs}</div>
                    <div className="text-xs text-gray-500">ADRs</div>
                  </div>
                </div>
              </div>
            </div>
            {review?.decision_rationale && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">AI Rationale</p>
                <p className="text-sm text-gray-700 italic">{review.decision_rationale}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm font-medium">AI review not yet complete</p>
            <p className="text-gray-400 text-xs mt-1">Trigger the review from the dashboard to run the AI agent.</p>
          </div>
        )}

        {/* ── Blockers ── */}
        {(review?.blockers || []).length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-500" />
              Blockers — Must Resolve Before Approval ({review.blockers.length})
            </h2>
            <div className="space-y-3">
              {review.blockers.map((b: any, i: number) => (
                <div key={b.id || i} className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                        {b.blocker_id || `BLK-${String(i + 1).padStart(2, '0')}`}
                      </span>
                      {b.is_security_or_dr && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-700 text-white font-semibold">SEC/DR</span>
                      )}
                      {b.domain && (
                        <span className="text-xs text-gray-500 font-medium">{b.domain.toUpperCase()}</span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${b.status === 'OPEN' || !b.status ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {b.status || 'OPEN'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">{b.title || b.description}</p>
                  {b.description && b.title && (
                    <p className="text-sm text-gray-700 mb-2">{b.description}</p>
                  )}
                  {b.violated_standard && (
                    <p className="text-xs text-red-700 mt-1">Standard violated: <span className="font-medium">{b.violated_standard}</span></p>
                  )}
                  {b.impact && (
                    <p className="text-xs text-gray-600 mt-0.5">Impact: <span className="font-medium">{b.impact}</span></p>
                  )}
                  {b.resolution_required && (
                    <div className="mt-2 bg-white rounded-lg px-3 py-2 border border-red-100">
                      <p className="text-xs font-semibold text-gray-600">Resolution Required:</p>
                      <p className="text-xs text-gray-700 mt-0.5">{b.resolution_required}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Domain Cards Grid ── */}
        {orderedSlugs.length > 0 ? (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Domain Assessment — click a card to see findings
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {orderedSlugs.map(slug => (
                <DomainCard
                  key={slug}
                  slug={slug}
                  summary={domainSummaries[slug]}
                  onClick={() => setActiveSlug(slug)}
                />
              ))}
            </div>
          </section>
        ) : (
          recDecision && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              <p className="text-sm">No domain-level data found. Re-run the AI review to populate domain summaries.</p>
            </div>
          )
        )}

        {/* ── ADRs Section ── */}
        {displayAdrs.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Architecture Decision Records ({displayAdrs.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {displayAdrs.map((adr: any, i: number) => {
                const adrKey = adr.id || adr.adr_id || `ADR-${seq(i)}`
                const adrOverride = eaOverrides[adrKey]
                const effectiveStatus = adrOverride ? String(adrOverride.override_value) : adr.status
                return (
                  <div key={adr.id || i} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {adr.adr_id || `ADR-${seq(i)}`}
                      </span>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {adr.adr_type && (
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-600">
                            {adr.adr_type}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded font-medium flex items-center gap-0.5 ${
                          effectiveStatus === 'accepted'    ? 'bg-green-100 text-green-700'  :
                          effectiveStatus === 'rejected'    ? 'bg-red-100 text-red-700'      :
                          effectiveStatus === 'conditional' ? 'bg-amber-100 text-amber-700'  :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {adrOverride && <Award className="w-2.5 h-2.5" />}{effectiveStatus}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">{adr.title || adr.decision}</p>
                    {adr.rationale && (
                      <p className="text-xs text-gray-500 line-clamp-2">{adr.rationale}</p>
                    )}
                    {adr.waiver_expiry_date && (
                      <p className="text-xs text-amber-700 mt-1 font-medium">Waiver expires: {adr.waiver_expiry_date}</p>
                    )}
                    {adr.proposed_target_date && (
                      <p className="text-xs text-gray-400 mt-1">Target: {adr.proposed_target_date}</p>
                    )}
                    {isEA && submissionId && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <EAOverrideWidget
                          label="Override ADR Status"
                          overrideType="adr_content"
                          targetId={adrKey}
                          currentValue={adr.status}
                          reviewId={submissionId}
                          options={ADR_STATUS_OPTIONS}
                          existingOverride={adrOverride}
                          onSaved={handleOverrideSaved}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Actions Section ── */}
        {displayActions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Open Actions ({displayActions.filter((a: any) => !a.status || a.status === 'open').length} open / {displayActions.length} total)
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Owner</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Due</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayActions.map((ac: any, idx: number) => {
                    const actionKey = ac.id || ac.action_id || `ACT-${seq(idx)}`
                    const actionOverride = eaOverrides[actionKey]
                    const effectivePriority = actionOverride ? String(actionOverride.override_value) : ac.priority
                    return (
                      <tr key={ac.id || idx} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-800 max-w-sm">
                          <div className="flex items-start gap-2">
                            <div>
                              {(ac.action_type || ac.is_conditional_approval_gate) && (
                                <div className="flex gap-1 mb-0.5">
                                  {ac.action_type && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{ac.action_type}</span>
                                  )}
                                  {ac.is_conditional_approval_gate && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">Gate</span>
                                  )}
                                </div>
                              )}
                              <p className="line-clamp-2">{ac.title || ac.action_text || ac.action}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {(ac.confirmed_owner || ac.proposed_owner || ac.owner_role)?.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {ac.confirmed_due_date || ac.proposed_due_date || ac.due_date || (ac.due_days ? `${ac.due_days}d` : '—')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="space-y-1">
                            {effectivePriority && (
                              <span className={`text-xs px-2 py-0.5 rounded font-medium flex items-center gap-0.5 w-fit ${
                                effectivePriority === 'CRITICAL' ? 'bg-red-200 text-red-800' :
                                effectivePriority === 'HIGH'     ? 'bg-red-100 text-red-700' :
                                effectivePriority === 'MEDIUM'   ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {actionOverride && <Award className="w-2.5 h-2.5" />}{effectivePriority}
                              </span>
                            )}
                            {isEA && submissionId && (
                              <EAOverrideWidget
                                label="Override Priority"
                                overrideType="action_modification"
                                targetId={actionKey}
                                currentValue={ac.priority}
                                reviewId={submissionId}
                                options={PRIORITY_OPTIONS}
                                existingOverride={actionOverride}
                                onSaved={handleOverrideSaved}
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            ac.status === 'completed'   ? 'bg-green-100 text-green-700'  :
                            ac.status === 'in_progress' ? 'bg-blue-100 text-blue-700'    :
                            ac.status === 'closed'      ? 'bg-gray-200 text-gray-600'    :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {ac.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── NFR Scorecard ── */}
        {(review?.nfr_scorecard || []).length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-500" />
              NFR Scorecard ({review.nfr_scorecard.length} categories)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {review.nfr_scorecard.map((nfr: any, i: number) => {
                const s = ragStyle(nfr.rag_score)
                return (
                  <div key={nfr.id || i} className={`rounded-xl border-2 p-4 ${s.border} ${s.bg}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wide ${s.text}`}>
                          {(nfr.nfr_category || '').replace(/_/g, ' ')}
                        </p>
                        {nfr.is_mandatory_green && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold mt-0.5 inline-block">
                            MANDATORY
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-black ${s.text}`}>{nfr.rag_score}</span>
                        <p className="text-xs text-gray-400">/5</p>
                      </div>
                    </div>
                    {nfr.slo_target && (
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">SLO:</span> {nfr.slo_target}
                      </p>
                    )}
                    {nfr.actual_evidenced && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        <span className="font-medium">Evidenced:</span> {nfr.actual_evidenced}
                      </p>
                    )}
                    {(nfr.gaps || []).length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-amber-700">Gaps:</p>
                        <ul className="mt-0.5 space-y-0.5">
                          {nfr.gaps.slice(0, 2).map((gap: string, j: number) => (
                            <li key={j} className="text-xs text-amber-800">• {gap}</li>
                          ))}
                          {nfr.gaps.length > 2 && (
                            <li className="text-xs text-amber-600">+{nfr.gaps.length - 2} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── EA Gate 2 Decision Panel ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-gray-900">Enterprise Architect Gate 2 Decision</h2>
            {(review?.return_count ?? 0) > 0 && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                review.return_count >= 3 ? 'bg-red-100 text-red-700' :
                review.return_count >= 2 ? 'bg-amber-100 text-amber-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                Returned {review.return_count}×
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-5">Record your EA decision for this ARB submission.</p>

          {/* ── review_ready: not yet opened by EA ── */}
          {review?.status === 'review_ready' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">AI Review Complete — Ready for EA</p>
                <p className="text-sm text-gray-500 mt-1">Open the dossier to begin your Gate 2 review.</p>
              </div>
              <Button onClick={handleOpenForEA} disabled={submitting} className="flex items-center gap-2">
                {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Open for EA Review
              </Button>
            </div>
          )}

          {/* ── Completed: read-only EA decision record ── */}
          {review?.ea_review && review?.status !== 'review_ready' && review?.status !== 'ea_reviewing' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-medium text-green-700">EA Decision Recorded</span>
                {review.ea_review.reviewed_at && (
                  <span className="text-xs text-gray-400 ml-1">
                    {new Date(review.ea_review.reviewed_at).toLocaleDateString()}
                  </span>
                )}
                {review.ea_review.ea_name && (
                  <span className="text-xs text-gray-500 ml-1">by {review.ea_review.ea_name}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">EA Decision</p>
                  <p className={`text-sm font-bold ${
                    review.ea_review.ea_decision === 'APPROVE'               ? 'text-green-700' :
                    review.ea_review.ea_decision === 'CONDITIONALLY_APPROVE' ? 'text-teal-700'  :
                    review.ea_review.ea_decision === 'RETURN'                ? 'text-amber-700' :
                    review.ea_review.ea_decision === 'DEFER'                 ? 'text-orange-700':
                    'text-gray-700'
                  }`}>
                    {(review.ea_review.ea_decision || '').replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Review Status</p>
                  <p className="text-sm font-medium text-gray-800">
                    {(review.status || '').replace(/_/g, ' ').toUpperCase()}
                  </p>
                </div>
              </div>
              {review.ea_review.ea_annotations && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">EA Annotations</p>
                  <p className="text-sm text-gray-700">{review.ea_review.ea_annotations}</p>
                </div>
              )}
              {(review.ea_review.return_domains || []).length > 0 && (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 mb-3">
                  <p className="text-xs font-semibold text-amber-700 uppercase mb-2">Domains Flagged for Rework</p>
                  <div className="flex flex-wrap gap-2">
                    {review.ea_review.return_domains.map((slug: string) => (
                      <span key={slug} className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-300 capitalize">
                        {slug.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(review.ea_review.rework_gaps || []).length > 0 && (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-700 uppercase mb-2">Rework Required</p>
                  <ul className="space-y-1">
                    {review.ea_review.rework_gaps.map((gap: string, i: number) => (
                      <li key={i} className="text-sm text-amber-800 flex items-start gap-2">
                        <span className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── ea_reviewing: active 4-outcome decision form ── */}
          {review?.status === 'ea_reviewing' && !review?.ea_review && (
            <>
              <div className="mb-5">
                <p className="text-sm font-medium text-gray-700 mb-3">Select your Gate 2 outcome:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    {
                      key:         'APPROVE',
                      label:       'Approve',
                      desc:        'All domains green — approve to proceed',
                      Icon:        CheckCircle,
                      activeColor: 'border-green-500 bg-green-100',
                      idleColor:   'border-green-200 bg-green-50 hover:border-green-400',
                      textColor:   'text-green-800',
                    },
                    {
                      key:         'CONDITIONALLY_APPROVE',
                      label:       'Approve with Conditions',
                      desc:        'Approve subject to outstanding actions being closed',
                      Icon:        AlertCircle,
                      activeColor: 'border-teal-500 bg-teal-100',
                      idleColor:   'border-teal-200 bg-teal-50 hover:border-teal-400',
                      textColor:   'text-teal-800',
                    },
                    {
                      key:         'RETURN',
                      label:       'Return to SA',
                      desc:        'Targeted rework — SA resubmits affected domains',
                      Icon:        XCircle,
                      activeColor: 'border-amber-500 bg-amber-100',
                      idleColor:   'border-amber-200 bg-amber-50 hover:border-amber-400',
                      textColor:   'text-amber-800',
                    },
                    {
                      key:         'DEFER',
                      label:       'Defer',
                      desc:        'Terminal — submission must restart from scratch',
                      Icon:        Flag,
                      activeColor: 'border-red-400 bg-red-100',
                      idleColor:   'border-red-200 bg-red-50 hover:border-red-300',
                      textColor:   'text-red-800',
                    },
                  ].map(opt => {
                    const isActive = eaMode === opt.key
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setEaMode(isActive ? '' : opt.key)}
                        className={`text-left rounded-xl border-2 p-4 transition-all ${isActive ? opt.activeColor : opt.idleColor}`}
                      >
                        <opt.Icon className={`w-5 h-5 mb-2 ${opt.textColor}`} />
                        <p className={`text-sm font-semibold ${opt.textColor}`}>{opt.label}</p>
                        <p className={`text-xs mt-1 opacity-70 ${opt.textColor}`}>{opt.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* CONDITIONALLY_APPROVE — rationale required */}
              {eaMode === 'CONDITIONALLY_APPROVE' && (
                <div className="border border-teal-200 rounded-xl p-4 bg-teal-50 mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conditions <span className="text-gray-400 font-normal">(required — describe what must be closed)</span>
                  </label>
                  <Textarea
                    value={eaAnnotations}
                    onChange={e => setEaAnnotations(e.target.value)}
                    placeholder="e.g. DR runbook must be signed off before go-live; security pen-test evidence required within 30 days…"
                    rows={3}
                  />
                </div>
              )}

              {/* RETURN — domain selector + rework gaps */}
              {eaMode === 'RETURN' && (
                <div className="border border-amber-200 rounded-xl p-4 bg-amber-50 space-y-4 mb-4">

                  {/* Step 1 — domain selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Domains Requiring Rework <span className="text-red-500">*</span>
                      <span className="text-gray-400 font-normal ml-1">(select all that apply)</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(review?.domain_summaries || {}).map(([slug, summary]: [string, any]) => {
                        const isSelected = returnDomains.includes(slug)
                        const ragLabel   = (summary?.rag_label || 'UNKNOWN').toUpperCase()
                        const ragColor   = ragLabel === 'GREEN' || ragLabel === 'GREEN+'
                          ? 'bg-green-100 text-green-700'
                          : ragLabel === 'AMBER'
                          ? 'bg-amber-200 text-amber-800'
                          : 'bg-red-100 text-red-700'
                        return (
                          <button
                            key={slug}
                            type="button"
                            onClick={() => setReturnDomains(
                              isSelected
                                ? returnDomains.filter(d => d !== slug)
                                : [...returnDomains, slug]
                            )}
                            className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left transition-all ${
                              isSelected
                                ? 'border-amber-500 bg-white shadow-sm'
                                : 'border-gray-200 bg-white hover:border-amber-300'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 ${
                              isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 capitalize leading-tight">
                                {slug.replace(/_/g, ' ')}
                              </p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ragColor}`}>
                                {ragLabel}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {returnDomains.length > 0 && (
                      <p className="text-xs text-amber-700 mt-2">
                        {returnDomains.length} domain{returnDomains.length > 1 ? 's' : ''} selected:{' '}
                        {returnDomains.map(d => d.replace(/_/g, ' ')).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Step 2 — rework gaps */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rework Gaps <span className="text-red-500">*</span>
                      <span className="text-gray-400 font-normal ml-1">(at least one required)</span>
                    </label>
                    <div className="space-y-2 mb-3">
                      {reworkGaps.map((gap, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-amber-100">
                          <span className="text-xs font-mono text-amber-600 w-5">{i + 1}.</span>
                          <p className="text-sm text-gray-800 flex-1">{gap}</p>
                          <button onClick={() => setReworkGaps(reworkGaps.filter((_, j) => j !== i))} className="text-amber-400 hover:text-amber-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={reworkGapInput}
                        onChange={e => setReworkGapInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && reworkGapInput.trim()) {
                            setReworkGaps([...reworkGaps, reworkGapInput.trim()])
                            setReworkGapInput('')
                          }
                        }}
                        placeholder="Describe a gap the SA must address…"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:outline-none"
                      />
                      <Button variant="outline" size="sm"
                        onClick={() => { if (reworkGapInput.trim()) { setReworkGaps([...reworkGaps, reworkGapInput.trim()]); setReworkGapInput('') } }}
                        className="flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </Button>
                    </div>
                  </div>

                  {/* Step 3 — optional annotations */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      EA Annotations <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <Textarea value={eaAnnotations} onChange={e => setEaAnnotations(e.target.value)} placeholder="Additional notes for the Solution Architect…" rows={2} />
                  </div>
                </div>
              )}

              {/* DEFER — rationale ≥ 50 chars */}
              {eaMode === 'DEFER' && (
                <div className="border border-red-200 rounded-xl p-4 bg-red-50 mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deferral Rationale <span className="text-red-500 font-normal">(min 50 characters — this is terminal)</span>
                  </label>
                  <Textarea
                    value={eaAnnotations}
                    onChange={e => setEaAnnotations(e.target.value)}
                    placeholder="Explain why this submission must be deferred and what a restart would need to address…"
                    rows={4}
                  />
                  <p className={`text-xs mt-1 ${eaAnnotations.trim().length < 50 ? 'text-red-500' : 'text-green-600'}`}>
                    {eaAnnotations.trim().length} / 50 characters
                  </p>
                </div>
              )}

              {eaMode && (
                <Button
                  onClick={handleEaDecision}
                  disabled={submitting || (eaMode === 'DEFER' && eaAnnotations.trim().length < 50)}
                  className={`flex items-center gap-2 ${
                    eaMode === 'APPROVE'               ? 'bg-green-600 hover:bg-green-700' :
                    eaMode === 'CONDITIONALLY_APPROVE' ? 'bg-teal-600 hover:bg-teal-700'  :
                    eaMode === 'RETURN'                ? 'bg-amber-600 hover:bg-amber-700' :
                    'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : eaMode === 'APPROVE' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : eaMode === 'RETURN' ? (
                    <XCircle className="w-4 h-4" />
                  ) : eaMode === 'DEFER' ? (
                    <Flag className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {eaMode === 'APPROVE'               ? 'Confirm Approval'
                   : eaMode === 'CONDITIONALLY_APPROVE'? 'Confirm Conditional Approval'
                   : eaMode === 'RETURN'               ? 'Return to Solution Architect'
                   : 'Defer Submission'}
                </Button>
              )}
            </>
          )}
        </section>
      </main>

      {/* ── Domain Detail Panel ── */}
      {activeSlug && domainSummaries[activeSlug] && submissionId && (
        <DomainDetailPanel
          slug={activeSlug}
          summary={domainSummaries[activeSlug]}
          onClose={() => setActiveSlug(null)}
          reviewId={submissionId}
          isEA={isEA}
          eaOverrides={eaOverrides}
          onOverrideSaved={handleOverrideSaved}
        />
      )}
    </div>
  )
}
