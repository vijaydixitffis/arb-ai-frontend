import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminStore } from '../../stores/adminStore'
import { useAuthStore } from '../../stores/authStore'
import {
  LayoutDashboard, Users, Settings, Globe, ListChecks,
  BarChart3, ScrollText, FileText, BookOpen, Shield,
  TrendingUp, Clock, CheckCircle, XCircle, AlertCircle,
} from 'lucide-react'

const ADMIN_QUICK_LINKS = [
  { label: 'Users',         path: '/admin/users',      icon: Users,       roles: ['arb_admin', 'super_admin'] },
  { label: 'System Config', path: '/admin/config',     icon: Settings,    roles: ['super_admin'] },
  { label: 'Domains',       path: '/admin/domains',    icon: Globe,       roles: ['arb_admin', 'super_admin'] },
  { label: 'Checklist',     path: '/admin/checklist',  icon: ListChecks,  roles: ['arb_admin', 'super_admin'] },
  { label: 'Analytics',     path: '/admin/analytics',  icon: BarChart3,   roles: ['arb_admin', 'super_admin'] },
  { label: 'Audit Log',     path: '/admin/audit-log',  icon: ScrollText,  roles: ['arb_admin', 'super_admin'] },
  { label: 'Prompts',       path: '/admin/prompts',    icon: FileText,    roles: ['super_admin'] },
  { label: 'Knowledge Base',path: '/admin/kb',         icon: BookOpen,    roles: ['super_admin'] },
]

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? '—'}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-slate-50 border border-slate-100`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { summary, recentReviews, analyticsLoading, loadAnalytics } = useAdminStore()

  useEffect(() => { loadAnalytics() }, [])

  const links = ADMIN_QUICK_LINKS.filter(l => l.roles.includes(user?.role ?? ''))

  const ragColor = (score?: number) => {
    if (!score) return 'text-slate-400'
    if (score <= 2) return 'text-red-600'
    if (score <= 3) return 'text-amber-500'
    return 'text-green-600'
  }

  const statusColor = (status: string) => {
    if (status === 'approved') return 'bg-green-100 text-green-700'
    if (status === 'rejected') return 'bg-red-100 text-red-700'
    if (status === 'reviewing') return 'bg-teal-100 text-teal-700'
    if (status === 'submitted') return 'bg-blue-100 text-blue-700'
    return 'bg-slate-100 text-slate-600'
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        </div>
        <p className="text-slate-500 text-sm ml-12">
          {user?.role === 'super_admin' ? 'Super Admin — full system access' : 'ARB Administrator — governance management'}
        </p>
      </div>

      {/* Stats */}
      {analyticsLoading ? (
        <div className="flex items-center gap-2 text-slate-400 mb-8">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
          Loading analytics…
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Reviews"       value={summary.total_reviews}    icon={LayoutDashboard} color="text-slate-700" />
          <StatCard label="Pending"             value={summary.pending_reviews}  icon={Clock}           color="text-amber-600" />
          <StatCard label="Approved"            value={summary.approved_reviews} icon={CheckCircle}     color="text-green-600" />
          <StatCard label="Rejected"            value={summary.rejected_reviews} icon={XCircle}         color="text-red-600"   />
          <StatCard label="This Month"          value={summary.reviews_this_month} icon={TrendingUp}    color="text-teal-600"  />
          <StatCard label="Approval Rate"       value={summary.approval_rate != null ? `${summary.approval_rate}%` : '—'} icon={CheckCircle} color="text-green-600" />
          <StatCard label="Avg Domain Score"    value={summary.avg_domain_score != null ? summary.avg_domain_score.toFixed(1) : '—'} icon={BarChart3} color="text-teal-600" />
          <StatCard label="Deferred"            value={summary.deferred_reviews} icon={AlertCircle}     color="text-slate-500"  />
        </div>
      ) : null}

      {/* Quick links */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {links.map(({ label, path, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-teal-300 hover:bg-teal-50/40 transition-colors text-left group"
            >
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-teal-100 flex-shrink-0 transition-colors">
                <Icon className="w-4 h-4 text-slate-600 group-hover:text-teal-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent reviews */}
      {recentReviews.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-3">Recent Reviews</h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Solution</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Model</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentReviews.slice(0, 10).map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800 truncate max-w-[180px]">{r.solution_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${ragColor(r.aggregate_rag_score)}`}>
                      {r.aggregate_rag_score ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.llm_model ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
