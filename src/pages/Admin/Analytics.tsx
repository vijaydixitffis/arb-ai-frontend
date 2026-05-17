import { useEffect } from 'react'
import { BarChart3, TrendingUp, CheckCircle, XCircle, Clock, AlertCircle, Target, AlertTriangle } from 'lucide-react'
import { useAdminStore } from '../../stores/adminStore'

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: any; color: string; sub?: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? '—'}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ value, max = 5 }: { value?: number; max?: number }) {
  const pct = value != null ? Math.round((value / max) * 100) : 0
  const color = !value ? 'bg-slate-200' : value <= 2 ? 'bg-red-400' : value <= 3 ? 'bg-amber-400' : 'bg-green-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold w-8 text-right ${!value ? 'text-slate-300' : value <= 2 ? 'text-red-500' : value <= 3 ? 'text-amber-500' : 'text-green-600'}`}>
        {value != null ? value.toFixed(1) : '—'}
      </span>
    </div>
  )
}

export default function Analytics() {
  const { summary, domainAnalytics, recentReviews, analyticsLoading, error, loadAnalytics } = useAdminStore()

  useEffect(() => { loadAnalytics() }, [])

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      reviewing: 'bg-teal-100 text-teal-700',
      submitted: 'bg-blue-100 text-blue-700',
      deferred: 'bg-slate-100 text-slate-600',
    }
    return map[status] ?? 'bg-slate-100 text-slate-600'
  }

  const ragColor = (score?: number) => {
    if (!score) return 'text-slate-400'
    if (score <= 2) return 'text-red-600'
    if (score <= 3) return 'text-amber-500'
    return 'text-green-600'
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
      </div>
      <p className="text-slate-500 text-sm mb-8 ml-12">
        Review statistics, domain health scores, and submission trends.
      </p>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {analyticsLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-12">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
          Loading analytics…
        </div>
      ) : (
        <>
          {/* Summary stats */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Reviews"    value={summary.total_reviews}     icon={BarChart3}   color="text-slate-700" />
              <StatCard label="Pending"          value={summary.pending_reviews}   icon={Clock}       color="text-amber-600" />
              <StatCard label="Approved"         value={summary.approved_reviews}  icon={CheckCircle} color="text-green-600" />
              <StatCard label="Rejected"         value={summary.rejected_reviews}  icon={XCircle}     color="text-red-600"   />
              <StatCard label="This Month"       value={summary.reviews_this_month} icon={TrendingUp}  color="text-teal-600"  />
              <StatCard
                label="Approval Rate"
                value={summary.approval_rate != null ? `${summary.approval_rate}%` : '—'}
                icon={Target}
                color="text-green-600"
                sub={`of ${summary.approved_reviews + summary.rejected_reviews} decided`}
              />
              <StatCard
                label="Avg Domain Score"
                value={summary.avg_domain_score != null ? summary.avg_domain_score.toFixed(2) : '—'}
                icon={BarChart3}
                color="text-teal-600"
                sub="out of 5.0"
              />
              <StatCard label="Deferred" value={summary.deferred_reviews} icon={AlertCircle} color="text-slate-500" />
            </div>
          )}

          {/* Domain scores */}
          {domainAnalytics.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">Domain Health Scores</h2>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Domain</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-56">Avg Score</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reviews</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Blockers Raised</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domainAnalytics.map(d => (
                      <tr key={d.domain_slug} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800">{d.domain_name}</p>
                          <p className="text-xs text-slate-400 font-mono">{d.domain_slug}</p>
                        </td>
                        <td className="px-5 py-3 w-56">
                          <ScoreBar value={d.avg_score} />
                        </td>
                        <td className="px-5 py-3 text-slate-600 font-medium">{d.total_reviews}</td>
                        <td className="px-5 py-3">
                          <span className={`text-sm font-semibold ${d.blocker_count > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {d.blocker_count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent reviews */}
          {recentReviews.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">Recent Reviews</h2>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Solution</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Model</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentReviews.map(r => (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-medium text-slate-800 max-w-[200px] truncate">{r.solution_name}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className={`px-5 py-3 font-semibold ${ragColor(r.aggregate_rag_score)}`}>
                          {r.aggregate_rag_score ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-xs font-mono">{r.llm_model ?? '—'}</td>
                        <td className="px-5 py-3 text-slate-400 text-xs">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!summary && domainAnalytics.length === 0 && recentReviews.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No analytics data available yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
