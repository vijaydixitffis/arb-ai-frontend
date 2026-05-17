import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useMetadataStore } from '../stores/metadataStore'
import { reviewService } from '../services/backendConfig'
import { toARBRef } from '../utils/reviewRef'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { FileText, Plus, Eye, CheckCircle, Clock, CheckCircle2, XCircle, ClipboardList, Briefcase, MessageSquare, Users, TrendingUp, Target, Tag, Layers, LayoutGrid, X, ChevronLeft, ChevronRight, ArrowRight, Loader2 } from 'lucide-react'

type Notification = { type: 'success' | 'error'; message: string }

export default function Dashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startingReviewId, setStartingReviewId] = useState<string | null>(null)
  const [notification, setNotification] = useState<Notification | null>(null)
  // EARR Modal states
  const [isEarrModalOpen, setIsEarrModalOpen] = useState(false)
  const [activeEarrTab, setActiveEarrTab] = useState(1)
  const { domains, loadMetadata, ptxGates, architectureDispositions } = useMetadataStore()
  const [earrFormData, setEarrFormData] = useState({
    project_name: '',
    problem_statement: '',
    stakeholders: [] as string[],
    business_drivers: [] as string[],
    target_business_outcomes: ''
  })
  const [earrPtxGate, setEarrPtxGate] = useState('')
  const [earrArchitectureDisposition, setEarrArchitectureDisposition] = useState('')
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])

  useEffect(() => {
    fetchData()
    loadMetadata()
  }, [])

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 6000)
  }

  const handleMarkReadyForReview = async (reviewId: string) => {
    if (!confirm('Start the AI review for this submission? The analysis runs in the background — check back in a couple of minutes.')) return
    try {
      setStartingReviewId(reviewId)
      // Update status (fast DB call)
      await reviewService.markReadyForReview(reviewId)
      // Fire the orchestrator without awaiting — LLM processing takes ~60s
      reviewService.triggerReviewOrchestrator(reviewId).catch((err: unknown) => {
        console.error('Orchestrator error (background):', err)
      })
      showNotification('success', 'Review started! The AI is analysing your submission. Check back in a couple of minutes for the results.')
      // Await fetchData so submissions state is updated before finally clears startingReviewId
      await fetchData()
    } catch (error) {
      console.error('Error starting review:', error)
      showNotification('error', `Failed to start review: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setStartingReviewId(null)
    }
  }

  const fetchData = async () => {
    try {
      const isSolutionArchitect = user?.role === 'solution_architect'
      const isEnterpriseArchitect = user?.role === 'enterprise_architect' || user?.role === 'arb_admin'

      if (isSolutionArchitect) {
        // Fetch reviews from Supabase for current user
        const userReviews = await reviewService.getUserReviews()
        setSubmissions(userReviews.map((review: any) => ({
          id: review.id,
          project_name: review.solution_name,
          status: review.status,
          created_date: new Date(review.created_at).toISOString().split('T')[0],
          overall_progress: ['ea_reviewing','review_ready','approved','conditionally_approved','rejected','deferred','closed'].includes(review.status) ? 100 : ['analysing','queued'].includes(review.status) ? 70 : review.status === 'drafting' ? 30 : 50,
        })))
      }

      if (isEnterpriseArchitect) {
        // For EA, fetch all reviews
        const allReviews = await reviewService.getAllReviews()
        setReviews(allReviews.map((review: any) => ({
          id: review.id,
          submission_id: review.id,
          project_name: review.solution_name,
          status: review.status,
          agent_recommendation: review.decision || 'pending',
          created_date: new Date(review.created_at).toISOString().split('T')[0],
        })))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const isSolutionArchitect = user?.role === 'solution_architect'
  const isEnterpriseArchitect = user?.role === 'enterprise_architect' || user?.role === 'arb_admin'

  // Calculate statistics
  const totalSubmissions = submissions.length
  const pendingReviews = reviews.filter(r => ['review_ready', 'ea_reviewing', 'queued', 'analysing', 'pending'].includes(r.status)).length
  const approved = submissions.filter(s => s.status === 'approved').length
  const rejected = submissions.filter(s => s.status === 'rejected').length

  return (
    <div className="p-8">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg max-w-md text-sm ${
          notification.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <span className="flex-1">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="shrink-0 ml-2 opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 mb-8 text-white flex items-center justify-between">
        <div>
          <p className="text-teal-400 text-xs font-semibold uppercase tracking-widest mb-1">
            Intelligent Architecture Governance
          </p>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.name?.split(' ')[0] ?? user?.name}
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            {isSolutionArchitect
              ? submissions.length === 0
                ? 'No active submissions — start an EA Review to begin.'
                : `You have ${submissions.filter(s => ['drafting','queued','analysing','submitted','review_ready'].includes(s.status)).length} active submission${submissions.filter(s => ['drafting','queued','analysing','submitted','review_ready'].includes(s.status)).length !== 1 ? 's' : ''} in progress.`
              : `${pendingReviews} review${pendingReviews !== 1 ? 's' : ''} awaiting your decision${pendingReviews > 0 ? ' — SLA clock is running.' : '.'}`
            }
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0 ml-6">
          {[
            { label: '✓ Approve',        color: 'bg-green-500/20 text-green-400 border-green-500/30' },
            { label: '⚡ w/ Actions',    color: 'bg-teal-500/20  text-teal-400  border-teal-500/30'  },
            { label: '⏸ Defer',         color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
            { label: '✕ Reject',        color: 'bg-red-500/20   text-red-400   border-red-500/30'   },
          ].map((d) => (
            <span key={d.label} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${d.color}`}>
              {d.label}
            </span>
          ))}
        </div>
      </div>

      {/* Statistics Cards — SA */}
      {isSolutionArchitect && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Submissions</p>
                  <p className="text-3xl font-bold">{totalSubmissions}</p>
                </div>
                <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-teal-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Approved</p>
                  <p className="text-3xl font-bold">{approved}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Rejected</p>
                  <p className="text-3xl font-bold">{rejected}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Governance KPI Cards — EA / Admin */}
      {isEnterpriseArchitect && (() => {
        const total    = reviews.length
        const terminal = reviews.filter(r => ['approved','conditionally_approved','rejected','deferred','closed'].includes(r.status))
        const approvedEA   = reviews.filter(r => ['approved','conditionally_approved'].includes(r.status)).length
        const approvalRate = terminal.length > 0 ? Math.round((approvedEA / terminal.length) * 100) : 0
        const pendingDecision = reviews.filter(r => r.status === 'review_ready').length
        const returnedCount   = reviews.filter(r => r.status === 'returned').length
        return (
          <div className="mb-8">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Governance Overview
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Reviews</p>
                      <p className="text-3xl font-bold">{total}</p>
                    </div>
                    <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Pending Decision</p>
                      <p className="text-3xl font-bold">{pendingDecision}</p>
                    </div>
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Approval Rate</p>
                      <p className="text-3xl font-bold">{approvalRate}<span className="text-lg font-medium text-gray-400">%</span></p>
                    </div>
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Returned for Rework</p>
                      <p className="text-3xl font-bold">{returnedCount}</p>
                    </div>
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      })()}


      <div className="grid gap-6">
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-600">Loading...</p>
            </CardContent>
          </Card>
        ) : isSolutionArchitect && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Review Submissions</CardTitle>
              <Button
                onClick={() => setIsEarrModalOpen(true)}
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white border-teal-600"
              >
                <Plus className="w-4 h-4" />
                EA Review
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Project Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Submitted Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((submission) => (
                      <tr key={submission.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-gray-500" />
                            <div>
                              <p className="font-medium">{submission.project_name}</p>
                              <p className="text-sm text-gray-500">{toARBRef(submission.id, submission.created_date)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-sm px-2 py-1 rounded ${
                            submission.status === 'approved'               ? 'bg-green-100 text-green-800'  :
                            submission.status === 'conditionally_approved' ? 'bg-teal-100 text-teal-800'    :
                            submission.status === 'closed'                 ? 'bg-gray-200 text-gray-700'    :
                            submission.status === 'rejected'               ? 'bg-red-100 text-red-800'      :
                            submission.status === 'deferred'               ? 'bg-orange-100 text-orange-800':
                            submission.status === 'returned'               ? 'bg-amber-100 text-amber-800'  :
                            submission.status === 'queued'                 ? 'bg-yellow-100 text-yellow-800':
                            submission.status === 'drafting'               ? 'bg-gray-100 text-gray-800'    :
                            submission.status === 'analysing'              ? 'bg-blue-100 text-blue-800'    :
                            submission.status === 'review_ready'           ? 'bg-blue-100 text-blue-700'    :
                            submission.status === 'ea_reviewing'           ? 'bg-purple-100 text-purple-800':
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {submission.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{submission.created_date}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            {!['analysing', 'submitted'].includes(submission.status) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/earr/edit/${submission.id}`)}
                              >
                                Edit
                              </Button>
                            ) : null}
                            {submission.status === 'queued' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={startingReviewId === submission.id}
                                onClick={() => handleMarkReadyForReview(submission.id)}
                              >
                                {startingReviewId === submission.id ? (
                                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Starting…</>
                                ) : 'Start Review'}
                              </Button>
                            ) : null}
                            {['submitted', 'analysing'].includes(submission.status) ? (
                              <Button variant="outline" size="sm" disabled>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Review in Progress
                              </Button>
                            ) : null}
                            {['review_ready', 'ea_reviewing', 'approved', 'conditionally_approved', 'rejected', 'deferred', 'closed'].includes(submission.status) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/review-status/${submission.id}`)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {isEnterpriseArchitect && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Project Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Review Ref</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Agent Recommendation</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((review) => (
                      <tr key={review.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-4 h-4 text-gray-500" />
                            <p className="font-medium">{review.project_name}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm font-mono text-gray-600">{toARBRef(review.submission_id, review.created_date)}</td>
                        <td className="py-3 px-4">
                          <span className="text-sm px-2 py-1 rounded bg-amber-100 text-amber-800">
                            {review.agent_recommendation}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            onClick={() => navigate(`/review/${review.submission_id}`)}
                            size="sm"
                          >
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal for EARR */}
      {isEarrModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                Enterprise Architecture Review Request (EARR)
              </h3>
              <button
                onClick={() => setIsEarrModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-6 flex-shrink-0">
              <button
                onClick={() => setActiveEarrTab(1)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeEarrTab === 1
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                Project Info
              </button>
              <button
                onClick={() => setActiveEarrTab(2)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeEarrTab === 2
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Layers className="w-4 h-4" />
                Review Type + Domains
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">

              {/* Tab 1: Project Info */}
              {activeEarrTab === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      Project Name
                      <span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <Input
                      value={earrFormData.project_name}
                      onChange={(e) => setEarrFormData({ ...earrFormData, project_name: e.target.value })}
                      placeholder="Enter project name"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                      Problem Statement
                      <span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <Textarea
                      value={earrFormData.problem_statement}
                      onChange={(e) => setEarrFormData({ ...earrFormData, problem_statement: e.target.value })}
                      placeholder="Describe the problem this solution addresses"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      Stakeholders
                    </label>
                    <Textarea
                      value={earrFormData.stakeholders?.join('\n') || ''}
                      onChange={(e) => setEarrFormData({ ...earrFormData, stakeholders: e.target.value.split('\n').filter(s => s.trim()) })}
                      placeholder="List key stakeholders (one per line)"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                      Business Drivers
                    </label>
                    <Textarea
                      value={earrFormData.business_drivers?.join('\n') || ''}
                      onChange={(e) => setEarrFormData({ ...earrFormData, business_drivers: e.target.value.split('\n').filter(s => s.trim()) })}
                      placeholder="List key business drivers (one per line)"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                      <Target className="w-3.5 h-3.5 text-slate-400" />
                      Target Business Outcomes
                    </label>
                    <Textarea
                      value={earrFormData.target_business_outcomes}
                      onChange={(e) => setEarrFormData({ ...earrFormData, target_business_outcomes: e.target.value })}
                      placeholder="Describe target business outcomes and expected results"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Review Type + Domains */}
              {activeEarrTab === 2 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        PTX Gate
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                        value={earrPtxGate}
                        onChange={(e) => setEarrPtxGate(e.target.value)}
                      >
                        <option value="">Select PTX Gate&hellip;</option>
                        {ptxGates.map((gate) => (
                          <option key={gate.value} value={gate.value}>{gate.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        Architecture Disposition
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                        value={earrArchitectureDisposition}
                        onChange={(e) => setEarrArchitectureDisposition(e.target.value)}
                      >
                        <option value="">Select Architecture Disposition&hellip;</option>
                        {architectureDispositions.map((disp) => (
                          <option key={disp.value} value={disp.value}>{disp.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
                        Select Domains
                        <span className="ml-1 text-xs font-normal text-slate-400">({selectedDomains.length} of {domains.length} selected)</span>
                      </label>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setSelectedDomains(domains.map(d => d.slug))}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={() => setSelectedDomains([])}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {domains.map((domain) => {
                        const isSelected = selectedDomains.includes(domain.slug)
                        return (
                          <label
                            key={domain.id}
                            className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                              isSelected
                                ? 'border-indigo-400 bg-indigo-50/60 shadow-sm'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDomains([...selectedDomains, domain.slug])
                                } else {
                                  setSelectedDomains(selectedDomains.filter(slug => slug !== domain.slug))
                                }
                              }}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 flex-shrink-0"
                            />
                            {domain.icon && (
                              <span className="text-base leading-none flex-shrink-0">{domain.icon}</span>
                            )}
                            <span className={`text-sm font-medium leading-snug ${isSelected ? 'text-indigo-800' : 'text-slate-800'}`}>
                              {domain.name}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200 flex-shrink-0">
              {activeEarrTab === 1 ? (
                <button
                  onClick={() => setIsEarrModalOpen(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => setActiveEarrTab(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
              )}

              {activeEarrTab === 1 ? (
                <button
                  onClick={() => setActiveEarrTab(2)}
                  disabled={!earrFormData.project_name || !earrFormData.problem_statement}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (earrPtxGate && earrArchitectureDisposition) {
                      setIsEarrModalOpen(false)
                      navigate('/earr/new', {
                        state: {
                          ptxGate: earrPtxGate,
                          architectureDisposition: earrArchitectureDisposition,
                          projectInfo: earrFormData,
                          selectedDomains: selectedDomains
                        }
                      })
                    }
                  }}
                  disabled={!earrPtxGate || !earrArchitectureDisposition || selectedDomains.length === 0}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  Create Request
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
