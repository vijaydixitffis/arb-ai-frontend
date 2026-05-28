import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Download, Filter, ArrowRight, Clock, Flag,
  CheckCircle, XCircle, Zap, AlertTriangle,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useMetadataStore } from '../stores/metadataStore'
import { reviewService } from '../services/backendConfig'
import { toARBRef } from '../utils/reviewRef'
import { Pill, DomainStrip, Sparkline } from '../components/ui/ds'
import type { PillTone, DomainSlug } from '../components/ui/ds'

// ── Types ────────────────────────────────────────────────────────────────────

type SubmissionStatus =
  | 'drafting' | 'queued' | 'analysing' | 'submitted'
  | 'review_pending' | 'agent_failed'
  | 'review_ready' | 'ea_reviewing'
  | 'approved' | 'conditionally_approved' | 'rejected' | 'deferred' | 'closed' | 'returned'

interface Review {
  id: string
  solution_name: string
  status: SubmissionStatus
  decision: string | null
  report_json: any
  created_at: string
  submitted_at: string | null
  // NOTE: domain_scores not included here — requires service join (not yet added)
  // NOTE: sla_hours, ai_confidence — not in DB yet
}

// ── Status → kanban column ────────────────────────────────────────────────────

type Column = 'drafting' | 'queued' | 'analysing' | 'awaitingEA' | 'decided'

function toColumn(status: SubmissionStatus): Column {
  switch (status) {
    case 'drafting':                                                     return 'drafting'
    case 'queued': case 'review_pending': case 'agent_failed':           return 'queued'
    case 'analysing': case 'submitted':                                  return 'analysing'
    case 'review_ready': case 'ea_reviewing':                            return 'awaitingEA'
    default:                                                             return 'decided'
  }
}

// ── Decision meta ────────────────────────────────────────────────────────────

const DECISION_META: Record<string, { label: string; tone: PillTone }> = {
  approve:                 { label: 'Approved',           tone: 'green' },
  approved:                { label: 'Approved',           tone: 'green' },
  approve_with_conditions: { label: 'Approve · w/ Actions', tone: 'turquoise' },
  conditionally_approved:  { label: 'Approve · w/ Actions', tone: 'turquoise' },
  defer:                   { label: 'Deferred',           tone: 'amber' },
  deferred:                { label: 'Deferred',           tone: 'amber' },
  reject:                  { label: 'Rejected',           tone: 'red' },
  rejected:                { label: 'Rejected',           tone: 'red' },
  returned:                { label: 'Returned',           tone: 'amber' },
  closed:                  { label: 'Closed',             tone: 'gray' },
}

function decisionOf(r: Review): { label: string; tone: PillTone } {
  const key = (r.decision ?? r.status ?? '').toLowerCase()
  return DECISION_META[key] ?? { label: r.status.replace(/_/g, ' '), tone: 'gray' }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ptxGate(r: Review): string | null {
  return r.report_json?.form_data?.ptx_gate ?? r.report_json?.form_data?.ptxGate ?? null
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

// ── Governance KPI strip ─────────────────────────────────────────────────────

function GovernanceStrip({ reviews, isSA }: { reviews: Review[]; isSA: boolean }) {
  const inflight  = reviews.filter(r => ['queued','analysing','submitted','review_ready','ea_reviewing'].includes(r.status)).length
  const awaitingEA = reviews.filter(r => ['review_ready','ea_reviewing'].includes(r.status)).length
  const approved  = reviews.filter(r => ['approved','conditionally_approved'].includes(r.status)).length
  const returned  = reviews.filter(r => ['rejected','deferred','returned','closed'].includes(r.status)).length

  const pending    = reviews.filter(r => r.status === 'review_ready').length
  const total      = reviews.length

  const saStats = [
    { k: 'In flight',    v: inflight,  sub: `across ${Math.max(1, inflight)} gate${inflight !== 1 ? 's' : ''}`, color: '#1FBCD4', spark: [3,4,3,5,4,inflight] },
    { k: 'Awaiting EA',  v: awaitingEA, sub: 'pending decision', color: '#E59500', spark: [1,2,1,2,3,awaitingEA] },
    { k: 'Approved YTD', v: approved,  sub: 'total approved',   color: '#1FA567', spark: [6,7,8,9,10,approved] },
    { k: 'Returned',     v: returned,  sub: 'returned or deferred', color: '#E59500', spark: [3,2,4,2,3,returned] },
  ]
  const eaStats = [
    { k: 'Awaiting decision', v: pending,   sub: 'in your queue',         color: '#D74A40', spark: [3,4,3,5,4,pending] },
    { k: 'AI low-confidence', v: 0,         sub: 'flagged for deep review', color: '#E59500', spark: [1,2,1,2,0,0] },
    { k: 'Decisions this wk', v: approved,  sub: 'approved this period',   color: '#1FA567', spark: [6,7,8,9,10,approved] },
    { k: 'Total reviews',     v: total,     sub: 'all time',               color: '#1FBCD4', spark: [3,2,4,2,3,total] },
  ]
  const stats = isSA ? saStats : eaStats

  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {stats.map(s => (
        <div key={s.k} className="bg-white border border-line rounded-lg shadow-sh-sm" style={{ padding: '16px 18px' }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="font-cond font-semibold text-[12px] uppercase tracking-[0.16em] text-ink-400">
                {s.k}
              </div>
              <div className="font-cond font-bold text-ink-900 mt-1.5 leading-none" style={{ fontSize: 34 }}>
                {s.v}
              </div>
            </div>
            <Sparkline values={s.spark} color={s.color} />
          </div>
          <div className="text-[13.5px] text-ink-500 mt-2">{s.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ── SA Kanban card ────────────────────────────────────────────────────────────

function KanbanCard({ review, col, onClick }: {
  review: Review
  col: Column
  onClick: () => void
}) {
  const { domains } = useMetadataStore()
  const gate = ptxGate(review)
  const decision = decisionOf(review)
  const ref = toARBRef(review.id, review.created_at)

  return (
    <div
      onClick={onClick}
      className="bg-white border border-line rounded-lg cursor-pointer group"
      style={{ padding: 14, marginBottom: 10, transition: 'box-shadow .15s, transform .15s' }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 0 rgba(11,27,46,0.04), 0 4px 14px rgba(11,27,46,0.06)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = ''
        ;(e.currentTarget as HTMLDivElement).style.transform = ''
      }}
    >
      {/* Header row */}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[12px] text-ink-400 tracking-[0.04em]">{ref}</div>
          <div className="font-cond font-semibold text-[15.5px] text-ink-900 mt-1 leading-snug truncate">
            {review.solution_name}
          </div>
        </div>
        {gate && <Pill tone="navy">{gate}</Pill>}
      </div>

      {/* State-specific row */}
      {col === 'drafting' && (
        <div className="mt-2.5">
          <div className="flex justify-between text-[13px] text-ink-500 mb-1">
            <span>{review.report_json?.artefact_uploads?.length ?? 0} artefacts</span>
            <span>{timeAgo(review.created_at)}</span>
          </div>
          {/* simple progress indicator */}
          <div className="h-[4px] rounded-full overflow-hidden bg-line-soft">
            <div className="h-full rounded-full bg-turquoise-500" style={{ width: '35%' }} />
          </div>
        </div>
      )}

      {col === 'queued' && (review.status === 'review_pending' || review.status === 'agent_failed' ? (
        <div className="mt-2.5 flex items-center gap-2 text-[13px]" style={{ color: '#B45309' }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#F59E0B' }} />
          {review.status === 'agent_failed' ? 'Agent failed — retry required' : 'Domains pending — retry required'}
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-2 text-[13px] text-ink-500">
          <span className="w-2 h-2 rounded-full bg-turquoise-500 flex-shrink-0" />
          Ready for AI agent
          <span className="ml-auto text-[13px]">in queue</span>
        </div>
      ))}

      {col === 'analysing' && (
        <div className="mt-2.5">
          <div className="flex items-center gap-2 text-[13px] text-turquoise-700 mb-1.5">
            <span
              className="w-2 h-2 rounded-full bg-turquoise-500 flex-shrink-0 animate-pulse"
            />
            AI agent analysing
            <span className="ml-auto text-ink-500 text-[13px]">processing…</span>
          </div>
          <div className="h-[4px] rounded-full overflow-hidden bg-turquoise-100">
            <div
              className="h-full rounded-full bg-turquoise-500 animate-pulse"
              style={{ width: '70%' }}
            />
          </div>
        </div>
      )}

      {col === 'awaitingEA' && (
        <>
          {/* domain scores placeholder — populated once domain_scores join added */}
          <div className="mt-2.5">
            <DomainStrip scores={{}} domains={domains} />
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <Pill tone="turquoise" dot>Awaiting EA decision</Pill>
          </div>
        </>
      )}

      {col === 'decided' && (
        <>
          <div className="mt-2.5">
            <DomainStrip scores={{}} domains={domains} />
          </div>
          <div className="mt-2.5 flex items-center">
            <Pill tone={decision.tone} dot>{decision.label}</Pill>
            <span className="ml-auto text-[13px] text-ink-400">{timeAgo(review.submitted_at ?? review.created_at)}</span>
          </div>
        </>
      )}
    </div>
  )
}

// ── SA Kanban board ───────────────────────────────────────────────────────────

const COLUMNS: { key: Column; title: string; subtitle: string }[] = [
  { key: 'drafting',   title: 'Drafting',    subtitle: 'Editable' },
  { key: 'queued',     title: 'Ready',       subtitle: 'AI queue' },
  { key: 'analysing',  title: 'In analysis', subtitle: 'AI agent' },
  { key: 'awaitingEA', title: 'Awaiting EA', subtitle: 'Decision pending' },
  { key: 'decided',    title: 'Decided',     subtitle: 'Last 30 days' },
]

function SAKanban({ reviews, onOpen }: { reviews: Review[]; onOpen: (r: Review) => void }) {
  const byCol = COLUMNS.reduce<Record<Column, Review[]>>((acc, c) => {
    acc[c.key] = reviews.filter(r => toColumn(r.status) === c.key)
    return acc
  }, { drafting: [], queued: [], analysing: [], awaitingEA: [], decided: [] })

  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
      {COLUMNS.map(col => (
        <div key={col.key} className="rounded-lg p-3" style={{ background: '#EEF2F6' }}>
          <div className="flex items-baseline gap-1.5 mb-1 px-0.5">
            <span className="font-cond font-bold text-[14px] uppercase tracking-[0.14em] text-ink-700">
              {col.title}
            </span>
            <span className="text-ink-400 text-[13px] ml-auto">{byCol[col.key].length}</span>
          </div>
          <div className="text-ink-400 text-[12.5px] mb-2 px-0.5">{col.subtitle}</div>

          {byCol[col.key].length === 0 ? (
            <div className="border border-dashed border-line rounded-[8px] text-center text-ink-400 text-[13px] py-5">
              —
            </div>
          ) : (
            byCol[col.key].map(r => (
              <KanbanCard key={r.id} review={r} col={col.key} onClick={() => onOpen(r)} />
            ))
          )}
        </div>
      ))}
    </div>
  )
}

// ── SA Dashboard ──────────────────────────────────────────────────────────────

function SADashboard({
  reviews,
  firstName,
  loading,
  onOpenReview,
  onNew,
}: {
  reviews: Review[]
  firstName: string
  loading: boolean
  onOpenReview: (r: Review) => void
  onNew: () => void
}) {
  const awaitingEA = reviews.filter(r => ['review_ready', 'ea_reviewing'].includes(r.status)).length
  const analysing  = reviews.filter(r => ['analysing', 'submitted', 'queued'].includes(r.status)).length

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-start mb-5">
        <div>
          <h1 className="font-cond font-bold text-ink-900 mb-1" style={{ fontSize: 30, lineHeight: 1.05 }}>
            Welcome back, {firstName}.
          </h1>
          <p className="text-ink-500 text-[15px]">
            {awaitingEA > 0 && (
              <strong className="text-ink-700">{awaitingEA} submission{awaitingEA !== 1 ? 's' : ''} awaiting EA decision</strong>
            )}
            {awaitingEA > 0 && analysing > 0 && ' · '}
            {analysing > 0 && `${analysing} in AI analysis`}
            {awaitingEA === 0 && analysing === 0 && 'No active submissions in progress.'}
          </p>
        </div>
        <div className="ml-auto flex gap-2.5">
          <button
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] border border-line bg-white text-ink-700 text-[14px] font-medium hover:bg-paper-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] bg-navy-700 text-white text-[14px] font-medium hover:bg-navy-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New review request
          </button>
        </div>
      </div>

      <GovernanceStrip reviews={reviews} isSA />

      {loading ? (
        <div className="text-center text-ink-400 py-12">Loading pipeline…</div>
      ) : (
        <SAKanban reviews={reviews} onOpen={onOpenReview} />
      )}
    </div>
  )
}

// ── EA Triage row ─────────────────────────────────────────────────────────────

function EATriageRow({ review, onOpen }: { review: Review; onOpen: () => void }) {
  const { domains } = useMetadataStore()
  const decision = decisionOf(review)
  const ref = toARBRef(review.id, review.created_at)
  // AI decision from report_json if present
  const aiDecision = review.report_json?.ai_decision ?? review.decision
  const aiDecisionMeta = aiDecision ? (DECISION_META[aiDecision] ?? decision) : decision

  // NOTE: sla_hours and ai_confidence not in DB yet — shown as placeholder
  const slaLabel = '—'
  const slaColor = 'text-ink-400'

  return (
    <tr className="cursor-pointer hover:bg-paper transition-colors" onClick={onOpen}>
      {/* SLA dot */}
      <td className="px-3.5 py-3.5 w-9">
        <span className="w-2 h-2 rounded-full bg-ink-300 inline-block" />
      </td>

      {/* Submission */}
      <td className="px-3.5 py-3.5">
        <div className="font-mono text-[12px] text-ink-400 tracking-[0.04em]">{ref}</div>
        <div className="font-cond font-semibold text-[15.5px] text-ink-900 mt-0.5">
          {review.solution_name}
        </div>
      </td>

      {/* Submitter — not separately stored, use SA user placeholder */}
      <td className="px-3.5 py-3.5">
        <div className="text-[14px] text-ink-700">—</div>
        <div className="text-[12.5px] text-ink-400">Submitted {timeAgo(review.submitted_at ?? review.created_at)}</div>
      </td>

      {/* AI recommendation */}
      <td className="px-3.5 py-3.5" style={{ minWidth: 180 }}>
        <Pill tone={aiDecisionMeta.tone} dot>{aiDecisionMeta.label}</Pill>
        {/* NOTE: ai_confidence not in DB — add bar once field available */}
      </td>

      {/* Domains · findings — NOTE: counts need service join */}
      <td className="px-3.5 py-3.5" style={{ minWidth: 160 }}>
        <DomainStrip scores={{}} domains={domains} />
        <div className="text-[12.5px] text-ink-500 mt-1.5">
          {(review.report_json?.scope_tags ?? review.report_json?.form_data?.domains ?? []).length > 0
            ? `${(review.report_json?.scope_tags ?? review.report_json?.form_data?.domains ?? []).length} domains in scope`
            : 'domains TBD'}
        </div>
      </td>

      {/* SLA — NOTE: not in DB yet */}
      <td className="px-3.5 py-3.5">
        <div className={`font-cond font-semibold text-[15px] tracking-[0.02em] ${slaColor}`}>{slaLabel}</div>
        <div className="text-[12px] text-ink-400">Not configured</div>
      </td>

      {/* Open */}
      <td className="px-3.5 py-3.5 w-[90px] text-right">
        <button
          onClick={e => { e.stopPropagation(); onOpen() }}
          className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-[8px] border border-line bg-white text-[13px] text-ink-700 hover:bg-paper-2 transition-colors"
        >
          Open <ArrowRight className="w-3 h-3" />
        </button>
      </td>
    </tr>
  )
}

// ── EA Dashboard ──────────────────────────────────────────────────────────────

type EAFilter = 'all' | 'sla' | 'low_conf' | 'rejects'

function EADashboard({
  reviews,
  loading,
  onOpenReview,
}: {
  reviews: Review[]
  loading: boolean
  onOpenReview: (r: Review) => void
}) {
  const [filter, setFilter] = useState<EAFilter>('all')

  const pending = reviews.filter(r => ['review_ready', 'ea_reviewing'].includes(r.status))

  const filtered = pending.filter(r => {
    if (filter === 'rejects') return (r.decision ?? '').includes('reject')
    // sla / low_conf require backend fields — show all for now
    return true
  })

  const FILTERS: { k: EAFilter; label: string }[] = [
    { k: 'all',      label: 'All' },
    { k: 'sla',      label: 'SLA risk' },
    { k: 'low_conf', label: 'AI low-conf' },
    { k: 'rejects',  label: 'AI rejects' },
  ]

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-start mb-5">
        <div>
          <div className="font-cond font-semibold text-[12px] uppercase tracking-[0.16em] text-ink-400">
            Enterprise Architect cockpit
          </div>
          <h1 className="font-cond font-bold text-ink-900 mt-1 mb-1" style={{ fontSize: 30, lineHeight: 1.05 }}>
            Decisions desk
          </h1>
          <p className="text-[15px] text-ink-500">
            {pending.length > 0
              ? <><strong className="text-ink-700">{pending.length} review{pending.length !== 1 ? 's' : ''}</strong> awaiting your decision.</>
              : 'No reviews awaiting your decision.'}
          </p>
        </div>
        <div className="ml-auto flex gap-2.5">
          <button className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] border border-line bg-white text-ink-700 text-[13px] font-medium hover:bg-paper-2 transition-colors">
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
          <button className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] border border-line bg-white text-ink-700 text-[13px] font-medium hover:bg-paper-2 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export queue
          </button>
        </div>
      </div>

      <GovernanceStrip reviews={reviews} isSA={false} />

      <div className="grid gap-[18px]" style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px' }}>
        {/* Triage queue */}
        <div className="bg-white border border-line rounded-lg shadow-sh-sm overflow-hidden">
          {/* Card head */}
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-line-soft">
            <h3 className="font-cond font-semibold text-[14.5px] uppercase tracking-[0.12em] text-ink-700">
              Triage queue
            </h3>
            <div className="ml-auto flex gap-1.5">
              {FILTERS.map(f => (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  className={`inline-flex items-center h-[26px] px-2.5 rounded-[6px] text-[13px] font-medium border transition-colors
                    ${filter === f.k
                      ? 'bg-navy-700 text-white border-navy-700'
                      : 'bg-transparent text-ink-600 border-transparent hover:bg-paper-2'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center text-ink-400 py-8">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-ink-400 py-10">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Queue is clear.
            </div>
          ) : (
            <table className="w-full border-collapse text-[14.5px]">
              <thead>
                <tr>
                  <th className="text-left font-cond font-semibold text-[12px] uppercase tracking-[0.16em] text-ink-400 px-3.5 py-2.5 border-b border-line" />
                  <th className="text-left font-cond font-semibold text-[12px] uppercase tracking-[0.16em] text-ink-400 px-3.5 py-2.5 border-b border-line">Submission</th>
                  <th className="text-left font-cond font-semibold text-[12px] uppercase tracking-[0.16em] text-ink-400 px-3.5 py-2.5 border-b border-line">Submitter</th>
                  <th className="text-left font-cond font-semibold text-[12px] uppercase tracking-[0.16em] text-ink-400 px-3.5 py-2.5 border-b border-line">AI recommendation</th>
                  <th className="text-left font-cond font-semibold text-[12px] uppercase tracking-[0.16em] text-ink-400 px-3.5 py-2.5 border-b border-line">Domains · findings</th>
                  <th className="text-left font-cond font-semibold text-[12px] uppercase tracking-[0.16em] text-ink-400 px-3.5 py-2.5 border-b border-line">SLA</th>
                  <th className="border-b border-line" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <EATriageRow
                    key={r.id}
                    review={r}
                    onOpen={() => onOpenReview(r)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4">
          {/* Focus next */}
          <div className="bg-white border border-line rounded-lg shadow-sh-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-line-soft">
              <h3 className="font-cond font-semibold text-[15.5px] uppercase tracking-[0.12em] text-ink-700">
                Focus next
              </h3>
            </div>
            <div className="px-4 py-3 text-[14px]">
              {pending.length === 0 ? (
                <p className="text-ink-400 text-center py-4">Nothing in queue.</p>
              ) : (
                pending.slice(0, 2).map((r, i) => (
                  <div
                    key={r.id}
                    onClick={() => onOpenReview(r)}
                    className={`p-[10px] rounded-[8px] mb-2 cursor-pointer border ${
                      i === 0
                        ? 'bg-rag-red-100 border-rag-red-500/20'
                        : 'bg-rag-amber-100 border-rag-amber-500/20'
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 font-semibold text-[13px] ${i === 0 ? 'text-rag-red-700' : 'text-rag-amber-700'}`}>
                      {i === 0 ? <Clock className="w-3.5 h-3.5" /> : <Flag className="w-3.5 h-3.5" />}
                      {i === 0 ? 'Oldest in queue' : 'Needs attention'}
                    </div>
                    <div className="mt-1 text-ink-900 font-medium text-[14px] leading-snug">{r.solution_name}</div>
                    <div className="text-[12.5px] text-ink-500 mt-0.5">
                      Submitted {timeAgo(r.submitted_at ?? r.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent decisions */}
          <div className="bg-white border border-line rounded-lg shadow-sh-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-line-soft">
              <h3 className="font-cond font-semibold text-[15.5px] uppercase tracking-[0.12em] text-ink-700">
                Recent decisions
              </h3>
              <span className="text-ink-400 text-[13px] ml-auto">last 30 days</span>
            </div>
            <div className="px-4 py-1">
              {reviews
                .filter(r => ['approved','conditionally_approved','rejected','deferred','closed','returned'].includes(r.status))
                .slice(0, 4)
                .map((r, i, arr) => {
                  const d = decisionOf(r)
                  const dotColor: Record<PillTone, string> = {
                    green: 'bg-rag-green-500', turquoise: 'bg-turquoise-500',
                    amber: 'bg-rag-amber-500', red: 'bg-rag-red-500',
                    navy: 'bg-navy-700', gray: 'bg-ink-300',
                  }
                  return (
                    <div
                      key={r.id}
                      className="flex items-start gap-2.5 py-[9px]"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid #E7EDF2' : 'none' }}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-[5px] ${dotColor[d.tone]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-ink-900 truncate">{r.solution_name}</div>
                        <div className="text-[12.5px] text-ink-500">{d.label}</div>
                      </div>
                      <div className="text-[12px] text-ink-400">{timeAgo(r.submitted_at ?? r.created_at)}</div>
                    </div>
                  )
                })}
              {reviews.filter(r => ['approved','conditionally_approved','rejected','deferred','closed','returned'].includes(r.status)).length === 0 && (
                <p className="text-ink-400 text-center py-4 text-[14px]">No decisions yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard (role-aware) ────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const user     = useAuthStore(s => s.user)
  const { loadMetadata } = useMetadataStore()
  useEffect(() => { loadMetadata() }, [])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  const isSA = user?.role === 'solution_architect'
  const isEA = user?.role === 'enterprise_architect' || user?.role === 'arb_admin' || user?.role === 'super_admin'

  useEffect(() => {
    const fetch = async () => {
      try {
        if (isSA) {
          const data = await reviewService.getUserReviews(user?.id)
          setReviews(data as Review[])
        } else if (isEA) {
          const data = await reviewService.getAllReviews()
          setReviews(data as Review[])
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [isSA, isEA])

  const firstName = (user?.name ?? 'there').split(' ')[0]

  const openReview = (r: Review) => {
    // Drafting is the only state where the edit wizard makes sense.
    // Everything else — including queued/analysing/submitted (stuck or in-flight) — goes
    // to the ReviewDashboard so the SA sees the retry banner rather than a blank form.
    if (r.status === 'drafting') {
      navigate(`/earr/edit/${r.id}`)
    } else {
      navigate(`/review/${r.id}`)
    }
  }

  if (isSA) {
    return (
      <SADashboard
        reviews={reviews}
        firstName={firstName}
        loading={loading}
        onOpenReview={openReview}
        onNew={() => navigate('/submission/new')}
      />
    )
  }

  if (isEA) {
    return (
      <EADashboard
        reviews={reviews}
        loading={loading}
        onOpenReview={openReview}
      />
    )
  }

  return (
    <div className="p-8 text-ink-500">Loading your dashboard…</div>
  )
}
