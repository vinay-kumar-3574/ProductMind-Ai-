import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aggregationService, normalizeFeatureGroup } from '../services/api/aggregationService'
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

describe('Feature Request Aggregation Module (Module 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Defect 1: Backend Field Normalization', () => {
    it('normalizes backend Pydantic FeatureGroupResult schema fields correctly', () => {
      const backendPayload = {
        feature_group_id: '661122334455667788990001',
        workspace_id: '660011223344556677889902',
        group_name: 'Automated Dark Mode Theme',
        feature_summary: 'Enables dark mode across product analytics dashboards.',
        consolidated_description: 'Multiple enterprise customers requested a high-contrast dark theme.',
        related_feedback_ids: ['fb-101', 'fb-102', 'fb-103'],
        total_request_count: 3,
        unique_customer_count: 2,
        sentiment_distribution: { Positive: 1, Neutral: 1, Negative: 1, Mixed: 0 },
        urgency_distribution: { High: 2, Medium: 1 },
        common_themes: ['UI Customization', 'Themes'],
        common_pain_points: ['Eye strain during evening shifts'],
        evidence: ['White background is blinding late at night', 'need night theme'],
        suggested_capability: 'Dashboard theme switcher',
        grouping_confidence: 0.94,
        grouping_reason: 'All items express identical dark interface preference.',
        grouping_status: 'suggested',
      }

      const normalized = normalizeFeatureGroup(backendPayload)

      expect(normalized.id).toBe('661122334455667788990001')
      expect(normalized.title).toBe('Automated Dark Mode Theme')
      expect(normalized.description).toBe('Multiple enterprise customers requested a high-contrast dark theme.')
      expect(normalized.count).toBe(3)
      expect(normalized.uniqueCustomers).toBe(2)
      expect(normalized.sentimentDistribution.Negative).toBe(1)
      expect(normalized.painPoints).toContain('Eye strain during evening shifts')
      expect(normalized.evidence).toHaveLength(2)
      expect(normalized.excerpts).toHaveLength(2)
      expect(normalized.isAIGenerated).toBe(true)
      expect(normalized.groupingConfidence).toBe(0.94)
    })

    it('handles missing or partial optional fields gracefully without defaulting to Untitled', () => {
      const minimalPayload = {
        id: 'grp-minimal',
        name: 'CSV Export Enhancement',
      }

      const normalized = normalizeFeatureGroup(minimalPayload)

      expect(normalized.id).toBe('grp-minimal')
      expect(normalized.title).toBe('CSV Export Enhancement')
      expect(normalized.count).toBe(0)
      expect(normalized.uniqueCustomers).toBe(1)
      expect(normalized.sentimentDistribution.Positive).toBe(0)
      expect(normalized.painPoints).toEqual([])
    })
  })

  describe('Defect 2 & 3: API Endpoint Constants & Grouping Key Handling', () => {
    it('consumes backend response with groups key and maps feature_groups', async () => {
      const mockResult = {
        workspace_id: '660011223344556677889902',
        groups_created: 1,
        total_feedback_analyzed: 3,
        groups: [
          {
            feature_group_id: 'fg-201',
            group_name: 'CSV Data Export',
            total_request_count: 3,
            related_feedback_ids: ['fb-1', 'fb-2', 'fb-3'],
          },
        ],
        ungrouped_feedback_ids: [],
        execution_metadata: { status: 'completed' },
      }

      apiClient.post.mockResolvedValueOnce({ data: mockResult })

      const res = await aggregationService.groupFeatures({
        workspaceId: '660011223344556677889902',
        forceRegroup: true,
      })

      expect(apiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.AI_FEATURES.GROUP,
        expect.objectContaining({
          workspace_id: '660011223344556677889902',
          force_regroup: true,
        })
      )

      expect(res.groups).toHaveLength(1)
      expect(res.feature_groups).toHaveLength(1)
      expect(res.groups[0].title).toBe('CSV Data Export')
      expect(res.groups[0].count).toBe(3)
    })

    it('fetches feature groups and normalizes each group in the array', async () => {
      apiClient.get.mockResolvedValueOnce({
        data: [
          {
            feature_group_id: 'fg-301',
            group_name: 'Slack Webhook Alerts',
            total_request_count: 5,
            related_feedback_ids: ['fb-1', 'fb-2'],
          },
        ],
      })

      const groups = await aggregationService.getFeatureGroups('660011223344556677889902')

      expect(apiClient.get).toHaveBeenCalledWith(
        API_ENDPOINTS.AI_FEATURES.GROUPS,
        { params: { workspace_id: '660011223344556677889902' } }
      )
      expect(groups).toHaveLength(1)
      expect(groups[0].title).toBe('Slack Webhook Alerts')
      expect(groups[0].count).toBe(5)
    })
  })

  describe('Defect 4: Feature Group Merging', () => {
    it('executes mergeGroups and calls backend merge endpoint with workspace isolation', async () => {
      const mockMergeResponse = {
        workspace_id: '660011223344556677889902',
        source_group_id: 'fg-source-1',
        target_group_id: 'fg-target-2',
        repointed_feedback_count: 4,
        updated_target_group: {
          feature_group_id: 'fg-target-2',
          group_name: 'Unified Data Export Engine',
          total_request_count: 8,
          related_feedback_ids: ['fb-1', 'fb-2', 'fb-3', 'fb-4', 'fb-5', 'fb-6', 'fb-7', 'fb-8'],
        },
        message: 'Successfully merged groups',
      }

      apiClient.post.mockResolvedValueOnce({ data: mockMergeResponse })

      const mergeResult = await aggregationService.mergeGroups(
        'fg-source-1',
        'fg-target-2',
        '660011223344556677889902'
      )

      expect(apiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.AI_FEATURES.MERGE,
        {
          workspace_id: '660011223344556677889902',
          source_group_id: 'fg-source-1',
          target_group_id: 'fg-target-2',
        }
      )

      expect(mergeResult.success).toBe(true)
      expect(mergeResult.repointedFeedbackCount).toBe(4)
      expect(mergeResult.updatedTargetGroup.title).toBe('Unified Data Export Engine')
      expect(mergeResult.updatedTargetGroup.count).toBe(8)
    })

    it('throws error when sourceGroupId or targetGroupId is missing', async () => {
      await expect(
        aggregationService.mergeGroups('', 'fg-target-2', '660011223344556677889902')
      ).rejects.toThrow('Both sourceGroupId and targetGroupId are required.')
    })
  })

  describe('Detailed Member Feedback & Duplicate Detection', () => {
    it('retrieves detailed member feedback records via getGroupFeedback', async () => {
      const mockFeedbackRecords = [
        {
          id: 'fb-101',
          title: 'Night mode needed',
          description: 'Screen is too bright.',
          customer: 'Bob',
          company: 'Acme Corp',
          sentiment: 'Negative',
        },
      ]

      apiClient.get.mockResolvedValueOnce({ data: mockFeedbackRecords })

      const items = await aggregationService.getGroupFeedback('fg-1', '660011223344556677889902')

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/ai/features/groups/fg-1/feedback',
        { params: { workspace_id: '660011223344556677889902' } }
      )
      expect(items).toHaveLength(1)
      expect(items[0].title).toBe('Night mode needed')
    })

    it('invokes duplicate detection endpoint via detectDuplicates', async () => {
      apiClient.post.mockResolvedValueOnce({
        data: {
          workspace_id: '660011223344556677889902',
          total_evaluated: 5,
          duplicates_found: 2,
          results: [],
        },
      })

      const res = await aggregationService.detectDuplicates({
        workspaceId: '660011223344556677889902',
      })

      expect(apiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.AI_FEATURES.DUPLICATES,
        { workspace_id: '660011223344556677889902' }
      )
      expect(res.duplicates_found).toBe(2)
    })
  })
})
