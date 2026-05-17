import { reviewService, type DraftData } from './python/reviewService'
import { supabaseService } from './supabaseClient'
import { apiRequest } from './python/api'
import { brand } from '../brand.config'

// Get backend type from environment
const backendType = import.meta.env.VITE_BACKEND_TYPE || 'python'

// Define interfaces for backend responses
interface ReviewStatus {
  id: string
  status: 'drafting' | 'queued' | 'analysing' | 'review_ready' | 'ea_reviewing' | 'returned' | 'approved' | 'conditionally_approved' | 'deferred' | 'rejected' | 'closed' | string
  decision: string | null
  report_json: any
  domain_scores: any[]
  findings: any[]
  adrs: any[]
  actions: any[]
  submitted_at: string | null
  reviewed_at: string | null
}

interface ReviewData {
  solution_name: string
  scope_tags: string[]
  sa_user_id: string
  llm_model?: string
}


interface ReviewResult {
  success: boolean
  reviewId: string
  report: any
  decision: string
}

// Unified backend service that routes to appropriate backend
export const backendService = {
  // Authentication
  async login(email: string, password: string) {
    if (backendType === 'supabase') {
      return await supabaseService.signIn(email, password)
    } else {
      // Python backend uses token-based auth, login handled by API
      return await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })
    }
  },

  async signOut() {
    if (backendType === 'supabase') {
      return await supabaseService.signOut()
    } else {
      localStorage.removeItem('token')
      // Python backend doesn't have explicit sign out
    }
  },

  async getCurrentUser() {
    if (backendType === 'supabase') {
      return await supabaseService.getCurrentUser()
    } else {
      // Get current user from token
      const token = localStorage.getItem('token')
      if (token) {
        return await apiRequest('/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }
      return null
    }
  },

  // Reviews
  async getReviews(userId?: string) {
    if (backendType === 'supabase') {
      return await supabaseService.getReviews(userId)
    } else {
      return await reviewService.getUserReviews(userId)
    }
  },

  async getReview(reviewId: string): Promise<ReviewStatus> {
    if (backendType === 'supabase') {
      try {
        const status = await supabaseService.getReview(reviewId)
        return {
          id: (status as any).id,
          status: (status as any).status,
          decision: (status as any).decision,
          report_json: (status as any).report_json,
          domain_scores: (status as any).domain_scores || [],
          findings: (status as any).findings || [],
          adrs: (status as any).adrs || [],
          actions: (status as any).actions || [],
          submitted_at: (status as any).submitted_at,
          reviewed_at: (status as any).reviewed_at
        }
      } catch (error) {
        // Return default status on error
        return {
          id: reviewId,
          status: 'pending',
          decision: null,
          report_json: null,
          domain_scores: [],
          findings: [],
          adrs: [],
          actions: [],
          submitted_at: null,
          reviewed_at: null
        }
      }
    } else {
      return await reviewService.getReviewStatus(reviewId)
    }
  },

  async getReviewStatus(reviewId: string): Promise<ReviewStatus> {
    if (backendType === 'supabase') {
      try {
        const status = await supabaseService.getReview(reviewId)
        return {
          id: (status as any).id,
          status: (status as any).status,
          decision: (status as any).decision,
          report_json: (status as any).report_json,
          domain_scores: (status as any).domain_scores || [],
          findings: (status as any).findings || [],
          adrs: (status as any).adrs || [],
          actions: (status as any).actions || [],
          submitted_at: (status as any).submitted_at,
          reviewed_at: (status as any).reviewed_at
        }
      } catch (error) {
        // Return default status on error
        return {
          id: reviewId,
          status: 'pending',
          decision: null,
          report_json: null,
          domain_scores: [],
          findings: [],
          adrs: [],
          actions: [],
          submitted_at: null,
          reviewed_at: null
        }
      }
    } else {
      return await reviewService.getReviewStatus(reviewId)
    }
  },

  async createReview(data: ReviewData) {
    if (backendType === 'supabase') {
      return await supabaseService.createReview(data)
    } else {
      return await reviewService.createReview(data)
    }
  },

  async updateReview(reviewId: string, data: any) {
    if (backendType === 'supabase') {
      return await supabaseService.updateReview(reviewId, data)
    } else {
      return await reviewService.updateDraft(reviewId, data)
    }
  },

  async uploadArtefacts(reviewId: string, artefacts: any[], domain?: string, type?: string) {
    if (backendType === 'supabase') {
      // Supabase service doesn't have uploadArtefact, return placeholder
      return { success: true }
    } else {
      return await reviewService.uploadArtefacts(reviewId, artefacts)
    }
  },

  async getReviewArtefacts(reviewId: string) {
    if (backendType === 'supabase') {
      return await supabaseService.getReviewArtefacts(reviewId)
    } else {
      return await reviewService.getReviewArtefacts(reviewId)
    }
  },

  async getArtefactChunks(reviewId: string, domainSlug: string, limit: number) {
    if (backendType === 'supabase') {
      // Supabase service doesn't have getArtefactChunks, return placeholder
      return []
    } else {
      // Review service doesn't have getArtefactChunks, return placeholder
      return []
    }
  },

  async markReadyForReview(reviewId: string): Promise<void> {
    if (backendType !== 'supabase') {
      await reviewService.markReadyForReview(reviewId)
    }
  },

  async triggerReviewOrchestrator(reviewId: string): Promise<ReviewResult> {
    if (backendType === 'supabase') {
      return await supabaseService.triggerARBReview(reviewId, {})
    } else {
      return await reviewService.triggerReviewOrchestrator(reviewId)
    }
  },

  // Knowledge Base
  async searchKnowledgeBase(query: string, category?: string, limit?: number) {
    if (backendType === 'supabase') {
      // Supabase service doesn't have searchKnowledgeBase, return placeholder
      return []
    } else {
      // Python backend doesn't have direct knowledge base search
      return []
    }
  },

  async populateKnowledgeBase(reviewId: string) {
    if (backendType === 'supabase') {
      // Supabase service doesn't have populateKnowledgeBase, return placeholder
      return { success: true }
    } else {
      // Python backend doesn't have direct knowledge base population
      return { success: true }
    }
  },

  // Draft management
  async createDraft(data: DraftData) {
    if (backendType === 'supabase') {
      // Supabase service doesn't have createDraft, return placeholder
      return { success: true }
    } else {
      return await reviewService.createDraft(data)
    }
  },

  async updateDraft(reviewId: string, data: Partial<DraftData>) {
    if (backendType === 'supabase') {
      // Supabase service doesn't have updateDraft, return placeholder
      return { success: true }
    } else {
      return await reviewService.updateDraft(reviewId, data)
    }
  },

  async getDraft(reviewId: string) {
    if (backendType === 'supabase') {
      // Supabase service doesn't have getDraft, return placeholder
      return null
    } else {
      return await reviewService.loadDraftData(reviewId)
    }
  },

  async getArtifactDownloadUrl(reviewId: string, fileName: string) {
    if (backendType === 'supabase') {
      // Supabase service doesn't have getArtifactDownloadUrl, return placeholder
      return `${brand.apiRoot}/reviews/${reviewId}/artifact/${fileName}`
    } else {
      return await reviewService.getArtifactDownloadUrl(reviewId, fileName)
    }
  },

  // Override functions
  async overrideReview(reviewId: string, decision: string, rationale: string) {
    if (backendType === 'supabase') {
      // Supabase service doesn't have updateReview, return placeholder
      return { success: true }
    } else {
      // Review service doesn't have overrideReview, return placeholder
      return { success: true }
    }
  }
}

// Export services for direct access
export { reviewService }
export { supabaseService }

// Export backend type for components to check
export const isSupabaseBackend = () => backendType === 'supabase'
export const isPythonBackend = () => backendType === 'python'
