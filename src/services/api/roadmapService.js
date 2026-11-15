/**
 * ProductMind AI — Roadmap Service
 * Real integration with FastAPI Roadmap & Product Roadmap API endpoints.
 * Provides multi-tenant, Atlas-persisted operations for ProductRoadmap containers,
 * RoadmapItems, candidate retrieval, and approved PRD promotion.
 */

import { apiClient, getActiveWorkspaceId } from './apiClient'
import { API_ENDPOINTS } from './types'

/**
 * Normalizes a raw ProductRoadmap container document from MongoDB Atlas.
 */
export function normalizeRoadmap(rm) {
  if (!rm) return null
  const id = rm.id || rm._id

  return {
    ...rm,
    id,
    workspaceId: rm.workspace_id || rm.workspaceId,
    legacyId: rm.legacy_id || rm.legacyId,
    title: rm.title || 'Untitled Roadmap',
    description: rm.description || '',
    roadmapType: rm.roadmap_type || rm.roadmapType || 'Product',
    timeHorizon: rm.time_horizon || rm.timeHorizon || 'Quarterly',
    status: rm.status || 'Active',
    isDefault: rm.is_default !== undefined ? rm.is_default : (rm.isDefault !== undefined ? rm.isDefault : false),
    createdBy: rm.created_by || rm.createdBy || 'Product Manager',
    creatorId: rm.creator_id || rm.creatorId,
    version: rm.version || '1.0.0',
    itemCount: rm.item_count !== undefined ? rm.item_count : (rm.itemCount !== undefined ? rm.itemCount : 0),
    createdAt: rm.created_at || rm.createdAt,
    updatedAt: rm.updated_at || rm.updatedAt,
  }
}

/**
 * Normalizes a raw RoadmapItem deliverable document from MongoDB Atlas.
 */
export function normalizeRoadmapItem(item) {
  if (!item) return null
  const id = item.id || item._id

  return {
    ...item,
    id,
    workspaceId: item.workspace_id || item.workspaceId,
    roadmapId: item.roadmap_id || item.roadmapId || null,
    featureId: item.feature_id || item.featureId || null,
    featureGroupId: item.feature_group_id || item.featureGroupId || null,
    prdId: item.prd_id || item.prdId || null,
    prioritizationScenarioId: item.prioritization_scenario_id || item.prioritizationScenarioId || null,
    releaseId: item.release_id || item.releaseId || null,
    legacyId: item.legacy_id || item.legacyId,
    title: item.title || 'Untitled Item',
    description: item.description || '',
    status: item.status || 'Planned',
    priority: item.priority || 'Medium',
    priorityScore: item.priority_score !== undefined ? item.priority_score : (item.priorityScore ?? null),
    isCommitted: item.is_committed !== undefined ? item.is_committed : (item.isCommitted !== undefined ? item.isCommitted : false),
    owner: item.owner || 'Unassigned',
    ownerId: item.owner_id || item.ownerId || null,
    startDate: item.start_date || item.startDate || '',
    targetDate: item.target_date || item.targetDate || '',
    actualStartDate: item.actual_start_date || item.actualStartDate || null,
    actualEndDate: item.actual_end_date || item.actualEndDate || null,
    milestone: item.milestone || 'Phase 1',
    progress: item.progress !== undefined ? Number(item.progress) : 0,
    dependencies: Array.isArray(item.dependencies) ? item.dependencies : [],
    notes: item.notes || '',
    version: item.version || '1.0.0',
    createdAt: item.created_at || item.createdAt,
    updatedAt: item.updated_at || item.updatedAt,
  }
}

/**
 * Normalizes a candidate item eligible for roadmap commitment.
 */
export function normalizeCandidate(cand) {
  if (!cand) return null

  return {
    ...cand,
    featureGroupId: cand.feature_group_id || cand.featureGroupId || null,
    title: cand.title || 'Untitled Candidate',
    description: cand.description || '',
    feedbackCount: cand.feedback_count !== undefined ? cand.feedback_count : (cand.feedbackCount || 0),
    customerPainPoints: cand.customer_pain_points || cand.customerPainPoints || [],
    sentimentDistribution: cand.sentiment_distribution || cand.sentimentDistribution || null,
    priorityScore: cand.priority_score !== undefined ? cand.priority_score : (cand.priorityScore ?? null),
    priorityLevel: cand.priority_level || cand.priorityLevel || 'Medium',
    priorityFactors: cand.priority_factors || cand.priorityFactors || null,
    prioritizationScenarioId: cand.prioritization_scenario_id || cand.prioritizationScenarioId || null,
    prdId: cand.prd_id || cand.prdId || null,
    prdTitle: cand.prd_title || cand.prdTitle || null,
    prdStatus: cand.prd_status || cand.prdStatus || null,
    prdVersion: cand.prd_version || cand.prdVersion || '1.0.0',
    isApprovedForRoadmap: cand.is_approved_for_roadmap !== undefined ? cand.is_approved_for_roadmap : (cand.isApprovedForRoadmap || false),
    roadmapRecommendations: cand.roadmap_recommendations || cand.roadmapRecommendations || [],
    existingRoadmapItemIds: cand.existing_roadmap_item_ids || cand.existingRoadmapItemIds || [],
    isFullyCommitted: cand.is_fully_committed !== undefined ? cand.is_fully_committed : (cand.isFullyCommitted || false),
  }
}

export const roadmapService = {
  /**
   * List Product Roadmap containers for the specified workspace.
   */
  async listRoadmaps(workspaceId = null, { status = null, skip = 0, limit = 100 } = {}) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) return { total: 0, items: [] }

    const queryParams = {
      workspace_id: wsId,
      ...(status ? { status } : {}),
      skip,
      limit,
    }

    const response = await apiClient.get(API_ENDPOINTS.ROADMAP.LIST, { params: queryParams })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to list roadmaps.')
      err.status = response?.status
      throw err
    }

    const data = response.data || { total: 0, items: [] }
    const items = Array.isArray(data.items) ? data.items.map(normalizeRoadmap) : []
    return {
      total: data.total !== undefined ? data.total : items.length,
      items,
    }
  },

  /**
   * Retrieve a single Product Roadmap container by ID.
   */
  async getRoadmap(workspaceId = null, roadmapId) {
    if (!roadmapId) throw new Error('Roadmap ID is required.')
    const wsId = workspaceId || getActiveWorkspaceId()

    const url = API_ENDPOINTS.ROADMAP.DETAIL(roadmapId)
    const response = await apiClient.get(url, { params: wsId ? { workspace_id: wsId } : {} })
    if (!response?.success) {
      const err = new Error(response?.error || `Failed to retrieve roadmap '${roadmapId}'.`)
      err.status = response?.status
      throw err
    }
    return normalizeRoadmap(response.data)
  },

  /**
   * Create a new Product Roadmap container.
   */
  async createRoadmap(workspaceId = null, roadmapData) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) throw new Error('Workspace ID is required to create a roadmap.')

    const payload = {
      title: roadmapData.title,
      description: roadmapData.description || '',
      roadmapType: roadmapData.roadmapType || 'Product',
      timeHorizon: roadmapData.timeHorizon || 'Quarterly',
      status: roadmapData.status || 'Active',
      isDefault: roadmapData.isDefault || false,
    }

    const response = await apiClient.post(API_ENDPOINTS.ROADMAP.CREATE, payload, {
      params: { workspace_id: wsId },
    })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to create roadmap container.')
      err.status = response?.status
      throw err
    }
    return normalizeRoadmap(response.data)
  },

  /**
   * Update an existing Product Roadmap container with optimistic concurrency control.
   */
  async updateRoadmap(workspaceId = null, roadmapId, updateData) {
    if (!roadmapId) throw new Error('Roadmap ID is required.')
    const wsId = workspaceId || getActiveWorkspaceId()

    const payload = {
      ...(updateData.title !== undefined ? { title: updateData.title } : {}),
      ...(updateData.description !== undefined ? { description: updateData.description } : {}),
      ...(updateData.roadmapType !== undefined ? { roadmapType: updateData.roadmapType } : {}),
      ...(updateData.timeHorizon !== undefined ? { timeHorizon: updateData.timeHorizon } : {}),
      ...(updateData.status !== undefined ? { status: updateData.status } : {}),
      ...(updateData.isDefault !== undefined ? { isDefault: updateData.isDefault } : {}),
      ...(updateData.expectedVersion !== undefined ? { expectedVersion: updateData.expectedVersion } : {}),
    }

    const url = API_ENDPOINTS.ROADMAP.UPDATE(roadmapId)
    const response = await apiClient.put(url, payload, {
      params: wsId ? { workspace_id: wsId } : {},
    })
    if (!response?.success) {
      const err = new Error(response?.error || `Failed to update roadmap '${roadmapId}'.`)
      err.status = response?.status
      throw err
    }
    return normalizeRoadmap(response.data)
  },

  /**
   * Archive a Product Roadmap container.
   */
  async archiveRoadmap(workspaceId = null, roadmapId) {
    if (!roadmapId) throw new Error('Roadmap ID is required.')
    const wsId = workspaceId || getActiveWorkspaceId()

    const url = API_ENDPOINTS.ROADMAP.ARCHIVE(roadmapId)
    const response = await apiClient.delete(url, {
      params: wsId ? { workspace_id: wsId } : {},
    })
    if (!response?.success) {
      const err = new Error(response?.error || `Failed to archive roadmap '${roadmapId}'.`)
      err.status = response?.status
      throw err
    }
    return normalizeRoadmap(response.data)
  },

  /**
   * List Roadmap Items with filtering.
   */
  async listRoadmapItems(workspaceId = null, {
    roadmapId = null,
    status = null,
    milestone = null,
    isCommitted = null,
    startDate = null,
    endDate = null,
    skip = 0,
    limit = 100,
  } = {}) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) return { total: 0, items: [] }

    const queryParams = {
      workspace_id: wsId,
      ...(roadmapId ? { roadmap_id: roadmapId } : {}),
      ...(status ? { status } : {}),
      ...(milestone ? { milestone } : {}),
      ...(isCommitted !== null && isCommitted !== undefined ? { is_committed: isCommitted } : {}),
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
      skip,
      limit,
    }

    const response = await apiClient.get(API_ENDPOINTS.ROADMAP.ITEMS, { params: queryParams })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to list roadmap items.')
      err.status = response?.status
      throw err
    }

    const data = response.data || { total: 0, items: [] }
    const items = Array.isArray(data.items) ? data.items.map(normalizeRoadmapItem) : []
    return {
      total: data.total !== undefined ? data.total : items.length,
      items,
    }
  },

  /**
   * Retrieve a single Roadmap Item by ID.
   */
  async getRoadmapItem(workspaceId = null, itemId) {
    if (!itemId) throw new Error('Item ID is required.')
    const wsId = workspaceId || getActiveWorkspaceId()

    const url = API_ENDPOINTS.ROADMAP.ITEM_DETAIL(itemId)
    const response = await apiClient.get(url, { params: wsId ? { workspace_id: wsId } : {} })
    if (!response?.success) {
      const err = new Error(response?.error || `Failed to retrieve roadmap item '${itemId}'.`)
      err.status = response?.status
      throw err
    }
    return normalizeRoadmapItem(response.data)
  },

  /**
   * Create a new Roadmap Item.
   */
  async createRoadmapItem(workspaceId = null, itemData) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) throw new Error('Workspace ID is required to create a roadmap item.')

    const payload = {
      title: itemData.title,
      description: itemData.description || '',
      status: itemData.status || 'Planned',
      priority: itemData.priority || 'Medium',
      startDate: itemData.startDate,
      targetDate: itemData.targetDate,
      milestone: itemData.milestone || 'Phase 1',
      ...(itemData.roadmapId ? { roadmapId: itemData.roadmapId } : {}),
      ...(itemData.featureId ? { featureId: itemData.featureId } : {}),
      ...(itemData.featureGroupId ? { featureGroupId: itemData.featureGroupId } : {}),
      ...(itemData.prdId ? { prdId: itemData.prdId } : {}),
      ...(itemData.prioritizationScenarioId ? { prioritizationScenarioId: itemData.prioritizationScenarioId } : {}),
      ...(itemData.releaseId ? { releaseId: itemData.releaseId } : {}),
      ...(itemData.priorityScore !== undefined && itemData.priorityScore !== null ? { priorityScore: itemData.priorityScore } : {}),
      ...(itemData.isCommitted !== undefined ? { isCommitted: itemData.isCommitted } : {}),
      ...(itemData.owner ? { owner: itemData.owner } : {}),
      ...(itemData.ownerId ? { ownerId: itemData.ownerId } : {}),
      ...(itemData.actualStartDate ? { actualStartDate: itemData.actualStartDate } : {}),
      ...(itemData.actualEndDate ? { actualEndDate: itemData.actualEndDate } : {}),
      ...(itemData.progress !== undefined ? { progress: Number(itemData.progress) } : {}),
      ...(itemData.dependencies ? { dependencies: itemData.dependencies } : {}),
      ...(itemData.notes ? { notes: itemData.notes } : {}),
    }

    const response = await apiClient.post(API_ENDPOINTS.ROADMAP.ITEM_CREATE, payload, {
      params: { workspace_id: wsId },
    })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to create roadmap item.')
      err.status = response?.status
      throw err
    }
    return normalizeRoadmapItem(response.data)
  },

  /**
   * Update an existing Roadmap Item with optimistic concurrency protection.
   */
  async updateRoadmapItem(workspaceId = null, itemId, updateData) {
    if (!itemId) throw new Error('Item ID is required.')
    const wsId = workspaceId || getActiveWorkspaceId()

    const payload = {
      ...(updateData.roadmapId !== undefined ? { roadmapId: updateData.roadmapId } : {}),
      ...(updateData.featureId !== undefined ? { featureId: updateData.featureId } : {}),
      ...(updateData.featureGroupId !== undefined ? { featureGroupId: updateData.featureGroupId } : {}),
      ...(updateData.prdId !== undefined ? { prdId: updateData.prdId } : {}),
      ...(updateData.prioritizationScenarioId !== undefined ? { prioritizationScenarioId: updateData.prioritizationScenarioId } : {}),
      ...(updateData.releaseId !== undefined ? { releaseId: updateData.releaseId } : {}),
      ...(updateData.title !== undefined ? { title: updateData.title } : {}),
      ...(updateData.description !== undefined ? { description: updateData.description } : {}),
      ...(updateData.status !== undefined ? { status: updateData.status } : {}),
      ...(updateData.priority !== undefined ? { priority: updateData.priority } : {}),
      ...(updateData.priorityScore !== undefined ? { priorityScore: updateData.priorityScore } : {}),
      ...(updateData.isCommitted !== undefined ? { isCommitted: updateData.isCommitted } : {}),
      ...(updateData.owner !== undefined ? { owner: updateData.owner } : {}),
      ...(updateData.ownerId !== undefined ? { ownerId: updateData.ownerId } : {}),
      ...(updateData.startDate !== undefined ? { startDate: updateData.startDate } : {}),
      ...(updateData.targetDate !== undefined ? { targetDate: updateData.targetDate } : {}),
      ...(updateData.actualStartDate !== undefined ? { actualStartDate: updateData.actualStartDate } : {}),
      ...(updateData.actualEndDate !== undefined ? { actualEndDate: updateData.actualEndDate } : {}),
      ...(updateData.milestone !== undefined ? { milestone: updateData.milestone } : {}),
      ...(updateData.progress !== undefined ? { progress: Number(updateData.progress) } : {}),
      ...(updateData.dependencies !== undefined ? { dependencies: updateData.dependencies } : {}),
      ...(updateData.notes !== undefined ? { notes: updateData.notes } : {}),
      ...(updateData.expectedVersion !== undefined ? { expectedVersion: updateData.expectedVersion } : {}),
    }

    const url = API_ENDPOINTS.ROADMAP.ITEM_UPDATE(itemId)
    const response = await apiClient.put(url, payload, {
      params: wsId ? { workspace_id: wsId } : {},
    })
    if (!response?.success) {
      const err = new Error(response?.error || `Failed to update roadmap item '${itemId}'.`)
      err.status = response?.status
      throw err
    }
    return normalizeRoadmapItem(response.data)
  },

  /**
   * Delete a Roadmap Item permanently.
   */
  async deleteRoadmapItem(workspaceId = null, itemId) {
    if (!itemId) throw new Error('Item ID is required.')
    const wsId = workspaceId || getActiveWorkspaceId()

    const url = API_ENDPOINTS.ROADMAP.ITEM_DELETE(itemId)
    const response = await apiClient.delete(url, {
      params: wsId ? { workspace_id: wsId } : {},
    })
    if (!response?.success) {
      const err = new Error(response?.error || `Failed to delete roadmap item '${itemId}'.`)
      err.status = response?.status
      throw err
    }
    return response.data || { success: true, id: itemId }
  },

  /**
   * Retrieve feature groups and PRD candidates eligible for roadmap commitment.
   */
  async getCandidates(workspaceId = null) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) return { total: 0, items: [] }

    const response = await apiClient.get(API_ENDPOINTS.ROADMAP.CANDIDATES, {
      params: { workspace_id: wsId },
    })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to retrieve roadmap candidates.')
      err.status = response?.status
      throw err
    }

    const data = response.data || { total: 0, items: [] }
    const items = Array.isArray(data.items) ? data.items.map(normalizeCandidate) : []
    return {
      total: data.total !== undefined ? data.total : items.length,
      items,
    }
  },

  /**
   * Promote an Approved PRD to formal roadmap items in MongoDB Atlas.
   * Strict business rule: non-approved PRDs are rejected by backend.
   */
  async promoteApprovedPRD(workspaceId = null, {
    prdId,
    roadmapId = null,
    selectedPhases = null,
    targetMilestone = null,
    startDate = null,
    targetDate = null,
  }) {
    if (!prdId) throw new Error('PRD ID is required for roadmap promotion.')
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) throw new Error('Workspace ID is required for PRD promotion.')

    const payload = {
      prdId,
      ...(roadmapId ? { roadmapId } : {}),
      ...(selectedPhases ? { selectedPhases } : {}),
      ...(targetMilestone ? { targetMilestone } : {}),
      ...(startDate ? { startDate } : {}),
      ...(targetDate ? { targetDate } : {}),
    }

    const response = await apiClient.post(API_ENDPOINTS.ROADMAP.PROMOTE_PRD, payload, {
      params: { workspace_id: wsId },
    })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to promote approved PRD to roadmap.')
      err.status = response?.status
      throw err
    }
    return response.data
  },
}

export default roadmapService
