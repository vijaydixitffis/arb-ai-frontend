import { brand } from '../../brand.config'

const API_BASE_URL = brand.apiRoot

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const url = `${API_BASE_URL}${endpoint}`
  const token = localStorage.getItem('token')
  
  console.log('[API-REQUEST] URL:', url)
  console.log('[API-REQUEST] Method:', options.method || 'GET')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    console.log('[API-REQUEST] Sending request...')
    const response = await fetch(url, {
      ...options,
      headers,
    })
    
    console.log('[API-REQUEST] Response status:', response.status)

    if (response.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new Error('Session expired. Please log in again.')
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[API-REQUEST] Error response:', errorText)
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    console.error('[API-REQUEST] Fetch error:', error)
    throw error
  }
}

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    console.log('[API] Attempting login for:', email)
    const params = new URLSearchParams()
    params.append('username', email)
    params.append('password', password)
    
    const url = `${API_BASE_URL}/auth/login`
    console.log('[API] Login URL:', url)
    
    try {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      })
      console.log('[API] Login successful')
      return result
    } catch (error) {
      console.error('[API] Login failed:', error)
      throw error
    }
  },

  getDemoUsers: () =>
    apiRequest('/auth/demo-users'),

  // Submissions
  getSubmissions: () =>
    apiRequest('/submissions'),

  getSubmission: (id: string) =>
    apiRequest(`/submissions/${id}`),

  createSubmission: (data: any) =>
    apiRequest('/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSubmission: (id: string, data: any) =>
    apiRequest(`/submissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  submitSubmission: (id: string) =>
    apiRequest(`/submissions/${id}/submit`, {
      method: 'POST',
    }),

  uploadArtefact: (submissionId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiRequest(`/submissions/${submissionId}/artefacts`, {
      method: 'POST',
      headers: {}, // Let browser set Content-Type for FormData
      body: formData,
    })
  },

  uploadIntegrationCatalogue: (submissionId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiRequest(`/submissions/${submissionId}/integration-catalogue`, {
      method: 'POST',
      headers: {},
      body: formData,
    })
  },

  // Reviews
  getReviews: () =>
    apiRequest('/reviews/'),

  getReview: (id: string) =>
    apiRequest(`/reviews/${id}`),

  getReviewBySubmission: (submissionId: string) =>
    apiRequest(`/reviews/submission/${submissionId}`),

  createReview: (data: any) =>
    apiRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateReview: (id: string, data: any) =>
    apiRequest(`/reviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  approveReview: (id: string, overrideRationale?: string) =>
    apiRequest(`/reviews/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ override_rationale: overrideRationale }),
    }),

  overrideReview: (id: string, decision: string, rationale: string) =>
    apiRequest(`/reviews/${id}/override`, {
      method: 'POST',
      body: JSON.stringify({ decision, rationale }),
    }),

  // Agent
  runARBReview: (submissionData: any) =>
    apiRequest('/agent/review', {
      method: 'POST',
      body: JSON.stringify(submissionData),
    }),

  populateKnowledgeBase: () =>
    apiRequest('/agent/populate-knowledge-base', {
      method: 'POST',
    }),
}
