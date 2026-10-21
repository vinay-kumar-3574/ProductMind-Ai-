import { describe, it, expect } from 'vitest'
import { calculatePriorityScore, getScoreBreakdown, rankFeatures } from '../data/scoringFormulas'

describe('Feature Prioritization Formula', () => {
  it('correctly calculates score with equal values of 10', () => {
    // 0.35*10 + 0.30*10 + 0.20*10 + 0.15*10 = 3.5 + 3.0 + 2.0 + 1.5 = 10.0
    const score = calculatePriorityScore({
      customerImpact: 10,
      urgency: 10,
      demand: 10,
      businessValue: 10,
    })
    expect(score).toBe(10)
  })

  it('correctly calculates score with equal values of 1', () => {
    // 0.35*1 + 0.30*1 + 0.20*1 + 0.15*1 = 1.0
    const score = calculatePriorityScore({
      customerImpact: 1,
      urgency: 1,
      demand: 1,
      businessValue: 1,
    })
    expect(score).toBe(1)
  })

  it('correctly calculates weighted mix according to specification', () => {
    // Impact: 9 * 0.35 = 3.15
    // Urgency: 8 * 0.30 = 2.40
    // Demand: 7 * 0.20 = 1.40
    // Business Value: 6 * 0.15 = 0.90
    // Total = 3.15 + 2.40 + 1.40 + 0.90 = 7.85
    const score = calculatePriorityScore({
      customerImpact: 9,
      urgency: 8,
      demand: 7,
      businessValue: 6,
    })
    expect(score).toBe(7.85)

    const breakdown = getScoreBreakdown({
      customerImpact: 9,
      urgency: 8,
      demand: 7,
      businessValue: 6,
    })
    expect(breakdown.customerImpactContribution).toBe(3.15)
    expect(breakdown.urgencyContribution).toBe(2.40)
    expect(breakdown.demandContribution).toBe(1.40)
    expect(breakdown.businessValueContribution).toBe(0.90)
    expect(breakdown.totalScore).toBe(7.85)
  })

  it('ranks features in descending order of priority score', () => {
    const list = [
      { id: 'f1', customerImpact: 5, urgency: 5, demand: 5, businessValue: 5 }, // 5.0
      { id: 'f2', customerImpact: 9, urgency: 9, demand: 9, businessValue: 9 }, // 9.0
      { id: 'f3', customerImpact: 7, urgency: 7, demand: 7, businessValue: 7 }, // 7.0
    ]
    const ranked = rankFeatures(list)
    expect(ranked[0].id).toBe('f2')
    expect(ranked[1].id).toBe('f3')
    expect(ranked[2].id).toBe('f1')
  })
})
