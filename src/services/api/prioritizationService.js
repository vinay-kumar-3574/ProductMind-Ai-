/**
 * Feature Prioritization Service
 * Implements the verified 4-factor scoring formula and tier thresholds.
 * Formula: (0.35 × Customer Impact) + (0.30 × Urgency) + (0.20 × Demand) + (0.15 × Business Value)
 */
import { apiClient } from './apiClient'
import { API_ENDPOINTS } from './types'
import {
  calculatePriorityScore,
  getScoreBreakdown,
  rankFeatures,
  getPriorityTier,
  FACTOR_WEIGHTS,
} from '../../data/scoringFormulas'

export const prioritizationService = {
  FACTOR_WEIGHTS,

  /**
   * Calculate exact priority score for a feature
   */
  calculateScore(factors) {
    return calculatePriorityScore(factors)
  },

  /**
   * Get mathematical breakdown of factor contributions
   */
  getBreakdown(factors) {
    return getScoreBreakdown(factors)
  },

  /**
   * Determine priority tier
   */
  getTier(score) {
    return getPriorityTier(score)
  },

  /**
   * Rank a list of features by descending score
   */
  rank(featuresList) {
    return rankFeatures(featuresList)
  },

  /**
   * Generate human-readable mathematical explanation for a feature's score
   */
  getExplanation(feature) {
    const bd = getScoreBreakdown(feature)
    const tier = getPriorityTier(bd.totalScore)
    return {
      tier: tier.label,
      totalScore: bd.totalScore,
      summary: `Ranked as ${tier.label} priority with a score of ${bd.totalScore.toFixed(2)} / 10.0. ` +
        `Customer Impact contributes ${(bd.customerImpactContribution).toFixed(2)} (35%), ` +
        `Urgency contributes ${(bd.urgencyContribution).toFixed(2)} (30%), ` +
        `Customer Demand contributes ${(bd.demandContribution).toFixed(2)} (20%), and ` +
        `Business Value contributes ${(bd.businessValueContribution).toFixed(2)} (15%).`,
      formulaString: `(0.35 × ${feature.customerImpact || 5}) + (0.30 × ${feature.urgency || 5}) + (0.20 × ${feature.demand || 5}) + (0.15 × ${feature.businessValue || 5}) = ${bd.totalScore.toFixed(2)}`,
    }
  },

  /**
   * Fetch prioritized features via API or local computation
   */
  async getRankedFeatures(featuresList = []) {
    if (apiClient.isConfigured()) {
      return apiClient.get(API_ENDPOINTS.PRIORITIZATION.FEATURES)
    }

    const ranked = rankFeatures(featuresList)
    return {
      success: true,
      data: ranked,
      isDemo: true,
      status: 200,
      timestamp: new Date().toISOString(),
    }
  },
}

export default prioritizationService
