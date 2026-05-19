import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, X, CheckCircle, XCircle, AlertCircle, Clock,
  AlertTriangle, FileText, Zap, Download,
  Flag, Award, Plus, Trash2, Pencil, Check, Filter,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Textarea } from '../components/ui/Textarea'
import { reviewService } from '../services/backendConfig'
import { generateARBReportPDF } from '../services/pdfService'
import { toARBRef } from '../utils/reviewRef'
import { useAuthStore } from '../stores/authStore'
import { useMetadataStore } from '../stores/metadataStore'
import { Pill, getDomainIcon } from '../components/ui/ds'


// ── Domain short-code normalisation (LLM outputs "SOL", "APP" etc.) ──────────
// The domain agent prompt uses 3-letter codes; normalise them to full DB slugs
// so filtering works regardless of which code path stored the domain field.
const DOMAIN_CODE_TO_SLUG: Record<string, string> = {
  // 3-letter codes from LLM prompt
  SOL: 'solution', BUS: 'business', APP: 'application',
  INT: 'integration', DAT: 'data', INF: 'infrastructure',
  DSO: 'devsecops', NFR: 'nfr',
}
// Legacy edge-function slugs stored before the agentDomainMap fix
const LEGACY_SLUG_MAP: Record<string, string> = {
  infra:        'infrastructure',
  security:     'infrastructure',
  engg_quality: 'devsecops',
  software:     'application',
  api:          'integration',
}
function normaliseDomainSlug(v: string | null | undefined): string {
  if (!v) return ''
  return DOMAIN_CODE_TO_SLUG[v.toUpperCase()] ?? LEGACY_SLUG_MAP[v.toLowerCase()] ?? v
}

// ── Domain meta lookup hook (built from DB domains) ─────────────────────────

type DomainMeta = Record<string, { label: string; Icon: React.ElementType }>

function useDomainMeta(): { domainMeta: DomainMeta; domainOrder: string[] } {
  const { domains, loadMetadata } = useMetadataStore()
  useEffect(() => { if (domains.length === 0) loadMetadata() }, [])
  const domainMeta = useMemo<DomainMeta>(
    () => Object.fromEntries(domains.map(d => [d.slug, { label: d.name, Icon: getDomainIcon(d.icon) }])),
    [domains]
  )
  const domainOrder = useMemo(
    () => [...domains].sort((a, b) => (a.seq_number ?? 99) - (b.seq_number ?? 99)).map(d => d.slug),
    [domains]
  )
  return { domainMeta, domainOrder }
}

// ── RAG helpers ───────────────────────────────────────────────────────────────

interface RagStyle { bg: string; text: string; border: string; dot: string; pill: string }

function ragStyle(score: number): RagStyle {
  if (score <= 2) return { bg: 'bg-red-50',    text: 'text-red-800',    border: 'border-red-200',    dot: 'bg-red-500',    pill: 'bg-red-100 text-red-800' }
  if (score === 3) return { bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-200',  dot: 'bg-amber-500',  pill: 'bg-amber-100 text-amber-800' }
  return               { bg: 'bg-green-50',   text: 'text-green-800',  border: 'border-green-200',  dot: 'bg-green-500',  pill: 'bg-green-100 text-green-800' }
}

function ragTileBar(score: number) {
  if (score <= 2)  return '#E53935'
  if (score === 3) return '#F59E0B'
  return '#16A34A'
}

function ragTileBg(score: number) {
  if (score <= 2)  return '#FEF2F2'
  if (score === 3) return '#FFFBEB'
  return '#F0FDF4'
}

function ragTileText(score: number) {
  if (score <= 2)  return '#991B1B'
  if (score === 3) return '#92400E'
  return '#14532D'
}

// ── Constants ──────────────────────────────────────────────────────────────────

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

function seq(n: number) { return String(n + 1).padStart(2, '0') }

function evidenceQualityStyle(quality?: string): string {
  switch ((quality || '').toUpperCase()) {
    case 'STRONG':   return 'bg-green-100 text-green-700'
    case 'ADEQUATE': return 'bg-blue-100 text-blue-700'
    case 'WEAK':     return 'bg-amber-100 text-amber-700'
    case 'ABSENT':   return 'bg-red-100 text-red-700'
    default:         return 'bg-gray-100 text-gray-600'
  }
}

function SeverityBadge({ ragScore }: { ragScore?: number }) {
  const score = ragScore ?? 3
  const label = score <= 1 ? 'Blocker' : score === 2 ? 'Critical' : score === 3 ? 'Major' : 'Minor'
  const cls   = score <= 1 ? 'bg-red-600 text-white' : score === 2 ? 'bg-red-100 text-red-800'
              : score === 3 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{label}</span>
}

// ── DomainSummary interface ───────────────────────────────────────────────────

interface DomainSummary {
  score: number; rag_label: string; total_findings: number; blocker_count: number
  critical_count: number; action_count: number; adr_count: number
  findings: any[]; actions: any[]; adrs: any[]; recommendations: any[]
  executive_summary?: string; overall_readiness?: string
  compliant_areas?: string[]; gap_areas?: string[]
  evidence_quality?: string; domain_specific_scores?: Record<string, number>
}

// ── EAOverrideWidget (preserved) ──────────────────────────────────────────────

function EAOverrideWidget({
  label, overrideType, targetId, currentValue, reviewId,
  options, existingOverride, onSaved,
}: {
  label: string; overrideType: string; targetId: string; currentValue: any
  reviewId: string; options: { value: any; label: string }[]
  existingOverride?: any; onSaved: (override: any) => void
}) {
  const [open,      setOpen]      = useState(false)
  const [value,     setValue]     = useState('')
  const [rationale, setRationale] = useState('')
  const [saving,    setSaving]    = useState(false)

  const handleSave = async () => {
    if (!value || rationale.trim().length < 10) return
    setSaving(true)
    try {
      const parsedValue = options.find(o => String(o.value) === value)?.value ?? value
      const result = await reviewService.saveEAOverride(reviewId, {
        override_type: overrideType, target_id: targetId,
        original_value: currentValue, override_value: parsedValue,
        rationale: rationale.trim()
      })
      onSaved(result); setOpen(false); setValue(''); setRationale('')
    } catch (e: any) {
      alert(`Override failed: ${e.message}`)
    } finally { setSaving(false) }
  }

  if (existingOverride && !open) {
    const overrideLabel = options.find(o => String(o.value) === String(existingOverride.override_value))?.label ?? String(existingOverride.override_value)
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold flex items-center gap-1">
          <Award className="w-3 h-3" /> EA Override: {overrideLabel}
        </span>
        <span className="text-xs text-gray-400 italic truncate max-w-xs">{existingOverride.rationale}</span>
        <button
          onClick={() => {
            setValue(String(existingOverride.override_value))
            setRationale(existingOverride.rationale || '')
            setOpen(true)
          }}
          className="text-xs px-1.5 py-0.5 rounded border flex items-center gap-1 font-medium transition-colors"
          style={{ borderColor: 'rgba(217,138,0,0.3)', color: '#D98A00' }}
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
      </div>
    )
  }

  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="text-xs px-2 py-0.5 rounded border border-gold-200 text-gold-600 hover:bg-gold-100 flex items-center gap-1 font-medium transition-colors"
          style={{ borderColor: 'rgba(217,138,0,0.3)', color: '#D98A00' }}>
          <Pencil className="w-3 h-3" /> Override
        </button>
      ) : (
        <div className="border border-purple-200 rounded-lg p-3 bg-purple-50 space-y-2 mt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-purple-700">{label}</p>
            <button onClick={() => setOpen(false)} className="text-purple-400 hover:text-purple-600"><X className="w-3 h-3" /></button>
          </div>
          <select value={value} onChange={e => setValue(e.target.value)}
            className="w-full text-xs border border-purple-200 rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-300">
            <option value="">Select new value…</option>
            {options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
          </select>
          <Textarea value={rationale} onChange={e => setRationale(e.target.value)}
            placeholder="Rationale for override (min 10 characters)…" rows={2} className="text-xs" />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !value}
              className="text-xs bg-purple-600 hover:bg-purple-700 text-white">
              {saving ? 'Saving…' : 'Save Override'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DomainDetailPanel (preserved) ────────────────────────────────────────────

function DomainDetailPanel({ slug, summary, onClose, reviewId, isEA, eaOverrides, onOverrideSaved }: {
  slug: string; summary: DomainSummary; onClose: () => void; reviewId: string
  isEA: boolean; eaOverrides: Record<string, any>; onOverrideSaved: (override: any) => void
}) {
  const { domainMeta } = useDomainMeta()
  const meta = domainMeta[slug] || { label: slug, Icon: FileText }
  const domainOverride = eaOverrides[`domain:${slug}`]
  const effectiveScore = domainOverride ? Number(domainOverride.override_value) : summary.score
  const style = ragStyle(effectiveScore)
  const Icon  = meta.Icon

  return (
    <div className="bg-white rounded-[12px] border border-line flex flex-col">
      <div className={`flex items-center justify-between px-4 py-3 border-b ${style.bg} ${style.border} rounded-t-[12px]`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${style.pill}`}><Icon className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg font-bold">{meta.label}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span className={`text-xs font-semibold ${style.text}`}>
                  {domainOverride
                    ? `EA Override: ${SCORE_OPTIONS.find(o => o.value === effectiveScore)?.label?.split(' — ')[1] ?? effectiveScore} — Score ${effectiveScore}/5`
                    : `${summary.rag_label} — Score ${summary.score}/5`}
                </span>
                {summary.evidence_quality && (
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${evidenceQualityStyle(summary.evidence_quality)}`}>
                    Evidence: {summary.evidence_quality}
                  </span>
                )}
              </div>
              {isEA && (
                <div className="mt-2">
                  <EAOverrideWidget label="Override Domain Score" overrideType="finding_severity" targetId={`domain:${slug}`}
                    currentValue={summary.score} reviewId={reviewId} options={SCORE_OPTIONS}
                    existingOverride={domainOverride} onSaved={onOverrideSaved} />
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/60 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-3">
          {summary.executive_summary ? (
            <section className={`rounded-lg border p-3 ${style.bg} ${style.border}`}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Executive Summary</h3>
              <p className={`text-sm leading-relaxed ${style.text}`}>{summary.executive_summary}</p>
            </section>
          ) : (
            <p className="text-xs text-gray-400 italic">No executive summary available</p>
          )}
          {(summary.compliant_areas?.length ?? 0) > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Compliant Areas</h3>
              <div className="flex flex-wrap gap-1">
                {summary.compliant_areas!.map((area, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{area}</span>)}
              </div>
            </section>
          )}
          {(summary.gap_areas?.length ?? 0) > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Gap Areas</h3>
              <div className="flex flex-wrap gap-1">
                {summary.gap_areas!.map((area, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{area}</span>)}
              </div>
            </section>
          )}
        </div>
    </div>
  )
}

// ── RecommendationBanner ──────────────────────────────────────────────────────

const REC_META: Record<string, { label: string }> = {
  approve:                 { label: 'Approve' },
  approve_with_conditions: { label: 'Approve · with Actions' },
  conditionally_approved:  { label: 'Approve · with Actions' },
  defer:                   { label: 'Defer' },
  reject:                  { label: 'Reject' },
}

function RecommendationBanner({ review, totalFindings, totalBlockers, totalActions, totalADRs, totalRecs, onPDF }: {
  review: any; totalFindings: number; totalBlockers: number; totalActions: number; totalADRs: number; totalRecs: number; onPDF: () => void
}) {
  const recDecision = review?.recommended_decision || review?.report_json?.ai_review?.decision || ''
  const recKey = recDecision.toLowerCase().replace(/ /g, '_')
  const recLabel = REC_META[recKey]?.label || recDecision.replace(/_/g, ' ')
  const aggScore  = review?.aggregate_rag_score ?? review?.report_json?.ai_review?.aggregate_score ?? 0
  const aggLabel  = aggScore >= 4 ? 'GREEN+' : aggScore === 3 ? 'AMBER' : aggScore > 0 ? 'RED' : '—'

  // Synthesis executive rationale — stored in decision_rationale or ai_review.executive_rationale
  const executiveRationale: string =
    review?.decision_rationale ||
    review?.report_json?.ai_review?.executive_rationale ||
    review?.report_json?.executive_rationale || ''
  const synthesisFellBack = executiveRationale.startsWith('Synthesis step unavailable')
    || executiveRationale.startsWith('Synthesis unavailable')
    || executiveRationale.includes('LLM error')
  const showRationale = executiveRationale && !synthesisFellBack

  const scoreCorrections: any[] = review?.report_json?.ai_review?.score_corrections ?? []

  if (!recDecision) return null

  return (
    <div className="relative overflow-hidden rounded-[14px] mb-[18px]"
      style={{ background: 'linear-gradient(135deg, #1A2D45 0%, #0B1B2E 100%)', padding: '20px 24px' }}>
      {/* Decorative ring */}
      <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
        style={{ border: '1px solid rgba(0,176,156,0.15)' }} />

      <div className="relative flex items-center gap-6">
        {/* AI icon + decision */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-[52px] h-[52px] rounded-[12px] grid place-items-center flex-shrink-0"
            style={{ background: '#00B09C' }}>
            <Zap className="w-[22px] h-[22px]" style={{ color: '#0B1B2E' }} />
          </div>
          <div className="min-w-0">
            <div className="font-cond text-[10.5px] uppercase tracking-[0.2em] mb-1"
              style={{ color: '#00B09C' }}>AI Agent recommendation</div>
            <div className="font-cond font-bold text-[24px] leading-[1.15] text-white">{recLabel}</div>
            <div className="font-cond font-semibold text-[10.5px] uppercase tracking-[0.12em] mt-1"
              style={{ color: '#00B09C' }}>
              Aggregate {aggScore}/5 · {aggLabel}
              {scoreCorrections.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ background: 'rgba(0,176,156,0.2)', color: '#00B09C' }}>
                  {scoreCorrections.length} score correction{scoreCorrections.length > 1 ? 's' : ''} applied
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 flex-shrink-0">
          {[
            { label: 'Blockers', value: totalBlockers, red: totalBlockers > 0 },
            { label: 'Findings', value: totalFindings, red: false },
            { label: 'Actions',  value: totalActions,  red: false },
            { label: 'ADRs',     value: totalADRs,     red: false },
            { label: 'Recs',     value: totalRecs,     red: false },
          ].map(s => (
            <div key={s.label} className="text-center min-w-[48px]">
              <div className="font-cond font-bold text-[28px] leading-none"
                style={{ color: s.red ? '#EF4444' : '#fff' }}>{s.value}</div>
              <div className="font-cond text-[10px] uppercase tracking-[0.15em] mt-1"
                style={{ color: 'rgba(255,255,255,0.55)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* PDF button */}
        <button onClick={onPDF}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-medium text-white flex-shrink-0 transition-colors hover:bg-white/20"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <Download className="w-[14px] h-[14px]" /> PDF
        </button>
      </div>

      {/* Executive rationale from synthesis */}
      {(showRationale || synthesisFellBack) && (
        <div className="relative mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="font-cond text-[10px] uppercase tracking-[0.2em] mb-2"
            style={{ color: 'rgba(0,176,156,0.8)' }}>Principal EA · Synthesis Rationale</div>
          <p className="text-[13px] leading-[1.65]" style={{ color: synthesisFellBack ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.82)' }}>
            {synthesisFellBack
              ? 'Synthesis was temporarily unavailable due to high AI demand. Domain scores are shown as-is — re-run the review to generate a full rationale.'
              : executiveRationale}
          </p>
          {scoreCorrections.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {scoreCorrections.map((c: any, i: number) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px]"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                  <span className="capitalize">{(c.domain ?? '').replace(/_/g, ' ')}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>{c.original_score}→</span>
                  <span style={{ color: c.corrected_score < c.original_score ? '#EF4444' : '#00B09C' }}>{c.corrected_score}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── DomainHeatmap ─────────────────────────────────────────────────────────────

function DomainHeatmap({ domainSummaries, activeDomain, onFilter, onDetail }: {
  domainSummaries: Record<string, DomainSummary>
  activeDomain: string | null; onFilter: (slug: string | null) => void; onDetail: (slug: string | null) => void
}) {
  const { domainMeta, domainOrder } = useDomainMeta()
  // DB-ordered slugs first, then any AI slugs not in the DB domains list
  const aiOnlySlugs = Object.keys(domainSummaries).filter(s => !domainOrder.includes(s))
  const allTileSlugs = [...domainOrder, ...aiOnlySlugs]
  return (
    <div className="bg-white rounded-[12px] border border-line">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <h3 className="font-cond font-bold text-[15px] text-ink-900">Domain heatmap</h3>
        <span className="text-[12px] text-ink-400">Click a tile to view detail</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-[10px]">
        {allTileSlugs.map((slug: string) => {
          const s = domainSummaries[slug]
          const meta = domainMeta[slug]
          const Icon = meta?.Icon || FileText
          const isActive = activeDomain === slug
          const hasData = !!s

          if (!hasData) return (
            <div key={slug} className="rounded-[10px] border border-line bg-paper-2 p-3 opacity-40 cursor-not-allowed">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-ink-400" />
                <span className="font-cond font-semibold text-[12px] text-ink-400">{meta?.label || slug}</span>
              </div>
              <div className="font-cond font-bold text-[22px] text-ink-300">—</div>
            </div>
          )

          const bg   = isActive ? '#1A2D45' : ragTileBg(s.score)
          const text = isActive ? '#fff'   : ragTileText(s.score)
          const bar  = ragTileBar(s.score)

          return (
            <button key={slug}
              onClick={() => { onFilter(isActive ? null : slug); onDetail(isActive ? null : slug) }}
              className="relative rounded-[10px] border p-3 text-left transition-all cursor-pointer overflow-hidden"
              style={{
                background: bg,
                borderColor: isActive ? '#1A2D45' : bar + '40',
              }}>
              {/* RAG stripe */}
              <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: bar }} />
              <div className="pl-[6px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: text }} />
                    <span className="font-cond font-semibold text-[12px]" style={{ color: text }}>{meta?.label || slug}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" style={{ color: text }} />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="font-cond font-bold text-[24px] leading-none" style={{ color: text }}>{s.score}</span>
                    <span className="font-cond text-[12px] ml-0.5" style={{ color: text, opacity: 0.6 }}>/5</span>
                  </div>
                  <div className="text-right" style={{ fontSize: 11, lineHeight: 1.4, color: isActive ? 'rgba(255,255,255,0.65)' : ragTileText(s.score), opacity: isActive ? 1 : 0.8 }}>
                    {s.blocker_count > 0 && <div style={{ color: '#EF4444', fontWeight: 600 }}>{s.blocker_count} blk</div>}
                    <div>{s.total_findings} find</div>
                    <div>{s.action_count} act</div>
                    {s.adr_count > 0 && <div>{s.adr_count} adr</div>}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── FindingsStream ────────────────────────────────────────────────────────────

type StreamTab = 'findings' | 'actions' | 'adrs' | 'recommendations'

function FindingRow({ f, idx, last, isEA, reviewId, eaOverrides, onOverrideSaved, domainMeta }: {
  f: any; idx: number; last: boolean; isEA: boolean; reviewId: string; eaOverrides: Record<string, any>; onOverrideSaved: (o: any) => void; domainMeta: DomainMeta
}) {
  const slug = f._domainSlug || f.domain_slug || f.domain || ''
  const meta = domainMeta[slug]
  const Icon = meta?.Icon || FileText
  const findingKey = f.finding_id || f.principle_id || `FIND-${seq(idx)}`
  const findingOverride = eaOverrides[findingKey]

  return (
    <div className="px-5 py-4" style={{ borderBottom: last ? 'none' : '1px solid #E7EDF2' }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: '112px 1fr auto' }}>
        {/* Left: severity + id + domain */}
        <div>
          <SeverityBadge ragScore={f.rag_score} />
          {findingKey && <div className="font-mono text-[11px] text-ink-400 mt-1.5">{findingKey}</div>}
          <div className="flex items-center gap-1 mt-1.5 text-[11.5px] text-ink-500">
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{meta?.label || slug}</span>
          </div>
        </div>
        {/* Centre: title + body + meta */}
        <div className="min-w-0">
          {f.title && <div className="font-cond font-semibold text-[15px] text-ink-900 mb-1">{f.title}</div>}
          <div className="text-[13.5px] text-ink-600 leading-[1.55]">{f.finding}</div>
          <div className="flex flex-wrap gap-3 mt-2 text-[11.5px] text-ink-500">
            {f.standard_violated && <span><strong className="text-ink-700">Standard:</strong> {f.standard_violated}</span>}
            {f.evidence_source    && <span><strong className="text-ink-700">Evidence:</strong> {f.evidence_source}</span>}
            {f.kb_ref             && <span className="font-mono text-teal-700">{f.kb_ref} ↗</span>}
          </div>
        </div>
        {/* Right: override */}
        {isEA && (
          <div className="flex-shrink-0">
            <EAOverrideWidget label="Override Severity" overrideType="finding_severity" targetId={findingKey}
              currentValue={f.rag_score} reviewId={reviewId} options={SCORE_OPTIONS}
              existingOverride={findingOverride} onSaved={onOverrideSaved} />
          </div>
        )}
      </div>
    </div>
  )
}

function ActionRow({ a, idx, last, isEA, reviewId, eaOverrides, onOverrideSaved, domainMeta }: {
  a: any; idx: number; last: boolean; isEA: boolean; reviewId: string; eaOverrides: Record<string, any>; onOverrideSaved: (o: any) => void; domainMeta: DomainMeta
}) {
  const slug = a.domain_slug || a.domain || ''
  const meta = domainMeta[slug]
  const Icon = meta?.Icon || FileText
  const actionKey = a.id || a.action_id || `ACT-${seq(idx)}`
  const actionOverride = eaOverrides[actionKey]
  const effectivePriority = actionOverride ? actionOverride.override_value : a.priority

  const prioTone: Record<string, string> = {
    CRITICAL: 'bg-red-200 text-red-800', HIGH: 'bg-red-100 text-red-700',
    MEDIUM: 'bg-amber-100 text-amber-700', LOW: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="px-5 py-4" style={{ borderBottom: last ? 'none' : '1px solid #E7EDF2' }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: '112px 1fr auto' }}>
        <div>
          {effectivePriority && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${prioTone[effectivePriority] || 'bg-gray-100 text-gray-600'}`}>
              {actionOverride && <Award className="w-2.5 h-2.5 mr-0.5" />}{effectivePriority}
            </span>
          )}
          {a.is_conditional_approval_gate && <div className="mt-1.5"><span className="text-xs px-2 py-0.5 rounded bg-navy-100 text-navy-700 font-semibold">Gate</span></div>}
          <div className="font-mono text-[11px] text-ink-400 mt-1.5">{actionKey}</div>
          {slug && (
            <div className="flex items-center gap-1 mt-1.5 text-[11.5px] text-ink-500">
              <Icon className="w-3.5 h-3.5 flex-shrink-0" /><span>{meta?.label || slug}</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          {a.title && <div className="font-cond font-semibold text-[15px] text-ink-900 mb-1">{a.title}</div>}
          <div className="text-[13.5px] text-ink-600 leading-[1.55]">{a.action_text || a.action}</div>
          <div className="flex flex-wrap gap-3 mt-2 text-[11.5px] text-ink-500">
            {(a.owner_role || a.proposed_owner) && <span><strong className="text-ink-700">Owner:</strong> {a.owner_role || a.proposed_owner}</span>}
            {(a.confirmed_due_date || a.proposed_due_date || a.due_days) && (
              <span><strong className="text-ink-700">Due:</strong> {a.confirmed_due_date || a.proposed_due_date || `${a.due_days}d`}</span>
            )}
            {a.verification_method && <span><strong className="text-ink-700">Verify:</strong> {a.verification_method}</span>}
          </div>
        </div>
        {isEA && (
          <div className="flex-shrink-0">
            <EAOverrideWidget label="Override Priority" overrideType="action_modification" targetId={actionKey}
              currentValue={a.priority} reviewId={reviewId} options={PRIORITY_OPTIONS}
              existingOverride={actionOverride} onSaved={onOverrideSaved} />
          </div>
        )}
      </div>
    </div>
  )
}

function ADRRow({ adr, idx, last, isEA, reviewId, eaOverrides, onOverrideSaved, domainMeta }: {
  adr: any; idx: number; last: boolean; isEA: boolean; reviewId: string; eaOverrides: Record<string, any>; onOverrideSaved: (o: any) => void; domainMeta: DomainMeta
}) {
  const slug = adr.domain_slug || adr.domain || ''
  const meta = domainMeta[slug]
  const Icon = meta?.Icon || FileText
  const adrKey = adr.id || adr.adr_id || `ADR-${seq(idx)}`
  const adrOverride = eaOverrides[adrKey]
  const effectiveStatus = adrOverride ? String(adrOverride.override_value) : adr.status

  const statusCls: Record<string, string> = {
    accepted: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
    conditional: 'bg-amber-100 text-amber-700', pending: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="px-5 py-4" style={{ borderBottom: last ? 'none' : '1px solid #E7EDF2' }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: '112px 1fr auto' }}>
        <div>
          {effectiveStatus && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${statusCls[effectiveStatus] || 'bg-gray-100 text-gray-600'}`}>
              {adrOverride && <Award className="w-2.5 h-2.5 mr-0.5" />}{effectiveStatus}
            </span>
          )}
          <div className="font-mono text-[11px] text-ink-400 mt-1.5">{adrKey}</div>
          {(adr.adr_type || adr.type) && (
            <div className="mt-1.5"><span className="text-xs px-2 py-0.5 rounded bg-ink-100 text-ink-600 font-medium">{adr.adr_type || adr.type}</span></div>
          )}
          {slug && (
            <div className="flex items-center gap-1 mt-1.5 text-[11.5px] text-ink-500">
              <Icon className="w-3.5 h-3.5 flex-shrink-0" /><span>{meta?.label || slug}</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-cond font-semibold text-[15px] text-ink-900 mb-1">{adr.title || adr.decision}</div>
          {adr.rationale && <div className="text-[13.5px] text-ink-600 leading-[1.55]">{adr.rationale}</div>}
          {adr.waiver_expiry_date && <div className="text-[12px] text-amber-700 mt-2 font-medium">Waiver expires: {adr.waiver_expiry_date}</div>}
        </div>
        {isEA && (
          <div className="flex-shrink-0">
            <EAOverrideWidget label="Override ADR Status" overrideType="adr_content" targetId={adrKey}
              currentValue={adr.status} reviewId={reviewId} options={ADR_STATUS_OPTIONS}
              existingOverride={adrOverride} onSaved={onOverrideSaved} />
          </div>
        )}
      </div>
    </div>
  )
}

function RecommendationRow({ rec, idx, last, domainMeta }: {
  rec: any; idx: number; last: boolean; domainMeta: DomainMeta
}) {
  const slug = rec._domainSlug || rec.domain_slug || rec.domain || ''
  const meta = domainMeta[slug]
  const Icon = meta?.Icon || FileText
  const recKey = rec.recommendation_id || `REC-${seq(idx)}`

  const prioTone: Record<string, string> = {
    HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700',
    LOW: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="px-5 py-4" style={{ borderBottom: last ? 'none' : '1px solid #E7EDF2' }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: '112px 1fr' }}>
        <div>
          {rec.priority && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${prioTone[(rec.priority as string).toUpperCase()] || 'bg-gray-100 text-gray-600'}`}>
              {(rec.priority as string).toUpperCase()}
            </span>
          )}
          <div className="font-mono text-[11px] text-ink-400 mt-1.5">{recKey}</div>
          {slug && (
            <div className="flex items-center gap-1 mt-1.5 text-[11.5px] text-ink-500">
              <Icon className="w-3.5 h-3.5 flex-shrink-0" /><span>{meta?.label || slug}</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          {rec.title && <div className="font-cond font-semibold text-[15px] text-ink-900 mb-1">{rec.title}</div>}
          <div className="text-[13.5px] text-ink-600 leading-[1.55]">{rec.rationale || rec.recommendation}</div>
          <div className="flex flex-wrap gap-3 mt-2 text-[11.5px] text-ink-500">
            {rec.approved_pattern_ref && <span><strong className="text-ink-700">Pattern:</strong> {rec.approved_pattern_ref}</span>}
            {rec.benefit             && <span><strong className="text-ink-700">Benefit:</strong> {rec.benefit}</span>}
            {rec.implementation_hint && <span><strong className="text-ink-700">Hint:</strong> {rec.implementation_hint}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function FindingsStream({ allFindings, displayActions, displayAdrs, displayRecommendations, activeDomain, isEA, reviewId, eaOverrides, onOverrideSaved, totalBlockers }: {
  allFindings: any[]; displayActions: any[]; displayAdrs: any[]; displayRecommendations: any[]
  activeDomain: string | null; isEA: boolean; reviewId: string
  eaOverrides: Record<string, any>; onOverrideSaved: (o: any) => void; totalBlockers: number
}) {
  const [tab, setTab] = useState<StreamTab>('findings')
  const { domainMeta } = useDomainMeta()

  const filteredFindings        = activeDomain ? allFindings.filter(f           => (f._domainSlug           || f.domain_slug || f.domain) === activeDomain) : allFindings
  const filteredActions         = activeDomain ? displayActions.filter((a: any) => (a._domainSlug            || a.domain_slug || a.domain) === activeDomain) : displayActions
  const filteredAdrs            = activeDomain ? displayAdrs.filter((a: any)    => (a._domainSlug            || a.domain_slug || a.domain) === activeDomain) : displayAdrs
  const filteredRecommendations = activeDomain ? displayRecommendations.filter((r: any) => (r._domainSlug   || r.domain_slug || r.domain) === activeDomain) : displayRecommendations

  const tabs: { key: StreamTab; label: string; count: number }[] = [
    { key: 'findings',        label: 'Findings',        count: filteredFindings.length },
    { key: 'actions',         label: 'Actions',         count: filteredActions.length },
    { key: 'adrs',            label: 'ADRs',            count: filteredAdrs.length },
    { key: 'recommendations', label: 'Recommendations', count: filteredRecommendations.length },
  ]

  const items = tab === 'findings' ? filteredFindings
    : tab === 'actions'  ? filteredActions
    : tab === 'adrs'     ? filteredAdrs
    : filteredRecommendations

  return (
    <div className="bg-white rounded-[12px] border border-line">
      {/* Tab header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <h3 className="font-cond font-bold text-[15px] text-ink-900">Evidence stream</h3>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3.5 py-1.5 rounded-[8px] font-cond font-semibold text-[12.5px] uppercase tracking-[0.06em] border transition-colors"
              style={{
                background: tab === t.key ? '#1A2D45' : 'transparent',
                color: tab === t.key ? '#fff' : '#566880',
                borderColor: tab === t.key ? '#1A2D45' : '#D9E2EA',
              }}>
              {t.label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Blocker callout */}
      {tab === 'findings' && totalBlockers > 0 && (
        <div className="mx-5 mt-3 px-4 py-2.5 rounded-[8px] bg-red-50 border border-red-200 flex items-center gap-2">
          <Flag className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
          <span className="text-[12.5px] text-red-700 font-medium">{totalBlockers} blocker{totalBlockers > 1 ? 's' : ''} — must resolve before approval</span>
        </div>
      )}

      {/* Domain filter banner */}
      {activeDomain && (
        <div className="mx-5 mt-2 px-4 py-2 rounded-[8px] flex items-center gap-2"
          style={{ background: '#EEF2F6' }}>
          <Filter className="w-3.5 h-3.5 text-ink-500 flex-shrink-0" />
          <span className="text-[12.5px] text-ink-600">
            Filtered to <strong>{domainMeta[activeDomain]?.label || activeDomain}</strong>
          </span>
          <span className="text-[11.5px] text-ink-400 ml-auto">click tile again to clear</span>
        </div>
      )}

      <div className="mt-3">
        {items.length === 0 ? (
          <div className="py-10 text-center text-ink-400">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p className="text-[13px]">
              {tab === 'recommendations' ? 'No recommendations' : 'Nothing flagged'}
              {activeDomain ? ' in this domain' : ''}.
            </p>
          </div>
        ) : tab === 'findings' ? (
          filteredFindings.map((f, i) => (
            <FindingRow key={f.finding_id || i} f={f} idx={i} last={i === filteredFindings.length - 1}
              isEA={isEA} reviewId={reviewId} eaOverrides={eaOverrides} onOverrideSaved={onOverrideSaved} domainMeta={domainMeta} />
          ))
        ) : tab === 'actions' ? (
          filteredActions.map((a: any, i: number) => (
            <ActionRow key={a.id || i} a={a} idx={i} last={i === filteredActions.length - 1}
              isEA={isEA} reviewId={reviewId} eaOverrides={eaOverrides} onOverrideSaved={onOverrideSaved} domainMeta={domainMeta} />
          ))
        ) : tab === 'adrs' ? (
          filteredAdrs.map((adr: any, i: number) => (
            <ADRRow key={adr.id || i} adr={adr} idx={i} last={i === filteredAdrs.length - 1}
              isEA={isEA} reviewId={reviewId} eaOverrides={eaOverrides} onOverrideSaved={onOverrideSaved} domainMeta={domainMeta} />
          ))
        ) : (
          filteredRecommendations.map((rec: any, i: number) => (
            <RecommendationRow key={rec.recommendation_id || i} rec={rec} idx={i}
              last={i === filteredRecommendations.length - 1} domainMeta={domainMeta} />
          ))
        )}
      </div>
    </div>
  )
}

// ── DecisionTray ──────────────────────────────────────────────────────────────

const DECISION_OPTIONS = [
  { key: 'APPROVE',               label: 'Approve',              desc: 'Meets standards. Minor actions tracked only.',     tone: 'green', Icon: CheckCircle },
  { key: 'CONDITIONALLY_APPROVE', label: 'Approve with Actions', desc: 'Conditional on gate actions completing.',          tone: 'teal',  Icon: Zap },
  { key: 'RETURN',                label: 'Return to SA',         desc: 'Gaps identified — SA resubmits affected domains.', tone: 'amber', Icon: Clock },
  { key: 'DEFER',                 label: 'Defer / Reject',       desc: 'Misaligned, unsafe or unviable. Terminal.',       tone: 'red',   Icon: XCircle },
]

const DECISION_PAST_LABELS: Record<string, string> = {
  APPROVE:               'Approved',
  CONDITIONALLY_APPROVE: 'Conditionally Approved',
  RETURN:                'Returned to SA',
  DEFER:                 'Deferred / Rejected',
}
function fmtDecision(d: string) { return DECISION_PAST_LABELS[d] || d.replace(/_/g, ' ') }

const SEL_BG: Record<string, string> = {
  green: '#F0FDF4', teal: '#F0FDFA', amber: '#FFFBEB', red: '#FEF2F2',
}
const SEL_ICON_BG: Record<string, string> = {
  green: '#16A34A', teal: '#00B09C', amber: '#F59E0B', red: '#EF4444',
}

// ── AuditLane — placeholder; wire to GET /reviews/{id}/audit-log when backend ready ──

function AuditLane({ review }: { review: any }) {
  // Static events derived from review fields we already have.
  // Replace with real audit-log API data once backend provides GET /reviews/{id}/audit-log.
  const events: { time: string; actor: string; what: string; isOverride?: boolean; rationale?: string }[] = []

  if (review?.created_at) {
    events.push({ time: new Date(review.created_at).toLocaleString(), actor: 'Solution Architect', what: 'Submission created' })
  }
  if (review?.status === 'analysing' || review?.reviewed_at) {
    events.push({ time: '—', actor: 'AI Agent', what: 'Analysis queued' })
  }
  if (review?.reviewed_at) {
    const counts = [
      review?.report_json?.ai_review?.findings?.length && `${review.report_json.ai_review.findings.length} findings`,
      review?.report_json?.ai_review?.actions?.length  && `${review.report_json.ai_review.actions.length} actions`,
      review?.report_json?.ai_review?.adrs?.length     && `${review.report_json.ai_review.adrs.length} ADRs`,
    ].filter(Boolean).join(', ')
    events.push({ time: new Date(review.reviewed_at).toLocaleString(), actor: 'AI Agent', what: `Analysis complete${counts ? ` · ${counts}` : ''}` })
  }
  if (review?.ea_review?.reviewed_at) {
    events.push({
      time: new Date(review.ea_review.reviewed_at).toLocaleString(),
      actor: review.ea_review.ea_name || 'Enterprise Architect',
      what: `EA decision: ${fmtDecision(review.ea_review.ea_decision || '')}`,
    })
  }

  return (
    <div className="bg-white rounded-[12px] border border-line">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <h3 className="font-cond font-bold text-[15px] text-ink-900">Audit timeline</h3>
        <span className="text-[12px] text-ink-400">All actions logged · WORM</span>
      </div>
      <div className="px-5 py-4">
        {events.length === 0 ? (
          <div className="py-6 text-center text-ink-400">
            <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p className="text-[12.5px]">Audit log pending — wire to backend GET /reviews/{'{id}'}/audit-log</p>
          </div>
        ) : (
          <div className="space-y-0">
            {events.map((e, i) => (
              <div key={i} className="flex gap-4 relative pb-4">
                {/* Connector line */}
                {i < events.length - 1 && (
                  <div className="absolute left-[6px] top-5 bottom-0 w-px bg-line" />
                )}
                <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 mt-1"
                  style={{ background: e.isOverride ? '#D98A00' : '#C8D4DF', border: '2px solid #fff', boxShadow: '0 0 0 1px #D9E2EA' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-ink-400">{e.time}</span>
                    <strong className="text-[13px] text-ink-800">{e.actor}</strong>
                    {e.isOverride && <Pill tone="gold">EA Override</Pill>}
                  </div>
                  <div className="text-[13px] text-ink-600 mt-0.5">{e.what}</div>
                  {e.rationale && (
                    <div className="mt-1.5 text-[12px] text-gold-600 italic px-3 py-1.5 rounded-[6px]"
                      style={{ background: '#FEF3C7' }}>"{e.rationale}"</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DecisionTray({ review, isEA, eaMode, setEaMode, eaAnnotations, setEaAnnotations,
  reworkGaps, setReworkGaps, reworkGapInput, setReworkGapInput,
  returnDomains, setReturnDomains, submitting, onOpen, onSubmit, domainSummaries }: {
  review: any; isEA: boolean; eaMode: string; setEaMode: (v: string) => void
  eaAnnotations: string; setEaAnnotations: (v: string) => void
  reworkGaps: string[]; setReworkGaps: (v: string[]) => void
  reworkGapInput: string; setReworkGapInput: (v: string) => void
  returnDomains: string[]; setReturnDomains: (v: string[]) => void
  submitting: boolean; onOpen: () => void; onSubmit: () => void
  domainSummaries: Record<string, DomainSummary>
}) {
  const status = review?.status || ''
  const isCompleted = ['approved', 'conditionally_approved', 'returned', 'rejected', 'deferred', 'closed'].includes(status)

  return (
    <div className="bg-white rounded-[12px] border border-line sticky top-6 overflow-hidden"
      style={{ borderTop: '3px solid #D98A00' }}>

      {/* Head */}
      <div className="px-5 py-4 border-b border-line">
        <div className="font-cond text-[10.5px] uppercase tracking-[0.2em] text-ink-500 mb-1">
          {isEA ? 'Enterprise Architect decision' : 'Decision (view-only)'}
        </div>
        <div className="font-cond font-bold text-[18px] text-ink-900">
          {isCompleted ? 'Decision recorded' : isEA ? 'Make a call' : 'Awaiting EA'}
        </div>
        {/* SLA placeholder — wire to review.sla_hours once backend provides it */}
        <div className="text-[12px] text-ink-500 mt-1">
          SLA: <strong className="text-gold-600">— hrs remaining</strong>
        </div>
      </div>

      {/* review_ready: not yet opened */}
      {status === 'review_ready' && (
        <div className="p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 grid place-items-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-teal-600" />
          </div>
          <p className="font-cond font-semibold text-[14px] text-ink-900 mb-1">AI Review Complete</p>
          <p className="text-[12.5px] text-ink-500 mb-4">Ready for Gate 2 EA review.</p>
          {isEA && (
            <button onClick={onOpen} disabled={submitting}
              className="w-full py-2.5 rounded-[8px] font-cond font-semibold text-[13.5px] text-white transition-colors"
              style={{ background: '#00B09C' }}>
              {submitting ? 'Opening…' : 'Open for EA Review'}
            </button>
          )}
        </div>
      )}

      {/* Completed: read-only record */}
      {isCompleted && (
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-[13px] font-medium text-green-700">EA Decision Recorded</span>
            {review.ea_review?.reviewed_at && (
              <span className="text-[12px] text-ink-400">{new Date(review.ea_review.reviewed_at).toLocaleDateString()}</span>
            )}
          </div>
          <div className="bg-paper-2 rounded-[8px] p-3">
            <div className="text-[10.5px] font-cond uppercase tracking-[0.15em] text-ink-500 mb-1">EA Decision</div>
            <div className="font-cond font-bold text-[15px] text-ink-900">
              {fmtDecision(review.ea_review?.ea_decision || '')}
            </div>
          </div>
          {review.ea_review?.ea_name && (
            <div className="text-[12.5px] text-ink-500">by {review.ea_review.ea_name}</div>
          )}
          {review.ea_review?.ea_annotations && (
            <div className="bg-paper-2 rounded-[8px] p-3">
              <div className="text-[10.5px] font-cond uppercase tracking-[0.15em] text-ink-500 mb-1">Annotations</div>
              <p className="text-[13px] text-ink-700">{review.ea_review.ea_annotations}</p>
            </div>
          )}
          {(review.ea_review?.return_domains || []).length > 0 && (
            <div className="bg-amber-50 rounded-[8px] p-3 border border-amber-200">
              <div className="text-[10.5px] font-cond uppercase tracking-[0.15em] text-amber-700 mb-2">Domains for rework</div>
              <div className="flex flex-wrap gap-1">
                {review.ea_review.return_domains.map((d: string) => (
                  <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium capitalize">{d.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ea_reviewing: active decision form */}
      {status === 'ea_reviewing' && !isCompleted && (
        <>
          {/* 4 decision rows */}
          <div className="border-b border-line">
            {DECISION_OPTIONS.map(opt => {
              const sel = eaMode === opt.key
              const Ico = opt.Icon
              return (
                <button key={opt.key}
                  disabled={!isEA}
                  onClick={() => setEaMode(sel ? '' : opt.key)}
                  className="w-full flex items-start gap-3 px-5 py-3.5 border-b border-line last:border-0 text-left transition-colors"
                  style={{
                    background: sel ? SEL_BG[opt.tone] : 'transparent',
                    cursor: isEA ? 'pointer' : 'not-allowed',
                    opacity: isEA ? 1 : 0.55,
                  }}>
                  <div className="w-7 h-7 rounded-[8px] grid place-items-center flex-shrink-0 mt-0.5"
                    style={{ background: sel ? SEL_ICON_BG[opt.tone] : '#EEF2F6' }}>
                    <Ico className="w-3.5 h-3.5" style={{ color: sel ? '#fff' : '#8CA0B3' }} />
                  </div>
                  <div>
                    <div className="font-cond font-semibold text-[13.5px] text-ink-900">{opt.label}</div>
                    <div className="text-[11.5px] text-ink-500 mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Conditional forms */}
          <div className="p-5 space-y-3">
            {eaMode === 'CONDITIONALLY_APPROVE' && (
              <div>
                <label className="block text-[12px] font-medium text-ink-700 mb-1.5">Conditions <span className="text-red-500">*</span></label>
                <Textarea value={eaAnnotations} onChange={e => setEaAnnotations(e.target.value)} rows={3}
                  placeholder="Describe what must be closed before go-live…" />
              </div>
            )}

            {eaMode === 'RETURN' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink-700 mb-2">Domains requiring rework <span className="text-red-500">*</span></label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {Object.entries(domainSummaries).map(([slug, sum]: [string, any]) => {
                      const isSelected = returnDomains.includes(slug)
                      return (
                        <button key={slug} type="button"
                          onClick={() => setReturnDomains(isSelected ? returnDomains.filter(d => d !== slug) : [...returnDomains, slug])}
                          className="w-full flex items-center gap-2 rounded-[8px] border-2 px-3 py-2 text-left transition-all text-[12px]"
                          style={{ borderColor: isSelected ? '#F59E0B' : '#D9E2EA', background: isSelected ? '#fff' : 'transparent' }}>
                          <div className="w-4 h-4 rounded flex-shrink-0 grid place-items-center border-2"
                            style={{ background: isSelected ? '#F59E0B' : 'transparent', borderColor: isSelected ? '#F59E0B' : '#CBD5E1' }}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="font-medium text-ink-800 capitalize">{slug.replace(/_/g, ' ')}</span>
                          <span className="ml-auto text-[10.5px] font-cond font-semibold"
                            style={{ color: sum.score >= 4 ? '#16A34A' : sum.score === 3 ? '#92400E' : '#991B1B' }}>
                            {sum.score >= 4 ? 'GREEN' : sum.score === 3 ? 'AMBER' : 'RED'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-ink-700 mb-1.5">Action items <span className="text-red-500">*</span></label>
                  <div className="space-y-1.5 mb-2">
                    {reworkGaps.map((gap, i) => (
                      <div key={i} className="flex items-center gap-2 bg-amber-50 rounded-[6px] px-3 py-1.5 border border-amber-100">
                        <span className="font-mono text-[11px] text-amber-600 w-4">{i + 1}.</span>
                        <p className="text-[12px] text-ink-800 flex-1">{gap}</p>
                        <button onClick={() => setReworkGaps(reworkGaps.filter((_, j) => j !== i))} className="text-amber-400 hover:text-amber-700">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={reworkGapInput} onChange={e => setReworkGapInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && reworkGapInput.trim()) { setReworkGaps([...reworkGaps, reworkGapInput.trim()]); setReworkGapInput('') } }}
                      placeholder="Add an action item…"
                      className="flex-1 border border-line rounded-[8px] px-3 py-2 text-[12.5px] text-ink-700 focus:outline-none focus:border-teal-500" />
                    <button onClick={() => { if (reworkGapInput.trim()) { setReworkGaps([...reworkGaps, reworkGapInput.trim()]); setReworkGapInput('') } }}
                      className="px-3 py-2 rounded-[8px] border border-line text-ink-600 hover:bg-paper-2 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-ink-700 mb-1.5">Notes <span className="text-ink-400 font-normal">(optional)</span></label>
                  <Textarea value={eaAnnotations} onChange={e => setEaAnnotations(e.target.value)} rows={2} placeholder="Additional notes for the SA…" />
                </div>
              </div>
            )}

            {eaMode === 'DEFER' && (
              <div>
                <label className="block text-[12px] font-medium text-ink-700 mb-1.5">
                  Rejection rationale <span className="text-red-500">*</span>
                  <span className="text-ink-400 font-normal ml-1">(min 50 chars — terminal)</span>
                </label>
                <Textarea value={eaAnnotations} onChange={e => setEaAnnotations(e.target.value)} rows={4}
                  placeholder="Explain why this submission must be rejected and what a restart would need to address…" />
                <p className={`text-[11.5px] mt-1 ${eaAnnotations.trim().length < 50 ? 'text-red-500' : 'text-green-600'}`}>
                  {eaAnnotations.trim().length} / 50
                </p>
              </div>
            )}

            {/* EA rationale (always shown when mode selected, except DEFER which has its own) */}
            {eaMode && eaMode !== 'DEFER' && eaMode !== 'RETURN' && eaMode !== 'CONDITIONALLY_APPROVE' && (
              <div>
                <label className="block text-[12px] font-medium text-ink-700 mb-1.5">EA rationale <span className="text-red-500">*</span></label>
                <Textarea value={eaAnnotations} onChange={e => setEaAnnotations(e.target.value)} rows={3}
                  placeholder="Required — captured to audit log…" />
              </div>
            )}

            {eaMode && (
              <div className="flex gap-2 pt-1">
                <button onClick={onSubmit}
                  disabled={submitting || !isEA || (eaMode === 'DEFER' && eaAnnotations.trim().length < 50)}
                  className="flex-1 py-2.5 rounded-[8px] font-cond font-semibold text-[13.5px] text-white transition-colors disabled:opacity-50"
                  style={{ background: eaMode === 'APPROVE' ? '#16A34A' : eaMode === 'CONDITIONALLY_APPROVE' ? '#00B09C' : eaMode === 'RETURN' ? '#F59E0B' : '#EF4444' }}>
                  {submitting ? 'Submitting…'
                    : eaMode === 'APPROVE' ? 'Confirm Approval'
                    : eaMode === 'CONDITIONALLY_APPROVE' ? 'Confirm Conditional'
                    : eaMode === 'RETURN' ? 'Return to SA'
                    : 'Reject Submission'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Re-trigger modal ──────────────────────────────────────────────────────────

function RetriggerModal({ scopeDomains, triggeringAI, onRun, onClose }: {
  scopeDomains: string[]
  triggeringAI: boolean
  onRun: (domains?: string[]) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string[]>([...scopeDomains])
  const allSelected = selected.length === scopeDomains.length

  const toggle = (slug: string) =>
    setSelected(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-[12px] shadow-xl flex flex-col"
        style={{ width: 480, maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <h2 className="font-cond font-bold text-[17px] text-ink-900">Re-run AI Review</h2>
            <p className="text-[12.5px] text-ink-500 mt-0.5">Choose which domains to analyse</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Domain list */}
        <div className="flex-1 overflow-y-auto p-5">
          {scopeDomains.length === 0 ? (
            <p className="text-[13px] text-ink-400 text-center py-4">No domains in scope for this review.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12.5px] text-ink-500">
                  <strong className="text-ink-700">{selected.length}</strong> of {scopeDomains.length} selected
                </span>
                <button
                  onClick={() => setSelected(allSelected ? [] : [...scopeDomains])}
                  className="text-[12.5px] font-medium text-teal-600 hover:text-teal-800 transition-colors"
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="space-y-1.5">
                {scopeDomains.map(slug => {
                  const checked = selected.includes(slug)
                  return (
                    <button key={slug} type="button" onClick={() => toggle(slug)}
                      className="w-full flex items-center gap-3 rounded-[8px] border-2 px-3.5 py-2.5 text-left transition-all"
                      style={{
                        borderColor: checked ? '#00B09C' : '#D9E2EA',
                        background:  checked ? '#F0FDFB' : 'transparent',
                      }}>
                      <div className="w-4 h-4 rounded flex-shrink-0 grid place-items-center border-2 transition-all"
                        style={{ background: checked ? '#00B09C' : 'transparent', borderColor: checked ? '#00B09C' : '#CBD5E1' }}>
                        {checked && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="text-[13.5px] font-medium text-ink-800 capitalize">
                        {slug.replace(/_/g, ' ')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-5 py-4 border-t border-line">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-[8px] border border-line text-[13.5px] font-medium text-ink-700 hover:bg-paper-2 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onRun(selected)}
            disabled={triggeringAI || selected.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-[8px] font-cond font-semibold text-[13.5px] text-white transition-colors disabled:opacity-50"
            style={{ background: '#00B09C' }}
          >
            <Zap className="w-3.5 h-3.5" />
            {triggeringAI
              ? 'Starting…'
              : allSelected
                ? 'Run all domains'
                : `Run ${selected.length} domain${selected.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReviewDashboard() {
  const navigate         = useNavigate()
  const { submissionId } = useParams<{ submissionId: string }>()
  const { user }         = useAuthStore()
  const { domainOrder }  = useDomainMeta()

  const [review,         setReview]         = useState<any>(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [activeSlug,     setActiveSlug]     = useState<string | null>(null)
  const [activeDomain,   setActiveDomain]   = useState<string | null>(null)
  const [eaMode,         setEaMode]         = useState<string>('')
  const [eaAnnotations,  setEaAnnotations]  = useState<string>('')
  const [reworkGaps,     setReworkGaps]     = useState<string[]>([])
  const [reworkGapInput, setReworkGapInput] = useState<string>('')
  const [returnDomains,  setReturnDomains]  = useState<string[]>([])
  const [submitting,     setSubmitting]     = useState(false)
  const [eaOverrides,    setEaOverrides]    = useState<Record<string, any>>({})

  const isEA = ['enterprise_architect', 'arb_admin'].includes(user?.role || '')

  useEffect(() => {
    if (!submissionId) return
    reviewService.getReviewById(submissionId)
      .then(data => { setReview(data); setLoading(false) })
      .catch(err  => { setError(err.message || 'Failed to load review'); setLoading(false) })
  }, [submissionId])

  useEffect(() => {
    if (!submissionId || !isEA) return
    reviewService.getEAOverrides(submissionId)
      .then(data => {
        if (!data) return
        const byTargetId: Record<string, any> = {}
        Object.values(data.overrides as Record<string, any[]>).flat().forEach((o: any) => { byTargetId[o.target_id] = o })
        setEaOverrides(byTargetId)
      })
      .catch(() => {})
  }, [submissionId, isEA])

  const handleOverrideSaved = (override: any) => {
    setEaOverrides(prev => ({ ...prev, [override.target_id]: override }))
  }

  const isSA = !isEA
  const eaIsTerminal = ['approved', 'conditionally_approved', 'rejected', 'deferred', 'closed'].includes(review?.status || '')
  const [showRetrigger,  setShowRetrigger]  = useState(false)
  const [triggeringAI, setTriggeringAI] = useState(false)

  const handleStartAIReview = async (domainsToRetry?: string[]) => {
    if (!submissionId) return
    setTriggeringAI(true)
    try {
      await reviewService.triggerReviewOrchestrator(submissionId, domainsToRetry)
      const updated = await reviewService.getReviewById(submissionId)
      setReview(updated)
    } catch (e: any) {
      alert(`Failed to start AI review: ${e.message}`)
    } finally { setTriggeringAI(false) }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const domainSummaries: Record<string, DomainSummary> = (() => {
    if (review?.domain_summaries && Object.keys(review.domain_summaries).length > 0) return review.domain_summaries
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

    const domain_summaries_raw = ai_review.domain_summaries || {}

    const allSlugs = new Set([
      ...Object.keys(domain_scores_raw), ...Object.keys(findingsByDomain),
      ...Object.keys(actionsByDomain),   ...Object.keys(adrsByDomain),
      ...Object.keys(recsByDomain),      ...Object.keys(domain_summaries_raw),
    ])

    const summaries: Record<string, DomainSummary> = {}
    for (const slug of allSlugs) {
      const f_list   = findingsByDomain[slug] || []
      const a_list   = actionsByDomain[slug]  || []
      const r_list   = adrsByDomain[slug]     || []
      const rec_list = recsByDomain[slug]     || []
      const score    = domain_scores_raw[slug] || 3
      const f_sorted = [...f_list].sort((a, b) => (a.rag_score || 3) - (b.rag_score || 3))
      const ds_raw   = domain_summaries_raw[slug] || {}
      summaries[slug] = {
        score, rag_label: score <= 2 ? 'RED' : score === 3 ? 'AMBER' : 'GREEN',
        total_findings: f_list.length, blocker_count: f_list.filter(f => (f.rag_score || 5) <= 1).length,
        critical_count: f_list.filter(f => (f.rag_score || 5) <= 2).length,
        action_count: a_list.length, adr_count: r_list.length,
        findings: f_sorted, actions: a_list, adrs: r_list, recommendations: rec_list,
        executive_summary: ds_raw.executive_summary || ds_raw.rationale,
        compliant_areas: ds_raw.compliant_areas,
        gap_areas: ds_raw.gap_areas,
        evidence_quality: ds_raw.evidence_quality,
        domain_specific_scores: ds_raw.domain_specific_scores,
      }
    }
    return summaries
  })()

  const orderedSlugs = domainOrder.filter(s => domainSummaries[s])
    .concat(Object.keys(domainSummaries).filter(s => !domainOrder.includes(s)))

  // Flatten findings with _domainSlug attached for reliable filtering
  const allFindings = orderedSlugs.flatMap(slug =>
    (domainSummaries[slug]?.findings || []).map((f: any) => ({ ...f, _domainSlug: slug }))
  )

  // Actions and ADRs: stamp _domainSlug normalised to full slug (handles legacy short codes like "SOL", "APP")
  const _rawActions = (review?.actions || []).length > 0 ? review.actions : review?.report_json?.ai_review?.actions || []
  const displayActions = (_rawActions as any[]).map((a: any) => ({ ...a, _domainSlug: normaliseDomainSlug(a._domainSlug || a.domain_slug || a.domain) }))

  const _rawAdrs = (review?.adrs || []).length > 0 ? review.adrs : review?.report_json?.ai_review?.adrs || []
  const displayAdrs = (_rawAdrs as any[]).map((r: any) => ({ ...r, _domainSlug: normaliseDomainSlug(r._domainSlug || r.domain_slug || r.domain) }))

  const _rawRecs = (review?.recommendations || []).length > 0 ? review.recommendations : review?.report_json?.ai_review?.recommendations || []
  const displayRecommendations = (_rawRecs as any[]).map((r: any) => ({ ...r, _domainSlug: normaliseDomainSlug(r._domainSlug || r.domain_slug || r.domain) }))

  const totalFindings = allFindings.length
  const totalBlockers = (review?.blockers || []).length || orderedSlugs.reduce((n, s) => n + (domainSummaries[s]?.blocker_count || 0), 0)
  const totalActions  = displayActions.length
  const totalADRs     = displayAdrs.length
  const totalRecs     = displayRecommendations.length

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleOpenForEA = async () => {
    if (!submissionId) return
    setSubmitting(true)
    try {
      await reviewService.openForEA(submissionId)
      const updated = await reviewService.getReviewById(submissionId)
      setReview(updated)
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    } finally { setSubmitting(false) }
  }

  const handleEaDecision = async () => {
    if (!submissionId || !eaMode) return
    setSubmitting(true)
    try {
      const payload: any = { ea_decision: eaMode, ea_annotations: eaAnnotations || null, ea_name: user?.name || '' }
      if (eaMode === 'CONDITIONALLY_APPROVE') {
        if (!eaAnnotations.trim()) { alert('Provide conditions / rationale for conditional approval'); setSubmitting(false); return }
      } else if (eaMode === 'RETURN') {
        if (returnDomains.length === 0) { alert('Select at least one domain that needs rework'); setSubmitting(false); return }
        if (reworkGaps.length === 0)    { alert('Add at least one action item before returning'); setSubmitting(false); return }
        payload.return_domains = returnDomains
        payload.rework_gaps    = reworkGaps
      } else if (eaMode === 'DEFER') {
        if (eaAnnotations.trim().length < 50) { alert('Rejection requires a rationale of at least 50 characters'); setSubmitting(false); return }
        payload.decision_rationale = eaAnnotations
      }
      await reviewService.submitEADecision(submissionId, payload)
      navigate('/dashboard')
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    } finally { setSubmitting(false) }
  }

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-full">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[13px] text-ink-500">Loading ARB dossier…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center min-h-full">
      <div className="text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-[14px] text-red-600 font-medium mb-4">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="text-[13px] text-teal-600 underline">Back to Dashboard</button>
      </div>
    </div>
  )

  // ── Header pills ──────────────────────────────────────────────────────────

  const status = review?.status || ''
  const statusLabel =
    status === 'ea_reviewing'           ? 'Awaiting EA'      :
    status === 'review_ready'           ? 'Ready for EA'     :
    status === 'analysing'              ? 'In Analysis'      :
    status === 'submitted'              ? 'Submitted'        :
    status === 'queued'                 ? 'Queued'           :
    status === 'approved'               ? 'Approved'         :
    status === 'conditionally_approved' ? 'Cond. Approved'   :
    status === 'rejected'               ? 'Rejected'         :
    status === 'returned'               ? 'Returned'         :
    status === 'deferred'               ? 'Deferred'         :
    status === 'closed'                 ? 'Closed'           :
    status === 'review_pending'         ? 'Domains Pending'  :
    status === 'agent_failed'           ? 'Agent Failed'     :
    status.replace(/_/g, ' ')

  const statusTone: 'teal' | 'gold' | 'green' | 'red' | 'amber' | 'gray' | 'navy' =
    status === 'ea_reviewing'           ? 'teal'   :
    status === 'review_ready'           ? 'gold'   :
    status === 'approved'               ? 'green'  :
    status === 'conditionally_approved' ? 'teal'   :
    status === 'rejected'               ? 'red'    :
    status === 'returned'               ? 'amber'  :
    status === 'deferred'               ? 'amber'  :
    status === 'review_pending'         ? 'amber'  :
    status === 'agent_failed'           ? 'red'    :
    (status === 'submitted' || status === 'queued') ? 'navy' :
    'gray'

  const isSubmittedAwaitingAI = status === 'submitted' || status === 'queued'
  // analysing included so reviews stuck after edge-function crash surface the retry button
  const isReviewPending       = status === 'review_pending' || status === 'agent_failed' || status === 'analysing'
  const failedDomains: string[] = review?.report_json?.failed_domains ?? []
  // Domains that failed per-domain isolation (AGENT_FAILURE stub findings in a review_ready review)
  const agentFailureDomains = status === 'review_ready'
    ? [...new Set((allFindings as any[])
        .filter(f => f.check_category === 'AGENT_FAILURE')
        .map(f => f.domain as string))]
    : []

  const ptxGate     = review?.report_json?.form_data?.ptx_gate || review?.ptx_gate || ''
  const disposition = review?.report_json?.form_data?.architecture_disposition || review?.architecture_disposition || ''

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 py-5 min-h-full">

      {/* Page header */}
      <div className="flex items-start gap-4 mb-5">
        <button onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-line text-[13px] text-ink-600 hover:bg-paper-2 transition-colors flex-shrink-0 mt-0.5">
          <ChevronLeft className="w-4 h-4" /> Pipeline
        </button>
        <div className="w-px self-stretch bg-line flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-cond font-bold text-[22px] text-ink-900 leading-[1.2]">
            {review?.solution_name || 'ARB Review'}
          </h1>
          <div className="flex items-center flex-wrap gap-2 mt-2">
            {ptxGate     && <Pill tone="navy">{ptxGate}</Pill>}
            {disposition && <Pill tone="gold">{disposition}</Pill>}
            <Pill tone={statusTone} dot={['ea_reviewing', 'analysing'].includes(status)}>{statusLabel}</Pill>
            <span className="text-[12px] text-ink-400 font-mono">
              {review?.arb_ref || (submissionId ? toARBRef(submissionId, review?.created_at) : '')}
              {review?.reviewed_at && ` · Reviewed ${new Date(review.reviewed_at).toLocaleDateString()}`}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {isSA && !eaIsTerminal && (
            <button
              onClick={() => setShowRetrigger(true)}
              disabled={triggeringAI}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-line text-[13px] text-ink-600 hover:bg-paper-2 transition-colors disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" /> Re-run AI
            </button>
          )}
          <button onClick={() => generateARBReportPDF(review)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-line text-[13px] text-ink-600 hover:bg-paper-2 transition-colors">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Recommendation banner */}
      <RecommendationBanner
        review={review} totalFindings={totalFindings} totalBlockers={totalBlockers}
        totalActions={totalActions} totalADRs={totalADRs} totalRecs={totalRecs}
        onPDF={() => generateARBReportPDF(review)}
      />

      {/* review_pending / agent_failed / analysing — persistent retry banner above the dossier */}
      {isReviewPending && (() => {
        // Four distinct sub-cases:
        //  analysing + partials — edge function was killed mid-run; N domains saved; resume needed
        //  analysing + no partials — killed before any domain saved; full re-run needed
        //  agent_failed — orchestrator threw at top level; full re-run needed
        //  review_pending — some domains 503'd; partial retry to failed_domains only
        const savedPartials: Record<string, any> = review?.report_json?.domain_partial_results ?? {}
        const completedPartialDomains = Object.keys(savedPartials).filter(d => !savedPartials[d]?.error)
        const hasPartialProgress = status === 'analysing' && completedPartialDomains.length > 0
        const scopeTags: string[] = review?.scope_tags ?? []
        const remainingDomains = hasPartialProgress
          ? scopeTags.filter(d => !completedPartialDomains.includes(d))
          : []

        const isStuck   = status === 'analysing'
        const isPartial = status === 'review_pending' && failedDomains.length > 0

        const heading = isStuck
          ? hasPartialProgress
            ? 'AI review interrupted — resuming from partial results'
            : 'AI review interrupted — full re-run required'
          : status === 'agent_failed'
            ? 'AI review failed — retry required'
            : 'Some domains could not be analysed'

        const body = isStuck
          ? hasPartialProgress
            ? `${completedPartialDomains.length} of ${scopeTags.length} domains completed before the process was interrupted. Retrying will resume from where it left off — only the ${remainingDomains.length} remaining domain${remainingDomains.length !== 1 ? 's' : ''} will be re-analysed.`
            : 'The review process was interrupted before any domain results were saved. A full re-run across all domains is required.'
          : status === 'agent_failed'
            ? 'The orchestrator encountered an unexpected error. Re-trigger to retry the full review.'
            : `One or more domain agents returned a 503 (LLM unavailable). A targeted retry will re-run only the failed domain${failedDomains.length !== 1 ? 's' : ''} below.`

        const domainsToRetry = isPartial ? failedDomains : undefined
        const btnLabel = triggeringAI
          ? 'Retrying…'
          : isPartial
            ? `Retry ${failedDomains.length} failed domain${failedDomains.length > 1 ? 's' : ''}`
            : hasPartialProgress
              ? `Resume (${remainingDomains.length} domain${remainingDomains.length !== 1 ? 's' : ''} remaining)`
              : 'Retry full review'

        const chipsToShow = isPartial ? failedDomains : hasPartialProgress ? remainingDomains : []
        return (
          <div className="bg-white rounded-[12px] border p-6"
            style={{ borderTop: '3px solid #F59E0B', borderColor: 'rgba(245,158,11,0.35)' }}>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full grid place-items-center flex-shrink-0"
                style={{ background: '#FEF3C7' }}>
                <AlertTriangle className="w-5 h-5 text-rag-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-cond font-bold text-[16px] text-ink-900 mb-1">{heading}</p>
                <p className="text-[13px] text-ink-500 mb-3">{body}</p>
                {chipsToShow.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {chipsToShow.map(slug => (
                      <span key={slug}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold capitalize"
                        style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid rgba(217,119,6,0.3)' }}>
                        <AlertTriangle className="w-3 h-3" />
                        {slug.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => handleStartAIReview(domainsToRetry)}
                  disabled={triggeringAI}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-[8px] font-cond font-semibold text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#1A2D45', color: '#fff' }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  {btnLabel}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* review_ready with partial per-domain failures — softer re-run banner */}
      {agentFailureDomains.length > 0 && (
        <div className="bg-white rounded-[12px] border mt-4 p-5"
          style={{ borderTop: '3px solid #F59E0B', borderColor: 'rgba(245,158,11,0.35)' }}>
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-full grid place-items-center flex-shrink-0"
              style={{ background: '#FEF3C7' }}>
              <AlertTriangle className="w-4 h-4 text-rag-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-cond font-bold text-[15px] text-ink-900 mb-0.5">
                {agentFailureDomains.length} domain{agentFailureDomains.length > 1 ? 's' : ''} could not be analysed
              </p>
              <p className="text-[12px] text-ink-500">
                {agentFailureDomains.map(d => d.replace(/_/g, ' ')).join(', ')} — re-trigger to retry these domains
              </p>
            </div>
            <button
              onClick={() => handleStartAIReview(agentFailureDomains)}
              disabled={triggeringAI}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-[8px] font-cond font-semibold text-[13px] transition-colors disabled:opacity-50 flex-shrink-0"
              style={{ background: '#1A2D45', color: '#fff' }}
            >
              <Zap className="w-3.5 h-3.5" />
              {triggeringAI ? 'Retrying…' : `Retry ${agentFailureDomains.length} domain${agentFailureDomains.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Main two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          {orderedSlugs.length > 0 && (
            <DomainHeatmap
              domainSummaries={domainSummaries}
              activeDomain={activeDomain}
              onFilter={slug => setActiveDomain(slug)}
              onDetail={slug => setActiveSlug(slug)}
            />
          )}

          {(allFindings.length > 0 || displayActions.length > 0 || displayAdrs.length > 0 || displayRecommendations.length > 0) && (
            <FindingsStream
              allFindings={allFindings} displayActions={displayActions} displayAdrs={displayAdrs}
              displayRecommendations={displayRecommendations}
              activeDomain={activeDomain} isEA={isEA} reviewId={submissionId || ''}
              eaOverrides={eaOverrides} onOverrideSaved={handleOverrideSaved} totalBlockers={totalBlockers}
            />
          )}

          {/* NFR Scorecard */}
          {(review?.nfr_scorecard || []).length > 0 && (
            <div className="bg-white rounded-[12px] border border-line">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <h3 className="font-cond font-bold text-[15px] text-ink-900">NFR Scorecard</h3>
                <span className="text-[12px] text-ink-400">{review.nfr_scorecard.length} categories</span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {review.nfr_scorecard.map((nfr: any, i: number) => {
                  const s = ragStyle(nfr.rag_score)
                  return (
                    <div key={nfr.id || i} className={`rounded-[10px] border-2 p-4 ${s.border} ${s.bg}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className={`text-[11px] font-bold uppercase tracking-[0.1em] ${s.text}`}>
                            {(nfr.nfr_category || '').replace(/_/g, ' ')}
                          </p>
                          {nfr.is_mandatory_green && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold mt-1 inline-block">MANDATORY</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`font-cond font-black text-[22px] leading-none ${s.text}`}>{nfr.rag_score}</span>
                          <p className="text-[11px] text-ink-400">/5</p>
                        </div>
                      </div>
                      {nfr.slo_target && <p className="text-[12px] text-ink-600"><strong>SLO:</strong> {nfr.slo_target}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Audit timeline — shows events derived from review fields now; wire to backend audit-log API later */}
          <AuditLane review={review} />

          {/* Empty state / Start AI review CTA */}
          {orderedSlugs.length === 0 && (
            isSubmittedAwaitingAI ? (
              <div className="bg-white rounded-[12px] border border-line p-10 text-center"
                style={{ borderTop: '3px solid #00B09C' }}>
                <div className="w-14 h-14 rounded-full bg-teal-50 grid place-items-center mx-auto mb-4">
                  <Zap className="w-7 h-7 text-teal-600" />
                </div>
                <p className="font-cond font-bold text-[18px] text-ink-900 mb-1">Ready to analyse</p>
                <p className="text-[13px] text-ink-500 mb-5 max-w-xs mx-auto">
                  Your submission has been received. Start the AI review to dispatch domain sub-agents.
                </p>
                <button
                  onClick={() => setShowRetrigger(true)}
                  disabled={triggeringAI}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-[8px] font-cond font-semibold text-[14px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#00B09C', color: '#0B1B2E' }}
                >
                  <Zap className="w-4 h-4" />
                  {triggeringAI ? 'Starting…' : 'Start AI review'}
                </button>
                <p className="text-[11.5px] text-ink-400 mt-3">Analysis typically takes 60–90 seconds.</p>
              </div>
            ) : (
              <div className="bg-white rounded-[12px] border border-dashed border-line p-10 text-center">
                <Clock className="w-8 h-8 text-ink-300 mx-auto mb-3" />
                <p className="text-[14px] font-medium text-ink-600">AI review not yet complete</p>
                <p className="text-[13px] text-ink-400 mt-1">Waiting for AI analysis results.</p>
              </div>
            )
          )}
        </div>

        {/* Right column: Domain detail + Decision tray */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {activeSlug && domainSummaries[activeSlug] && submissionId && (
            <DomainDetailPanel
              slug={activeSlug} summary={domainSummaries[activeSlug]}
              onClose={() => setActiveSlug(null)} reviewId={submissionId}
              isEA={isEA} eaOverrides={eaOverrides} onOverrideSaved={handleOverrideSaved}
            />
          )}
          <DecisionTray
            review={review} isEA={isEA}
            eaMode={eaMode} setEaMode={setEaMode}
            eaAnnotations={eaAnnotations} setEaAnnotations={setEaAnnotations}
            reworkGaps={reworkGaps} setReworkGaps={setReworkGaps}
            reworkGapInput={reworkGapInput} setReworkGapInput={setReworkGapInput}
            returnDomains={returnDomains} setReturnDomains={setReturnDomains}
            submitting={submitting} onOpen={handleOpenForEA} onSubmit={handleEaDecision}
            domainSummaries={domainSummaries}
          />
        </div>
      </div>

      {showRetrigger && (
        <RetriggerModal
          scopeDomains={review?.scope_tags ?? []}
          triggeringAI={triggeringAI}
          onRun={domains => { handleStartAIReview(domains); setShowRetrigger(false) }}
          onClose={() => setShowRetrigger(false)}
        />
      )}
    </div>
  )
}
