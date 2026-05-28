import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronRight, Search, HelpCircle, Bell } from 'lucide-react'

// ── Breadcrumb map ────────────────────────────────────────────────────────────

function buildCrumbs(pathname: string): string[] {
  // Normalise away the basename if present
  const p = pathname.replace(/^\/arb-ai-agent/, '') || '/'

  if (p === '/' || p === '/dashboard') return ['ARB AI Agent', 'Pipeline']
  if (p.startsWith('/submission/new'))  return ['ARB AI Agent', 'Pipeline', 'New EA review']
  if (p.startsWith('/earr/new'))        return ['ARB AI Agent', 'Pipeline', 'New EA review']
  if (p.startsWith('/earr/edit'))       return ['ARB AI Agent', 'Pipeline', 'Edit submission']
  if (p.startsWith('/review-status'))   return ['ARB AI Agent', 'Pipeline', 'Review status']
  if (p.startsWith('/review/'))         return ['ARB AI Agent', 'Pipeline', 'Review dossier']
  if (p === '/admin')                   return ['ARB AI Agent', 'Administration']
  if (p.startsWith('/admin/users'))     return ['ARB AI Agent', 'Administration', 'Users']
  if (p.startsWith('/admin/config'))    return ['ARB AI Agent', 'Administration', 'System config']
  if (p.startsWith('/admin/domains'))   return ['ARB AI Agent', 'Administration', 'Domains']
  if (p.startsWith('/admin/checklist')) return ['ARB AI Agent', 'Administration', 'Checklist']
  if (p.startsWith('/admin/analytics')) return ['ARB AI Agent', 'Workspace', 'Analytics']
  if (p.startsWith('/admin/audit-log')) return ['ARB AI Agent', 'Workspace', 'Audit log']
  if (p.startsWith('/admin/prompts'))   return ['ARB AI Agent', 'Administration', 'Prompts']
  if (p.startsWith('/admin/kb'))        return ['ARB AI Agent', 'Workspace', 'Knowledge base']
  return ['ARB AI Agent']
}

// ── Topbar ────────────────────────────────────────────────────────────────────

export default function Topbar() {
  const location = useLocation()
  const crumbs = buildCrumbs(location.pathname)
  const [query, setQuery] = useState('')

  return (
    <header
      className="flex items-center gap-[14px] px-7 flex-shrink-0"
      style={{
        height: 56,
        background: '#fff',
        borderBottom: '1px solid #D9E2EA',
      }}
    >
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-[14.5px] text-ink-500 flex-1 min-w-0">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2 min-w-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-ink-300" />}
            {i === crumbs.length - 1
              ? <strong className="text-ink-700 font-semibold truncate">{c}</strong>
              : <span className="truncate">{c}</span>
            }
          </span>
        ))}
      </nav>

      {/* Global search */}
      <div className="relative flex-shrink-0" style={{ width: 280 }}>
        <Search
          className="absolute left-[11px] top-1/2 -translate-y-1/2 text-ink-400"
          style={{ width: 14, height: 14 }}
        />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search submissions, ADRs, findings…"
          className="w-full h-[34px] rounded-[8px] border border-line bg-paper text-[14px] text-ink-700 outline-none pl-8 pr-3 focus:border-turquoise-500 focus:bg-white transition-colors"
          style={{ fontFamily: 'inherit' }}
        />
      </div>

      {/* Icon buttons */}
      <button
        title="Help"
        className="w-[34px] h-[34px] rounded-[8px] grid place-items-center text-ink-500 bg-paper border border-line hover:bg-paper-2 transition-colors flex-shrink-0"
      >
        <HelpCircle style={{ width: 16, height: 16 }} />
      </button>

      <button
        title="Notifications"
        className="relative w-[34px] h-[34px] rounded-[8px] grid place-items-center text-ink-500 bg-paper border border-line hover:bg-paper-2 transition-colors flex-shrink-0"
      >
        <Bell style={{ width: 16, height: 16 }} />
        {/* Unread indicator — static for now, wire to notification service when ready */}
        <span
          className="absolute top-[6px] right-[6px] w-[7px] h-[7px] rounded-full bg-turquoise-500"
          style={{ border: '1.5px solid #fff' }}
        />
      </button>
    </header>
  )
}
