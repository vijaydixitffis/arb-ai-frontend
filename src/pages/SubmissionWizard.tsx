/**
 * SubmissionWizard — 4-step guided EA review request flow.
 *
 * Replaces ARBSubmission.tsx and EARRSubmission.tsx.
 * Routes: /submission/new  (new)
 *         /earr/new        (new, aliased)
 *         /earr/edit/:id   (edit draft)
 *
 * Service calls (all existing, no new backend calls):
 *   - reviewService.createDraft()          step 1 first save
 *   - reviewService.updateDraft()          subsequent autosaves
 *   - reviewService.uploadArtifact()       step 3 file drop
 *   - reviewService.updateReviewArtifactInfo()  step 3 file metadata
 *   - reviewService.markReadyForReview()   step 4 submit
 *   - reviewService.triggerReviewOrchestrator() step 4 fire-and-forget
 *
 * NOTE: AI problem-statement suggestion (teal callout in Step 1) is UI-only.
 *       Wire to a backend endpoint when the AI suggestion API is ready.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import {
  Briefcase, Layers, Upload, Check, ArrowLeft, ArrowRight,
  Sparkles, Users, Zap, Flag, MessageSquare, File, X,
  Shield, AlertTriangle,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useMetadataStore } from '../stores/metadataStore'
import { reviewService } from '../services/backendConfig'
import { Pill, getDomainIcon } from '../components/ui/ds'
import type { DomainSlug } from '../components/ui/ds'

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, key: 'context',   label: 'Context',   icon: Briefcase, desc: 'Project, problem, drivers' },
  { id: 2, key: 'scope',     label: 'Scope',     icon: Layers,    desc: 'Gate, disposition, domains' },
  { id: 3, key: 'artefacts', label: 'Artefacts', icon: Upload,    desc: 'Upload supporting docs' },
  { id: 4, key: 'review',    label: 'Review',    icon: Check,     desc: 'Confirm & submit' },
] as const

// ── Wizard form state ─────────────────────────────────────────────────────────

interface WizardData {
  project_name: string
  problem_statement: string
  stakeholders: string
  business_drivers: string
  target_outcomes: string
  ptx_gate: string
  architecture_disposition: string
  domains: DomainSlug[]
  domain_data: Record<string, WizardDomainData>
}

interface DomainArtefact {
  id?: string
  name: string
  type: string
  fileName: string
  file: File | null
}

interface WizardDomainData {
  checklist: Record<string, string>
  evidence: Record<string, string>
}

// ── Step rail ─────────────────────────────────────────────────────────────────

function StepRail({ step, lastSaved }: { step: number; lastSaved: Date | null }) {
  return (
    <div style={{ position: 'sticky', top: 24, width: 200 }}>
      <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-ink-400 mb-1.5">
        New EA review
      </div>
      <div className="font-cond font-bold text-[16px] text-ink-900 mb-[18px] tracking-[0.02em]">
        Step {step} of {STEPS.length}
      </div>

      {STEPS.map(s => {
        const isActive = s.id === step
        const isDone   = s.id < step
        const Icon = s.icon
        return (
          <div key={s.id} className="relative pl-[22px] pb-3.5">
            {/* Vertical line */}
            {s.id < STEPS.length && (
              <div
                className="absolute left-[5px] top-4 bottom-[-2px] w-[1px]"
                style={{ background: isDone ? '#1FBCD4' : '#D9E2EA' }}
              />
            )}
            {/* Step dot */}
            <div
              className="absolute left-0 top-1 w-[11px] h-[11px] rounded-full"
              style={{
                background: isDone ? '#1FBCD4' : isActive ? '#fff' : '#EEF2F6',
                border: `1.5px solid ${isActive ? '#1FBCD4' : isDone ? '#1FBCD4' : '#C9D4DE'}`,
                boxShadow: isActive ? '0 0 0 4px rgba(31,188,212,0.18)' : 'none',
              }}
            />
            {/* Label */}
            <div
              className="flex items-center gap-1.5"
              style={{ color: isActive ? '#0E1B2C' : isDone ? '#0E8FA8' : '#4A6480' }}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span
                className="font-cond text-[13px] tracking-[0.02em]"
                style={{ fontWeight: isActive ? 700 : 500 }}
              >
                {s.label}
              </span>
            </div>
            <div className="text-[11px] text-ink-400 mt-[2px] pl-5">{s.desc}</div>
          </div>
        )
      })}

      {/* Autosave indicator */}
      <div className="flex items-center gap-1.5 pl-[22px] mt-2 text-[11px] text-turquoise-700">
        <span className="w-1.5 h-1.5 rounded-full bg-turquoise-500 flex-shrink-0" />
        {lastSaved
          ? `Autosaved ${Math.round((Date.now() - lastSaved.getTime()) / 1000)}s ago`
          : 'Not yet saved'}
      </div>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, icon: Icon, required, hint, children }: {
  label: string
  icon?: React.ElementType
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 font-cond font-semibold text-[11.5px] uppercase tracking-[0.14em] text-ink-500">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
        {required && <span className="text-rag-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[12px] text-ink-400">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full border border-line bg-white rounded-[8px] px-3 py-[9px] text-[13.5px] text-ink-700 outline-none focus:border-turquoise-500 focus:shadow-[0_0_0_3px_rgba(31,188,212,0.18)] transition-all font-sans'
const textareaCls = `${inputCls} min-h-[80px] resize-y`

// ── Step 1: Context ───────────────────────────────────────────────────────────

function StepContext({ data, set }: { data: WizardData; set: (p: Partial<WizardData>) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-turquoise-700 mb-1">
          Step 1 / 4
        </div>
        <h2 className="font-cond font-bold text-[22px] text-ink-900 mb-1 tracking-[0.01em]">
          What are we reviewing, and why?
        </h2>
        <p className="text-[13px] text-ink-500">
          A 60-second framing helps the AI agent calibrate domain weights and pull the right standards.
        </p>
      </div>

      <Field label="Project name" icon={Briefcase} required>
        <input
          className={inputCls}
          value={data.project_name}
          onChange={e => set({ project_name: e.target.value })}
          placeholder="e.g. Treasury · Real-time Liquidity Engine"
        />
      </Field>

      <div className="grid gap-[18px]" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <Field label="Problem statement" icon={MessageSquare} required hint="Tip: stick to outcomes, not implementations.">
          <textarea
            className={textareaCls}
            rows={5}
            value={data.problem_statement}
            onChange={e => set({ problem_statement: e.target.value })}
            placeholder="What user/business problem does this solve? Be specific."
          />
        </Field>

        {/* AI suggestion callout — UI only until backend endpoint ready */}
        <div
          className="rounded-[8px] p-[12px_14px] self-start"
          style={{ background: '#F1FAFC', border: '1px solid rgba(31,188,212,0.25)' }}
        >
          <div className="flex items-center gap-1.5 text-turquoise-700 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-cond font-semibold text-[10px] uppercase tracking-[0.16em] text-turquoise-700">
              AI suggests
            </span>
          </div>
          <p className="text-[12.5px] text-ink-700 leading-relaxed">
            {data.problem_statement
              ? 'Type your problem statement and the AI will generate a fit-for-purpose summary.'
              : 'The AI agent will suggest a refined problem statement based on your project name and context.'}
          </p>
          {/* NOTE: wire to AI suggestion endpoint when ready */}
          <button
            disabled
            className="mt-2 h-6 px-2.5 rounded-[6px] text-[11.5px] text-turquoise-700 border border-turquoise-500 bg-transparent opacity-40 cursor-not-allowed"
          >
            Use suggestion
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[18px]">
        <Field label="Stakeholders" icon={Users} hint="One per line — name, role, accountability">
          <textarea
            className={textareaCls}
            rows={4}
            value={data.stakeholders}
            onChange={e => set({ stakeholders: e.target.value })}
            placeholder="One per line — name, role, accountability"
          />
        </Field>
        <Field label="Business drivers" icon={Zap} hint="Regulatory, cost, growth, risk — one per line">
          <textarea
            className={textareaCls}
            rows={4}
            value={data.business_drivers}
            onChange={e => set({ business_drivers: e.target.value })}
            placeholder="Regulatory, cost, growth, risk — one per line"
          />
        </Field>
      </div>

      <Field label="Target business outcomes" icon={Flag} hint="Measurable outcomes within 6–18 months">
        <textarea
          className={textareaCls}
          rows={3}
          value={data.target_outcomes}
          onChange={e => set({ target_outcomes: e.target.value })}
          placeholder="Measurable outcomes within 6–18 months"
        />
      </Field>
    </div>
  )
}

// ── Step 2: Scope ─────────────────────────────────────────────────────────────

function StepScope({ data, set }: { data: WizardData; set: (p: Partial<WizardData>) => void }) {
  const { domains, ptxGates, architectureDispositions, loadMetadata } = useMetadataStore()

  useEffect(() => { loadMetadata() }, [])

  const toggleDomain = (slug: DomainSlug) => {
    set({
      domains: data.domains.includes(slug)
        ? data.domains.filter(d => d !== slug)
        : [...data.domains, slug],
    })
  }

  // Disposition icon lookup
  const dispIcon: Record<string, React.ElementType> = {
    new: Sparkles, enhancement: Zap, migration: ArrowRight, retire: X,
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-turquoise-700 mb-1">
          Step 2 / 4
        </div>
        <h2 className="font-cond font-bold text-[22px] text-ink-900 mb-1 tracking-[0.01em]">
          Scope the review.
        </h2>
        <p className="text-[13px] text-ink-500">
          The PTX gate and disposition decide which standards are enforced. Domains determine which expert sub-agents are dispatched.
        </p>
      </div>

      {/* PTX Gate — segmented control */}
      <div>
        <div className="flex items-center gap-1.5 font-cond font-semibold text-[11.5px] uppercase tracking-[0.14em] text-ink-500 mb-2.5">
          <Flag className="w-3.5 h-3.5" />
          PTX gate
        </div>
        <div
          className="inline-flex rounded-[10px] border border-line"
          style={{ background: '#EEF2F6', padding: 4, gap: 2 }}
        >
          {(ptxGates.length ? ptxGates : [
            { value: 'PTX-G0', label: 'G0 · Idea' },
            { value: 'PTX-G1', label: 'G1 · Initiation' },
            { value: 'PTX-G2', label: 'G2 · Design' },
            { value: 'PTX-G3', label: 'G3 · Build' },
            { value: 'PTX-G4', label: 'G4 · Live' },
          ]).map(g => {
            const sel = data.ptx_gate === g.value
            return (
              <button
                key={g.value}
                onClick={() => set({ ptx_gate: g.value })}
                className="rounded-[7px] px-3.5 py-[7px] font-cond font-semibold text-[12.5px] tracking-[0.02em] border-none cursor-pointer transition-all"
                style={{
                  background: sel ? '#1A2D45' : 'transparent',
                  color: sel ? '#fff' : '#2F4865',
                }}
              >
                {g.label.split(' · ')[0].replace('PTX-', '')}
              </button>
            )
          })}
        </div>
        {data.ptx_gate && (
          <p className="text-[12px] text-ink-500 mt-1.5">
            {ptxGates.find(g => g.value === data.ptx_gate)?.label ?? data.ptx_gate}
          </p>
        )}
      </div>

      {/* Architecture disposition */}
      <div>
        <div className="flex items-center gap-1.5 font-cond font-semibold text-[11.5px] uppercase tracking-[0.14em] text-ink-500 mb-2.5">
          <Layers className="w-3.5 h-3.5" />
          Architecture disposition
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(architectureDispositions.length ? architectureDispositions : [
            { value: 'new',         label: 'New solution',           description: 'Greenfield capability' },
            { value: 'enhancement', label: 'Enhancement',            description: 'Material change to in-flight system' },
            { value: 'migration',   label: 'Migration / re-platform', description: 'Same capability, new tech' },
            { value: 'retire',      label: 'Retire / consolidate',   description: 'Decommission or merge' },
          ]).map(d => {
            const sel = data.architecture_disposition === d.value
            const Icon = dispIcon[d.value] ?? Layers
            return (
              <button
                key={d.value}
                onClick={() => set({ architecture_disposition: d.value })}
                className="text-left cursor-pointer rounded-[8px] p-[10px_12px] flex flex-col gap-1 transition-all border"
                style={{
                  background: sel ? '#F1FAFC' : '#fff',
                  borderColor: sel ? '#1FBCD4' : '#D9E2EA',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-[22px] h-[22px] rounded-[6px] grid place-items-center flex-shrink-0"
                    style={{
                      background: sel ? '#1FBCD4' : '#EEF2F6',
                      color: sel ? '#fff' : '#4A6480',
                    }}
                  >
                    <Icon className="w-3 h-3" />
                  </span>
                  <span className="text-[13px] font-medium text-ink-900 leading-tight">{d.label}</span>
                </div>
                <span className="text-[11.5px] text-ink-400 leading-snug">
                  {'description' in d ? (d as any).description : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Domain scope */}
      <div>
        <div className="flex items-center mb-2.5">
          <div className="flex items-center gap-1.5 font-cond font-semibold text-[11.5px] uppercase tracking-[0.14em] text-ink-500">
            <Shield className="w-3.5 h-3.5" />
            Domain scope
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px] text-ink-500">{data.domains.length} of {domains.length} selected</span>
            <button
              className="h-[28px] px-2.5 rounded-[6px] text-[12px] text-ink-600 hover:bg-paper-2 border-none bg-transparent cursor-pointer"
              onClick={() => set({ domains: domains.map(d => d.slug) })}
            >
              Select all
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {domains.map(d => {
            const sel = data.domains.includes(d.slug)
            const Icon = getDomainIcon(d.icon)
            return (
              <button
                key={d.slug}
                onClick={() => toggleDomain(d.slug)}
                className="text-left cursor-pointer rounded-[8px] px-3 py-[9px] flex items-center gap-[9px] transition-all border relative"
                style={{
                  background: sel ? '#F1FAFC' : '#fff',
                  borderColor: sel ? '#1FBCD4' : '#D9E2EA',
                }}
              >
                {/* Checkbox */}
                <span
                  className="w-3.5 h-3.5 rounded-[3px] flex-shrink-0 grid place-items-center"
                  style={{
                    border: `1.5px solid ${sel ? '#1FBCD4' : '#A6BAC9'}`,
                    background: sel ? '#1FBCD4' : 'transparent',
                    color: '#fff',
                  }}
                >
                  {sel && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <Icon className="w-3.5 h-3.5 text-ink-500 flex-shrink-0" />
                <span className="text-[13px] font-medium text-ink-900">{d.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Gate hint */}
      <div className="rounded-lg border border-line bg-paper-2 px-4 py-3 flex items-center gap-2 text-ink-600">
        <Shield className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-semibold text-[13px]">Required for this gate: </span>
        <span className="text-[13px] text-ink-500">Solution overview · NFR evidence · Security threat model · Data classification.</span>
      </div>
    </div>
  )
}

// ── Checklist question dialog ─────────────────────────────────────────────────

const CHECKLIST_COLORS = [
  { bg: '#F1FAFC', border: '#B8ECF3', text: '#0E8FA8' },  // turquoise-50 · turquoise-200 · turquoise-700
  { bg: '#E2F6FA', border: '#B8ECF3', text: '#14A8BF' },  // turquoise-100 · turquoise-200 · turquoise-600
  { bg: '#EEF2F6', border: '#C9D4DE', text: '#1A2D45' },  // paper-2  · ink-200  · navy-700
  { bg: '#DDF3E5', border: 'rgba(31,165,103,0.35)', text: '#15784D' },  // green-100 · green-500/35 · green-700
  { bg: '#E2F6FA', border: '#B8ECF3', text: '#0E8FA8' },  // turquoise-100 · turquoise-200 · turquoise-700
  { bg: '#F4F7FA', border: '#DEE6ED', text: '#2F4865' },  // paper    · ink-100  · ink-600
]

const SLIDER_OPTIONS = ['compliant', 'non_compliant', 'partial', 'na']
const SLIDER_LABELS  = ['Yes', 'No', 'Partial', 'N/A']

function QuestionDialog({ subsection, domain, data, patchData, onClose }: {
  subsection: any
  domain: string
  data: WizardData
  patchData: (p: Partial<WizardData>) => void
  onClose: () => void
}) {
  const setAnswer = (qCode: string, answer: string) =>
    patchData({
      domain_data: {
        ...data.domain_data,
        [domain]: {
          checklist: { ...(data.domain_data[domain]?.checklist ?? {}), [qCode]: answer },
          evidence:  data.domain_data[domain]?.evidence ?? {},
        },
      },
    })

  const setEvidence = (qCode: string, text: string) =>
    patchData({
      domain_data: {
        ...data.domain_data,
        [domain]: {
          checklist: data.domain_data[domain]?.checklist ?? {},
          evidence:  { ...(data.domain_data[domain]?.evidence ?? {}), [qCode]: text },
        },
      },
    })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-cond font-bold text-[17px] text-ink-900">{subsection.name}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-ink-400 hover:text-ink-700 hover:bg-paper-2 border-none bg-transparent cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {(subsection.questions ?? []).map((q: any) => {
            const currentAnswer = data.domain_data[domain]?.checklist?.[q.question_code] ?? ''
            const idx = Math.max(0, SLIDER_OPTIONS.indexOf(currentAnswer))
            return (
              <div key={q.id} className="border border-line rounded-lg p-4 flex flex-col gap-3">
                <p className="font-medium text-[13.5px] text-ink-900">{q.question_text}</p>
                <div>
                  <input
                    type="range"
                    min={0}
                    max={SLIDER_OPTIONS.length - 1}
                    step={1}
                    value={idx}
                    onChange={e => setAnswer(q.question_code, SLIDER_OPTIONS[+e.target.value])}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-turquoise-500"
                  />
                  <div className="flex justify-between mt-1.5">
                    {SLIDER_LABELS.map((label, i) => (
                      <span
                        key={label}
                        className="text-[11px]"
                        style={{ color: idx === i ? '#1FBCD4' : '#6B8299', fontWeight: idx === i ? 700 : 400 }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Evidence notes (optional)"
                  value={data.domain_data[domain]?.evidence?.[q.question_code] ?? ''}
                  onChange={e => setEvidence(q.question_code, e.target.value)}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-[8px] bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-800 transition-colors border-none cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Artefacts & Checklists ───────────────────────────────────────────

function StepArtefacts({
  reviewId,
  data,
  patchData,
  domainArtefacts,
  setDomainArtefacts,
}: {
  reviewId: string | null
  data: WizardData
  patchData: (p: Partial<WizardData>) => void
  domainArtefacts: Record<string, DomainArtefact[]>
  setDomainArtefacts: React.Dispatch<React.SetStateAction<Record<string, DomainArtefact[]>>>
}) {
  const { domains, artefactTypes, artefactTemplatesByDomain, checklistSubsectionsByDomain, loadDomainMetadata } = useMetadataStore()
  const [activeTab, setActiveTab]     = useState<string>(data.domains[0] ?? '')
  const [newArtefact, setNewArtefact] = useState({ name: '', type: '', file: null as File | null })
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedSubsection, setSelectedSubsection] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentDomain = activeTab || data.domains[0] || ''
  const templates     = artefactTemplatesByDomain[currentDomain] ?? []
  const subsections   = checklistSubsectionsByDomain[currentDomain] ?? []
  const currentArts   = domainArtefacts[currentDomain] ?? []
  const totalArtefacts = Object.values(domainArtefacts).reduce((n, a) => n + a.length, 0)

  const domainMeta = (slug: string) => {
    const d = domains.find(x => x.slug === slug)
    return d ? { label: d.name, Icon: getDomainIcon(d.icon) } : undefined
  }

  useEffect(() => {
    data.domains.forEach(slug => {
      if (!artefactTemplatesByDomain[slug] || !checklistSubsectionsByDomain[slug]) {
        loadDomainMetadata(slug)
      }
    })
  }, [data.domains])

  const handleUpload = async () => {
    if (!reviewId || !newArtefact.name || !newArtefact.type || !newArtefact.file) return
    setUploading(true)
    setUploadError(null)
    try {
      const results = await reviewService.uploadArtefacts(reviewId, [{
        domain: currentDomain,
        name:   newArtefact.name,
        type:   newArtefact.type,
        file:   newArtefact.file,
      }])
      const uploaded = results[0]
      setDomainArtefacts(prev => ({
        ...prev,
        [currentDomain]: [
          ...(prev[currentDomain] ?? []),
          { id: uploaded.id, name: uploaded.artefact_name, type: uploaded.artefact_type, fileName: uploaded.filename, file: null },
        ],
      }))
      setNewArtefact({ name: '', type: '', file: null })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (artefactId: string) => {
    if (!reviewId) return
    try {
      await reviewService.deleteArtefact(artefactId, reviewId)
      setDomainArtefacts(prev => ({
        ...prev,
        [currentDomain]: (prev[currentDomain] ?? []).filter(a => a.id !== artefactId),
      }))
    } catch (e) {
      console.error('Delete artefact failed', e)
    }
  }

  if (data.domains.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-turquoise-700 mb-1">Step 3 / 4</div>
          <h2 className="font-cond font-bold text-[22px] text-ink-900 mb-1 tracking-[0.01em]">Upload artefacts &amp; answer checklists.</h2>
        </div>
        <div className="flex items-start gap-3 rounded-lg border px-4 py-3" style={{ background: '#FCEED0', borderColor: 'rgba(229,149,0,0.3)' }}>
          <AlertTriangle className="w-4 h-4 text-rag-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-[13px] text-ink-700">No domains selected. Go back to Step 2 and select at least one domain.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-turquoise-700 mb-1">
          Step 3 / 4
        </div>
        <h2 className="font-cond font-bold text-[22px] text-ink-900 mb-1 tracking-[0.01em]">
          Upload artefacts &amp; answer checklists.
        </h2>
        <p className="text-[13px] text-ink-500">
          For each selected domain: upload supporting documents and answer the compliance checklist.
        </p>
      </div>

      {/* Domain tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {data.domains.map(slug => {
          const meta    = domainMeta(slug)
          const Icon    = meta?.Icon ?? Shield
          const artCount = (domainArtefacts[slug] ?? []).length
          const isActive = slug === currentDomain
          return (
            <button
              key={slug}
              onClick={() => setActiveTab(slug)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border text-[12.5px] font-medium transition-all cursor-pointer"
              style={{
                background:  isActive ? '#1A2D45' : '#fff',
                borderColor: isActive ? '#1A2D45' : '#D9E2EA',
                color:       isActive ? '#fff'    : '#4A6480',
              }}
            >
              <Icon className="w-3 h-3" />
              {meta?.label ?? slug}
              {artCount > 0 && (
                <span
                  className="ml-0.5 rounded-full px-1.5 text-[10px] font-bold"
                  style={{ background: isActive ? 'rgba(255,255,255,0.2)' : '#EEF2F6', color: isActive ? '#fff' : '#4A6480' }}
                >
                  {artCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Artefact upload form ── */}
      <div className="bg-paper-2 rounded-lg border border-line p-4">
        <div className="flex items-center gap-1.5 font-cond font-semibold text-[11px] uppercase tracking-[0.14em] text-ink-500 mb-3">
          <Upload className="w-3.5 h-3.5" />
          Add artefact — {domainMeta(currentDomain)?.label ?? currentDomain}
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.12em]">Artefact</label>
            <select
              className={inputCls}
              value={newArtefact.name}
              onChange={e => {
                const tmpl = templates.find((t: any) => t.name === e.target.value)
                setNewArtefact(prev => ({
                  ...prev,
                  name: e.target.value,
                  type: (tmpl as any)?.artefact_type?.value ?? (tmpl as any)?.artefact_type_id ?? prev.type,
                }))
              }}
            >
              <option value="">Select artefact…</option>
              {templates.map((t: any) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.12em]">Type</label>
            <select
              className={inputCls}
              value={newArtefact.type}
              onChange={e => setNewArtefact(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="">Select type…</option>
              {(artefactTypes.length > 0 ? artefactTypes : [
                { value: 't-doc', label: 'Doc' }, { value: 't-diag', label: 'Diagram' },
                { value: 't-xls', label: 'Sheet' }, { value: 't-deck', label: 'Deck' },
                { value: 't-log', label: 'Log' },
              ]).map((t: any) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.12em]">File</label>
            <div
              className="flex items-center gap-2 rounded-[8px] border border-line bg-white px-3 py-[9px] text-[13px] text-ink-500 cursor-pointer hover:border-turquoise-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <File className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{newArtefact.file?.name ?? 'Choose file…'}</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={e => setNewArtefact(prev => ({ ...prev, file: e.target.files?.[0] ?? null }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-ink-500 uppercase tracking-[0.12em] opacity-0">Add</label>
            <button
              onClick={handleUpload}
              disabled={!newArtefact.name || !newArtefact.type || !newArtefact.file || uploading || !reviewId}
              className="h-[38px] px-4 rounded-[8px] bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-none cursor-pointer"
            >
              {uploading ? 'Uploading…' : 'Add'}
            </button>
          </div>
        </div>
        {!reviewId && (
          <p className="mt-2 text-[12px] text-rag-amber-700">Click "Save draft" first — artefact uploads require a review record.</p>
        )}
        {uploadError && <p className="mt-2 text-[12px] text-rag-red-700">{uploadError}</p>}
      </div>

      {/* Uploaded artefacts for current domain */}
      {currentArts.length > 0 && (
        <div className="bg-white border border-line rounded-lg overflow-hidden shadow-sh-sm">
          <div className="px-4 py-3 border-b border-line-soft flex items-center gap-2">
            <span className="font-cond font-semibold text-[13px] uppercase tracking-[0.12em] text-ink-600">
              {domainMeta(currentDomain)?.label} artefacts · {currentArts.length}
            </span>
          </div>
          {currentArts.map((art, i) => (
            <div
              key={art.id ?? i}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderBottom: i < currentArts.length - 1 ? '1px solid #E7EDF2' : 'none' }}
            >
              <div className="w-8 h-8 rounded-[7px] bg-paper-2 text-ink-500 grid place-items-center flex-shrink-0">
                <File className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[13px] text-ink-900 truncate">{art.name}</div>
                <div className="text-[11px] text-ink-500">{art.fileName}</div>
              </div>
              <Pill tone="turquoise">{art.type}</Pill>
              {art.id && (
                <button
                  onClick={() => handleDelete(art.id!)}
                  className="w-7 h-7 flex items-center justify-center rounded-[6px] text-ink-400 hover:text-rag-red-600 hover:bg-paper-2 border-none bg-transparent cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Compliance checklist ── */}
      {subsections.length > 0 && (
        <div className="border-t border-line pt-5">
          <div className="flex items-center gap-1.5 font-cond font-semibold text-[11px] uppercase tracking-[0.14em] text-ink-500 mb-3">
            <Shield className="w-3.5 h-3.5" />
            Compliance checklist — {domainMeta(currentDomain)?.label}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {subsections.map((sub: any, idx: number) => {
              const col = CHECKLIST_COLORS[idx % CHECKLIST_COLORS.length]
              const questions = sub.questions ?? []
              const answered = questions.filter(
                (q: any) => data.domain_data[currentDomain]?.checklist?.[q.question_code]
              ).length
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubsection(sub)}
                  className="text-left rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
                  style={{ background: col.bg, borderColor: col.border }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-[13px] text-ink-900 pr-2">{sub.name}</span>
                    <span
                      className="w-7 h-7 rounded-full grid place-items-center text-[12px] font-bold flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.6)', color: col.text }}
                    >
                      {questions.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500">questions</p>
                  {answered > 0 && (
                    <p className="text-[11px] mt-1 font-semibold" style={{ color: col.text }}>
                      {answered}/{questions.length} answered
                    </p>
                  )}
                  <div className="mt-2 text-[11px] text-ink-400">Click to answer →</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* No artefacts warning */}
      {totalArtefacts === 0 && (
        <div
          className="flex items-start gap-3 rounded-lg border px-4 py-3"
          style={{ background: '#FCEED0', borderColor: 'rgba(229,149,0,0.3)' }}
        >
          <AlertTriangle className="w-4 h-4 text-rag-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-cond font-semibold text-[13.5px] text-rag-amber-700 tracking-[0.04em]">No artefacts uploaded yet</div>
            <div className="text-[13px] text-ink-700 mt-0.5">Upload at least one artefact so the AI agent can begin analysis.</div>
          </div>
        </div>
      )}

      {selectedSubsection && (
        <QuestionDialog
          subsection={selectedSubsection}
          domain={currentDomain}
          data={data}
          patchData={patchData}
          onClose={() => setSelectedSubsection(null)}
        />
      )}
    </div>
  )
}

// ── Step 4: Review ────────────────────────────────────────────────────────────

function StepReview({
  data,
  domainArtefacts,
  acknowledged,
  setAcknowledged,
}: {
  data: WizardData
  domainArtefacts: Record<string, DomainArtefact[]>
  acknowledged: boolean
  setAcknowledged: (v: boolean) => void
}) {
  const { domains, architectureDispositions } = useMetadataStore()
  const dispLabel = architectureDispositions.find(d => d.value === data.architecture_disposition)?.label ?? data.architecture_disposition ?? 'Not set'
  const totalArtefacts = Object.values(domainArtefacts).reduce((n, a) => n + a.length, 0)

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-turquoise-700 mb-1">
          Step 4 / 4
        </div>
        <h2 className="font-cond font-bold text-[22px] text-ink-900 mb-1 tracking-[0.01em]">
          Review &amp; submit.
        </h2>
        <p className="text-[13px] text-ink-500">
          Submission queues the AI agent. You'll get a notification when analysis completes (≈ 90 seconds).
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-white border border-line rounded-lg shadow-sh-sm px-6 py-5">
        <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-ink-400 mb-2">
          Context
        </div>
        <div className="font-cond font-bold text-[22px] text-ink-900">{data.project_name || '—'}</div>
        <div className="mt-2 text-ink-600 text-[13.5px] leading-relaxed">
          {data.problem_statement || <em className="text-ink-400">No problem statement</em>}
        </div>

        <div className="grid grid-cols-3 gap-[18px] mt-4">
          <div>
            <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-ink-400 mb-1.5">Gate</div>
            {data.ptx_gate ? <Pill tone="navy">{data.ptx_gate}</Pill> : <span className="text-ink-400 text-[13px]">Not set</span>}
          </div>
          <div>
            <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-ink-400 mb-1.5">Disposition</div>
            {data.architecture_disposition ? <Pill tone="amber">{dispLabel}</Pill> : <span className="text-ink-400 text-[13px]">Not set</span>}
          </div>
          <div>
            <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-ink-400 mb-1.5">Domain scope</div>
            <span className="text-[13px] text-ink-900">{data.domains.length} sub-agents</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[18px]">
        {/* Domains in scope */}
        <div className="bg-white border border-line rounded-lg shadow-sh-sm px-5 py-4">
          <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-ink-400 mb-3">
            Domains in scope
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.domains.map(slug => {
              const d = domains.find(x => x.slug === slug)
              if (!d) return null
              const Icon = getDomainIcon(d.icon)
              return (
                <span key={slug} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-paper border border-line text-[12px] text-ink-600">
                  <Icon className="w-3 h-3" />
                  {d.name}
                </span>
              )
            })}
          </div>
        </div>

        {/* What happens next */}
        <div className="bg-white border border-line rounded-lg shadow-sh-sm px-5 py-4">
          <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-ink-400 mb-3">
            What happens next
          </div>
          {[
            'Submission locks. Status → "Queued for AI analysis".',
            'Domain sub-agents score, find evidence, propose actions & ADRs.',
            "You're notified when ready. EA reviews, decides, or overrides.",
            'Approved? Dossier exports as PDF to EDMS.',
          ].map((t, i) => (
            <div key={i} className="flex gap-2.5 py-1.5">
              <span
                className="w-[22px] h-[22px] rounded-[6px] grid place-items-center font-cond font-bold text-[12px] flex-shrink-0"
                style={{ background: '#1E4A82', color: '#1FBCD4' }}
              >
                {i + 1}
              </span>
              <span className="text-[13px] text-ink-600">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Artefacts summary */}
      {totalArtefacts > 0 && (
        <div className="bg-white border border-line rounded-lg shadow-sh-sm px-5 py-3">
          <div className="font-cond font-semibold text-[11px] uppercase tracking-[0.16em] text-ink-400 mb-2">
            Artefacts ({totalArtefacts})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(domainArtefacts).flatMap(([, arts]) =>
              arts.map(a => (
                <Pill key={a.id ?? a.fileName} tone="green" dot>{a.name}</Pill>
              ))
            )}
          </div>
        </div>
      )}

      {/* Acknowledgement */}
      <div
        className="flex items-center gap-3 rounded-lg border px-4 py-3"
        style={{ background: '#F1FAFC', borderColor: 'rgba(31,188,212,0.25)' }}
      >
        <input
          type="checkbox"
          id="ack"
          checked={acknowledged}
          onChange={e => setAcknowledged(e.target.checked)}
          className="w-4 h-4 accent-turquoise-500 flex-shrink-0"
        />
        <label htmlFor="ack" className="text-[13px] text-ink-700 cursor-pointer select-none">
          I confirm the submission is complete and accurate. The AI agent will analyse and the EA may override.
        </label>
      </div>
    </div>
  )
}

// ── SubmissionWizard ──────────────────────────────────────────────────────────

export default function SubmissionWizard() {
  const navigate      = useNavigate()
  const location      = useLocation()
  const { reviewId: urlId } = useParams<{ reviewId?: string }>()
  const user          = useAuthStore(s => s.user)

  const [step,            setStep]            = useState(1)
  const [reviewId,        setReviewId]        = useState<string | null>(urlId ?? null)
  const [lastSaved,       setLastSaved]       = useState<Date | null>(null)
  const [submitting,      setSubmitting]      = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [domainArtefacts, setDomainArtefacts] = useState<Record<string, DomainArtefact[]>>({})
  const [acknowledged,    setAcknowledged]    = useState(false)
  const [savedFlash,      setSavedFlash]      = useState(false)
  // EA return context — populated when editing a returned submission
  const [isReturned,      setIsReturned]      = useState(false)
  const [returnDomains,   setReturnDomains]   = useState<string[]>([])
  const [reworkGaps,      setReworkGaps]      = useState<string[]>([])

  // Pre-fill from dashboard modal state (backward compat)
  const prefill = (location.state as any) ?? {}

  const [data, setData] = useState<WizardData>({
    project_name:             prefill.projectInfo?.project_name ?? '',
    problem_statement:        prefill.projectInfo?.problem_statement ?? '',
    stakeholders:             (prefill.projectInfo?.stakeholders ?? []).join('\n'),
    business_drivers:         (prefill.projectInfo?.business_drivers ?? []).join('\n'),
    target_outcomes:          prefill.projectInfo?.target_business_outcomes ?? '',
    ptx_gate:                 prefill.ptxGate ?? '',
    architecture_disposition: prefill.architectureDisposition ?? '',
    domains:                  (prefill.selectedDomains ?? []) as DomainSlug[],
    domain_data:              {},
  })

  const patchData = (patch: Partial<WizardData>) => setData(prev => ({ ...prev, ...patch }))

  // ── Load existing review when editing (returned / draft) ──────────────────

  useEffect(() => {
    if (!urlId) return
    Promise.all([
      reviewService.loadDraftData(urlId),
      reviewService.getReviewArtefacts(urlId),
    ]).then(([{ review, formData }, arts]) => {
      // review_pending / agent_failed must not be edited — redirect to the retry screen
      if (['review_pending', 'agent_failed'].includes(review.status)) {
        navigate(`/review/${urlId}`, { replace: true })
        return
      }

      const loadedReturnDomains: string[] = review.ea_review?.return_domains ?? []
      const loadedReworkGaps: string[]    = review.ea_review?.rework_gaps    ?? []
      const loadedIsReturned = review.status === 'returned' && loadedReturnDomains.length > 0

      setIsReturned(loadedIsReturned)
      setReturnDomains(loadedReturnDomains)
      setReworkGaps(loadedReworkGaps)

      const activeDomains = loadedIsReturned
        ? loadedReturnDomains
        : (formData.domains ?? review.scope_tags ?? [])

      setData({
        project_name:             formData.project_name             ?? review.solution_name ?? '',
        problem_statement:        formData.problem_statement        ?? '',
        stakeholders:             Array.isArray(formData.stakeholders)
                                    ? formData.stakeholders.join('\n')
                                    : (formData.stakeholders ?? ''),
        business_drivers:         Array.isArray(formData.business_drivers)
                                    ? formData.business_drivers.join('\n')
                                    : (formData.business_drivers ?? ''),
        target_outcomes:          formData.target_outcomes          ?? '',
        ptx_gate:                 formData.ptx_gate                 ?? '',
        architecture_disposition: formData.architecture_disposition ?? '',
        domains:                  activeDomains as DomainSlug[],
        domain_data:              formData.domain_data              ?? {},
      })

      const grouped: Record<string, DomainArtefact[]> = {}
      for (const a of arts) {
        const slug = a.domain_slug || 'solution'
        if (loadedIsReturned && !loadedReturnDomains.includes(slug)) continue
        if (!grouped[slug]) grouped[slug] = []
        grouped[slug].push({ id: a.id, name: a.artefact_name, type: a.artefact_type, fileName: a.filename, file: null })
      }
      setDomainArtefacts(grouped)
    }).catch(console.error)
  }, [urlId])

  // ── Auto-save ─────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (!user) return
    const formData = {
      project_name:             data.project_name,
      problem_statement:        data.problem_statement,
      stakeholders:             data.stakeholders.split('\n').map(s => s.trim()).filter(Boolean),
      business_drivers:         data.business_drivers.split('\n').map(s => s.trim()).filter(Boolean),
      target_outcomes:          data.target_outcomes,
      ptx_gate:                 data.ptx_gate,
      architecture_disposition: data.architecture_disposition,
      domains:                  data.domains,
      domain_data:              data.domain_data,
    }

    if (!reviewId) {
      if (!data.project_name) return
      const draft = await reviewService.createDraft({
        solution_name: data.project_name,
        scope_tags:    data.domains,
        sa_user_id:    user.id,
        form_data:     formData,
      })
      setReviewId(draft.id)
    } else {
      await reviewService.updateDraft(reviewId, {
        solution_name: data.project_name,
        scope_tags:    data.domains,
        form_data:     formData,
      })
    }
    setLastSaved(new Date())
  }, [data, reviewId, user])

  // Autosave on step change
  useEffect(() => {
    if (step > 1) {
      save().catch(e => setError(e?.message || 'Auto-save failed'))
    }
  }, [step])

  // ── Navigation ────────────────────────────────────────────────────────────

  const canProceed1 = !!data.project_name.trim() && !!data.problem_statement.trim()
  const canProceed2 = !!data.ptx_gate && !!data.architecture_disposition && data.domains.length > 0
  const canProceed3 = Object.values(domainArtefacts).some(arts => arts.length > 0)

  const canContinue = step === 1 ? canProceed1 : step === 2 ? canProceed2 : step === 3 ? canProceed3 : acknowledged

  const goBack = () => {
    if (step === 1) navigate(-1)
    else setStep(s => s - 1)
  }

  const goContinue = async () => {
    if (step < 4) {
      setStep(s => s + 1)
    } else {
      // Submit — mark ready, then let SA trigger AI from the review page
      if (!reviewId) { setError('No review ID — save the form first.'); return }
      setSubmitting(true)
      setError(null)
      try {
        await reviewService.markReadyForReview(reviewId)
        navigate(`/review/${reviewId}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Submission failed')
      } finally {
        setSubmitting(false)
      }
    }
  }

  const saveDraft = () => save()
    .then(() => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000) })
    .catch(e => setError(e?.message || 'Save failed — please try again'))

  return (
    <div className="p-8">
      <div className="flex gap-9 items-start" style={{ maxWidth: 1060 }}>
        <StepRail step={step} lastSaved={lastSaved} />

        <div className="flex-1 min-w-0" style={{ maxWidth: 820 }}>
          {/* EA Return notice */}
          {isReturned && (
            <div
              className="flex items-start gap-3 rounded-lg border px-5 py-4 mb-4"
              style={{ background: '#FFFBEB', borderColor: 'rgba(229,149,0,0.4)', borderLeft: '4px solid #F59E0B' }}
            >
              <AlertTriangle className="w-4 h-4 text-rag-amber-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-cond font-semibold text-[14px] text-rag-amber-700 mb-1">
                  Returned by EA — rework required before resubmission
                </p>
                {returnDomains.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[12px] font-medium text-ink-600 mb-1.5">Domains to address:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {returnDomains.map(slug => (
                        <span key={slug}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold capitalize"
                          style={{ background: '#FDE68A', color: '#92400E', border: '1px solid rgba(217,119,6,0.3)' }}>
                          {slug.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {reworkGaps.length > 0 && (
                  <div>
                    <p className="text-[12px] font-medium text-ink-600 mb-1">EA feedback:</p>
                    <ul className="space-y-0.5">
                      {reworkGaps.map((gap, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12.5px] text-rag-amber-700">
                          <span
                            className="w-4 h-4 mt-[1px] flex-shrink-0 rounded-full grid place-items-center text-[10px] font-bold"
                            style={{ background: '#FCD34D', color: '#78350F' }}
                          >
                            {i + 1}
                          </span>
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            className="bg-white border border-line rounded-lg shadow-sh-sm"
            style={{ padding: '28px 32px' }}
          >
            {step === 1 && <StepContext data={data} set={patchData} />}
            {step === 2 && <StepScope   data={data} set={patchData} />}
            {step === 3 && (
              <StepArtefacts
                reviewId={reviewId}
                data={data}
                patchData={patchData}
                domainArtefacts={domainArtefacts}
                setDomainArtefacts={setDomainArtefacts}
              />
            )}
            {step === 4 && (
              <StepReview
                data={data}
                domainArtefacts={domainArtefacts}
                acknowledged={acknowledged}
                setAcknowledged={setAcknowledged}
              />
            )}
          </div>

          {error && (
            <div className="mt-3 px-4 py-3 rounded-lg bg-rag-red-100 text-rag-red-700 text-[13px] border border-rag-red-500/20">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center mt-5">
            <button
              onClick={goBack}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] text-ink-600 text-[13px] font-medium hover:bg-paper-2 border-none bg-transparent cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {step === 1 ? 'Discard' : 'Back'}
            </button>

            <div className="ml-auto flex gap-2.5">
              <button
                onClick={saveDraft}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] border text-[13px] font-medium transition-colors"
                style={savedFlash
                  ? { background: '#DDF3E5', borderColor: 'rgba(31,165,103,0.35)', color: '#15784D' }
                  : { background: '#fff', borderColor: '#D9E2EA', color: '#1A2D45' }}
              >
                {savedFlash ? <><Check className="w-3.5 h-3.5" /> Saved</> : 'Save draft'}
              </button>

              {step < 4 ? (
                <button
                  onClick={goContinue}
                  disabled={!canContinue}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] bg-navy-700 text-white text-[13px] font-medium hover:bg-navy-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={goContinue}
                  disabled={!canContinue || submitting}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#1FBCD4', color: '#14366B', borderColor: '#1FBCD4' }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {submitting ? 'Submitting…' : 'Submit for Review'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
