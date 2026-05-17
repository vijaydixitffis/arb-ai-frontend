import { create } from 'zustand'
import { adminService } from '../services/backendConfig'
import type {
  ConfigGrouped, AdminUser, AdminDomain,
  AnalyticsSummary, DomainAnalytics, RecentReview, AuditLogEntry,
} from '../types/admin'

interface AdminState {
  // Config
  config: ConfigGrouped
  configLoading: boolean
  loadConfig: () => Promise<void>
  updateConfig: (key: string, value: any, reason?: string) => Promise<void>

  // Users
  users: AdminUser[]
  usersLoading: boolean
  loadUsers: () => Promise<void>

  // Domains
  domains: AdminDomain[]
  domainsLoading: boolean
  loadDomains: () => Promise<void>

  // Analytics
  summary: AnalyticsSummary | null
  domainAnalytics: DomainAnalytics[]
  recentReviews: RecentReview[]
  analyticsLoading: boolean
  loadAnalytics: () => Promise<void>

  // Audit log
  auditLog: AuditLogEntry[]
  auditLoading: boolean
  loadAuditLog: () => Promise<void>

  // Generic error
  error: string | null
  clearError: () => void
}

export const useAdminStore = create<AdminState>((set, get) => ({
  config: {},
  configLoading: false,
  loadConfig: async () => {
    set({ configLoading: true, error: null })
    try {
      const config = await adminService.getConfig()
      set({ config, configLoading: false })
    } catch (e: any) {
      set({ configLoading: false, error: e.message })
    }
  },
  updateConfig: async (key, value, reason) => {
    await adminService.updateConfig(key, value, reason)
    await get().loadConfig()
  },

  users: [],
  usersLoading: false,
  loadUsers: async () => {
    set({ usersLoading: true, error: null })
    try {
      const users = await adminService.listUsers()
      set({ users, usersLoading: false })
    } catch (e: any) {
      set({ usersLoading: false, error: e.message })
    }
  },

  domains: [],
  domainsLoading: false,
  loadDomains: async () => {
    set({ domainsLoading: true, error: null })
    try {
      const domains = await adminService.listDomains(true)
      set({ domains, domainsLoading: false })
    } catch (e: any) {
      set({ domainsLoading: false, error: e.message })
    }
  },

  summary: null,
  domainAnalytics: [],
  recentReviews: [],
  analyticsLoading: false,
  loadAnalytics: async () => {
    set({ analyticsLoading: true, error: null })
    try {
      const [summary, domainAnalytics, recentReviews] = await Promise.all([
        adminService.getAnalyticsSummary(),
        adminService.getDomainAnalytics(),
        adminService.getRecentReviews(20),
      ])
      set({ summary, domainAnalytics, recentReviews, analyticsLoading: false })
    } catch (e: any) {
      set({ analyticsLoading: false, error: e.message })
    }
  },

  auditLog: [],
  auditLoading: false,
  loadAuditLog: async () => {
    set({ auditLoading: true, error: null })
    try {
      const auditLog = await adminService.getAuditLog(100, 0)
      set({ auditLog, auditLoading: false })
    } catch (e: any) {
      set({ auditLoading: false, error: e.message })
    }
  },

  error: null,
  clearError: () => set({ error: null }),
}))
