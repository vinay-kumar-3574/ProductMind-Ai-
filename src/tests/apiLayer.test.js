import { describe, it, expect, beforeEach } from 'vitest'
import { apiClient } from '../services/api/apiClient'
import { authService } from '../services/api/authService'
import { prioritizationService } from '../services/api/prioritizationService'
import { aggregationService } from '../services/api/aggregationService'

describe('Centralized API Client and Service Layer', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('correctly reports backend configured state', () => {
    // In test environment, VITE_API_BASE_URL is not set to a live backend
    expect(apiClient.isConfigured()).toBe(false)
    expect(typeof apiClient.getBaseUrl()).toBe('string')
  })

  it('authenticates single PM user with valid mock session and rejects invalid email', async () => {
    const res = await authService.login('alex.rivera@productmind.ai', 'demo123')
    expect(res.success).toBe(true)
    expect(res.isDemo).toBe(true)
    expect(res.data.user.role).toBe('Lead Product Architect')
    expect(res.data.token).toBeDefined()

    // Test session retrieval
    const currentSession = authService.getCurrentSession()
    expect(currentSession).not.toBeNull()
    expect(currentSession.user.name).toBe('Alex Rivera')

    // Test rejection of non-email/blank credentials
    const badRes = await authService.login('unknown_guest', '1')
    expect(badRes.success).toBe(false)
  })

  it('handles session expiration and logout correctly', async () => {
    await authService.login('alex.rivera@productmind.ai', 'demo123')
    expect(authService.getCurrentSession()).not.toBeNull()

    // Simulate expired session (expired 1 hour ago)
    const session = JSON.parse(localStorage.getItem('pmai_mock_auth_session'))
    session.expiresAt = Date.now() - 3600000
    localStorage.setItem('pmai_mock_auth_session', JSON.stringify(session))

    const expiredCheck = authService.getCurrentSession()
    expect(expiredCheck).toBeNull()

    // Logout cleans storage
    await authService.logout()
    expect(localStorage.getItem('pmai_mock_auth_session')).toBeNull()
  })

  it('prioritizationService enforces exact 4-factor formula and tiers', () => {
    const feature = {
      customerImpact: 9, // 9 * 0.35 = 3.15
      urgency: 8,        // 8 * 0.30 = 2.40
      demand: 7,         // 7 * 0.20 = 1.40
      businessValue: 6,  // 6 * 0.15 = 0.90
    } // sum = 7.85

    const score = prioritizationService.calculateScore(feature)
    expect(score).toBe(7.85)

    const breakdown = prioritizationService.getBreakdown(feature)
    expect(breakdown.customerImpactContribution).toBe(3.15)
    expect(breakdown.urgencyContribution).toBe(2.40)
    expect(breakdown.demandContribution).toBe(1.40)
    expect(breakdown.businessValueContribution).toBe(0.90)
    expect(breakdown.totalScore).toBe(7.85)

    const tier = prioritizationService.getTier(score)
    expect(tier.label).toBe('High')

    expect(prioritizationService.FACTOR_WEIGHTS.customerImpact).toBe(0.35)
    expect(prioritizationService.FACTOR_WEIGHTS.urgency).toBe(0.30)
    expect(prioritizationService.FACTOR_WEIGHTS.demand).toBe(0.20)
    expect(prioritizationService.FACTOR_WEIGHTS.businessValue).toBe(0.15)

    const explanation = prioritizationService.getExplanation(feature)
    expect(explanation.summary).toContain('High')
    expect(explanation.totalScore).toBe(7.85)
  })

  it('aggregationService clusters feedback and supports merging groups', async () => {
    const feedbackList = [
      { id: 'fb-1', title: 'Export to CSV is needed', category: 'Analytics', tags: ['csv-export'], sentiment: 'Neutral' },
      { id: 'fb-2', title: 'Need CSV download button', category: 'Analytics', tags: ['csv-export'], sentiment: 'Negative' },
      { id: 'fb-3', title: 'Dark mode contrast is too low', category: 'Usability', tags: ['contrast'], sentiment: 'Negative' },
    ]

    const groupsRes = await aggregationService.getGroups(feedbackList, [])
    expect(groupsRes.success).toBe(true)
    expect(groupsRes.isDemo).toBe(true)
    expect(groupsRes.data.length).toBeGreaterThan(0)

    const analyticsGroup = groupsRes.data.find(g => g.category === 'Analytics')
    expect(analyticsGroup).toBeDefined()
    expect(analyticsGroup.feedbackItems.length).toBe(2)

    // Merge groups test
    if (groupsRes.data.length >= 2) {
      const g1 = groupsRes.data[0].id
      const g2 = groupsRes.data[1].id
      const merged = aggregationService.mergeGroups(g2, g1, groupsRes.data)
      expect(merged.length).toBe(groupsRes.data.length - 1)
      const target = merged.find(g => g.id === g1)
      expect(target.count).toBe(groupsRes.data[0].count + groupsRes.data[1].count)
    }
  })
})
