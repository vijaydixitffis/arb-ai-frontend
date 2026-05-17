import { useEffect, useState } from 'react'
import { Globe, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { useAdminStore } from '../../stores/adminStore'
import { adminService } from '../../services/backendConfig'
import type { AdminDomain } from '../../types/admin'

interface DrawerProps {
  domain: AdminDomain
  onClose: () => void
  onSave: () => void
}

function DomainDrawer({ domain, onClose, onSave }: DrawerProps) {
  const [name, setName]         = useState(domain.name)
  const [description, setDesc]  = useState(domain.description ?? '')
  const [color, setColor]       = useState(domain.color ?? '')
  const [icon, setIcon]         = useState(domain.icon ?? '')
  const [isActive, setIsActive] = useState(domain.is_active)
  const [reason, setReason]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    try {
      await adminService.updateDomain(domain.id, { name, description, color, icon, is_active: isActive, change_reason: reason })
      onSave()
      onClose()
    } catch (e: any) {
      setErr(e.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Edit Domain</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{domain.slug}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Color</label>
              <input value={color} onChange={e => setColor(e.target.value)} placeholder="#3b82f6"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Icon (emoji)</label>
              <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🏗️"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsActive(!isActive)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-teal-500' : 'bg-slate-200'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-slate-600">{isActive ? 'Active — visible to SA/EA' : 'Inactive — hidden from submissions'}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Change Reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Deprecating legacy domain"
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 h-10 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DomainManagement() {
  const { domains, domainsLoading, loadDomains } = useAdminStore()
  const [editDomain, setEditDomain] = useState<AdminDomain | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => { loadDomains() }, [])

  const handleToggleActive = async (domain: AdminDomain) => {
    setToggling(domain.id)
    try {
      await adminService.updateDomain(domain.id, {
        is_active: !domain.is_active,
        change_reason: `Quick toggle by admin`,
      })
      await loadDomains()
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Domain Management</h1>
      </div>
      <p className="text-slate-500 text-sm mb-6 ml-12">
        Activate, deactivate, and configure architecture review domains.
      </p>

      {domainsLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
          Loading domains…
        </div>
      ) : (
        <div className="space-y-2">
          {domains.map(d => (
            <div key={d.id}
              className={`bg-white border rounded-xl px-5 py-4 flex items-center justify-between gap-4 transition-colors ${d.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <div className="flex items-center gap-4">
                <span className="text-2xl w-8 text-center">{d.icon ?? '🏗️'}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">{d.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{d.description ?? '—'}</p>
                  <p className="text-xs text-slate-300 font-mono mt-0.5">{d.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggleActive(d)}
                  disabled={toggling === d.id}
                  title={d.is_active ? 'Deactivate' : 'Activate'}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
                >
                  {d.is_active
                    ? <ToggleRight className="w-5 h-5 text-teal-600" />
                    : <ToggleLeft className="w-5 h-5 text-slate-400" />
                  }
                </button>
                <button
                  onClick={() => setEditDomain(d)}
                  className="flex items-center gap-1.5 px-3 h-9 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editDomain && (
        <DomainDrawer domain={editDomain} onClose={() => setEditDomain(null)} onSave={loadDomains} />
      )}
    </div>
  )
}
