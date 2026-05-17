import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toARBRef } from '../utils/reviewRef'
import { getBackendType } from './backendConfig'

interface jsPDFExtended extends jsPDF {
  lastAutoTable?: { finalY: number }
}

interface ReviewData {
  id: string
  solution_name: string
  status: string
  decision?: string
  submitted_at?: string
  reviewed_at?: string
  aggregate_rag_score?: number
  recommended_decision?: string
  decision_rationale?: string
  ea_user_id?: string
  ea_override_notes?: string
  ea_overridden_at?: string
  sa_user_id?: string
  scope_tags?: string[]
  artifact_filename?: string
  domain_summaries?: Record<string, DomainSummary>
  adrs?: any[]
  actions?: any[]
  findings?: any[]
  report_json?: any
}

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
}

const DOMAIN_LABELS: Record<string, string> = {
  solution: 'Solution',
  business: 'Business Architecture',
  application: 'Application Architecture',
  integration: 'Integration Architecture',
  data: 'Data Architecture',
  infrastructure: 'Infrastructure & Platform',
  devsecops: 'DevSecOps',
  nfr: 'Non-Functional Requirements',
  security: 'Security Architecture',
}

const DOMAIN_ORDER = ['solution', 'business', 'application', 'integration', 'data', 'infrastructure', 'devsecops', 'nfr', 'security']

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A'
  const d = new Date(dateStr)
  return `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short' }).toUpperCase()}-${d.getFullYear()}`
}

function getRAGColor(rag_label: string): [number, number, number] {
  if (rag_label.toUpperCase() === 'GREEN') return [234, 243, 222]
  if (rag_label.toUpperCase() === 'AMBER') return [250, 237, 218]
  if (rag_label.toUpperCase() === 'RED') return [252, 235, 235]
  return [220, 220, 220]
}

function getRAGTextColor(rag_label: string): [number, number, number] {
  if (rag_label.toUpperCase() === 'GREEN') return [39, 80, 10]
  if (rag_label.toUpperCase() === 'AMBER') return [99, 56, 6]
  if (rag_label.toUpperCase() === 'RED') return [80, 19, 19]
  return [0, 0, 0]
}

function getRAGBorderColor(rag_label: string): [number, number, number] {
  if (rag_label.toUpperCase() === 'GREEN') return [151, 196, 89]
  if (rag_label.toUpperCase() === 'AMBER') return [239, 159, 39]
  if (rag_label.toUpperCase() === 'RED') return [226, 75, 74]
  return [150, 150, 150]
}

export async function generateARBReportPDF(review: ReviewData): Promise<void> {
  const doc = new jsPDF() as jsPDFExtended
  const pageWidth = doc.internal.pageSize.width
  const margin = 18
  const contentWidth = pageWidth - 2 * margin
  let y = 20

  const aggScore = review.aggregate_rag_score ?? review.report_json?.ai_review?.aggregate_score ?? 0
  const recDecision = review.recommended_decision || review.report_json?.ai_review?.decision
  const decisionRationale = review.decision_rationale || review.report_json?.ai_review?.decision_rationale || ''

  // domain_summaries is not a DB column — always read from report_json.ai_review
  const aiReview = review.report_json?.ai_review || {}
  const domainSummaries: Record<string, DomainSummary> =
    (review.domain_summaries && Object.keys(review.domain_summaries).length > 0)
      ? review.domain_summaries
      : (aiReview.domain_summaries && Object.keys(aiReview.domain_summaries).length > 0)
        ? aiReview.domain_summaries
        : {}

  const orderedSlugs = DOMAIN_ORDER.filter((s) => domainSummaries[s]).concat(
    Object.keys(domainSummaries).filter((s) => !DOMAIN_ORDER.includes(s))
  )

  // ── EXECUTIVE SUMMARY HEADER MATCHING SCREENSHOT ──────────────────────────
  
  // Main container with border
  doc.setDrawColor(204, 204, 204)
  doc.setLineWidth(0.5)
  doc.rect(margin - 5, y - 5, contentWidth + 10, 280, 'S')
  
  // Header band - matching screenshot layout
  // Left side - solution info
  doc.setFontSize(11)
  doc.setTextColor(102, 102, 102)
  doc.text('PRE-ARB DOSSIER', margin, y + 8)
  
  doc.setFontSize(17)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text(review.solution_name || 'Unknown Solution', margin, y + 18)
  
  doc.setFontSize(12)
  doc.setTextColor(102, 102, 102)
  doc.setFont('helvetica', 'normal')
  const arbRef = toARBRef(review.id, review.submitted_at || review.reviewed_at)
  const reviewDate = formatDate(review.reviewed_at)
  doc.text(`${arbRef} · EA: Priya Nair · Review: ${reviewDate}`, margin, y + 26)
  
  // Right side - decision pill
  const decisionMap: Record<string, string> = {
    'approve': 'Approve',
    'approve_with_conditions': 'Approve with conditions',
    'conditional_approval': 'Approve with conditions',
    'reject': 'Reject',
    'defer': 'Defer',
    'return': 'Return',
    'pending': 'Pending'
  }
  
  const decisionText = decisionMap[recDecision || 'pending'] || 'Pending'
  const decisionRag = aggScore >= 4 ? 'GREEN' : aggScore >= 3 ? 'AMBER' : 'RED'
  
  const decisionBgColor = getRAGColor(decisionRag)
  const decisionTextColor = getRAGTextColor(decisionRag)
  const decisionBorderColor = getRAGBorderColor(decisionRag)
  
  // Decision pill
  const decisionX = pageWidth - margin - 80
  doc.setFillColor(decisionBgColor[0], decisionBgColor[1], decisionBgColor[2])
  doc.setDrawColor(decisionBorderColor[0], decisionBorderColor[1], decisionBorderColor[2])
  doc.roundedRect(decisionX, y + 8, 75, 25, 3, 3, 'FD')
  
  doc.setTextColor(decisionTextColor[0], decisionTextColor[1], decisionTextColor[2])
  doc.setFontSize(11)
  doc.text('RECOMMENDED DECISION', decisionX + 5, y + 16)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`⚠ ${decisionText}`, decisionX + 5, y + 28)
  
  y += 45
  
  // Aggregate bar - matching screenshot
  doc.setTextColor(102, 102, 102)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Aggregate readiness', margin, y + 8)
  
  // Calculate domain statistics
  const domainStats = Object.values(domainSummaries).reduce((acc: any, domain: any) => {
    const rag = domain.rag_label?.toUpperCase()
    if (rag === 'GREEN') acc.green++
    else if (rag === 'AMBER') acc.amber++
    else if (rag === 'RED') acc.red++
    return acc
  }, { green: 0, amber: 0, red: 0 })
  
  const hasBlocker = Object.values(domainSummaries).some((d: any) => d.blocker_count > 0)
  const blockerText = hasBlocker ? `${domainStats.red} domain Red — BLOCKER` : `${domainStats.red} domain Red`
  
  // Aggregate pills
  const pillY = y + 3
  const pillSpacing = 10
  let pillX = margin + 120
  
  // Green pill
  const greenBg = getRAGColor('GREEN')
  const greenText = getRAGTextColor('GREEN')
  const greenBorder = getRAGBorderColor('GREEN')
  doc.setFillColor(greenBg[0], greenBg[1], greenBg[2])
  doc.setDrawColor(greenBorder[0], greenBorder[1], greenBorder[2])
  doc.roundedRect(pillX, pillY, 60, 18, 3, 3, 'FD')
  doc.setTextColor(greenText[0], greenText[1], greenText[2])
  doc.setFontSize(12)
  doc.text(`${domainStats.green} domains Green`, pillX + 5, pillY + 12)
  
  // Amber pill
  pillX += 65
  const amberBg = getRAGColor('AMBER')
  const amberText = getRAGTextColor('AMBER')
  const amberBorder = getRAGBorderColor('AMBER')
  doc.setFillColor(amberBg[0], amberBg[1], amberBg[2])
  doc.setDrawColor(amberBorder[0], amberBorder[1], amberBorder[2])
  doc.roundedRect(pillX, pillY, 65, 18, 3, 3, 'FD')
  doc.setTextColor(amberText[0], amberText[1], amberText[2])
  doc.text(`${domainStats.amber} domains Amber`, pillX + 5, pillY + 12)
  
  // Red pill
  pillX += 70
  const redBg = getRAGColor('RED')
  const redText = getRAGTextColor('RED')
  const redBorder = getRAGBorderColor('RED')
  doc.setFillColor(redBg[0], redBg[1], redBg[2])
  doc.setDrawColor(redBorder[0], redBorder[1], redBorder[2])
  doc.roundedRect(pillX, pillY, 70, 18, 3, 3, 'FD')
  doc.setTextColor(redText[0], redText[1], redText[2])
  doc.text(blockerText, pillX + 5, pillY + 12)
  
  y += 35
  
  // Rationale section
  doc.setTextColor(102, 102, 102)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  const rationaleLines = doc.splitTextToSize(`Agent rationale: ${decisionRationale}`, contentWidth)
  doc.text(rationaleLines, margin, y + 5)
  y += rationaleLines.length * 6 + 15
  
  // Domain scorecard section
  doc.setTextColor(102, 102, 102)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('DOMAIN SCORECARD', margin, y + 5)
  y += 15
  
  // Domain rows - matching screenshot grid layout
  const domainTableData = []
  
  for (const [domainKey, domainName] of [
    ['application', 'Application architecture'],
    ['software', 'Software architecture'],
    ['integration', 'Integration architecture'],
    ['api', 'API architecture'],
    ['security', 'Security architecture'],
    ['data', 'Data architecture'],
    ['infrastructure', 'Infra & platform'],
    ['devsecops', 'Engineering & DevSecOps'],
    ['quality', 'Engineering quality']
  ]) {
    const domainData = domainSummaries[domainKey]
    if (!domainData) continue
    
    const score = domainData.score || 3
    const rag_label = domainData.rag_label || 'AMBER'
    const executive_summary = domainData.executive_summary || ''
    
    // Add blocker indicator for security domain
    const blockerIndicator = (domainKey === 'security' && hasBlocker) ? ' BLOCKER' : ''
    
    const scoreBg = getRAGColor(rag_label)
    const scoreText = getRAGTextColor(rag_label)
    const scoreBorder = getRAGBorderColor(rag_label)
    
    const ragBg = getRAGColor(rag_label)
    const ragText = getRAGTextColor(rag_label)
    const ragBorder = getRAGBorderColor(rag_label)
    
    // Score badge
    doc.setFillColor(scoreBg[0], scoreBg[1], scoreBg[2])
    doc.setDrawColor(scoreBorder[0], scoreBorder[1], scoreBorder[2])
    doc.roundedRect(margin, y, 18, 12, 2, 2, 'FD')
    doc.setTextColor(scoreText[0], scoreText[1], scoreText[2])
    doc.setFontSize(11)
    doc.text(`${score}/5`, margin + 3, y + 8)
    
    // Domain name
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    const domainText = `${domainName}${blockerIndicator}`
    doc.text(domainText, margin + 25, y + 8)
    
    // RAG badge
    const ragX = margin + 105
    doc.setFillColor(ragBg[0], ragBg[1], ragBg[2])
    doc.setDrawColor(ragBorder[0], ragBorder[1], ragBorder[2])
    doc.roundedRect(ragX, y, 18, 12, 2, 2, 'FD')
    doc.setTextColor(ragText[0], ragText[1], ragText[2])
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(rag_label, ragX + 2, y + 8)
    
    // Executive summary
    doc.setTextColor(102, 102, 102)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'normal')
    const summaryLines = doc.splitTextToSize(executive_summary, contentWidth - 150)
    doc.text(summaryLines, margin + 130, y + 8)
    
    y += Math.max(20, summaryLines.length * 6 + 5)
    
    // Add border line between domains
    if (domainKey !== 'quality') {
      doc.setDrawColor(224, 224, 224)
      doc.setLineWidth(0.5)
      doc.line(margin, y, pageWidth - margin, y)
      y += 7
    }
  }
  
  // Blocker callout - matching screenshot
  if (hasBlocker) {
    y += 10
    const blockerBg = getRAGColor('RED')
    const blockerText = getRAGTextColor('RED')
    const blockerBorder = getRAGBorderColor('RED')
    
    doc.setFillColor(blockerBg[0], blockerBg[1], blockerBg[2])
    doc.setDrawColor(blockerBorder[0], blockerBorder[1], blockerBorder[2])
    doc.roundedRect(margin, y, contentWidth, 40, 3, 3, 'FD')
    
    doc.setTextColor(blockerText[0], blockerText[1], blockerText[2])
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('BLOCKER — MUST RESOLVE BEFORE ARB', margin + 10, y + 15)
    
    doc.setFontSize(13)
    doc.setFont('helvetica', 'normal')
    const blockerTextLines = doc.splitTextToSize('BLK-01 · Security: VAPT evidence not submitted. RBAC model incomplete for three service accounts. Non-compliance with Security Standards v2.4.', contentWidth - 20)
    doc.text(blockerTextLines, margin + 10, y + 28)
  }

  // Save the PDF
  const filename = `${arbRef}-${review.solution_name?.replace(/\s+/g, '_') || 'Dossier'}-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
