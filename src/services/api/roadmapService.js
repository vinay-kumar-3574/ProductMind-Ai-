/**
 * Product Roadmap Service
 */
import { apiClient } from './apiClient'
import { API_ENDPOINTS } from './types'

export const roadmapService = {
  async getMilestones() {
    if (apiClient.isConfigured()) {
      return apiClient.get(API_ENDPOINTS.ROADMAP.MILESTONES)
    }
    return { success: true, data: null, isDemo: true, status: 200 }
  },

  async updateMilestone(id, updates) {
    if (apiClient.isConfigured()) {
      return apiClient.put(API_ENDPOINTS.ROADMAP.UPDATE(id), updates)
    }
    return { success: true, data: { id, ...updates }, isDemo: true, status: 200 }
  },
}

export default roadmapService
