import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prdService, normalizePlan, normalizePlanSections } from '../services/api/prdService'
import { apiClient } from '../services/api/apiClient'

vi.mock('../services/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
  getActiveWorkspaceId: vi.fn(() => 'ws-test-123'),
}))

describe('prdService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('normalizePlanSections', () => {
    it('normalizes both camelCase and snake_case keys', () => {
      const raw = {
        executive_summary: 'Exec summary',
        problem_statement: 'The problem',
        target_users: 'Admins',
        customer_pain_points: 'High latency',
        proposed_solution: 'Streaming',
        goals_and_success_metrics: 'Target: 50%',
        functional_requirements: 'REQ-1',
        non_functional_requirements: 'NFR-1',
        user_stories: 'US-1',
        acceptance_criteria: 'AC-1',
        dependencies_and_constraints: 'Postgres',
        risks_and_mitigations: 'Memory leak',
        release_plan: 'Phase 1',
      }
      const normalized = normalizePlanSections(raw)
      expect(normalized.overview).toBe('Exec summary')
      expect(normalized.problemStatement).toBe('The problem')
      expect(normalized.targetUsers).toBe('Admins')
      expect(normalized.customerPainPoints).toBe('High latency')
      expect(normalized.proposedSolution).toBe('Streaming')
      expect(normalized.goalsAndSuccessMetrics).toBe('Target: 50%')
      expect(normalized.functionalRequirements).toBe('REQ-1')
      expect(normalized.nonFunctionalRequirements).toBe('NFR-1')
      expect(normalized.userStories).toBe('US-1')
      expect(normalized.acceptanceCriteria).toBe('AC-1')
      expect(normalized.dependenciesAndConstraints).toBe('Postgres')
      expect(normalized.risksAndMitigations).toBe('Memory leak')
      expect(normalized.releasePlan).toBe('Phase 1')
    })
  })

  describe('listProductPlans', () => {
    it('returns normalized plans on success', async () => {
      apiClient.get.mockResolvedValue({
        success: true,
        data: [
          {
            planning_id: 'plan-1',
            title: 'CSV Engine',
            version: '1.0.0',
            status: 'pending_review',
            sections: { overview: 'Summary' },
          },
        ],
      })

      const plans = await prdService.listProductPlans('ws-test-123')
      expect(plans).toHaveLength(1)
      expect(plans[0].id).toBe('plan-1')
      expect(plans[0].sections.overview).toBe('Summary')
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/ai/planning/', {
        params: { workspace_id: 'ws-test-123' },
      })
    })

    it('throws error and does NOT silently return empty/mock data when API fails', async () => {
      apiClient.get.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
        status: 500,
      })

      await expect(prdService.listProductPlans('ws-test-123')).rejects.toThrow('Database connection failed')
    })
  })

  describe('updatePRDSections', () => {
    it('sends PUT to sections endpoint with expectedVersion and versionBump', async () => {
      apiClient.put.mockResolvedValue({
        success: true,
        data: {
          planning_id: 'plan-1',
          version: '1.0.1',
          sections: { overview: 'Updated summary' },
        },
      })

      const res = await prdService.updatePRDSections('plan-1', {
        sections: { overview: 'Updated summary' },
        expectedVersion: '1.0.0',
        versionBump: 'patch',
        workspaceId: 'ws-test-123',
      })

      expect(res.version).toBe('1.0.1')
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/ai/planning/plan-1/sections',
        {
          sections: { overview: 'Updated summary' },
          expectedVersion: '1.0.0',
          versionBump: 'patch',
          forceApprovedOverwrite: false,
        },
        { params: { workspace_id: 'ws-test-123' } }
      )
    })

    it('throws with status code on 409 conflict', async () => {
      apiClient.put.mockResolvedValue({
        success: false,
        error: 'Concurrent modification conflict',
        status: 409,
      })

      let caught = null
      try {
        await prdService.updatePRDSections('plan-1', {
          sections: { overview: 'Conflict update' },
          expectedVersion: '1.0.0',
        })
      } catch (err) {
        caught = err
      }

      expect(caught).toBeTruthy()
      expect(caught.status).toBe(409)
      expect(caught.message).toContain('Concurrent modification')
    })
  })

  describe('regenerateSection', () => {
    it('sends POST to regenerate-section endpoint with customInstructions', async () => {
      apiClient.post.mockResolvedValue({
        success: true,
        data: {
          planning_id: 'plan-1',
          sections: { user_stories: '### US-001 Regenerated' },
        },
      })

      const res = await prdService.regenerateSection('plan-1', {
        sectionKey: 'user_stories',
        customInstructions: 'Focus on SOC2 compliance',
        workspaceId: 'ws-test-123',
      })

      expect(res.sections.userStories).toBe('### US-001 Regenerated')
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/ai/planning/plan-1/regenerate-section',
        {
          sectionKey: 'user_stories',
          customInstructions: 'Focus on SOC2 compliance',
          forceApprovedOverwrite: false,
        },
        { params: { workspace_id: 'ws-test-123' } }
      )
    })
  })

  describe('reviewProductPlan', () => {
    it('submits human review decision and maps approve to approved', async () => {
      apiClient.patch.mockResolvedValue({
        success: true,
        data: {
          planning_id: 'plan-1',
          status: 'approved',
        },
      })

      const res = await prdService.reviewProductPlan('plan-1', 'approve')
      expect(res.status).toBe('approved')
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/ai/planning/plan-1/review',
        { review_status: 'approved' }
      )
    })

    it('submits rejection with review notes', async () => {
      apiClient.patch.mockResolvedValue({
        success: true,
        data: {
          planning_id: 'plan-1',
          status: 'rejected',
          review_notes: 'Latency target too high',
        },
      })

      const res = await prdService.reviewProductPlan('plan-1', 'reject', 'Latency target too high')
      expect(res.status).toBe('rejected')
      expect(res.reviewNotes).toBe('Latency target too high')
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/ai/planning/plan-1/review',
        {
          review_status: 'rejected',
          review_notes: 'Latency target too high',
        }
      )
    })
  })
})
