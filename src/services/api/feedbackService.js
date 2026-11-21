/**
 * ProductMind AI — Customer Feedback Service
 * Real FastAPI & MongoDB integration for feedback ingestion and AI Feedback Intelligence analysis.
 */
import { apiClient, getActiveWorkspaceId } from './apiClient'
import { API_ENDPOINTS } from './types'

function normalizeCategory(cat) {
  if (!cat || cat === 'All' || cat === '—') return undefined
  const c = String(cat).toLowerCase().replace(/_/g, ' ').trim()
  const map = {
    'performance': 'Performance',
    'integrations': 'Integrations',
    'usability': 'Usability',
    'reliability': 'Reliability',
    'pricing': 'Pricing',
    'satisfaction': 'Satisfaction',
    'feature requests': 'Feature Requests',
    'feature request': 'Feature Requests',
    'general': 'General',
  }
  return map[c] || 'Feature Requests'
}

function normalizeSentiment(sent) {
  if (!sent || sent === 'All' || sent === '—') return undefined
  const s = String(sent).toLowerCase().trim()
  if (s === 'positive') return 'Positive'
  if (s === 'negative') return 'Negative'
  return 'Neutral'
}

function normalizePriority(prio) {
  if (!prio || prio === 'All' || prio === '—') return undefined
  const p = String(prio).toLowerCase().trim()
  if (p === 'urgent') return 'Urgent'
  if (p === 'high') return 'High'
  if (p === 'medium') return 'Medium'
  if (p === 'low') return 'Low'
  return 'Medium'
}

export const feedbackService = {
  /**
   * Fetch feedback items for the active workspace
   */
  async getFeedbackList(params = {}) {
    const workspaceId = params.workspaceId || getActiveWorkspaceId()
    const queryParams = { ...params }
    if (workspaceId) {
      queryParams.workspaceId = workspaceId
    }

    const response = await apiClient.get(API_ENDPOINTS.FEEDBACK.LIST, {
      params: queryParams,
    })
    return response.data
  },

  /**
   * Create a manual feedback or support ticket item in the active workspace
   */
  async createFeedback(feedbackItem) {
    const workspaceId = feedbackItem.workspaceId || getActiveWorkspaceId()
    if (!workspaceId) {
      throw new Error('No active workspace selected.')
    }

    const externalId =
      feedbackItem.external_id ||
      feedbackItem.externalId ||
      `fb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    const sourceType = feedbackItem.source_type || feedbackItem.sourceType || 'manual'
    const cat = normalizeCategory(feedbackItem.category)
    const sent = normalizeSentiment(feedbackItem.sentiment)
    const prio = normalizePriority(feedbackItem.priority || feedbackItem.source_priority)

    // Map UI model to backend FeedbackItemCreate schema
    const payload = {
      title: feedbackItem.title,
      description: feedbackItem.description || feedbackItem.title,
      source_type: sourceType,
      external_id: externalId,
      customer_name: feedbackItem.customer || feedbackItem.customer_name || 'Anonymous Customer',
      customer_email: feedbackItem.customer_email || 'feedback@example.com',
      company_name: feedbackItem.company || feedbackItem.company_name || 'Independent Client',
      tags: feedbackItem.tags || [],
      ...(cat ? { category: cat } : {}),
      ...(sent ? { sentiment: sent } : {}),
      ...(prio ? { source_priority: prio } : {}),
    }

    const response = await apiClient.post(
      `${API_ENDPOINTS.FEEDBACK.CREATE}?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload,
      {
        headers: {
          'Idempotency-Key': externalId,
        },
      }
    )
    return response.data
  },

  /**
   * Batch ingest feedback or support ticket items into the active workspace
   */
  async batchImport(items, workspaceId = null) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) {
      throw new Error('No active workspace selected.')
    }

    const payload = {
      items: items.map((item, idx) => {
        const title = (item.title || 'Untitled Feedback').trim()
        const description = (item.description || title).trim()
        const extId = item.external_id || item.externalId || item.id || `csv-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`
        const cat = normalizeCategory(item.category)
        const sent = normalizeSentiment(item.sentiment)
        const prio = normalizePriority(item.priority || item.source_priority)

        return {
          title: title.length < 3 ? `${title} feedback` : title.slice(0, 300),
          description: description.slice(0, 5000),
          source_type: item.source_type || item.sourceType || 'csv',
          external_id: String(extId).slice(0, 120),
          customer_name: (item.customer_name || item.customer || 'Anonymous Customer').slice(0, 120),
          customer_email: (item.customer_email || item.email || 'feedback@example.com').slice(0, 150),
          company_name: (item.company_name || item.company || 'Enterprise Client').slice(0, 150),
          tags: Array.isArray(item.tags) ? item.tags.slice(0, 50) : [],
          ...(cat ? { category: cat } : {}),
          ...(sent ? { sentiment: sent } : {}),
          ...(prio ? { source_priority: prio } : {}),
        }
      }),
    }

    const response = await apiClient.post(
      `${API_ENDPOINTS.FEEDBACK.BATCH_IMPORT}?workspaceId=${encodeURIComponent(wsId)}`,
      payload
    )
    return response.data
  },

  /**
   * Update feedback record
   */
  async updateFeedback(id, updates) {
    const url = typeof API_ENDPOINTS.FEEDBACK.UPDATE === 'function'
      ? API_ENDPOINTS.FEEDBACK.UPDATE(id)
      : `/api/v1/feedback/${id}`
    const response = await apiClient.put(url, updates)
    return response.data
  },

  /**
   * Delete feedback record
   */
  async deleteFeedback(id, workspaceId = null) {
    const wsId = workspaceId || getActiveWorkspaceId()
    const baseUrl = typeof API_ENDPOINTS.FEEDBACK.DELETE === 'function'
      ? API_ENDPOINTS.FEEDBACK.DELETE(id)
      : `/api/v1/feedback/${id}`
    const url = wsId ? `${baseUrl}?workspaceId=${encodeURIComponent(wsId)}` : baseUrl
    const response = await apiClient.delete(url)
    return response.data
  },

  /**
   * Run real AI Feedback Intelligence Agent analysis on an item
   */
  async analyzeFeedback(feedbackId, forceReanalyze = false) {
    const url = typeof API_ENDPOINTS.AI_FEEDBACK.ANALYZE === 'function'
      ? API_ENDPOINTS.AI_FEEDBACK.ANALYZE(feedbackId)
      : `/api/v1/ai/feedback/${feedbackId}/analyze`
    const response = await apiClient.post(url, { force_reanalyze: forceReanalyze })
    return response.data
  },

  /**
   * Retrieve cached AI analysis for a feedback item without consuming LLM quota
   */
  async getFeedbackAnalysis(feedbackId) {
    const url = typeof API_ENDPOINTS.AI_FEEDBACK.ANALYSIS === 'function'
      ? API_ENDPOINTS.AI_FEEDBACK.ANALYSIS(feedbackId)
      : `/api/v1/ai/feedback/${feedbackId}/analysis`
    const response = await apiClient.get(url)
    return response.data
  },

  /**
   * Batch analyze up to 10 feedback items
   */
  async batchAnalyze(feedbackIds, forceReanalyze = false) {
    const response = await apiClient.post(API_ENDPOINTS.AI_FEEDBACK.BATCH_ANALYZE, {
      feedback_ids: feedbackIds,
      force_reanalyze: forceReanalyze,
    })
    return response.data
  },

  /**
   * Get batch ingestion and AI processing status
   */
  async getBatchStatus(batchId, workspaceId = null) {
    const wsId = workspaceId || getActiveWorkspaceId()
    const response = await apiClient.get(
      `/api/v1/feedback/batch/${batchId}?workspaceId=${encodeURIComponent(wsId)}`
    )
    const data = response.data || {}
    return {
      batchId: data.id || data.batch_id || data.batchId || batchId,
      workspaceId: data.workspaceId || data.workspace_id,
      status: data.status,
      totalRows: data.totalRows ?? data.total_rows ?? 0,
      acceptedRows: data.acceptedRows ?? data.accepted_rows ?? 0,
      rejectedRows: data.rejectedRows ?? data.rejected_rows ?? 0,
      duplicateRows: data.duplicateRows ?? data.duplicate_rows ?? 0,
      aiCompletedRows: data.aiCompletedRows ?? data.ai_completed_rows ?? 0,
      aiQueuedRows: data.aiQueuedRows ?? data.ai_queued_rows ?? 0,
      aiRateLimitedRows: data.aiRateLimitedRows ?? data.ai_rate_limited_rows ?? 0,
      aiFailedRows: data.aiFailedRows ?? data.ai_failed_rows ?? 0,
      raw: data,
    }
  },

  /**
   * Retry failed or rate-limited AI items in a batch
   */
  async retryBatchAi(batchId, workspaceId = null) {
    const wsId = workspaceId || getActiveWorkspaceId()
    const response = await apiClient.post(
      `/api/v1/feedback/batch/${batchId}/retry-failed-ai?workspaceId=${encodeURIComponent(wsId)}`
    )
    const data = response.data || {}
    return {
      batchId: data.batch_id || data.batchId || batchId,
      requeuedRows: data.requeued_rows ?? data.requeuedRows ?? 0,
      message: data.message,
      raw: data,
    }
  },
}

export default feedbackService
