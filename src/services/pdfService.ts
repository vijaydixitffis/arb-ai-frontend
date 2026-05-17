import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toARBRef } from '../utils/reviewRef'
import { brand } from '../brand.config'

// Extend jsPDF prototype with autotable functionality
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: { finalY: number }
  }
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
  overall_readiness?: string
  compliant_areas?: string[]
  gap_areas?: string[]
  evidence_quality?: string
  domain_specific_scores?: Record<string, number | { rag_score?: number }>
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

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return 'N/A'
  const d = new Date(dateStr)
  return `${formatDate(dateStr)} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function getRAGColor(score: number): [number, number, number] {
  if (score <= 2) return [220, 38, 38]
  if (score === 3) return [217, 119, 6]
  return [22, 163, 74]
}

function getRAGLabel(score: number): string {
  if (score <= 2) return 'RED'
  if (score === 3) return 'AMBER'
  return 'GREEN'
}

function severityFromFinding(f: any): string {
  if (f.severity) return f.severity.toUpperCase()
  if (f.rag_score !== undefined) {
    if (f.rag_score <= 1) return 'BLOCKER'
    if (f.rag_score <= 2) return 'CRITICAL'
    if (f.rag_score <= 3) return 'MAJOR'
    return 'MINOR'
  }
  return 'N/A'
}

function addSectionHeader(doc: jsPDF, sectionNumber: string, title: string, y: number, margin: number): number {
  doc.setTextColor(26, 86, 219)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${sectionNumber}  ${title}`, margin, y)
  doc.setDrawColor(26, 86, 219)
  doc.setLineWidth(0.5)
  doc.line(margin, y + 2, doc.internal.pageSize.width - margin, y + 2)
  return y + 12
}

function addSubsectionHeader(doc: jsPDF, title: string, y: number, margin: number): number {
  doc.setTextColor(55, 65, 81)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(title, margin, y)
  return y + 7
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  if (y + needed > doc.internal.pageSize.height - 20) {
    doc.addPage()
    return margin
  }
  return y
}

export async function generateARBReportPDF(review: ReviewData): Promise<void> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.width
  const margin = 18
  const contentWidth = pageWidth - 2 * margin
  let y = 20

  const aggScore = review.aggregate_rag_score ?? review.report_json?.ai_review?.aggregate_score ?? 0
  const recDecision = review.recommended_decision || review.report_json?.ai_review?.decision
  const decisionRationale = review.decision_rationale || review.report_json?.ai_review?.decision_rationale || ''
  const formData = review.report_json?.form_data || {}

  // domain_summaries is not a DB column — always read from report_json.ai_review
  const aiReview = review.report_json?.ai_review || {}
  const domainSummaries: Record<string, DomainSummary> =
    (review.domain_summaries && Object.keys(review.domain_summaries).length > 0)
      ? review.domain_summaries
      : (aiReview.domain_summaries && Object.keys(aiReview.domain_summaries).length > 0)
        ? aiReview.domain_summaries
        : {}

  // actions/adrs: prefer table-fetched arrays, fall back to report_json
  const allActions: any[] = (review.actions || []).length > 0
    ? review.actions!
    : aiReview.actions || []
  const allAdrs: any[] = (review.adrs || []).length > 0
    ? review.adrs!
    : aiReview.adrs || []

  const orderedSlugs = DOMAIN_ORDER.filter((s) => domainSummaries[s]).concat(
    Object.keys(domainSummaries).filter((s) => !DOMAIN_ORDER.includes(s))
  )

  // ── COVER HEADER ──────────────────────────────────────────────────────────
  doc.setFillColor(26, 86, 219)
  doc.rect(0, 0, pageWidth, 58, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('ARB Review Dossier', margin, 30)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${brand.name} Generated  ·  Enterprise Architecture`, margin, 42)
  const arbRef = toARBRef(review.id, review.submitted_at || review.reviewed_at)
  doc.text(`Ref: ${arbRef}`, margin, 50)

  y = 68

  // Document control metadata
  autoTable(doc, {
    startY: y,
    body: [
      ['Solution / Platform:', review.solution_name || 'N/A'],
      ['Submission Date:', formatDate(review.submitted_at)],
      ['Review Date:', formatDate(review.reviewed_at)],
      ['Status:', (review.status || 'N/A').replace(/_/g, ' ').toUpperCase()],
      ['Scope Domains:', review.scope_tags?.join(', ') || 'N/A'],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [75, 85, 99], cellWidth: 40 },
      1: { textColor: [31, 41, 55] },
    },
  })
  y = (doc.lastAutoTable?.finalY || y + 28) + 8

  // ── SECTION 1: EXECUTIVE SUMMARY ──────────────────────────────────────────
  y = ensureSpace(doc, y, 40, 20)
  y = addSectionHeader(doc, '1', 'Executive Summary', y, margin)

  // Aggregate recommendation banner
  const ragColor = getRAGColor(aggScore)
  doc.setFillColor(ragColor[0], ragColor[1], ragColor[2])
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('AI AGENT RECOMMENDATION', margin + 5, y + 8)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  const decisionLabel = recDecision ? recDecision.replace(/_/g, ' ').toUpperCase() : 'PENDING'
  doc.text(decisionLabel, margin + 5, y + 20)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Aggregate Score: ${aggScore}/5  (${getRAGLabel(aggScore)})`, margin + contentWidth - 68, y + 20)
  y += 36

  // Decision rationale
  if (decisionRationale) {
    y = ensureSpace(doc, y, 20, 20)
    doc.setTextColor(55, 65, 81)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    const lines = doc.splitTextToSize(decisionRationale, contentWidth)
    doc.text(lines, margin, y)
    y += lines.length * 5 + 8
  }

  // Platform Readiness Scorecard
  y = ensureSpace(doc, y, 20, 20)
  doc.setTextColor(55, 65, 81)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Platform Readiness Scorecard', margin, y)
  y += 7

  const domainTableRows = orderedSlugs.map((slug) => {
    const s = domainSummaries[slug]
    return [
      DOMAIN_LABELS[slug] || slug,
      `${s.score}/5`,
      s.rag_label,
      s.total_findings.toString(),
      s.blocker_count > 0 ? s.blocker_count.toString() : '-',
      s.action_count.toString(),
      s.adr_count.toString(),
    ]
  })

  if (domainTableRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Architecture Domain', 'Score', 'RAG', 'Findings', 'Blockers', 'Actions', 'ADRs']],
      body: domainTableRows,
      theme: 'grid',
      headStyles: { fillColor: [26, 86, 219], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 68 },
        1: { halign: 'center', cellWidth: 18 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 16 },
        6: { halign: 'center', cellWidth: 10 },
      },
      styles: { cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.3 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    })
    y = (doc.lastAutoTable?.finalY || y) + 12
  }

  // ── SECTION 2: CONSOLIDATED BLOCKERS ──────────────────────────────────────
  doc.addPage()
  y = 20
  y = addSectionHeader(doc, '2', 'Consolidated Blockers', y, margin)

  doc.setTextColor(75, 85, 99)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text(
    'All RED-scored findings across all domains. Each blocker must be resolved and evidence submitted to the EA before proceeding.',
    margin, y, { maxWidth: contentWidth }
  )
  y += 12

  const allBlockers: any[] = []
  for (const slug of orderedSlugs) {
    const s = domainSummaries[slug]
    if (!s) continue
    for (const f of s.findings || []) {
      if ((f.rag_score !== undefined && f.rag_score <= 1) || f.severity === 'critical' || f.severity === 'blocker') {
        allBlockers.push({ ...f, _domain: slug })
      }
    }
  }

  if (allBlockers.length > 0) {
    const blockerRows = allBlockers.map((f, idx) => [
      `BLK-${String(idx + 1).padStart(2, '0')}`,
      DOMAIN_LABELS[f._domain] || f._domain,
      f.finding || 'N/A',
      f.recommendation || '-',
      f.principle_id || '-',
    ])
    autoTable(doc, {
      startY: y,
      head: [['ID', 'Domain', 'Blocker', 'Recommendation', 'KB Ref']],
      body: blockerRows,
      theme: 'grid',
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 8, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 38 },
        2: { cellWidth: 55 },
        3: { cellWidth: 45 },
        4: { cellWidth: 14 },
      },
      styles: { cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.2 },
      pageBreak: 'auto',
    })
    y = (doc.lastAutoTable?.finalY || y) + 12
  } else {
    doc.setTextColor(22, 163, 74)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('No blockers identified across all domains.', margin, y)
    y += 12
  }

  // ── SECTION 3: DOMAIN ARCHITECTURE REVIEWS ────────────────────────────────
  doc.addPage()
  y = 20
  y = addSectionHeader(doc, '3', 'Domain Architecture Reviews', y, margin)

  doc.setTextColor(75, 85, 99)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text(
    'Each domain is assessed independently. Findings are organised by severity. Amber and Red scores require conditions.',
    margin, y, { maxWidth: contentWidth }
  )
  y += 14

  for (let di = 0; di < orderedSlugs.length; di++) {
    const slug = orderedSlugs[di]
    const summary = domainSummaries[slug]
    if (!summary) continue

    y = ensureSpace(doc, y, 30, 20)

    // Domain header bar
    const dColor = getRAGColor(summary.score)
    doc.setFillColor(dColor[0], dColor[1], dColor[2])
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(
      `3.${di + 1}  ${DOMAIN_LABELS[slug] || slug}  —  Score: ${summary.score}/5  (${summary.rag_label})`,
      margin + 4, y + 9
    )
    y += 20

    // Executive summary — prefer domain_summaries field, fall back to report_json paths
    const execSummary = summary.executive_summary
      || review.report_json?.ai_review?.domain_summaries?.[slug]?.summary
      || review.report_json?.ai_review?.summaries?.[slug]
      || ''
    if (execSummary) {
      y = ensureSpace(doc, y, 15, 20)
      y = addSubsectionHeader(doc, 'Executive Summary', y, margin)
      doc.setTextColor(55, 65, 81)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(execSummary, contentWidth)
      doc.text(lines, margin, y)
      y += lines.length * 4.5 + 4
    }

    // Evidence quality + overall readiness metadata — inline, no extra ensureSpace
    const metaItems: string[] = []
    if (summary.evidence_quality) metaItems.push(`Evidence Quality: ${summary.evidence_quality}`)
    if (summary.overall_readiness) metaItems.push(`Overall Readiness: ${summary.overall_readiness}`)
    if (metaItems.length > 0) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(metaItems.join('   |   '), margin, y)
      y += 7
    }

    // Compliant areas and gap areas
    const compliantAreas = summary.compliant_areas || []
    const gapAreas = summary.gap_areas || []
    if (compliantAreas.length > 0 || gapAreas.length > 0) {
      y = ensureSpace(doc, y, 20, 20)
      const colW = (contentWidth - 2) / 2
      const areaRows: string[][] = []
      const maxRows = Math.max(compliantAreas.length, gapAreas.length)
      for (let ri = 0; ri < maxRows; ri++) {
        areaRows.push([
          compliantAreas[ri] || '',
          gapAreas[ri] || '',
        ])
      }
      autoTable(doc, {
        startY: y,
        head: [['Compliant Areas', 'Gap Areas']],
        body: areaRows,
        theme: 'grid',
        headStyles: {
          fontSize: 8,
          fontStyle: 'bold',
          fillColor: [240, 253, 244],
          textColor: [21, 128, 61],
        },
        bodyStyles: { fontSize: 8, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: colW, textColor: [21, 128, 61] },
          1: { cellWidth: colW, textColor: [180, 83, 9] },
        },
        styles: { cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
        didParseCell: (data) => {
          if (data.section === 'head' && data.column.index === 1) {
            data.cell.styles.fillColor = [255, 251, 235]
            data.cell.styles.textColor = [180, 83, 9]
          }
        },
      })
      y = (doc.lastAutoTable?.finalY || y) + 8
    }

    // Domain-specific sub-scores
    const subScores = summary.domain_specific_scores
    if (subScores && Object.keys(subScores).length > 0) {
      y = ensureSpace(doc, y, 20, 20)
      y = addSubsectionHeader(doc, 'Sub-scores', y, margin)
      const subRows = Object.entries(subScores).map(([key, val]) => {
        const score = typeof val === 'number' ? val : ((val as any)?.rag_score ?? 3)
        const label = score <= 2 ? 'RED' : score === 3 ? 'AMBER' : 'GREEN'
        return [key.replace(/_/g, ' '), `${score}/5`, label]
      })
      autoTable(doc, {
        startY: y,
        head: [['Sub-area', 'Score', 'RAG']],
        body: subRows,
        theme: 'grid',
        headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 22, halign: 'center' },
        },
        styles: { cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.2 },
      })
      y = (doc.lastAutoTable?.finalY || y) + 8
    }

    // Key Recommendations
    const recs = summary.recommendations || []
    if (recs.length > 0) {
      y = ensureSpace(doc, y, 20, 20)
      y = addSubsectionHeader(doc, 'Key Recommendations', y, margin)
      const recRows = recs.map((r: any, idx: number) => [
        `REC-${String(idx + 1).padStart(2, '0')}`,
        r.recommendation || r.text || r.description || String(r),
        r.standard_ref || r.kb_ref || '-',
      ])
      autoTable(doc, {
        startY: y,
        body: recRows,
        theme: 'plain',
        bodyStyles: { fontSize: 8, overflow: 'linebreak', textColor: [55, 65, 81] },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 28, textColor: [100, 116, 139] },
        },
        styles: { cellPadding: 2 },
      })
      y = (doc.lastAutoTable?.finalY || y) + 6
    }

    // Findings table — ID | Priority | Finding | Recommendation
    const domainFindings = summary.findings || []
    if (domainFindings.length > 0) {
      y = ensureSpace(doc, y, 20, 20)
      y = addSubsectionHeader(doc, `Findings  (${domainFindings.length})`, y, margin)

      const findingRows = domainFindings.map((f: any, idx: number) => [
        f.principle_id || `${slug.substring(0, 3).toUpperCase()}-F${String(idx + 1).padStart(2, '0')}`,
        severityFromFinding(f),
        f.finding || 'N/A',
        f.recommendation || '-',
      ])

      autoTable(doc, {
        startY: y,
        head: [['ID', 'Priority', 'Finding', 'Recommendation']],
        body: findingRows,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 7.5, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 70 },
          3: { cellWidth: 58 },
        },
        styles: { cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.2 },
        pageBreak: 'auto',
      })
      y = (doc.lastAutoTable?.finalY || y) + 8
    }

    // Actions table — ID | Action | Owner | Due Date | Status | Verification Method
    const domainActions = summary.actions || []
    if (domainActions.length > 0) {
      y = ensureSpace(doc, y, 20, 20)
      y = addSubsectionHeader(doc, `Actions  (${domainActions.length})`, y, margin)

      const actionRows = domainActions.map((a: any, idx: number) => [
        `${slug.substring(0, 3).toUpperCase()}-A${String(idx + 1).padStart(2, '0')}`,
        a.action_text || a.action || 'N/A',
        (a.owner_role || a.owner || 'TBD').replace(/_/g, ' '),
        a.due_date ? formatDate(a.due_date) : a.due_days ? `${a.due_days}d` : 'TBD',
        (a.status || 'OPEN').toUpperCase(),
        a.verification_method || 'EA review',
      ])

      autoTable(doc, {
        startY: y,
        head: [['ID', 'Action', 'Owner', 'Due Date', 'Status', 'Verification Method']],
        body: actionRows,
        theme: 'grid',
        headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 7.5, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 52 },
          2: { cellWidth: 25 },
          3: { cellWidth: 20 },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 37 },
        },
        styles: { cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.2 },
        pageBreak: 'auto',
      })
      y = (doc.lastAutoTable?.finalY || y) + 8
    }

    // ADR table — ADR ID | Title | Context & Options | Decision | Rationale | Owner | Target | Status
    const domainAdrs = summary.adrs || []
    if (domainAdrs.length > 0) {
      y = ensureSpace(doc, y, 20, 20)
      y = addSubsectionHeader(doc, `Architecture Decision Records  (${domainAdrs.length})`, y, margin)

      const adrRows = domainAdrs.map((adr: any) => [
        adr.adr_id || adr.id || 'ADR-???',
        adr.title || adr.decision || 'N/A',
        adr.context || '-',
        adr.decision || 'N/A',
        adr.rationale || '-',
        (adr.owner || 'TBD'),
        adr.target_date ? formatDate(adr.target_date) : 'TBD',
        (adr.status || 'PROPOSED').toUpperCase(),
      ])

      autoTable(doc, {
        startY: y,
        head: [['ADR ID', 'Title', 'Context & Options', 'Decision', 'Rationale & Consequences', 'Owner', 'Target', 'Status']],
        body: adrRows,
        theme: 'grid',
        headStyles: { fillColor: [26, 86, 219], textColor: [255, 255, 255], fontSize: 7.5 },
        bodyStyles: { fontSize: 7, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 28 },
          2: { cellWidth: 26 },
          3: { cellWidth: 26 },
          4: { cellWidth: 26 },
          5: { cellWidth: 18 },
          6: { cellWidth: 15 },
          7: { cellWidth: 13, halign: 'center' },
        },
        styles: { cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.2 },
        pageBreak: 'auto',
      })
      y = (doc.lastAutoTable?.finalY || y) + 12
    }

    y += 4
  }

  // ── SECTION 4: NFR SCORECARD ───────────────────────────────────────────────
  doc.addPage()
  y = 20
  y = addSectionHeader(doc, '4', 'NFR Scorecard', y, margin)

  doc.setTextColor(75, 85, 99)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text(
    'Non-Functional Requirements assessed independently. Amber and Red scores require mitigating conditions.',
    margin, y, { maxWidth: contentWidth }
  )
  y += 12

  const nfrScorecard = (review as any).nfr_scorecard || []
  const nfrSummary = domainSummaries['nfr']

  if (nfrScorecard.length > 0) {
    const nfrRows = nfrScorecard.map((r: any) => [
      r.nfr_category || 'N/A',
      `${r.rag_score ?? '-'}/5`,
      r.rag_label || '-',
      r.slo_target || '-',
      r.actual_evidenced || '-',
      Array.isArray(r.gaps) ? r.gaps.join('; ') : (r.gaps || '-'),
    ])
    autoTable(doc, {
      startY: y,
      head: [['NFR Category', 'Score', 'RAG', 'SLO Target', 'Evidence Provided', 'Gaps / Mitigating Conditions']],
      body: nfrRows,
      theme: 'grid',
      headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 8, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 28 },
        4: { cellWidth: 30 },
        5: { cellWidth: 34 },
      },
      styles: { cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.3 },
    })
    y = (doc.lastAutoTable?.finalY || y) + 12
  } else {
    // Placeholder rows from nfr domain summary
    const nfrPlaceholderRows = [
      ['Scalability & Performance', nfrSummary ? `${nfrSummary.score}/5` : 'N/A', nfrSummary?.rag_label || '-', '-', '-', '-'],
      ['High Availability & Resilience', nfrSummary ? `${nfrSummary.score}/5` : 'N/A', nfrSummary?.rag_label || '-', '-', '-', '-'],
      ['Security NFRs', nfrSummary ? `${nfrSummary.score}/5` : 'N/A', nfrSummary?.rag_label || '-', '-', '-', '-'],
      ['DevSecOps Quality', nfrSummary ? `${nfrSummary.score}/5` : 'N/A', nfrSummary?.rag_label || '-', '-', '-', '-'],
      ['Engineering Excellence', nfrSummary ? `${nfrSummary.score}/5` : 'N/A', nfrSummary?.rag_label || '-', '-', '-', '-'],
    ]
    autoTable(doc, {
      startY: y,
      head: [['NFR Category', 'Score', 'RAG', 'SLO Target', 'Evidence Provided', 'Gaps / Mitigating Conditions']],
      body: nfrPlaceholderRows,
      theme: 'grid',
      headStyles: { fillColor: [100, 116, 139], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 8, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 28 },
        4: { cellWidth: 30 },
        5: { cellWidth: 34 },
      },
      styles: { cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.3 },
    })
    y = (doc.lastAutoTable?.finalY || y) + 12
  }

  // ── SECTION 5: CONSOLIDATED ACTION REGISTER ────────────────────────────────
  y = ensureSpace(doc, y, 40, 20)
  y = addSectionHeader(doc, '5', 'Consolidated Action Register', y, margin)

  doc.setTextColor(75, 85, 99)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('All actions arising from Amber conditions and EA review across all domains.', margin, y)
  y += 10

  if (allActions.length > 0) {
    const actionRows = allActions.map((a: any, idx: number) => [
      `ACT-${String(idx + 1).padStart(2, '0')}`,
      a.action_text || a.action || 'N/A',
      (a.owner_role || a.owner || 'TBD').replace(/_/g, ' '),
      a.due_date ? formatDate(a.due_date) : a.due_days ? `${a.due_days}d` : 'TBD',
      (a.status || 'OPEN').toUpperCase(),
      a.verification_method || 'EA review',
    ])
    autoTable(doc, {
      startY: y,
      head: [['ID', 'Action', 'Owner', 'Due Date', 'Status', 'Verification Method']],
      body: actionRows,
      theme: 'grid',
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 8, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 55 },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 27 },
      },
      styles: { cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.3 },
      pageBreak: 'auto',
    })
    y = (doc.lastAutoTable?.finalY || y) + 12
  } else {
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.text('No actions recorded.', margin, y)
    y += 10
  }

  // ── SECTION 6: CONSOLIDATED ADR REGISTER ──────────────────────────────────
  y = ensureSpace(doc, y, 40, 20)
  y = addSectionHeader(doc, '6', 'Consolidated ADR Register', y, margin)

  doc.setTextColor(75, 85, 99)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('All Architecture Decision Records across all domains.', margin, y)
  y += 10

  if (allAdrs.length > 0) {
    const adrRows = allAdrs.map((adr: any) => [
      adr.adr_id || adr.id || 'ADR-???',
      adr.title || adr.decision || 'N/A',
      adr.context || '-',
      adr.decision || 'N/A',
      adr.rationale || '-',
      (adr.owner || 'TBD'),
      adr.target_date ? formatDate(adr.target_date) : 'TBD',
      (adr.status || 'PROPOSED').toUpperCase(),
    ])
    autoTable(doc, {
      startY: y,
      head: [['ADR ID', 'Title', 'Context & Options', 'Decision', 'Rationale & Consequences', 'Owner', 'Target', 'Status']],
      body: adrRows,
      theme: 'grid',
      headStyles: { fillColor: [26, 86, 219], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 7.5, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 28 },
        2: { cellWidth: 26 },
        3: { cellWidth: 26 },
        4: { cellWidth: 26 },
        5: { cellWidth: 18 },
        6: { cellWidth: 15 },
        7: { cellWidth: 13, halign: 'center' },
      },
      styles: { cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.3 },
      pageBreak: 'auto',
    })
    y = (doc.lastAutoTable?.finalY || y) + 12
  } else {
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.text('No ADRs recorded.', margin, y)
    y += 10
  }

  // ── SECTION 7: CROSS-PLATFORM & CROSS-CUTTING IMPACT ──────────────────────
  y = ensureSpace(doc, y, 50, 20)
  y = addSectionHeader(doc, '7', 'Cross-Platform & Cross-Cutting Impact', y, margin)

  const crossCuttingItems = [
    ['Consuming Platform Impacts', 'To be completed by EA during review — list all platforms affected by this change.'],
    ['Shared Interface & Data Contract Changes', 'Document any breaking changes requiring versioning bump. Reference API catalogue.'],
    ['Regulatory & Compliance Considerations', 'List applicable regulatory requirements (GDPR, PCI-DSS, SOX, etc.) and obligations.'],
    ['Security & Privacy Impact Assessment', 'Summary of SPIA outcome and any residual risks accepted by Risk Committee.'],
  ]
  autoTable(doc, {
    startY: y,
    body: crossCuttingItems,
    theme: 'grid',
    bodyStyles: { fontSize: 9, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold', textColor: [55, 65, 81] },
      1: { cellWidth: 'auto', textColor: [100, 116, 139], fontStyle: 'italic' },
    },
    styles: { cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.3 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  })
  y = (doc.lastAutoTable?.finalY || y) + 12

  // ── SECTION 8: EA REVIEW, ANNOTATIONS & APPROVAL ──────────────────────────
  y = ensureSpace(doc, y, 60, 20)
  y = addSectionHeader(doc, '8', 'EA Review, Annotations & Approval', y, margin)

  doc.setTextColor(75, 85, 99)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text(
    'Completed by the Enterprise Architect. All overrides of agent recommendations must include rationale.',
    margin, y, { maxWidth: contentWidth }
  )
  y += 10

  autoTable(doc, {
    startY: y,
    body: [
      ['Assigned EA:', '_________________________________'],
      ['Review Date:', formatDate(review.ea_overridden_at || review.reviewed_at)],
      ['EA Decision:', review.decision ? review.decision.replace(/_/g, ' ').toUpperCase() : 'PENDING'],
      ['Override Summary:', review.ea_override_notes || 'None'],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4, overflow: 'linebreak' },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [75, 85, 99], cellWidth: 42 },
      1: { textColor: [31, 41, 55] },
    },
  })
  y = (doc.lastAutoTable?.finalY || y) + 16

  doc.setTextColor(55, 65, 81)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Rework Required?', margin, y)
  y += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('[  ] No — proceed to ARB    [  ] Yes — specify gaps below', margin, y)
  y += 12

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.rect(margin, y, contentWidth, 40)
  doc.setTextColor(150, 150, 150)
  doc.setFontSize(9)
  doc.text('Rework Gaps (if applicable):', margin + 5, y + 10)
  y += 50

  // ── SECTION 9: ARB AGENDA & MEETING TEMPLATE ──────────────────────────────
  y = ensureSpace(doc, y, 60, 20)
  y = addSectionHeader(doc, '9', 'ARB Agenda & Meeting Template', y, margin)

  doc.setTextColor(75, 85, 99)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('Standard 90-minute time-boxed ARB agenda generated from this dossier.', margin, y)
  y += 10

  autoTable(doc, {
    startY: y,
    head: [['Time', 'Duration', 'Agenda Item & Presenter']],
    body: [
      ['T+00', '10 min', 'Welcome, context & agenda overview — EA / ARB Chair'],
      ['T+10', '10 min', 'Solution overview & business case — SA / LOB Owner'],
      ['T+20', '15 min', 'Architecture walk-through (highlight key decisions) — SA'],
      ['T+35', '10 min', 'Security & DR findings — Security Agent / EA'],
      ['T+45', '15 min', 'Domain findings, Amber conditions & Actions — EA / Domain Leads'],
      ['T+60', '10 min', 'ADR review & decision taxonomy — EA'],
      ['T+70', '15 min', 'Panel Q&A — time-boxed, chair manages queue'],
      ['T+85', '5 min',  'Decision & action owner confirmation — ARB Chair'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [26, 86, 219], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 8, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 'auto' },
    },
    styles: { cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.3 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  })

  // ── FOOTERS ────────────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `${brand.name}  ·  Enterprise Architecture  ·  Page ${i} of ${pageCount}`,
      margin,
      doc.internal.pageSize.height - 10
    )
    doc.text(
      'ARB Dossier Template v1.0  ·  Internal — Restricted',
      pageWidth - margin - 62,
      doc.internal.pageSize.height - 10
    )
  }

  const filename = `${arbRef}-${review.solution_name?.replace(/\s+/g, '_') || 'Dossier'}-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
