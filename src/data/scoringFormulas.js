/**
 * Exact Priority Score Formula specified in Master Prompt:
 * Priority Score = (0.35 × Customer Impact) + (0.30 × Urgency) + (0.20 × Demand) + (0.15 × Business Value)
 * All factors on a 1–10 scale. Resulting score stays on 1–10 scale.
 */

export const FACTOR_WEIGHTS = {
  customerImpact: 0.35,
  urgency: 0.30,
  demand: 0.20,
  businessValue: 0.15,
}

export function calculatePriorityScore(factors) {
  const customerImpact = Math.min(10, Math.max(1, Number(factors.customerImpact) || 1))
  const urgency = Math.min(10, Math.max(1, Number(factors.urgency) || 1))
  const demand = Math.min(10, Math.max(1, Number(factors.demand) || 1))
  const businessValue = Math.min(10, Math.max(1, Number(factors.businessValue) || 1))

  const rawScore = 
    (FACTOR_WEIGHTS.customerImpact * customerImpact) +
    (FACTOR_WEIGHTS.urgency * urgency) +
    (FACTOR_WEIGHTS.demand * demand) +
    (FACTOR_WEIGHTS.businessValue * businessValue)

  // Rounded to 2 decimal places
  return Math.round(rawScore * 100) / 100
}

export function getScoreBreakdown(factors) {
  const customerImpact = Math.min(10, Math.max(1, Number(factors.customerImpact) || 1))
  const urgency = Math.min(10, Math.max(1, Number(factors.urgency) || 1))
  const demand = Math.min(10, Math.max(1, Number(factors.demand) || 1))
  const businessValue = Math.min(10, Math.max(1, Number(factors.businessValue) || 1))

  return {
    customerImpactContribution: Math.round((FACTOR_WEIGHTS.customerImpact * customerImpact) * 100) / 100,
    urgencyContribution: Math.round((FACTOR_WEIGHTS.urgency * urgency) * 100) / 100,
    demandContribution: Math.round((FACTOR_WEIGHTS.demand * demand) * 100) / 100,
    businessValueContribution: Math.round((FACTOR_WEIGHTS.businessValue * businessValue) * 100) / 100,
    totalScore: calculatePriorityScore(factors),
  }
}

export function rankFeatures(features) {
  return [...features].sort((a, b) => {
    const scoreA = calculatePriorityScore(a)
    const scoreB = calculatePriorityScore(b)
    if (scoreB !== scoreA) {
      return scoreB - scoreA
    }
    // secondary sort by demand or creation
    return (b.demand || 0) - (a.demand || 0)
  })
}

export function getPriorityTier(score) {
  if (score >= 8.0) return { label: 'Urgent', color: 'text-red-600 bg-red-500/10 border-red-500/20' }
  if (score >= 6.5) return { label: 'High', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' }
  if (score >= 4.5) return { label: 'Medium', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' }
  return { label: 'Low', color: 'text-slate-600 bg-slate-500/10 border-slate-500/20' }
}
