/**
 * ProductMind AI — Executive Reporting & Intelligence Service
 * Interacts with FastAPI /api/v1/reports/* endpoints to deliver live,
 * Atlas-grounded metrics, saved reports CRUD, structured exports, and AI briefings.
 */
import { apiClient } from './apiClient'
import { API_ENDPOINTS } from './types'

function assertSuccess(res, fallbackMsg = 'Reporting API request failed.') {
  if (res && res.success === false) {
    const err = new Error(res.error || fallbackMsg)
    err.status = res.status || 500
    throw err
  }
}

export const reportingService = {
  /**
   * Fetches unified executive summary, Product Health Score, and domain metrics.
   */
  async getExecutiveSummary({ workspaceId, timeRange = '30d', startDate = null, endDate = null } = {}) {
    if (!workspaceId) throw new Error('workspaceId is required.')
    const params = { workspaceId }
    if (timeRange && timeRange !== 'custom') {
      params.timeRange = timeRange
    }
    if (startDate && endDate) {
      params.startDate = startDate
      params.endDate = endDate
    }

    const res = await apiClient.get(API_ENDPOINTS.REPORTS.EXECUTIVE_SUMMARY, params)
    assertSuccess(res, 'Failed to load executive summary.')
    return res.data || res
  },

  /**
   * Fetches deliverable bottlenecks, overdue milestones, and risk scores.
   */
  async getDeliveryRisk({ workspaceId } = {}) {
    if (!workspaceId) throw new Error('workspaceId is required.')
    const res = await apiClient.get(API_ENDPOINTS.REPORTS.DELIVERY_RISK, { workspaceId })
    assertSuccess(res, 'Failed to load delivery risk report.')
    return res.data || res
  },

  /**
   * Lists saved report configurations for workspace.
   */
  async getSavedReports({ workspaceId, isFavorite = null, limit = 50, skip = 0 } = {}) {
    if (!workspaceId) throw new Error('workspaceId is required.')
    const params = { workspaceId, limit, skip }
    if (typeof isFavorite === 'boolean') {
      params.isFavorite = isFavorite
    }

    const res = await apiClient.get(API_ENDPOINTS.REPORTS.SAVED_LIST, params)
    assertSuccess(res, 'Failed to list saved reports.')
    return res.data || res
  },

  /**
   * Creates a new saved report configuration.
   */
  async createSavedReport({ workspaceId, title, reportType = 'executive_kpi', filters = {}, layoutConfig = [], isFavorite = false }) {
    if (!workspaceId) throw new Error('workspaceId is required.')
    if (!title || !title.trim()) throw new Error('Report title is required.')

    const payload = {
      title: title.trim(),
      reportType,
      filters: filters || { timeRange: '30d' },
      layoutConfig: layoutConfig || ['kpis', 'trends', 'sentiment', 'priorities', 'delivery'],
      isFavorite: Boolean(isFavorite),
    }

    const res = await apiClient.post(`${API_ENDPOINTS.REPORTS.SAVED_CREATE}?workspaceId=${encodeURIComponent(workspaceId)}`, payload)
    assertSuccess(res, 'Failed to create saved report.')
    return res.data || res
  },

  /**
   * Retrieves a single saved report by ID.
   */
  async getSavedReport(reportId, { workspaceId } = {}) {
    if (!workspaceId) throw new Error('workspaceId is required.')
    if (!reportId) throw new Error('reportId is required.')

    const res = await apiClient.get(API_ENDPOINTS.REPORTS.SAVED_DETAIL(reportId), { workspaceId })
    assertSuccess(res, 'Failed to fetch saved report.')
    return res.data || res
  },

  /**
   * Updates an existing saved report.
   */
  async updateSavedReport(reportId, updates = {}, { workspaceId } = {}) {
    if (!workspaceId) throw new Error('workspaceId is required.')
    if (!reportId) throw new Error('reportId is required.')

    const res = await apiClient.patch(`${API_ENDPOINTS.REPORTS.SAVED_UPDATE(reportId)}?workspaceId=${encodeURIComponent(workspaceId)}`, updates)
    assertSuccess(res, 'Failed to update saved report.')
    return res.data || res
  },

  /**
   * Deletes a saved report by ID.
   */
  async deleteSavedReport(reportId, { workspaceId } = {}) {
    if (!workspaceId) throw new Error('workspaceId is required.')
    if (!reportId) throw new Error('reportId is required.')

    const res = await apiClient.delete(`${API_ENDPOINTS.REPORTS.SAVED_DELETE(reportId)}?workspaceId=${encodeURIComponent(workspaceId)}`)
    assertSuccess(res, 'Failed to delete saved report.')
    return res.data || res
  },

  /**
   * Exports report as JSON or downloads CSV.
   */
  async exportReport({ workspaceId, format = 'json', timeRange = '30d' } = {}) {
    if (!workspaceId) throw new Error('workspaceId is required.')
    const url = `${API_ENDPOINTS.REPORTS.EXPORT}?workspaceId=${encodeURIComponent(workspaceId)}&format=${format}&timeRange=${timeRange}`

    if (format === 'json') {
      const res = await apiClient.get(API_ENDPOINTS.REPORTS.EXPORT, { workspaceId, format: 'json', timeRange })
      assertSuccess(res, 'Failed to export JSON report.')
      return res.data || res
    }

    // Direct browser CSV download
    const token = localStorage.getItem('productmind_access_token') || sessionStorage.getItem('productmind_access_token')
    const headers = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(url, { headers })
    if (!response.ok) {
      throw new Error(`Export failed with HTTP ${response.status}`)
    }
    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `product_intelligence_${workspaceId}_${timeRange}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
    return true
  },

  /**
   * Triggers evidence-backed AI Executive Briefing generation.
   */
  async generateExecutiveBriefing({ workspaceId, timeRange = '30d', forceRegenerate = false } = {}) {
    if (!workspaceId) throw new Error('workspaceId is required.')
    const payload = {
      workspaceId,
      timeRange,
      forceRegenerate: Boolean(forceRegenerate),
    }

    const res = await apiClient.post(API_ENDPOINTS.REPORTS.BRIEFING, payload)
    assertSuccess(res, 'Failed to generate executive briefing.')
    return res.data || res
  },
}
