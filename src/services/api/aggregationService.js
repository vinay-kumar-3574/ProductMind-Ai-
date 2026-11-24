/**
 * ProductMind AI — Feature Request Aggregation Service
 * Connects to FastAPI AI Feature Intelligence Agent to cluster customer feedback,
 * aggregate demand, evaluate sentiment, and synthesize product feature proposals.
 */

import { apiClient, getActiveWorkspaceId, isBackendConfigured } from './apiClient'
import { API_ENDPOINTS } from './types'

function formatGroupTitle(category, tag) {
  const cleanTag = (tag || 'General').replace(/[-_]/g, ' ')
  const capitalizedTag = cleanTag.charAt(0).toUpperCase() + cleanTag.slice(1)
  return `${capitalizedTag} (${category || 'Feature'})`
}

/**
 * Centralized normalizer: maps both backend FeatureGroupResult (FastAPI/MongoDB)
 * and client-side structures into a uniform interface for the UI.
 */
export function normalizeFeatureGroup(raw, featuresList = []) {
  if (!raw) return null
  const id = String(raw.feature_group_id || raw.featureGroupId || raw.id || raw._id || '')
  const title = String(raw.group_name || raw.groupName || raw.name || raw.title || 'Untitled Feature Group')
  const description = String(
    raw.consolidated_description ||
    raw.consolidatedDescription ||
    raw.feature_summary ||
    raw.featureSummary ||
    raw.description ||
    ''
  )
  const featureSummary = String(raw.feature_summary || raw.featureSummary || raw.description || '')
  const category = raw.category || 'Feature Requests'
  const primaryTag = raw.primary_tag || raw.primaryTag || (raw.common_themes && raw.common_themes[0]) || (raw.commonThemes && raw.commonThemes[0]) || 'General'

  // Demand metrics
  const count = Number(
    raw.total_request_count ??
    raw.totalRequestCount ??
    raw.feedback_count ??
    raw.feedbackCount ??
    raw.count ??
    (raw.related_feedback_ids || raw.relatedFeedbackIds || []).length ??
    0
  )
  const uniqueCustomers = Number(
    raw.unique_customer_count ??
    raw.uniqueCustomerCount ??
    raw.unique_customers_count ??
    1
  )

  // Sentiment distribution
  const rawSent = raw.sentiment_distribution || raw.sentimentDistribution || {}
  const sentimentDistribution = {
    Positive: Number(rawSent.Positive ?? rawSent.positive ?? 0),
    Neutral: Number(rawSent.Neutral ?? rawSent.neutral ?? 0),
    Negative: Number(rawSent.Negative ?? rawSent.negative ?? 0),
    Mixed: Number(rawSent.Mixed ?? rawSent.mixed ?? 0),
  }

  // Pain points and evidence
  const painPoints = Array.isArray(raw.common_pain_points || raw.commonPainPoints || raw.pain_points || raw.painPoints)
    ? (raw.common_pain_points || raw.commonPainPoints || raw.pain_points || raw.painPoints)
    : (raw.customer_pain_point ? [raw.customer_pain_point] : [])

  const rawEvidence = Array.isArray(raw.evidence || raw.evidence_quotes || raw.evidenceQuotes)
    ? (raw.evidence || raw.evidence_quotes || raw.evidenceQuotes)
    : []

  // Excerpts: if raw already has structured excerpts, keep them; else format from evidence or member feedback items
  let excerpts = []
  if (Array.isArray(raw.excerpts) && raw.excerpts.length > 0) {
    excerpts = raw.excerpts
  } else if (Array.isArray(raw.feedback_items) && raw.feedback_items.length > 0) {
    excerpts = raw.feedback_items.slice(0, 3).map(f => ({
      id: f.id,
      customer: f.customer || f.customer_name || 'Customer Voice',
      company: f.company || f.company_name || 'Verified Demand',
      sentiment: f.sentiment || 'Neutral',
      snippet: (f.description || f.title || '').slice(0, 100) + '...',
    }))
  } else if (rawEvidence.length > 0) {
    excerpts = rawEvidence.slice(0, 3).map((snippet, idx) => ({
      id: `ev-${idx}`,
      customer: 'Customer Voice',
      company: 'Verified Demand',
      sentiment: 'Neutral',
      snippet: typeof snippet === 'string' ? snippet : JSON.stringify(snippet),
    }))
  }

  const relatedFeedbackIds = (raw.related_feedback_ids || raw.relatedFeedbackIds || []).map(String)
  const commonThemes = raw.common_themes || raw.commonThemes || (primaryTag ? [primaryTag] : [])
  const suggestedCapability = raw.suggested_capability || raw.suggestedCapability || null
  const groupingConfidence = raw.grouping_confidence ?? raw.groupingConfidence ?? null
  const groupingReason = raw.grouping_reason || raw.groupingReason || null
  const status = raw.grouping_status || raw.status || 'suggested'
  const promotedFeatureId = raw.promoted_feature_id || raw.promotedFeatureId || null

  const existingFeature = (featuresList || []).find(
    f => (promotedFeatureId && String(f.id) === String(promotedFeatureId)) ||
         f.name.toLowerCase() === title.toLowerCase() ||
         (f.relatedFeedbackIds && relatedFeedbackIds.some(fid => f.relatedFeedbackIds.includes(fid)))
  )

  const isPromoted = Boolean(
    promotedFeatureId ||
    existingFeature ||
    status === 'promoted' ||
    status === 'prioritized'
  )

  return {
    id,
    feature_group_id: id,
    title,
    group_name: title,
    description,
    consolidated_description: description,
    featureSummary,
    feature_summary: featureSummary,
    category,
    primaryTag,
    primary_tag: primaryTag,
    count,
    total_request_count: count,
    uniqueCustomers,
    unique_customer_count: uniqueCustomers,
    sentimentDistribution,
    sentiment_distribution: sentimentDistribution,
    urgencyDistribution: raw.urgency_distribution || raw.urgencyDistribution || {},
    urgency_distribution: raw.urgency_distribution || raw.urgencyDistribution || {},
    painPoints,
    common_pain_points: painPoints,
    evidence: rawEvidence,
    evidence_quotes: rawEvidence,
    excerpts,
    commonThemes,
    common_themes: commonThemes,
    relatedFeedbackIds,
    related_feedback_ids: relatedFeedbackIds,
    feedbackItems: raw.feedback_items || raw.feedbackItems || [],
    feedback_items: raw.feedback_items || raw.feedbackItems || [],
    suggestedCapability,
    suggested_capability: suggestedCapability,
    groupingConfidence,
    grouping_confidence: groupingConfidence,
    groupingReason,
    grouping_reason: groupingReason,
    status,
    grouping_status: status,
    isPromoted,
    promotedFeatureId: promotedFeatureId || existingFeature?.id || null,
    promoted_feature_id: promotedFeatureId || existingFeature?.id || null,
    promotedFeatureName: existingFeature?.name || null,
    promotedFeatureScore: existingFeature?.score || null,
    isAIGenerated: Boolean(raw.isAIGenerated ?? groupingConfidence ?? raw.feature_group_id),
  }
}

export const aggregationService = {
  /**
   * Run AI Feature Intelligence Agent clustering
   */
  async groupFeatures({
    workspaceId,
    feedbackIds = null,
    forceRegroup = false,
    confidenceThreshold = 0.65,
    minGroupSize = 1,
  } = {}) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) {
      throw new Error('Workspace ID is required for feature aggregation.')
    }

    const payload = {
      workspace_id: wsId,
      ...(feedbackIds ? { feedback_ids: feedbackIds } : {}),
      force_regroup: forceRegroup,
      confidence_threshold: confidenceThreshold,
      min_group_size: minGroupSize,
    }

    const response = await apiClient.post(API_ENDPOINTS.AI_FEATURES.GROUP, payload)
    const data = response.data || {}
    const rawGroups = data.groups || data.feature_groups || []
    const normalized = rawGroups.map(item => normalizeFeatureGroup(item))

    return {
      ...data,
      groups: normalized,
      feature_groups: normalized,
    }
  },

  /**
   * Fetch consolidated feature groups from backend
   */
  async getFeatureGroups(workspaceId = null, params = {}) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) {
      return []
    }

    const queryParams = {
      workspace_id: wsId,
      ...params,
    }

    const response = await apiClient.get(API_ENDPOINTS.AI_FEATURES.GROUPS, {
      params: queryParams,
    })
    const list = Array.isArray(response.data) ? response.data : []
    return list.map(item => normalizeFeatureGroup(item))
  },

  /**
   * Fetch specific feature group by ID
   */
  async getFeatureGroup(groupId, workspaceId = null) {
    const wsId = workspaceId || getActiveWorkspaceId()
    const url = typeof API_ENDPOINTS.AI_FEATURES.GROUP_DETAIL === 'function'
      ? API_ENDPOINTS.AI_FEATURES.GROUP_DETAIL(groupId)
      : `/api/v1/ai/features/groups/${groupId}`
    const response = await apiClient.get(url, {
      params: { workspace_id: wsId },
    })
    return normalizeFeatureGroup(response.data)
  },

  /**
   * Fetch member feedback items for a specific feature group
   */
  async getGroupFeedback(groupId, workspaceId = null) {
    const wsId = workspaceId || getActiveWorkspaceId()
    const url = typeof API_ENDPOINTS.AI_FEATURES.GROUP_FEEDBACK === 'function'
      ? API_ENDPOINTS.AI_FEATURES.GROUP_FEEDBACK(groupId)
      : `/api/v1/ai/features/groups/${groupId}/feedback`
    const response = await apiClient.get(url, {
      params: { workspace_id: wsId },
    })
    return Array.isArray(response.data) ? response.data : []
  },

  /**
   * Merge two feature groups
   */
  async mergeGroups(sourceGroupId, targetGroupId, workspaceId = null) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) throw new Error('Workspace ID is required to merge feature groups.')
    if (!sourceGroupId || !targetGroupId) {
      throw new Error('Both sourceGroupId and targetGroupId are required.')
    }
    const response = await apiClient.post(API_ENDPOINTS.AI_FEATURES.MERGE, {
      workspace_id: wsId,
      source_group_id: sourceGroupId,
      target_group_id: targetGroupId,
    })
    const data = response.data || {}
    return {
      success: true,
      sourceGroupId: data.source_group_id,
      targetGroupId: data.target_group_id,
      repointedFeedbackCount: data.repointed_feedback_count,
      updatedTargetGroup: normalizeFeatureGroup(data.updated_target_group),
      message: data.message,
    }
  },

  /**
   * Detect duplicates among feedback items using AI & deterministic lexical matching
   */
  async detectDuplicates({ workspaceId = null, feedbackIds = null, targetFeedbackId = null } = {}) {
    const wsId = workspaceId || getActiveWorkspaceId()
    if (!wsId) throw new Error('Workspace ID is required for duplicate detection.')
    const response = await apiClient.post(API_ENDPOINTS.AI_FEATURES.DUPLICATES, {
      workspace_id: wsId,
      ...(feedbackIds ? { feedback_ids: feedbackIds } : {}),
      ...(targetFeedbackId ? { target_feedback_id: targetFeedbackId } : {}),
    })
    return response.data
  },

  /**
   * Backward-compatible local clustering fallback for demo/offline states
   */
  generateAggregatedGroups(feedbackList = [], featuresList = []) {
    if (!Array.isArray(feedbackList) || feedbackList.length === 0) {
      return []
    }

    const clusterMap = {}
    feedbackList.forEach((item) => {
      const primaryTag = (item.tags && item.tags[0]) || item.category || 'General'
      const key = `${item.category}__${primaryTag.toLowerCase()}`

      if (!clusterMap[key]) {
        clusterMap[key] = {
          id: `grp-${key.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
          title: formatGroupTitle(item.category, primaryTag),
          category: item.category,
          primaryTag,
          feedbackItems: [],
          sentimentDistribution: { Positive: 0, Neutral: 0, Negative: 0 },
          painPoints: [],
          status: 'suggested',
          promotedFeatureId: item.linkedFeatureId || null,
        }
      }

      clusterMap[key].feedbackItems.push(item)
      if (item.sentiment && clusterMap[key].sentimentDistribution[item.sentiment] !== undefined) {
        clusterMap[key].sentimentDistribution[item.sentiment]++
      }
      if (item.sentiment === 'Negative' && item.title) {
        if (!clusterMap[key].painPoints.includes(item.title)) {
          clusterMap[key].painPoints.push(item.title)
        }
      }
    })

    return Object.values(clusterMap)
      .map((group) => {
        const count = group.feedbackItems.length
        const excerpts = group.feedbackItems.slice(0, 3).map((f) => ({
          id: f.id,
          title: f.title,
          customer: f.customer,
          company: f.company,
          sentiment: f.sentiment,
          snippet: (f.description || f.title).slice(0, 100) + '...',
        }))

        const existingFeature = featuresList.find(
          (feat) =>
            feat.id === group.promotedFeatureId ||
            group.feedbackItems.some((fi) => fi.linkedFeatureId === feat.id)
        )

        return {
          ...group,
          count,
          excerpts,
          isPromoted: Boolean(existingFeature),
          promotedFeatureName: existingFeature?.name || null,
          promotedFeatureScore: existingFeature?.score || null,
          painPoints: group.painPoints.slice(0, 4),
          isAIGenerated: false,
        }
      })
      .sort((a, b) => b.count - a.count)
  },

  /**
   * Compatibility wrapper
   */
  async getGroups(feedbackList = [], featuresList = []) {
    const wsId = getActiveWorkspaceId()
    if (wsId && isBackendConfigured()) {
      try {
        const groups = await this.getFeatureGroups(wsId)
        return {
          success: true,
          data: groups,
          isDemo: false,
          status: 200,
        }
      } catch (err) {
        console.error('Failed to load feature groups from backend:', err)
        throw err
      }
    }

    const groups = this.generateAggregatedGroups(feedbackList, featuresList)
    return {
      success: true,
      data: groups,
      isDemo: true,
      status: 200,
      timestamp: new Date().toISOString(),
    }
  },
}

export default aggregationService
