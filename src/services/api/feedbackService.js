/**
 * Customer Feedback Service
 * Manages feedback CRUD, batch import, filtering, and classification status.
 */
import { apiClient } from './apiClient'
import { API_ENDPOINTS } from './types'

export const feedbackService = {
  async getFeedbackList(params = {}) {
    if (apiClient.isConfigured()) {
      return apiClient.get(API_ENDPOINTS.FEEDBACK.LIST, { params })
    }
    return {
      success: true,
      data: null, // caller uses local state when offline/demo
      isDemo: true,
      status: 200,
    }
  },

  async createFeedback(feedbackItem) {
    if (apiClient.isConfigured()) {
      return apiClient.post(API_ENDPOINTS.FEEDBACK.CREATE, feedbackItem)
    }
    return {
      success: true,
      data: feedbackItem,
      isDemo: true,
      status: 201,
    }
  },

  async updateFeedback(id, updates) {
    if (apiClient.isConfigured()) {
      return apiClient.put(API_ENDPOINTS.FEEDBACK.UPDATE(id), updates)
    }
    return {
      success: true,
      data: { id, ...updates },
      isDemo: true,
      status: 200,
    }
  },

  async deleteFeedback(id) {
    if (apiClient.isConfigured()) {
      return apiClient.delete(API_ENDPOINTS.FEEDBACK.DELETE(id))
    }
    return {
      success: true,
      data: { id },
      isDemo: true,
      status: 200,
    }
  },

  async batchImportFeedback(items) {
    if (apiClient.isConfigured()) {
      return apiClient.post(API_ENDPOINTS.FEEDBACK.BATCH_IMPORT, { items })
    }
    return {
      success: true,
      data: items,
      isDemo: true,
      status: 200,
    }
  },
}

export default feedbackService
