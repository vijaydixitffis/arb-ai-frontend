import { useEffect, useState } from 'react'
import { Users, Plus, Pencil, UserX, KeyRound, CheckCircle, XCircle, Shield } from 'lucide-react'
import { useAdminStore } from '../../stores/adminStore'
import { adminService } from '../../services/backendConfig'
import { ALL_ROLES } from '../../types/admin'
import type { AdminUser, UserCreatePayload, UserRole } from '../../types/admin'

const ROLE_LABEL: Record<string, string> = {
  solution_architect: 'Solution Architect',
  enterprise_architect: 'Enterprise Architect',
  arb_admin: 'ARB Admin',
  super_admin: 'Super Admin',
}

const ROLE_BADGE: Record<string, string> = {
  solution_architect:  'bg-blue-100 text-blue-700',
  enterprise_architect:'bg-purple-100 text-purple-700',
  arb_admin:           'bg-teal-100 text-teal-700',
  super_admin:         'bg-amber-100 text-amber-700',
}

interface DrawerProps {
  user?: AdminUser | null
  onClose: () => void
  onSave: () => void
}

function UserDrawer({ user, onClose, onSave }: DrawerProps) {
  const isEdit = !!user
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>(user?.role ?? 'solution_architect')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    try {
      if (isEdit && user) {
        await adminService.updateUser(user.id, { role: role as any, is_active: isActive })
        if (password) await adminService.resetPassword(user.id, password)
      } else {
        const payload: UserCreatePayload = { email, password, role: role as any, is_active: isActive }
        await adminService.createUser(payload)
      }
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
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? 'Edit User' : 'Create User'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="user@org.com"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {isEdit ? 'New Password (leave blank to keep)' : 'Password'}
            </label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••"
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <select value={role} onChange={e => setRole(e.target.value as UserRole)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
              {ALL_ROLES.filter(r => r !== 'super_admin').map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-teal-600" />
            <label htmlFor="isActive" className="text-sm text-slate-700">Active account</label>
          </div>
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 h-10 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const { users, usersLoading, loadUsers } = useAdminStore()
  const [drawerUser, setDrawerUser] = useState<AdminUser | null | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [deactivating, setDeactivating] = useState<string | null>(null)

  useEffect(() => { loadUsers() }, [])

  const filtered = users.filter(u =>
    u.role !== 'super_admin' && (
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (ROLE_LABEL[u.role] ?? u.role).toLowerCase().includes(search.toLowerCase())
    )
  )

  const handleDeactivate = async (userId: string) => {
    if (!confirm('Deactivate this user? They will no longer be able to log in.')) return
    setDeactivating(userId)
    try {
      await adminService.deactivateUser(userId)
      await loadUsers()
    } finally {
      setDeactivating(null)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          </div>
          <p className="text-slate-500 text-sm ml-12">Manage user accounts and role assignments</p>
        </div>
        <button
          onClick={() => setDrawerUser(null)}
          className="flex items-center gap-2 px-4 h-10 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700"
        >
          <Plus className="w-4 h-4" /> New User
        </button>
      </div>

      <div className="mb-4">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or role…"
          className="w-full max-w-sm h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {usersLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
          Loading users…
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Login</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE[u.role] ?? 'bg-slate-100 text-slate-600'}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active
                      ? <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle className="w-3 h-3" />Active</span>
                      : <span className="flex items-center gap-1 text-red-500 text-xs font-medium"><XCircle className="w-3 h-3" />Inactive</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setDrawerUser(u)} title="Edit user"
                        className="p-1.5 hover:bg-teal-50 rounded text-slate-400 hover:text-teal-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {u.is_active && (
                        <button onClick={() => handleDeactivate(u.id)} disabled={deactivating === u.id} title="Deactivate"
                          className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40">
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {drawerUser !== undefined && (
        <UserDrawer user={drawerUser} onClose={() => setDrawerUser(undefined)} onSave={loadUsers} />
      )}
    </div>
  )
}
