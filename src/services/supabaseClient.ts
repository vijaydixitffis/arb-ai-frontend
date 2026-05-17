import { createClient } from '@supabase/supabase-js'

// Get Supabase configuration from environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration is missing. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper functions for Supabase operations
export const supabaseService = {
  // Authentication
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  // Database operations
  async get(table: string, filters: any = {}, select: string = '*', limit: number | null = null) {
    let query = supabase.from(table).select(select)
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value)
    })
    
    if (limit) {
      query = query.limit(limit)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data
  },

  async insert(table: string, data: any) {
    const { data: result, error } = await supabase.from(table).insert(data).select()
    if (error) throw error
    return result?.[0]
  },

  async update(table: string, id: string, data: any) {
    const { data: result, error } = await supabase.from(table).update(data).eq('id', id).select()
    if (error) throw error
    return result?.[0]
  },

  // Storage operations
  async uploadFile(bucket: string, path: string, file: File) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) throw error
    return data
  },

  async getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    return data.publicUrl
  },

  async deleteFile(bucket: string, paths: string[]) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(paths)
    
    if (error) throw error
    return data
  },

  // Edge Functions
  async callEdgeFunction(functionName: string, payload: any) {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload
    })
    
    if (error) throw error
    return data
  },

  // ARB Review specific functions
  async triggerARBReview(reviewId: string, checklistData: any) {
    return await this.callEdgeFunction('arb-review', {
      action: 'trigger_review',
      reviewId,
      checklistData,
      llmProvider: import.meta.env.VITE_LLM_PROVIDER || 'openai'
    })
  },

  async getReviewStatus(reviewId: string) {
    return await this.callEdgeFunction('arb-review', {
      action: 'get_status',
      reviewId
    })
  },

  async uploadArtefact(reviewId: string, domainSlug: string, artefactName: string, artefactType: string, file: File) {
    try {
      // Upload file to storage
      const filePath = `${reviewId}/${domainSlug}/${file.name}`
      await this.uploadFile('artefacts', filePath, file)
      
      // Get public URL
      const publicUrl = await this.getPublicUrl('artefacts', filePath)
      
      // Create database record
      const artefactData = {
        review_id: reviewId,
        domain_slug: domainSlug,
        artefact_name: artefactName,
        artefact_type: artefactType,
        filename: file.name,
        file_type: file.type,
        file_size_bytes: file.size,
        storage_url: publicUrl,
        storage_path: filePath,
        is_active: true,
        created_at: new Date().toISOString()
      }
      
      const result = await this.insert('artefacts', artefactData)
      return result
    } catch (error) {
      console.error('Failed to upload artefact:', error)
      throw error
    }
  },

  async getReviewArtefacts(reviewId: string) {
    return await this.get('artefacts', { review_id: reviewId })
  },

  async getArtefactChunks(reviewId: string, domainSlug?: string, limit: number = 50) {
    const filters: any = { review_id: reviewId }
    if (domainSlug) {
      filters.domain_slug = domainSlug
    }
    
    return await this.get('artefact_chunks', filters, 'id,review_id,filename,chunk_index,chunk_text,created_at', limit)
  },

  async searchKnowledgeBase(query: string, category?: string, limit: number = 5) {
    const filters: any = { is_active: true }
    if (category) {
      filters.category = category
    }
    
    return await this.get('knowledge_base', filters, 'id,title,content,category,principle_id,created_at', limit)
  },

  async getReviews(userId?: string) {
    const filters: any = {}
    if (userId) {
      filters.sa_user_id = userId
    }
    
    return await this.get('reviews', filters, 'id,created_at,submitted_at,reviewed_at,sa_user_id,solution_name,scope_tags,status,decision,report_json')
  },

  async getReview(reviewId: string) {
    const reviews = await this.get('reviews', { id: reviewId })
    return reviews?.[0]
  },

  async updateReview(reviewId: string, data: any) {
    return await this.update('reviews', reviewId, {
      ...data,
      updated_at: new Date().toISOString()
    })
  },

  async createReview(data: any) {
    const reviewData = {
      ...data,
      created_at: new Date().toISOString(),
      status: 'drafting'
    }

    return await this.insert('reviews', reviewData)
  }
}

// Export types for TypeScript
export interface ArtefactRecord {
  id: string
  review_id: string
  domain_slug: string
  artefact_name: string
  artefact_type: string
  filename: string
  file_type: string
  file_size_bytes: number
  storage_url: string
  storage_path: string
  is_active: boolean
  created_at: string
}

export interface ReviewRecord {
  id: string
  created_at: string
  submitted_at: string | null
  reviewed_at: string | null
  sa_user_id: string
  solution_name: string
  scope_tags: string[]
  status: string
  decision: string | null
  report_json: any
}

export interface KnowledgeBaseRecord {
  id: string
  title: string
  content: string
  category: string
  principle_id: string | null
  created_at: string
}
