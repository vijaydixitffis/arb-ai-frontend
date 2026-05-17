import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { reviewService, ReviewStatus as ReviewStatusType } from '../services/backendConfig'
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle, FileText, Target, AlertTriangle, RefreshCw } from 'lucide-react'

export default function ReviewStatus() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const navigate = useNavigate()
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [retriggering, setRetriggering] = useState(false)
  const [retriggerError, setRetriggerError] = useState<string | null>(null)

  useEffect(() => {
    if (!reviewId) {
      setError('Review ID not provided')
      setLoading(false)
      return
    }

    // Initial fetch
    fetchReviewStatus()

    // Start polling if not complete
    const startPolling = async () => {
      setPolling(true)
      try {
        await reviewService.pollReviewStatus(
          reviewId,
          (status) => {
            setReviewStatus(status)
          },
          5000, // Poll every 5 seconds
          60 // Max 60 attempts (5 minutes)
        )
      } catch (err) {
        console.error('Polling error:', err)
        setError(err instanceof Error ? err.message : 'Failed to poll review status')
      } finally {
        setPolling(false)
      }
    }

    startPolling()
  }, [reviewId])

  const fetchReviewStatus = async () => {
    try {
      setLoading(true)
      const status = await reviewService.getReviewStatus(reviewId!)
      setReviewStatus(status)
    } catch (err) {
      console.error('Error fetching review status:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch review status')
    } finally {
      setLoading(false)
    }
  }

  const handleRetrigger = async () => {
    if (!reviewId) return
    setRetriggering(true)
    setRetriggerError(null)
    try {
      await reviewService.triggerReviewOrchestrator(reviewId)
      await fetchReviewStatus()
    } catch (err) {
      setRetriggerError(err instanceof Error ? err.message : 'Re-trigger failed')
    } finally {
      setRetriggering(false)
    }
  }

  const getStatusIcon = () => {
    if (!reviewStatus) return <Clock className="w-8 h-8 text-gray-400" />
    
    switch (reviewStatus.status) {
      case 'queued':
      case 'pending':
        return <Clock className="w-8 h-8 text-yellow-500 animate-pulse" />
      case 'analysing':
      case 'in_review':
        return <Clock className="w-8 h-8 text-blue-500 animate-spin" />
      case 'review_ready':
        return <Clock className="w-8 h-8 text-blue-600" />
      case 'ea_reviewing':
      case 'ea_review':
        return <CheckCircle className="w-8 h-8 text-purple-500" />
      case 'approved':
        return <CheckCircle className="w-8 h-8 text-green-600" />
      case 'conditionally_approved':
        return <CheckCircle className="w-8 h-8 text-teal-600" />
      case 'returned':
      case 'rework':
        return <AlertCircle className="w-8 h-8 text-amber-500" />
      case 'agent_failed':
        return <XCircle className="w-8 h-8 text-red-500" />
      case 'rejected':
        return <XCircle className="w-8 h-8 text-red-600" />
      case 'deferred':
        return <AlertCircle className="w-8 h-8 text-orange-500" />
      case 'closed':
        return <CheckCircle className="w-8 h-8 text-gray-500" />
      default:
        return <Clock className="w-8 h-8 text-gray-400" />
    }
  }

  const getStatusText = () => {
    if (!reviewStatus) return 'Loading...'
    
    switch (reviewStatus.status) {
      case 'drafting':
        return 'Draft — completing intake form'
      case 'queued':
      case 'pending':
        return 'Queued — waiting for AI processing'
      case 'analysing':
      case 'in_review':
        return 'Analysing — AI agent is reviewing'
      case 'review_ready':
        return 'Review Ready — awaiting EA to open dossier'
      case 'ea_reviewing':
      case 'ea_review':
        return 'EA Reviewing — Gate 2 in progress'
      case 'approved':
        return 'Approved'
      case 'conditionally_approved':
        return 'Conditionally Approved — actions pending'
      case 'returned':
      case 'rework':
        return 'Returned — SA rework required'
      case 'agent_failed':
        return 'AI Review Failed — re-trigger to retry'
      case 'rejected':
        return 'Rejected'
      case 'deferred':
        return 'Deferred — submission must restart'
      case 'closed':
        return 'Closed — all actions resolved'
      default:
        return 'Unknown Status'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'blocker': case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high': case 'major':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': case 'minor':
        return 'bg-blue-50 text-blue-800 border-blue-200'
      case 'info':
        return 'bg-gray-100 text-gray-600 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600'
    if (score >= 3) return 'text-yellow-600'
    return 'text-red-600'
  }

  const PIPELINE_STEPS = [
    { label: 'Intake',    sublabel: 'Upload'     },
    { label: 'Parse',     sublabel: 'Ingest'     },
    { label: 'KB',        sublabel: 'Retrieval'  },
    { label: 'Domain',    sublabel: 'Validation' },
    { label: 'NFR',       sublabel: 'Scoring'    },
    { label: 'Generate',  sublabel: 'ADRs'       },
    { label: 'EA',        sublabel: 'Review'     },
    { label: 'Publish',   sublabel: 'Schedule'   },
  ]

  const getActiveStep = (status: string): number => {
    switch (status) {
      case 'drafting':                                       return 0
      case 'queued': case 'pending':                        return 1
      case 'submitted': case 'analysing': case 'in_review': return 3
      case 'agent_failed':                                  return 3
      case 'review_ready':                                  return 5
      case 'ea_reviewing': case 'ea_review': case 'returned': return 6
      case 'approved': case 'conditionally_approved':
      case 'rejected': case 'deferred': case 'closed':      return 7
      default:                                              return 0
    }
  }

  const isTerminal = (status: string) =>
    ['approved','conditionally_approved','rejected','deferred','closed'].includes(status)

  const activeStep     = reviewStatus ? getActiveStep(reviewStatus.status) : -1
  const isAIProcessing = reviewStatus && ['analysing','in_review','submitted'].includes(reviewStatus.status)
  const hasDomainErrors = reviewStatus?.report_json?.has_domain_errors === true
  const failedDomains: string[] = reviewStatus?.report_json?.failed_domains ?? []
  const showRetrigger  = reviewStatus &&
    (reviewStatus.status === 'agent_failed' || (reviewStatus.status === 'review_ready' && hasDomainErrors))

  if (loading && !reviewStatus) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading review status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-xl font-semibold">Review Status</h1>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium">{getStatusText()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Progress */}
      {reviewStatus && (
        <div className="bg-slate-900 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 py-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
              8-Step Automated Pipeline · 3 Human Governance Gates
            </p>
            <div className="flex items-start gap-0 overflow-x-auto pb-1">
              {PIPELINE_STEPS.map((step, idx) => {
                const completed = isTerminal(reviewStatus.status)
                  ? true
                  : idx < activeStep
                const active    = !isTerminal(reviewStatus.status) && idx === activeStep
                const isAIRange = isAIProcessing && idx >= 2 && idx <= 4
                const isGate    = idx === 0 || idx === 6 || idx === 7

                return (
                  <div key={step.label} className="flex items-center flex-shrink-0">
                    <div className="flex flex-col items-center" style={{ minWidth: '72px' }}>
                      {/* Circle */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        completed
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : active || isAIRange
                          ? 'bg-teal-600/20 border-teal-400 text-teal-400 animate-pulse'
                          : 'bg-slate-800 border-slate-600 text-slate-500'
                      }`}>
                        {completed ? '✓' : idx + 1}
                      </div>
                      {/* Gate marker */}
                      {isGate && (
                        <span className="text-[9px] font-semibold text-amber-400 mt-0.5">GATE</span>
                      )}
                      {/* Labels */}
                      <p className={`text-[11px] font-semibold mt-1 text-center leading-tight ${
                        completed || active || isAIRange ? 'text-white' : 'text-slate-500'
                      }`}>{step.label}</p>
                      <p className="text-[10px] text-slate-500 text-center leading-tight">{step.sublabel}</p>
                    </div>
                    {/* Connector */}
                    {idx < PIPELINE_STEPS.length - 1 && (
                      <div className={`h-0.5 flex-shrink-0 mx-1 transition-all ${
                        idx < activeStep || isTerminal(reviewStatus.status)
                          ? 'bg-teal-600'
                          : 'bg-slate-700'
                      }`} style={{ width: '20px' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {reviewStatus && (
          <div className="space-y-6">
            {/* Re-trigger Banner */}
            {showRetrigger && (
              <div className={`rounded-lg border p-4 ${
                reviewStatus.status === 'agent_failed'
                  ? 'bg-red-50 border-red-300'
                  : 'bg-amber-50 border-amber-300'
              }`}>
                <div className="flex items-start gap-3">
                  {reviewStatus.status === 'agent_failed' ? (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {reviewStatus.status === 'agent_failed' ? (
                      <>
                        <p className="font-semibold text-red-800">AI Review Failed</p>
                        {reviewStatus.report_json?.agent_error && (
                          <p className="text-sm text-red-700 mt-1 font-mono break-words">
                            {reviewStatus.report_json.agent_error}
                          </p>
                        )}
                        <p className="text-sm text-red-700 mt-1">
                          The review agent encountered a critical error. Re-triggering will restart the full analysis.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-amber-800">Partial Review — Some Domains Failed</p>
                        {failedDomains.length > 0 && (
                          <p className="text-sm text-amber-700 mt-1">
                            Failed domains:{' '}
                            {failedDomains.map((d, i) => (
                              <span key={d}>
                                <span className="font-mono font-medium capitalize">{d}</span>
                                {i < failedDomains.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </p>
                        )}
                        <p className="text-sm text-amber-700 mt-1">
                          The review is available but one or more domains could not be fully analysed. Re-triggering will re-run the complete analysis.
                        </p>
                      </>
                    )}
                    {retriggerError && (
                      <p className="text-sm text-red-600 mt-2 font-medium">{retriggerError}</p>
                    )}
                  </div>
                  <Button
                    onClick={handleRetrigger}
                    disabled={retriggering}
                    size="sm"
                    className={`flex-shrink-0 flex items-center gap-2 ${
                      reviewStatus.status === 'agent_failed'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    <RefreshCw className={`w-4 h-4 ${retriggering ? 'animate-spin' : ''}`} />
                    {retriggering
                      ? 'Re-triggering...'
                      : reviewStatus.status === 'agent_failed'
                      ? 'Re-trigger AI Review'
                      : 'Re-run Analysis'}
                  </Button>
                </div>
              </div>
            )}

            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>Review Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Review ID</p>
                    <p className="font-mono text-sm">{reviewId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Submitted At</p>
                    <p className="text-sm">
                      {reviewStatus.submitted_at 
                        ? new Date(reviewStatus.submitted_at).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Reviewed At</p>
                    <p className="text-sm">
                      {reviewStatus.reviewed_at 
                        ? new Date(reviewStatus.reviewed_at).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Domain Scores */}
            {reviewStatus.domain_scores && reviewStatus.domain_scores.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Domain Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {reviewStatus.domain_scores.map((score) => (
                      <div key={score.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium capitalize">{score.domain}</span>
                          <span className={`text-2xl font-bold ${getScoreColor(score.score)}`}>
                            {score.score}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${score.score >= 4 ? 'bg-green-500' : score.score >= 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${(score.score / 5) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Findings */}
            {reviewStatus.findings && reviewStatus.findings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Findings ({reviewStatus.findings?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reviewStatus.findings.map((finding) => (
                      <div key={finding.id} className={`border rounded-lg p-4 ${getSeverityColor(finding.severity)}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase px-2 py-1 rounded">
                              {finding.severity}
                            </span>
                            <span className="text-sm font-medium capitalize">{finding.domain}</span>
                          </div>
                          {finding.principle_id && (
                            <span className="text-xs text-gray-600">{finding.principle_id}</span>
                          )}
                        </div>
                        <p className="text-sm mb-2">{finding.finding}</p>
                        {finding.recommendation && (
                          <p className="text-sm text-gray-600">
                            <strong>Recommendation:</strong> {finding.recommendation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ADRs */}
            {reviewStatus.adrs && reviewStatus.adrs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    Architecture Decision Records ({reviewStatus.adrs?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reviewStatus.adrs.map((adr) => (
                      <div key={adr.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-mono text-sm font-medium">{adr.adr_id}</span>
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 capitalize">
                            {adr.status}
                          </span>
                        </div>
                        <p className="font-medium mb-2">{adr.decision}</p>
                        <p className="text-sm text-gray-600 mb-2">{adr.rationale}</p>
                        {adr.context && (
                          <p className="text-sm text-gray-500 mb-2">
                            <strong>Context:</strong> {adr.context}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {adr.owner && (
                            <span><strong>Owner:</strong> {adr.owner}</span>
                          )}
                          {adr.target_date && (
                            <span><strong>Target:</strong> {adr.target_date}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {reviewStatus.actions && reviewStatus.actions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-500" />
                    Action Items ({reviewStatus.actions?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reviewStatus.actions.map((action) => (
                      <div key={action.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium">{action.action_text}</p>
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 capitalize">
                            {action.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span><strong>Owner:</strong> {action.owner_role}</span>
                          {action.due_days && (
                            <span><strong>Due:</strong> {action.due_days} days</span>
                          )}
                          {action.due_date && (
                            <span><strong>Date:</strong> {action.due_date}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Decision */}
            {reviewStatus.decision && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Decision</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`p-4 rounded-lg ${
                    reviewStatus.decision === 'approve' ? 'bg-green-50 border-green-200' :
                    reviewStatus.decision === 'reject' ? 'bg-red-50 border-red-200' :
                    reviewStatus.decision === 'defer' ? 'bg-orange-50 border-orange-200' :
                    'bg-yellow-50 border-yellow-200'
                  }`}>
                    <p className="font-semibold text-lg capitalize">{reviewStatus.decision.replace('_', ' ')}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* View Review Button - Only show when status is reviewed */}
            {reviewStatus.status === 'reviewed' && (
              <Card>
                <CardContent>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Review Complete</span>
                    </div>
                    <Button 
                      onClick={() => window.open(`/review/${reviewId}/view`, '_blank')}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      View Full Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Polling Indicator */}
            {polling && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                <span>Updating status...</span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
