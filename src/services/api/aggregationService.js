/**
 * Feature Request Aggregation Service
 * Groups similar customer feedback into aggregated request clusters,
 * provides counts, excerpts, recurring pain points, merge, and approval workflows.
 */
import { apiClient } from './apiClient'
import { API_ENDPOINTS } from './types'

export const aggregationService = {
  /**
   * Aggregate feedback items into cohesive feature request groups
   * @param {Array} feedbackList - Current workspace feedback
   * @param {Array} featuresList - Current workspace features
   */
  generateAggregatedGroups(feedbackList = [], featuresList = []) {
    if (!Array.isArray(feedbackList) || feedbackList.length === 0) {
      return []
    }

    // Cluster feedback items by category and shared tags/keywords
    const clusterMap = {}

    feedbackList.forEach(item => {
      // Find suitable group key
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
          status: 'suggested', // 'suggested' | 'approved' | 'merged'
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

    // Transform map to array with counts, top excerpts, and priority heuristics
    return Object.values(clusterMap)
      .map(group => {
        const count = group.feedbackItems.length
        const excerpts = group.feedbackItems.slice(0, 3).map(f => ({
          id: f.id,
          title: f.title,
          customer: f.customer,
          company: f.company,
          sentiment: f.sentiment,
          snippet: (f.description || f.title).slice(0, 100) + '...',
        }))

        // Match with existing feature if linked
        const existingFeature = featuresList.find(feat => 
          feat.id === group.promotedFeatureId || 
          group.feedbackItems.some(fi => fi.linkedFeatureId === feat.id)
        )

        return {
          ...group,
          count,
          excerpts,
          isPromoted: Boolean(existingFeature),
          promotedFeatureName: existingFeature?.name || null,
          promotedFeatureScore: existingFeature?.score || null,
          painPoints: group.painPoints.slice(0, 4),
        }
      })
      .sort((a, b) => b.count - a.count)
  },

  /**
   * Fetch feature groups (delegating to backend when configured)
   */
  async getGroups(feedbackList = [], featuresList = []) {
    if (apiClient.isConfigured()) {
      return apiClient.get(API_ENDPOINTS.AGGREGATION.GROUPS)
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

  /**
   * Merge sourceGroup into targetGroup
   */
  mergeGroups(sourceGroupId, targetGroupId, currentGroups) {
    const source = currentGroups.find(g => g.id === sourceGroupId)
    const target = currentGroups.find(g => g.id === targetGroupId)
    if (!source || !target) return currentGroups

    const mergedFeedback = [...target.feedbackItems, ...source.feedbackItems]
    const updatedTarget = {
      ...target,
      feedbackItems: mergedFeedback,
      count: mergedFeedback.length,
      painPoints: Array.from(new Set([...target.painPoints, ...source.painPoints])),
      excerpts: mergedFeedback.slice(0, 4).map(f => ({
        id: f.id,
        title: f.title,
        customer: f.customer,
        company: f.company,
        sentiment: f.sentiment,
        snippet: (f.description || f.title).slice(0, 100) + '...',
      })),
    }

    return currentGroups
      .filter(g => g.id !== sourceGroupId)
      .map(g => (g.id === targetGroupId ? updatedTarget : g))
  },
}

function formatGroupTitle(category, tag) {
  const cleanTag = tag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  if (category === 'Performance') return `Performance Optimization: ${cleanTag}`
  if (category === 'Integrations') return `Ecosystem Integrations: ${cleanTag}`
  if (category === 'Usability') return `UI/UX Refinements: ${cleanTag}`
  if (category === 'Reliability') return `Reliability & Resilience: ${cleanTag}`
  if (category === 'Pricing') return `Pricing & Licensing: ${cleanTag}`
  return `${category}: ${cleanTag}`
}

export default aggregationService
