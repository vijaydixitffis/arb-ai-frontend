import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore, initializeSession } from './stores/authStore'
import { isAdmin, isSuperAdmin } from './types/admin'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import ARBSubmission from './pages/ARBSubmission'
import EARRSubmission from './pages/EARRSubmission'
import ReviewDashboard from './pages/ReviewDashboard'
import ReviewStatus from './pages/ReviewStatus'
import Layout from './components/layout/Layout'
import AdminDashboard from './pages/Admin/AdminDashboard'
import UserManagement from './pages/Admin/UserManagement'
import ConfigSettings from './pages/Admin/ConfigSettings'
import DomainManagement from './pages/Admin/DomainManagement'
import ChecklistEditor from './pages/Admin/ChecklistEditor'
import Analytics from './pages/Admin/Analytics'
import AuditLog from './pages/Admin/AuditLog'
import PromptManagement from './pages/Admin/PromptManagement'
import KnowledgeBase from './pages/Admin/KnowledgeBase'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitializing } = useAuthStore()

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RootRedirect() {
  const { user } = useAuthStore()
  if (user?.role === 'super_admin') return <Navigate to="/admin" replace />
  return <Navigate to="/dashboard" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitializing } = useAuthStore()
  if (isInitializing) return null
  if (!user || !isAdmin(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitializing } = useAuthStore()
  if (isInitializing) return null
  if (!user || !isSuperAdmin(user.role)) return <Navigate to="/admin" replace />
  return <>{children}</>
}

function App() {
  const { user, logout, recordActivity, isSessionTimedOut } = useAuthStore()

  useEffect(() => {
    initializeSession()
  }, [])

  // Global activity tracking and inactivity-based session expiry
  useEffect(() => {
    if (!user) return

    const EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const handleActivity = () => {
      // Debounce to avoid hammering localStorage on every mousemove
      if (debounceTimer) return
      debounceTimer = setTimeout(() => {
        recordActivity()
        debounceTimer = null
      }, 5_000)
    }

    EVENTS.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))

    // Check session expiry every 30 seconds while the tab is open
    const expiryCheck = setInterval(() => {
      if (isSessionTimedOut()) {
        logout()
      }
    }, 30_000)

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, handleActivity))
      if (debounceTimer) clearTimeout(debounceTimer)
      clearInterval(expiryCheck)
    }
  }, [user])

  return (
    <BrowserRouter basename="/arb-ai-agent">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<RootRedirect />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="submissions" element={<Dashboard />} />
          <Route path="reviews" element={<Dashboard />} />
          <Route path="settings" element={<div className="p-8"><h1 className="text-2xl font-bold">Settings</h1><p className="text-gray-600 mt-2">Settings page coming soon</p></div>} />
          <Route path="submission/new" element={
            <ProtectedRoute>
              <ARBSubmission />
            </ProtectedRoute>
          } />
          <Route path="earr/new" element={
            <ProtectedRoute>
              <EARRSubmission />
            </ProtectedRoute>
          } />
          <Route path="earr/edit/:reviewId" element={
            <ProtectedRoute>
              <EARRSubmission />
            </ProtectedRoute>
          } />
          <Route path="review/:submissionId" element={
            <ProtectedRoute>
              <ReviewDashboard />
            </ProtectedRoute>
          } />
          <Route path="review-status/:reviewId" element={<ReviewStatus />} />

          {/* Admin routes — arb_admin + super_admin */}
          <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
          <Route path="admin/config" element={<SuperAdminRoute><ConfigSettings /></SuperAdminRoute>} />
          <Route path="admin/domains" element={<AdminRoute><DomainManagement /></AdminRoute>} />
          <Route path="admin/checklist" element={<AdminRoute><ChecklistEditor /></AdminRoute>} />
          <Route path="admin/analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
          <Route path="admin/audit-log" element={<AdminRoute><AuditLog /></AdminRoute>} />

          {/* Super-admin only routes */}
          <Route path="admin/prompts" element={<SuperAdminRoute><PromptManagement /></SuperAdminRoute>} />
          <Route path="admin/kb" element={<SuperAdminRoute><KnowledgeBase /></SuperAdminRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
