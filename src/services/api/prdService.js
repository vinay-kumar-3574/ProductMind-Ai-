/**
 * PRD and User Stories Service
 * Handles PRD generation, persistence, updates, and export.
 */
import { apiClient } from './apiClient'
import { API_ENDPOINTS } from './types'
import { generatePRDTemplate } from '../aiSimulationService'

export const prdService = {
  async getPRDs() {
    if (apiClient.isConfigured()) {
      return apiClient.get(API_ENDPOINTS.PRD.LIST)
    }
    return { success: true, data: null, isDemo: true, status: 200 }
  },

  async generatePRD(feature, customTitle = '') {
    if (apiClient.isConfigured()) {
      return apiClient.post(API_ENDPOINTS.PRD.GENERATE, {
        featureId: feature?.id,
        featureName: feature?.name,
        customTitle,
      })
    }

    // Local deterministic template generator for demo mode
    const sections = generatePRDTemplate(feature, customTitle)
    return {
      success: true,
      data: {
        id: `prd-${Date.now()}`,
        title: customTitle || (feature ? `${feature.name} Specification` : 'Product Requirements Document'),
        featureId: feature?.id || null,
        version: '1.0.0',
        status: 'Draft',
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        sections,
      },
      isDemo: true,
      status: 200,
    }
  },

  async updatePRD(id, updates) {
    if (apiClient.isConfigured()) {
      return apiClient.put(API_ENDPOINTS.PRD.UPDATE(id), updates)
    }
    return { success: true, data: { id, ...updates }, isDemo: true, status: 200 }
  },
}

export default prdService
