/**
 * ProductMind AI — PRD and Product Planning Service
 * Real integration with FastAPI Product Planning Agent for automated PRD,
 * user stories, acceptance criteria, technical specs, and human review workflows.
 * Backed directly by MongoDB Atlas.
 */

import { apiClient, getActiveWorkspaceId } from './apiClient'
import { API_ENDPOINTS } from './types'

/**
 * Normalizes 13-section dictionary so both camelCase and snake_case representations
 * map cleanly into standard frontend keys.
 */
export function normalizePlanSections(rawSections = {}) {
  const s = rawSections || {}
  return {
    overview: s.overview || s.executive_summary || '',
    problemStatement: s.problemStatement || s.problem_statement || '',
    targetUsers: s.targetUsers || s.target_users || '',
    customerPainPoints: s.customerPainPoints || s.customer_pain_points || '',
    proposedSolution: s.proposedSolution || s.proposed_solution || '',
    goalsAndSuccessMetrics: s.goalsAndSuccessMetrics || s.goals_and_success_metrics || '',
    functionalRequirements: s.functionalRequirements || s.functional_requirements || '',
    nonFunctionalRequirements: s.nonFunctionalRequirements || s.non_functional_requirements || '',
    userStories: s.userStories || s.user_stories || '',
    acceptanceCriteria: s.acceptanceCriteria || s.acceptance_criteria || '',
    dependenciesAndConstraints: s.dependenciesAndConstraints || s.dependencies_and_constraints || '',
    risksAndMitigations: s.risksAndMitigations || s.risks_and_mitigations || '',
    releasePlan: s.releasePlan || s.release_plan || '',
  }
}

/**
 * Normalizes a raw ProductPlanResponse document from MongoDB Atlas.
 */
export function normalizePlan(plan) {
  if (!plan) return null
  const id = plan.planning_id || plan.id || plan._id
  const userStories = Array.isArray(plan.user_stories)
    ? plan.user_stories
    : (Array.isArray(plan.userStories) ? plan.userStories : [])

  return {
    ...plan,
    id,
    planning_id: id,
    featureId: plan.feature_group_id || plan.featureId || null,
    title: plan.title || 'Untitled PRD',
    version: plan.version || '1.0.0',
    status: plan.status || 'draft',
    author: plan.author || 'Product Manager',
    sections: normalizePlanSections(plan.sections),
    user_stories: userStories,
    userStories: userStories,
    technical_requirements: plan.technical_requirements || plan.technicalRequirements || [],
    success_metrics: plan.success_metrics || plan.successMetrics || [],
    risk_analysis: plan.risk_analysis || plan.riskAnalysis || [],
    roadmap_recommendations: plan.roadmap_recommendations || plan.roadmapRecommendations || [],
    supporting_evidence: plan.supporting_evidence || plan.supportingEvidence || [],
    createdAt: plan.created_at || plan.createdAt || new Date().toISOString(),
    updatedAt: plan.updated_at || plan.updatedAt || new Date().toISOString(),
    reviewNotes: plan.review_notes || plan.reviewNotes || null,
    reviewedBy: plan.reviewed_by || plan.reviewedBy || null,
    reviewedAt: plan.reviewed_at || plan.reviewedAt || null,
  }
}

export const prdService = {
  /**
   * Run real AI Product Planning Agent to generate complete PRD & Plan
   */
  async generateProductPlan({
    workspaceId = null,
    featureGroupId,
    strategicContext = null,
    targetRelease = 'v2.5.0',
    includeTechnicalSpecs = true,
    includeUserStories = true,
    includeMetrics = true,
    includeRoadmap = true,
  }) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) {
      throw new Error('Workspace ID is required to generate a product plan.')
    }
    if (!featureGroupId) {
      throw new Error('Feature group ID is required.')
    }

    const normalizedStrategicContext =
      typeof strategicContext === 'string'
        ? { product_name: strategicContext, additional_planning_instructions: strategicContext }
        : strategicContext

    const payload = {
      workspace_id: wsId,
      feature_group_id: featureGroupId,
      ...(normalizedStrategicContext ? { strategic_context: normalizedStrategicContext } : {}),
    }

    const response = await apiClient.post(API_ENDPOINTS.AI_PLANNING.GENERATE, payload)
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to generate product plan.')
      err.status = response?.status
      throw err
    }
    return normalizePlan(response.data)
  },

  /**
   * List saved Product Plans from backend MongoDB Atlas
   */
  async listProductPlans(workspaceId = null, status = null) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) return []

    const queryParams = {
      workspace_id: wsId,
      ...(status ? { status } : {}),
    }

    const response = await apiClient.get(API_ENDPOINTS.AI_PLANNING.LIST, {
      params: queryParams,
    })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to list product plans.')
      err.status = response?.status
      throw err
    }
    const plans = response.data || []
    return Array.isArray(plans) ? plans.map(normalizePlan) : []
  },

  /**
   * Retrieve a specific Product Plan by PRD/Plan ID
   */
  async getProductPlan(planningId, workspaceId = null) {
    if (!planningId) {
      throw new Error('Planning ID is required.')
    }
    const wsId = workspaceId || getActiveWorkspaceId()
    const url = API_ENDPOINTS.AI_PLANNING.DETAIL(planningId)
    const response = await apiClient.get(url, {
      params: wsId ? { workspace_id: wsId } : {},
    })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to retrieve product plan.')
      err.status = response?.status
      throw err
    }
    return normalizePlan(response.data)
  },

  /**
   * Update PRD Sections with Atlas persistence, optimistic concurrency check,
   * and approved-document protection.
   */
  async updatePRDSections(planningId, {
    sections,
    title = null,
    structuredPrd = null,
    userStories = null,
    forceApprovedOverwrite = false,
    versionBump = 'patch',
    expectedVersion = null,
    workspaceId = null,
  }) {
    if (!planningId) {
      throw new Error('Planning ID is required to update sections.')
    }
    const wsId = workspaceId || getActiveWorkspaceId()
    const url = API_ENDPOINTS.AI_PLANNING.SECTIONS(planningId)
    const payload = {
      sections,
      ...(title ? { title } : {}),
      ...(structuredPrd ? { structuredPrd } : {}),
      ...(userStories !== null && userStories !== undefined ? { userStories } : {}),
      ...(forceApprovedOverwrite !== undefined ? { forceApprovedOverwrite } : {}),
      ...(versionBump ? { versionBump } : {}),
      ...(expectedVersion ? { expectedVersion } : {}),
    }
    const response = await apiClient.put(url, payload, {
      params: wsId ? { workspace_id: wsId } : {},
    })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to update PRD sections.')
      err.status = response?.status
      throw err
    }
    return normalizePlan(response.data)
  },

  /**
   * Regenerate a single PRD section using Groq LLM inference without full-document loops.
   */
  async regenerateSection(planningId, {
    sectionKey,
    customInstructions = null,
    forceApprovedOverwrite = false,
    workspaceId = null,
  }) {
    if (!planningId) {
      throw new Error('Planning ID is required to regenerate section.')
    }
    if (!sectionKey) {
      throw new Error('Section key is required.')
    }
    const wsId = workspaceId || getActiveWorkspaceId()
    const url = API_ENDPOINTS.AI_PLANNING.REGENERATE_SECTION(planningId)
    const payload = {
      sectionKey,
      ...(customInstructions ? { customInstructions } : {}),
      ...(forceApprovedOverwrite !== undefined ? { forceApprovedOverwrite } : {}),
    }
    const response = await apiClient.post(url, payload, {
      params: wsId ? { workspace_id: wsId } : {},
    })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to regenerate PRD section.')
      err.status = response?.status
      throw err
    }
    return normalizePlan(response.data)
  },

  /**
   * Submit human review decision (approve, reject, pending_review, draft)
   */
  async reviewProductPlan(planningId, actionOrStatus, notes = '') {
    if (!planningId) {
      throw new Error('Planning ID is required to submit review.')
    }
    const url = API_ENDPOINTS.AI_PLANNING.REVIEW(planningId)
    const statusMap = {
      approve: 'approved',
      approved: 'approved',
      reject: 'rejected',
      rejected: 'rejected',
      request_changes: 'rejected',
      submit: 'pending_review',
      submit_for_review: 'pending_review',
      pending_review: 'pending_review',
      draft: 'draft',
    }
    const reviewStatus = statusMap[String(actionOrStatus || '').toLowerCase()] || actionOrStatus
    const response = await apiClient.patch(url, {
      review_status: reviewStatus,
      ...(notes ? { review_notes: notes } : {}),
    })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to update PRD review status.')
      err.status = response?.status
      throw err
    }
    return normalizePlan(response.data)
  },

  /**
   * Validate PRD quality, completeness, traceability, criteria, and risks without modifying Atlas data.
   */
  async validateProductPlan(planningId, workspaceId = null) {
    if (!planningId) {
      throw new Error('Planning ID is required to validate PRD.')
    }
    const wsId = workspaceId || getActiveWorkspaceId()
    const url = API_ENDPOINTS.AI_PLANNING.VALIDATE(planningId)
    const response = await apiClient.post(url, {}, {
      params: wsId ? { workspace_id: wsId } : {},
    })
    if (!response?.success) {
      const err = new Error(response?.error || 'Failed to validate product plan.')
      err.status = response?.status
      throw err
    }
    return response.data
  },

  /**
   * Legacy alias: generatePRD
   */
  async generatePRD(feature, customTitle = '') {
    const wsId = getActiveWorkspaceId()
    return this.generateProductPlan({
      workspaceId: wsId,
      featureGroupId: feature?.id,
      strategicContext: customTitle || feature?.name,
    })
  },
}

export default prdService
