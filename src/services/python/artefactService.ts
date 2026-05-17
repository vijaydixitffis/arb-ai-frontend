import { brand } from '../../brand.config'
import { apiRequest } from './api'

export interface ArtefactUploadData {
  review_id: string
  domain_slug: string
  artefact_name: string
  artefact_type: string
  file: File
}

export interface ArtefactResponse {
  id: string
  review_id: string
  domain_slug: string
  artefact_name: string
  artefact_type: string
  filename: string
  file_type?: string
  file_size_bytes?: number
  uploaded_at: string
  is_active: boolean
}

export interface ArtefactChunkResponse {
  id: string
  artefact_id: string
  review_id: string
  filename?: string
  chunk_index: number
  chunk_text: string
  created_at: string
}

export const artefactService = {
  /**
   * Upload an artefact to a specific domain for a review
   */
  async uploadArtefact(data: ArtefactUploadData): Promise<ArtefactResponse> {
    const formData = new FormData()
    formData.append('review_id', data.review_id)
    formData.append('domain_slug', data.domain_slug)
    formData.append('artefact_name', data.artefact_name)
    formData.append('artefact_type', data.artefact_type)
    formData.append('file', data.file)
    
    const response = await fetch(`${brand.apiRoot}/artefacts/artefacts/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    return await response.json()
  },

  /**
   * Get all artefacts for a review
   */
  async getReviewArtefacts(reviewId: string): Promise<ArtefactResponse[]> {
    return await apiRequest(`/artefacts/artefacts/review/${reviewId}`)
  },

  /**
   * Get artefact chunks for a review (with optional domain filter)
   */
  async getReviewChunks(
    reviewId: string, 
    domainSlug?: string, 
    limit: number = 50
  ): Promise<ArtefactChunkResponse[]> {
    let url = `/artefacts/chunks/${reviewId}?limit=${limit}`
    if (domainSlug) {
      url += `&domain_slug=${domainSlug}`
    }
    return await apiRequest(url)
  },

  /**
   * Upload multiple artefacts for different domains
   */
  async uploadMultipleArtefacts(
    reviewId: string,
    artefacts: { domain: string; name: string; type: string; file: File }[]
  ): Promise<ArtefactResponse[]> {
    const uploadPromises = artefacts.map(artefact =>
      this.uploadArtefact({
        review_id: reviewId,
        domain_slug: artefact.domain,
        artefact_name: artefact.name,
        artefact_type: artefact.type,
        file: artefact.file
      })
    )

    return await Promise.all(uploadPromises)
  },

  /**
   * Delete an artefact
   */
  async deleteArtefact(artefactId: string): Promise<void> {
    await apiRequest(`/artefacts/artefacts/${artefactId}`, {
      method: 'DELETE'
    })
  }
}
