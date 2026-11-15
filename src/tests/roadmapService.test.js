import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  roadmapService,
  normalizeRoadmap,
  normalizeRoadmapItem,
  normalizeCandidate,
} from '../services/api/roadmapService'
import { apiClient } from '../services/api/apiClient'
import { API_ENDPOINTS } from '../services/api/types'

vi.mock('../services/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getActiveWorkspaceId: vi.fn(() => 'ws-test-123'),
}))

describe('roadmapService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Normalizers', () => {
    it('normalizeRoadmap normalizes snake_case and camelCase containers', () => {
      const raw = {
        _id: 'rm-101',
        workspace_id: 'ws-123',
        title: '2026 Core Delivery',
        description: 'Roadmap desc',
        roadmap_type: 'Strategic',
        time_horizon: 'Quarterly',
        status: 'Active',
        is_default: true,
        version: '1.2.0',
        item_count: 5,
      }
      const norm = normalizeRoadmap(raw)
      expect(norm.id).toBe('rm-101')
      expect(norm.workspaceId).toBe('ws-123')
      expect(norm.title).toBe('2026 Core Delivery')
      expect(norm.roadmapType).toBe('Strategic')
      expect(norm.timeHorizon).toBe('Quarterly')
      expect(norm.isDefault).toBe(true)
      expect(norm.itemCount).toBe(5)
    })

    it('normalizeRoadmapItem normalizes deliverable attributes', () => {
      const raw = {
        _id: 'item-201',
        workspace_id: 'ws-123',
        roadmap_id: 'rm-101',
        title: 'Kafka Consumer Group Rebalance',
        status: 'In Progress',
        priority: 'Urgent',
        priority_score: 91.5,
        is_committed: true,
        owner: 'Lead PM',
        start_date: '2026-10-01',
        target_date: '2026-11-15',
        milestone: 'Phase 2',
        progress: 60,
      }
      const norm = normalizeRoadmapItem(raw)
      expect(norm.id).toBe('item-201')
      expect(norm.roadmapId).toBe('rm-101')
      expect(norm.title).toBe('Kafka Consumer Group Rebalance')
      expect(norm.status).toBe('In Progress')
      expect(norm.isCommitted).toBe(true)
      expect(norm.priorityScore).toBe(91.5)
      expect(norm.progress).toBe(60)
    })

    it('normalizeCandidate normalizes PRD and feature group candidates', () => {
      const raw = {
        feature_group_id: 'fg-501',
        title: 'Zero-Knowledge Audit Trail',
        feedback_count: 35,
        priority_score: 95.0,
        prd_id: 'prd-701',
        prd_title: 'ZK Audit Trail PRD',
        prd_status: 'Approved',
        is_approved_for_roadmap: true,
        roadmap_recommendations: [{ phase: 'Phase 1' }],
        existing_roadmap_item_ids: ['item-201'],
        is_fully_committed: false,
      }
      const norm = normalizeCandidate(raw)
      expect(norm.featureGroupId).toBe('fg-501')
      expect(norm.prdId).toBe('prd-701')
      expect(norm.isApprovedForRoadmap).toBe(true)
      expect(norm.priorityScore).toBe(95.0)
      expect(norm.roadmapRecommendations).toHaveLength(1)
      expect(norm.isFullyCommitted).toBe(false)
    })
  })

  describe('Roadmap Container API Calls', () => {
    it('listRoadmaps queries backend with workspaceId and returns normalized roadmaps', async () => {
      apiClient.get.mockResolvedValue({
        success: true,
        data: {
          total: 1,
          items: [
            {
              id: 'rm-001',
              title: 'Main Roadmap',
              status: 'Active',
              isDefault: true,
            },
          ],
        },
      })

      const res = await roadmapService.listRoadmaps('ws-test-123')
      expect(apiClient.get).toHaveBeenCalledWith(API_ENDPOINTS.ROADMAP.LIST, {
        params: { workspace_id: 'ws-test-123', skip: 0, limit: 100 },
      })
      expect(res.total).toBe(1)
      expect(res.items[0].title).toBe('Main Roadmap')
    })

    it('createRoadmap posts container to backend', async () => {
      apiClient.post.mockResolvedValue({
        success: true,
        data: {
          id: 'rm-002',
          title: 'Q1 2027 Strategic',
          status: 'Active',
          version: '1.0.0',
        },
      })

      const res = await roadmapService.createRoadmap('ws-test-123', {
        title: 'Q1 2027 Strategic',
        roadmapType: 'Strategic',
      })
      expect(apiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.ROADMAP.CREATE,
        expect.objectContaining({ title: 'Q1 2027 Strategic', roadmapType: 'Strategic' }),
        { params: { workspace_id: 'ws-test-123' } }
      )
      expect(res.title).toBe('Q1 2027 Strategic')
    })

    it('archiveRoadmap sends delete to archive container', async () => {
      apiClient.delete.mockResolvedValue({
        success: true,
        data: { id: 'rm-002', status: 'Archived' },
      })

      const res = await roadmapService.archiveRoadmap('ws-test-123', 'rm-002')
      expect(apiClient.delete).toHaveBeenCalledWith(
        API_ENDPOINTS.ROADMAP.ARCHIVE('rm-002'),
        { params: { workspace_id: 'ws-test-123' } }
      )
      expect(res.status).toBe('Archived')
    })
  })

  describe('Roadmap Items API Calls', () => {
    it('listRoadmapItems sends filters and returns normalized items', async () => {
      apiClient.get.mockResolvedValue({
        success: true,
        data: {
          total: 2,
          items: [
            { id: 'i-1', title: 'Task 1', status: 'Planned' },
            { id: 'i-2', title: 'Task 2', status: 'In Progress' },
          ],
        },
      })

      const res = await roadmapService.listRoadmapItems('ws-test-123', {
        roadmapId: 'rm-001',
        status: 'In Progress',
      })
      expect(apiClient.get).toHaveBeenCalledWith(API_ENDPOINTS.ROADMAP.ITEMS, {
        params: {
          workspace_id: 'ws-test-123',
          roadmap_id: 'rm-001',
          status: 'In Progress',
          skip: 0,
          limit: 100,
        },
      })
      expect(res.total).toBe(2)
      expect(res.items).toHaveLength(2)
    })

    it('createRoadmapItem creates item with committed flag and dates', async () => {
      apiClient.post.mockResolvedValue({
        success: true,
        data: {
          id: 'i-new',
          title: 'Bounded CSV Pipeline',
          startDate: '2026-10-01',
          targetDate: '2026-11-01',
          isCommitted: true,
        },
      })

      const res = await roadmapService.createRoadmapItem('ws-test-123', {
        title: 'Bounded CSV Pipeline',
        startDate: '2026-10-01',
        targetDate: '2026-11-01',
        isCommitted: true,
      })
      expect(apiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.ROADMAP.ITEM_CREATE,
        expect.objectContaining({ title: 'Bounded CSV Pipeline', isCommitted: true }),
        { params: { workspace_id: 'ws-test-123' } }
      )
      expect(res.isCommitted).toBe(true)
    })

    it('deleteRoadmapItem deletes item permanently', async () => {
      apiClient.delete.mockResolvedValue({
        success: true,
        data: { success: true, id: 'i-del' },
      })

      const res = await roadmapService.deleteRoadmapItem('ws-test-123', 'i-del')
      expect(apiClient.delete).toHaveBeenCalledWith(
        API_ENDPOINTS.ROADMAP.ITEM_DELETE('i-del'),
        { params: { workspace_id: 'ws-test-123' } }
      )
      expect(res.success).toBe(true)
    })
  })

  describe('Candidates & PRD Promotion', () => {
    it('getCandidates retrieves feature group candidates and approval status', async () => {
      apiClient.get.mockResolvedValue({
        success: true,
        data: {
          total: 1,
          items: [
            {
              featureGroupId: 'fg-1',
              title: 'Real-time Ingestion',
              prdId: 'p-1',
              prdStatus: 'Approved',
              isApprovedForRoadmap: true,
            },
          ],
        },
      })

      const res = await roadmapService.getCandidates('ws-test-123')
      expect(apiClient.get).toHaveBeenCalledWith(API_ENDPOINTS.ROADMAP.CANDIDATES, {
        params: { workspace_id: 'ws-test-123' },
      })
      expect(res.items[0].isApprovedForRoadmap).toBe(true)
    })

    it('promoteApprovedPRD promotes approved PRD into roadmap items', async () => {
      apiClient.post.mockResolvedValue({
        success: true,
        data: {
          success: true,
          promotedCount: 2,
          createdItemIds: ['i-1', 'i-2'],
          roadmapId: 'rm-001',
          prdId: 'p-1',
          prdTitle: 'Real-time Ingestion PRD',
          message: 'Successfully committed 2 item(s)',
        },
      })

      const res = await roadmapService.promoteApprovedPRD('ws-test-123', {
        prdId: 'p-1',
        roadmapId: 'rm-001',
        targetMilestone: 'Q4 Core',
      })
      expect(apiClient.post).toHaveBeenCalledWith(
        API_ENDPOINTS.ROADMAP.PROMOTE_PRD,
        { prdId: 'p-1', roadmapId: 'rm-001', targetMilestone: 'Q4 Core' },
        { params: { workspace_id: 'ws-test-123' } }
      )
      expect(res.promotedCount).toBe(2)
      expect(res.prdTitle).toBe('Real-time Ingestion PRD')
    })
  })
})
