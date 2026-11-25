import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reportingService } from '../services/api/reportingService'
import { apiClient } from '../services/api/apiClient'
import { API_ENDPOINTS } from '../services/api/types'

vi.mock('../services/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getActiveWorkspaceId: vi.fn(() => 'ws-unit-789'),
  getAuthToken: vi.fn(() => 'mock-test-token'),
  getApiBaseUrl: vi.fn(() => 'http://localhost:8000'),
}))

describe('reportingService (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Executive Summary', () => {
    it('calls executive summary endpoint with workspaceId and timeRange', async () => {
      const mockSummary = {
        workspaceId: 'ws-test',
        productHealthScore: { score: 84.5, rating: 'Good' },
        customerSentiment: { positiveRatio: 0.8 },
      }
      apiClient.get.mockResolvedValueOnce({ success: true, data: mockSummary })

      const result = await reportingService.getExecutiveSummary({
        workspaceId: 'ws-test',
        timeRange: '30d',
      })

      expect(apiClient.get).toHaveBeenCalledWith(
        API_ENDPOINTS.REPORTS.EXECUTIVE_SUMMARY,
        { workspaceId: 'ws-test', timeRange: '30d' }
      )
      expect(result.productHealthScore.score).toBe(84.5)
    })

    it('throws error if workspaceId is missing', async () => {
      await expect(reportingService.getExecutiveSummary({})).rejects.toThrow('workspaceId is required')
    })
  })

  describe('Delivery Risk', () => {
    it('calls delivery risk endpoint', async () => {
      const mockRisk = {
        workspaceId: 'ws-test',
        overallRiskLevel: 'medium',
        itemsAtRisk: [{ itemTitle: 'OAuth Integration', riskLevel: 'medium' }],
      }
      apiClient.get.mockResolvedValueOnce({ success: true, data: mockRisk })

      const result = await reportingService.getDeliveryRisk({ workspaceId: 'ws-test' })
      expect(apiClient.get).toHaveBeenCalledWith(
        API_ENDPOINTS.REPORTS.DELIVERY_RISK,
        { workspaceId: 'ws-test' }
      )
      expect(result.overallRiskLevel).toBe('medium')
    })
  })

  describe('Saved Reports CRUD', () => {
    it('creates a saved report configuration', async () => {
      const newReport = {
        id: 'rep-1',
        workspaceId: 'ws-test',
        title: 'Q4 Board Deck',
        reportType: 'executive_kpi',
      }
      apiClient.post.mockResolvedValueOnce({ success: true, data: newReport })

      const res = await reportingService.createSavedReport({
        workspaceId: 'ws-test',
        title: 'Q4 Board Deck',
        reportType: 'executive_kpi',
      })

      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/saved?workspaceId=ws-test'),
        expect.objectContaining({ title: 'Q4 Board Deck', reportType: 'executive_kpi' })
      )
      expect(res.id).toBe('rep-1')
    })

    it('lists saved reports', async () => {
      apiClient.get.mockResolvedValueOnce({ success: true, data: [{ id: 'rep-1' }] })
      const res = await reportingService.getSavedReports({ workspaceId: 'ws-test' })
      expect(apiClient.get).toHaveBeenCalledWith(
        API_ENDPOINTS.REPORTS.SAVED_LIST,
        { workspaceId: 'ws-test', limit: 50, skip: 0 }
      )
      expect(res).toHaveLength(1)
    })

    it('updates a saved report', async () => {
      apiClient.patch.mockResolvedValueOnce({ success: true, data: { id: 'rep-1', isFavorite: true } })
      const res = await reportingService.updateSavedReport('rep-1', { isFavorite: true }, { workspaceId: 'ws-test' })
      expect(apiClient.patch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/saved/rep-1?workspaceId=ws-test'),
        { isFavorite: true }
      )
      expect(res.isFavorite).toBe(true)
    })

    it('deletes a saved report', async () => {
      apiClient.delete.mockResolvedValueOnce({ success: true, data: { deleted: true } })
      const res = await reportingService.deleteSavedReport('rep-1', { workspaceId: 'ws-test' })
      expect(apiClient.delete).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/saved/rep-1?workspaceId=ws-test')
      )
      expect(res.deleted).toBe(true)
    })
  })

  describe('Executive Briefing', () => {
    it('requests AI executive briefing with bounded parameters', async () => {
      const mockBriefing = {
        workspaceId: 'ws-test',
        modelUsed: 'qwen/qwen3.8-27b',
        executiveSummary: 'Positive sentiment trending upward.',
        strategicRecommendations: [{ recommendation: 'Accelerate mobile release' }],
      }
      apiClient.post.mockResolvedValueOnce({ success: true, data: mockBriefing })

      const res = await reportingService.generateExecutiveBriefing({
        workspaceId: 'ws-test',
        timeRange: '30d',
      })

      expect(apiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.REPORTS.BRIEFING,
        expect.objectContaining({ workspaceId: 'ws-test', timeRange: '30d' })
      )
      expect(res.executiveSummary).toContain('Positive sentiment')
    })
  })

  describe('Report Export', () => {
    it('downloads JSON report', async () => {
      const mockJson = { workspaceId: 'ws-test', format: 'json' }
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockJson,
      })
      window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
      window.URL.revokeObjectURL = vi.fn()

      const res = await reportingService.exportReport({
        workspaceId: 'ws-test',
        format: 'json',
        timeRange: '30d',
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/export?workspaceId=ws-test&format=json&timeRange=30d'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer mock-test-token' }) })
      )
      expect(res.data.workspaceId).toBe('ws-test')
    })

    it('downloads CSV report', async () => {
      const mockBlob = new Blob(['Metric,Score'], { type: 'text/csv' })
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => mockBlob,
      })
      window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
      window.URL.revokeObjectURL = vi.fn()

      const res = await reportingService.exportReport({
        workspaceId: 'ws-test',
        format: 'csv',
        timeRange: '30d',
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/export?workspaceId=ws-test&format=csv&timeRange=30d'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer mock-test-token' }) })
      )
      expect(res.success).toBe(true)
    })
  })
})
