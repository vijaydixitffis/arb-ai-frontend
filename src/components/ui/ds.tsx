/**
 * FFIS design-system atoms
 * Pill, DomainStrip, Sparkline, RagBar, domain icon map
 */
import type { ReactNode, ElementType } from 'react'
import {
  Layers, Briefcase, Code, GitMerge, Database,
  Server, Shield, Activity, Lock, FileText,
  Cpu, Globe, Settings, Box, Zap, Key, Cloud,
} from 'lucide-react'

// ── Domain slug type (string — resolved from DB at runtime) ─────────────────

export type DomainSlug = string

// ── Icon map: DB icon string → lucide component ─────────────────────────────

export const DOMAIN_ICON_MAP: Record<string, ElementType> = {
  Layers, Briefcase, Code, GitMerge, Database,
  Server, Shield, Activity, Lock, FileText,
  Cpu, Globe, Settings, Box, Zap, Key, Cloud,
}

export function getDomainIcon(iconName: string | null | undefined): ElementType {
  if (!iconName) return FileText
  return DOMAIN_ICON_MAP[iconName] || FileText
}

// ── RAG helpers ─────────────────────────────────────────────────────────────

export function ragClass(score: number | null | undefined): 'is-red' | 'is-amber' | 'is-green' | 'is-gray' {
  if (score == null) return 'is-gray'
  if (score <= 2) return 'is-red'
  if (score === 3) return 'is-amber'
  return 'is-green'
}

export function ragLabel(score: number | null | undefined): string {
  if (score == null) return '—'
  if (score <= 2) return 'RED'
  if (score === 3) return 'AMBER'
  return 'GREEN'
}

export function ragBg(score: number | null | undefined): string {
  if (score == null) return '#C9D4DE'
  if (score <= 2) return '#D74A40'
  if (score === 3) return '#E59500'
  return '#1FA567'
}

export function ragTone(score: number | null | undefined): PillTone {
  if (score == null) return 'gray'
  if (score <= 2) return 'red'
  if (score === 3) return 'amber'
  return 'green'
}

// ── Pill ────────────────────────────────────────────────────────────────────

export type PillTone = 'gray' | 'green' | 'amber' | 'red' | 'turquoise' | 'navy'

const PILL_STYLES: Record<PillTone, string> = {
  gray:      'bg-paper-2 text-ink-600 border-line',
  green:     'bg-rag-green-100 text-rag-green-700 border-rag-green-500/25',
  amber:     'bg-rag-amber-100 text-rag-amber-700 border-rag-amber-500/25',
  red:       'bg-rag-red-100   text-rag-red-700   border-rag-red-500/25',
  turquoise: 'bg-turquoise-100 text-turquoise-700 border-turquoise-500/25',
  navy:      'bg-navy-700  text-white     border-navy-700',
}

const DOT_STYLES: Record<PillTone, string> = {
  gray:      'bg-ink-300',
  green:     'bg-rag-green-500',
  amber:     'bg-rag-amber-500',
  red:       'bg-rag-red-500',
  turquoise: 'bg-turquoise-500',
  navy:      'bg-turquoise-500',
}

interface PillProps {
  tone?: PillTone
  dot?: boolean
  children: ReactNode
  className?: string
}

export function Pill({ tone = 'gray', dot = false, children, className = '' }: PillProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-cond font-semibold text-[11px] uppercase tracking-[0.1em] px-[9px] py-[3px] rounded-full border ${PILL_STYLES[tone]} ${className}`}>
      {dot && <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${DOT_STYLES[tone]}`} />}
      {children}
    </span>
  )
}

// ── DomainStrip — thin vertical bars, one per domain ────────────────────────

interface DomainStripProps {
  scores: Record<string, number | null | undefined>
  domains: Array<{ slug: string; name: string }>
  className?: string
}

export function DomainStrip({ scores, domains, className = '' }: DomainStripProps) {
  return (
    <div className={`flex gap-[3px] ${className}`}>
      {domains.map(d => (
        <span
          key={d.slug}
          title={`${d.name}: ${scores[d.slug] ?? '—'}/5`}
          style={{ background: ragBg(scores[d.slug]), flex: 1, height: 14, borderRadius: 2 }}
        />
      ))}
    </div>
  )
}

// ── Sparkline — polyline svg ─────────────────────────────────────────────────

interface SparklineProps {
  values: number[]
  color?: string
  width?: number
  height?: number
}

export function Sparkline({ values, color = '#1FBCD4', width = 80, height = 28 }: SparklineProps) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const step = width / (values.length - 1 || 1)
  const pts = values
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', flexShrink: 0 }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        points={pts}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── RagBar — stacked proportional bar ───────────────────────────────────────

interface RagBarProps {
  green?: number
  amber?: number
  red?: number
  gray?: number
  height?: number
}

export function RagBar({ green = 0, amber = 0, red = 0, gray = 0, height = 6 }: RagBarProps) {
  const total = green + amber + red + gray || 1
  const w = (n: number) => `${(n / total) * 100}%`
  return (
    <div className="flex rounded-full overflow-hidden" style={{ height, background: '#E7EDF2' }}>
      {green > 0 && <span style={{ width: w(green), background: '#1FA567' }} />}
      {amber > 0 && <span style={{ width: w(amber), background: '#E59500' }} />}
      {red   > 0 && <span style={{ width: w(red),   background: '#D74A40' }} />}
      {gray  > 0 && <span style={{ width: w(gray),  background: '#C9D4DE' }} />}
    </div>
  )
}
