import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AIClassificationCard } from '../components/common/ApiStatus'
import { feedbackService } from '../services/api/feedbackService'
import { feedbackAiQueue, AI_STATUS } from '../services/api/feedbackAiQueue'
import { apiClient } from '../services/api/apiClient'
import { API_ENDPOINTS } from '../services/api/types'

vi.mock('../services/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getActiveWorkspaceId: vi.fn(() => '660011223344556677889902'),
  isBackendConfigured: vi.fn(() => true),
}))

describe('Module 2 — Customer Feedback and Support Ticket Ingestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Defect 1: AI Analysis Endpoint Invocation', () => {
    it('calls analyzeFeedback using function endpoint without .replace error', async () => {
      apiClient.post.mockResolvedValueOnce({
        data: {
          feedback_id: 'fb-123',
          analysis: {
            category: 'Performance',
            sentiment: 'Negative',
            confidence: 0.94,
            secondary_tags: ['latency', 'timeout'],
          },
        },
      })

      const result = await feedbackService.analyzeFeedback('fb-123', true)

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/ai/feedback/fb-123/analyze',
        { force_reanalyze: true }
      )
      expect(result.analysis.category).toBe('Performance')
      expect(result.analysis.confidence).toBe(0.94)
    })

    it('retrieves cached analysis using function endpoint', async () => {
      apiClient.get.mockResolvedValueOnce({
        data: {
          feedback_id: 'fb-456',
          analysis: { category: 'Usability', sentiment: 'Positive', confidence: 0.88 },
        },
      })

      const result = await feedbackService.getFeedbackAnalysis('fb-456')

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/ai/feedback/fb-456/analysis')
      expect(result.analysis.confidence).toBe(0.88)
    })
  })

  describe('Defect 2 & 7: AI Classification Card Confidence & Findings Display', () => {
    it('displays "Awaiting Analysis" and does not fabricate 92% when confidence is null', () => {
      render(
        <AIClassificationCard
          category="—"
          sentiment="—"
          themes={[]}
          confidence={null}
          status="Awaiting Analysis"
        />
      )

      expect(screen.getByText('Awaiting Analysis')).toBeDefined()
      expect(screen.queryByText('92%')).toBeNull()
      expect(screen.getByText('Status: Awaiting Analysis')).toBeDefined()
    })

    it('renders real confidence percentage, main theme, and rationale when analysis is provided', () => {
      render(
        <AIClassificationCard
          category="Performance"
          sentiment="Negative"
          sentimentExplanation="Customer complained of unacceptable 8s load times"
          mainTheme="Dashboard Latency"
          themes={['speed', 'cache']}
          confidence={0.94}
          status="Completed"
        />
      )

      expect(screen.getByText('94%')).toBeDefined()
      expect(screen.getByText('Performance')).toBeDefined()
      expect(screen.getByText('Negative')).toBeDefined()
      expect(screen.getByText('Dashboard Latency')).toBeDefined()
      expect(screen.getByText(/unacceptable 8s load times/)).toBeDefined()
      expect(screen.getByText('#speed')).toBeDefined()
      expect(screen.getByText('#cache')).toBeDefined()
      expect(screen.getByText('Status: Completed')).toBeDefined()
    })

    it('renders retry button and appropriate warning when rate limited', () => {
      const onRetryMock = vi.fn()
      render(
        <AIClassificationCard
          category="Performance"
          sentiment="Negative"
          confidence={null}
          status="Rate Limited"
          onRetry={onRetryMock}
        />
      )

      expect(screen.getByText('AI rate limited (Groq free-tier)')).toBeDefined()
      expect(screen.getByText('Retry Analysis')).toBeDefined()
    })
  })

  describe('Defect 5: Support Ticket Source Type Ingestion & Mapping', () => {
    it('submits support_ticket source type to the backend creation endpoint', async () => {
      apiClient.post.mockResolvedValueOnce({
        data: {
          id: '660011223344556677889999',
          title: 'SSO login timeout issue',
          description: 'User cannot login via Okta SAML',
          sourceType: 'support_ticket',
          category: 'Integrations',
          sentiment: 'Negative',
          sourcePriority: 'Urgent',
        },
      })

      const result = await feedbackService.createFeedback({
        title: 'SSO login timeout issue',
        description: 'User cannot login via Okta SAML',
        source_type: 'support_ticket',
        category: 'Integrations',
        sentiment: 'Negative',
        priority: 'Urgent',
        customer: 'John Doe',
        company: 'Acme Corp',
        workspaceId: '660011223344556677889902',
      })

      expect(apiClient.post).toHaveBeenCalled()
      const [url, payload] = apiClient.post.mock.calls[0]
      expect(url).toContain('/api/v1/feedback?workspaceId=660011223344556677889902')
      expect(payload.source_type).toBe('support_ticket')
      expect(payload.category).toBe('Integrations')
      expect(payload.sentiment).toBe('Negative')
      expect(payload.source_priority).toBe('Urgent')
      expect(result.sourceType).toBe('support_ticket')
    })
  })

  describe('Defect 6: CSV Batch Ingestion Service', () => {
    it('sends batch payload to backend batch endpoint with sanitized fields and IDs', async () => {
      apiClient.post.mockResolvedValueOnce({
        data: {
          batchId: '660011223344556677889988',
          status: 'completed',
          totalRows: 2,
          acceptedRows: 2,
          rejectedRows: 0,
        },
      })

      const rawItems = [
        {
          id: 'ext-1',
          title: 'Dashboard loading latency',
          description: 'Page takes 8 seconds to load',
          customer: 'Alice',
          company: 'FinTech Co',
          category: 'Performance',
          priority: 'Urgent',
        },
        {
          title: 'Export to PDF missing header',
          description: 'Exported PDF does not have company logo',
          customer: 'Bob',
          company: 'Beta LLC',
          sentiment: 'Neutral',
        },
      ]

      const res = await feedbackService.batchImport(rawItems, '660011223344556677889902')

      expect(apiClient.post).toHaveBeenCalled()
      const [url, body] = apiClient.post.mock.calls[0]
      expect(url).toBe('/api/v1/feedback/batch?workspaceId=660011223344556677889902')
      expect(body.items).toHaveLength(2)
      expect(body.items[0].external_id).toBe('ext-1')
      expect(body.items[0].source_type).toBe('csv')
      expect(body.items[0].category).toBe('Performance')
      expect(body.items[0].source_priority).toBe('Urgent')
      expect(body.items[1].external_id).toBeDefined()
      expect(body.items[1].sentiment).toBe('Neutral')
      expect(res.acceptedRows).toBe(2)
    })
  })

  describe('Defect 8: Backend-Confirmed Feedback Deletion', () => {
    it('invokes DELETE endpoint with workspace isolation query param', async () => {
      apiClient.delete.mockResolvedValueOnce({ status: 204, data: null })

      await feedbackService.deleteFeedback('fb-999', '660011223344556677889902')

      expect(apiClient.delete).toHaveBeenCalledWith(
        '/api/v1/feedback/fb-999?workspaceId=660011223344556677889902'
      )
    })
  })

  describe('Defect 9: Automatic AI Execution Queue with Groq Rate-Limit Protection', () => {
    it('enqueues task and processes analysis with bounded concurrency', async () => {
      apiClient.post.mockResolvedValueOnce({
        data: {
          feedback_id: 'fb-auto-1',
          analysis: {
            category: 'Usability',
            sentiment: 'Positive',
            confidence: 0.91,
          },
        },
      })

      const onSuccessMock = vi.fn()
      feedbackAiQueue.enqueue('fb-auto-1', { onSuccess: onSuccessMock })

      expect(feedbackAiQueue.getStatus('fb-auto-1')).toBe(AI_STATUS.ANALYZING)

      // Allow queue promise tick
      await new Promise(r => setTimeout(r, 50))

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/ai/feedback/fb-auto-1/analyze',
        { force_reanalyze: false }
      )
      expect(feedbackAiQueue.getStatus('fb-auto-1')).toBe(AI_STATUS.COMPLETED)
      expect(onSuccessMock).toHaveBeenCalled()
    })

    it('captures HTTP 429 without infinite loop and marks status as Rate Limited', async () => {
      const rateLimitError = new Error('Request failed with status code 429')
      rateLimitError.response = { status: 429 }
      apiClient.post.mockRejectedValueOnce(rateLimitError)

      const onErrorMock = vi.fn()
      feedbackAiQueue.enqueue('fb-auto-2', { onError: onErrorMock })

      await new Promise(r => setTimeout(r, 50))

      expect(feedbackAiQueue.getStatus('fb-auto-2')).toBe(AI_STATUS.RATE_LIMITED)
      expect(onErrorMock).toHaveBeenCalledWith(rateLimitError, true)
    })
  })
})
