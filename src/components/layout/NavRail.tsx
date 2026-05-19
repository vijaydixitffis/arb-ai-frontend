import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { isAdmin, isSuperAdmin } from '../../types/admin'
import { brand } from '../../brand.config'
import {
  LayoutDashboard, Plus, BarChart3, BookOpen, ScrollText,
  Users, SlidersHorizontal, FileText, Globe, ListChecks, LogOut,
} from 'lucide-react'

// ── Nav item model ───────────────────────────────────────────────────────────

interface NavItem {
  icon: React.ElementType
  label: string
  path: string
  badge?: string | null
}

// ── Role labels ──────────────────────────────────────────────────────────────

const ROLE_DISPLAY: Record<string, string> = {
  solution_architect:   'Solution Architect',
  enterprise_architect: 'Enterprise Architect',
  arb_admin:            'ARB Administrator',
  super_admin:          'Super Admin',
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(p => p[0] ?? '')
    .join('')
    .toUpperCase()
}

// ── Single nav button ────────────────────────────────────────────────────────

function RailItem({ item, active }: { item: NavItem; active: boolean }) {
  const navigate = useNavigate()
  const Icon = item.icon
  return (
    <button
      onClick={() => navigate(item.path)}
      className={`w-full flex items-center gap-3 px-[10px] py-[9px] rounded-[8px] text-[15px] border-none bg-transparent text-left transition-colors duration-150 cursor-pointer
        ${active
          ? 'bg-teal-500/[0.14] text-white font-medium shadow-[inset_2px_0_0_#00B09C]'
          : 'text-white/[0.72] hover:bg-white/5 hover:text-white'
        }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0 opacity-85" />
      <span className="flex-1 min-w-0 truncate">{item.label}</span>
      {item.badge && (
        <span className="font-cond font-semibold text-[12px] bg-gold-500 text-navy-900 px-[7px] py-[1px] rounded-full leading-none">
          {item.badge}
        </span>
      )}
    </button>
  )
}

// ── Section ──────────────────────────────────────────────────────────────────

function RailSection({ title, items, currentPath }: {
  title: string
  items: NavItem[]
  currentPath: string
}) {
  return (
    <div className="px-3 pt-[18px] pb-[6px]">
      <div className="text-[12px] font-cond uppercase tracking-[0.2em] text-white/[0.42] px-[10px] pb-2">
        {title}
      </div>
      <div className="space-y-[2px]">
        {items.map(item => {
          const active =
            currentPath === item.path ||
            (item.path !== '/dashboard' && currentPath.startsWith(item.path))
          return <RailItem key={item.path} item={item} active={active} />
        })}
      </div>
    </div>
  )
}

// ── NavRail ──────────────────────────────────────────────────────────────────

export default function NavRail() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const user       = useAuthStore(s => s.user)
  const logout     = useAuthStore(s => s.logout)
  const currentPath = location.pathname.replace('/arb-ai-agent', '') || '/'

  const role = user?.role ?? ''
  const isSA = role === 'solution_architect'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // ── Section: Architect (SA) / Reviewer (EA) ───────────────────────────────

  const primaryItems: NavItem[] = isSA
    ? [
        { icon: LayoutDashboard, label: 'My pipeline',    path: '/dashboard' },
        { icon: Plus,            label: 'New submission', path: '/submission/new' },
      ]
    : [
        { icon: LayoutDashboard, label: 'Decisions desk', path: '/dashboard', badge: null },
      ]

  // ── Section: Workspace (arb_admin + super_admin only) ───────────────────

  const workspaceItems: NavItem[] = isAdmin(role)
    ? [
        { icon: BarChart3,  label: 'Analytics', path: '/admin/analytics' },
        { icon: ScrollText, label: 'Audit log', path: '/admin/audit-log' },
      ]
    : []

  // ── Section: Administration (arb_admin base; extras for super_admin only) ─

  const adminItems: NavItem[] = isAdmin(role)
    ? [
        { icon: Users,      label: 'Users',     path: '/admin/users' },
        { icon: Globe,      label: 'Domains',   path: '/admin/domains' },
        { icon: ListChecks, label: 'Checklist', path: '/admin/checklist' },
        ...(isSuperAdmin(role) ? [
          { icon: SlidersHorizontal, label: 'System',         path: '/admin/config' },
          { icon: FileText,          label: 'Prompts',        path: '/admin/prompts' },
          { icon: BookOpen,          label: 'Knowledge base', path: '/admin/kb' },
        ] : []),
      ]
    : []

  const name = user?.name ?? 'User'
  const displayRole = ROLE_DISPLAY[role] ?? role

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 sticky top-0"
      style={{ width: 240, background: '#1A2D45', color: 'rgba(255,255,255,0.78)' }}
    >
      {/* Brand block */}
      <div className="flex items-center gap-3 px-5 py-[22px] border-b border-white/[0.06]">
        <div
          className="w-9 h-9 rounded-[8px] grid place-items-center flex-shrink-0"
          style={{
            background: '#00B09C',
            boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.15)',
          }}
        >
          {/* FFIS shield mark */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B1B2E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <div>
          <div className="font-cond font-bold text-[20px] text-white leading-[1.05] tracking-[0.02em]">
            ARB <span style={{ color: '#00B09C' }}>AI</span> Agent
          </div>
          <div className="font-cond text-[11px] uppercase tracking-[0.22em] text-white/[0.45] mt-[2px]">
            {brand.company}
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto">
        <RailSection
          title={isSA ? 'Architect' : 'Reviewer'}
          items={primaryItems}
          currentPath={currentPath}
        />
        {workspaceItems.length > 0 && (
          <RailSection title="Workspace" items={workspaceItems} currentPath={currentPath} />
        )}
        {adminItems.length > 0 && (
          <RailSection title="Administration" items={adminItems} currentPath={currentPath} />
        )}
      </div>

      {/* User profile */}
      <div className="flex items-center gap-[10px] px-[14px] py-[14px] border-t border-white/[0.07]" style={{ paddingBottom: 18 }}>
        <div
          className="w-[34px] h-[34px] rounded-full grid place-items-center flex-shrink-0 font-cond font-bold text-[13px] text-navy-900"
          style={{ background: 'linear-gradient(135deg, #00B09C, #D98A00)' }}
        >
          {initials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-medium text-white truncate">{name}</div>
          <div className="font-cond text-[12px] uppercase tracking-[0.14em] text-teal-500 leading-tight">
            {displayRole}
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          className="w-8 h-8 flex items-center justify-center rounded-[8px] text-white/60 hover:text-white hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer flex-shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
