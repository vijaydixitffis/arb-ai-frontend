import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { isAdmin, isSuperAdmin } from '../../types/admin'
import { brand } from '../../brand.config'
import {
  LayoutDashboard, FileText, ClipboardCheck, LogOut, User,
  Shield, Users, Globe, ListChecks, BarChart3, ScrollText, BookOpen, SlidersHorizontal,
} from 'lucide-react'

const mainMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard',      path: '/dashboard',  roles: ['solution_architect', 'enterprise_architect', 'arb_admin'] },
  { icon: FileText,        label: 'My Submissions', path: '/submissions', roles: ['solution_architect'] },
  { icon: ClipboardCheck,  label: 'Reviews',        path: '/reviews',    roles: ['enterprise_architect', 'arb_admin'] },
]

const adminMenuItems = [
  { icon: Shield,            label: 'Admin Home',    path: '/admin',             roles: ['arb_admin', 'super_admin'] },
  { icon: Users,             label: 'Users',         path: '/admin/users',       roles: ['arb_admin', 'super_admin'] },
  { icon: SlidersHorizontal, label: 'System Config', path: '/admin/config',      roles: ['super_admin'] },
  { icon: Globe,             label: 'Domains',       path: '/admin/domains',     roles: ['arb_admin', 'super_admin'] },
  { icon: ListChecks,        label: 'Checklist',     path: '/admin/checklist',   roles: ['arb_admin', 'super_admin'] },
  { icon: BarChart3,         label: 'Analytics',     path: '/admin/analytics',   roles: ['arb_admin', 'super_admin'] },
  { icon: ScrollText,        label: 'Audit Log',     path: '/admin/audit-log',   roles: ['arb_admin', 'super_admin'] },
  { icon: FileText,          label: 'Prompts',       path: '/admin/prompts',     roles: ['super_admin'] },
  { icon: BookOpen,          label: 'Knowledge Base',path: '/admin/kb',          roles: ['super_admin'] },
]

const roleLabel: Record<string, string> = {
  solution_architect:   'Solution Architect',
  enterprise_architect: 'Enterprise Architect',
  arb_admin:            'ARB Administrator',
  super_admin:          'Super Admin',
}

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user     = useAuthStore((state) => state.user)
  const logout   = useAuthStore((state) => state.logout)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const role = user?.role ?? ''
  const filteredMain = mainMenuItems.filter(item => item.roles.includes(role))
  const filteredAdmin = adminMenuItems.filter(item => item.roles.includes(role))
  const showAdmin = isAdmin(role)

  const NavItem = ({ icon: Icon, label, path }: { icon: any; label: string; path: string }) => {
    const active = location.pathname === path || (path !== '/admin' && location.pathname.startsWith(path))
    return (
      <li>
        <button
          onClick={() => navigate(path)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            active
              ? 'bg-turquoise-500/15 text-turquoise-400 font-medium'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span>{label}</span>
          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-turquoise-400" />}
        </button>
      </li>
    )
  }

  return (
    <aside className="w-64 bg-slate-900 flex flex-col h-screen flex-shrink-0">

      {/* Logo */}
      <div className="px-5 py-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-turquoise-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm tracking-tight">ARB</span>
          </div>
          <div>
            <h1 className="font-bold text-base text-white leading-tight">
              ARB <span className="text-turquoise-400">AI</span> Agent
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{brand.tagline}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {filteredMain.length > 0 && (
          <>
            {!isSuperAdmin(role) && (
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">Navigation</p>
            )}
            <ul className="space-y-0.5">
              {filteredMain.map(item => <NavItem key={item.path} {...item} />)}
            </ul>
          </>
        )}

        {showAdmin && (
          <>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mt-5 mb-2">
              {isSuperAdmin(role) ? 'Super Admin' : 'Administration'}
            </p>
            <ul className="space-y-0.5">
              {filteredAdmin.map(item => <NavItem key={item.path} {...item} />)}
            </ul>
          </>
        )}
      </nav>

      {/* User Profile */}
      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-slate-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-turquoise-400">{roleLabel[user?.role || ''] ?? user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

    </aside>
  )
}
