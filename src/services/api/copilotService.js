/**
 * Product Copilot Service
 * Connects chat interface to backend Copilot endpoint or deterministic workspace context assistant.
 */
import { apiClient } from './apiClient'
import { API_ENDPOINTS } from './types'
import { queryCopilot } from '../aiSimulationService'

export const copilotService = {
  /**
   * Send user message to Copilot with workspace context
   */
  async sendMessage(query, context = {}) {
    if (apiClient.isConfigured()) {
      return apiClient.post(API_ENDPOINTS.COPILOT.CHAT, {
        query,
        context,
      })
    }

    // Local deterministic contextual response in Demo Mode
    try {
      const responseText = queryCopilot(query, context)
      // Extract evidence links from context matching query terms
      const evidence = extractEvidenceLinks(query, context)

      return {
        success: true,
        data: {
          id: `msg-bot-${Date.now()}`,
          sender: 'assistant',
          text: responseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isDemo: true,
          evidence,
        },
        isDemo: true,
        status: 200,
      }
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to process Copilot query',
        status: 500,
        isDemo: true,
      }
    }
  },

  async getChatHistory(sessionId) {
    if (apiClient.isConfigured()) {
      return apiClient.get(API_ENDPOINTS.COPILOT.HISTORY, {
        params: { sessionId },
      })
    }
    return { success: true, data: null, isDemo: true, status: 200 }
  },
}

function extractEvidenceLinks(query, context = {}) {
  const q = (query || '').toLowerCase()
  const evidence = []

  if (q.includes('feedback') || q.includes('pain') || q.includes('customer')) {
    evidence.push({
      type: 'feedback',
      label: 'Related Feedback Explorer',
      path: '/feedback',
      count: context.feedback?.length || 0,
    })
  }
  if (q.includes('priorit') || q.includes('score') || q.includes('rank')) {
    evidence.push({
      type: 'prioritization',
      label: 'Feature Prioritization Matrix',
      path: '/prioritization',
      count: context.features?.length || 0,
    })
  }
  if (q.includes('prd') || q.includes('spec') || q.includes('requirement')) {
    evidence.push({
      type: 'prd',
      label: 'PRD Specifications Studio',
      path: '/prd-generator',
    })
  }
  if (q.includes('roadmap') || q.includes('milestone') || q.includes('release')) {
    evidence.push({
      type: 'roadmap',
      label: 'Execution Roadmap',
      path: '/roadmap',
    })
  }
  if (q.includes('metric') || q.includes('analytics') || q.includes('usage') || q.includes('drop-off')) {
    evidence.push({
      type: 'analytics',
      label: 'Product Analytics & Funnels',
      path: '/analytics',
    })
  }

  return evidence
}

export default copilotService
