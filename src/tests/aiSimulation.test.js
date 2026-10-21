import { describe, it, expect } from 'vitest'
import {
  analyzeSentiment,
  predictCategory,
  generateSmartTags,
  detectDuplicates,
  generatePRDTemplate,
  queryCopilot,
} from '../services/aiSimulationService'

describe('AI Simulation Service - Deterministic NLP & Generation', () => {
  it('correctly analyzes sentiment based on sentiment keywords', () => {
    const positiveText = 'This feature is wonderful, great and extremely helpful!'
    const negativeText = 'Terrible crash, slow performance and awful broken bug.'
    const neutralText = 'The settings button is located in the top navigation bar.'

    expect(analyzeSentiment(positiveText)).toBe('Positive')
    expect(analyzeSentiment(negativeText)).toBe('Negative')
    expect(analyzeSentiment(neutralText)).toBe('Neutral')
  })

  it('predicts appropriate product category from text keywords', () => {
    expect(predictCategory('System latency is too high during page load')).toBe('Performance')
    expect(predictCategory('Need SAML SSO and Okta authentication')).toBe('Integrations')
    expect(predictCategory('Checkout invoice credit card receipt cost')).toBe('Pricing')
    expect(predictCategory('Color contrast and button layout')).toBe('Usability')
    expect(predictCategory('Database crash and server timeout save error')).toBe('Reliability')
  })

  it('generates domain-specific smart tags', () => {
    const tags = generateSmartTags('SAML SSO Okta', 'Enterprise security compliance and audit logging')
    expect(Array.isArray(tags)).toBe(true)
    expect(tags.length).toBeGreaterThan(0)
    expect(tags).toContain('security')
  })

  it('detects duplicates using Jaccard text similarity above threshold', () => {
    const existingItems = [
      { id: 'fb-1', title: 'Export reports to CSV and Excel format', description: 'Need export button for tables' },
      { id: 'fb-2', title: 'Dark mode theme toggle', description: 'Support night shift viewing' },
    ]

    const matches = detectDuplicates('Export report data into CSV spreadsheet', 'Need export button', existingItems)
    expect(Array.isArray(matches)).toBe(true)
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].feedback.id).toBe('fb-1')
    expect(matches[0].similarity).toBeGreaterThan(25)

    const noMatches = detectDuplicates('Kubernetes helm chart deployment guide', 'DevOps instructions', existingItems)
    expect(noMatches.length).toBe(0)
  })

  it('generates a complete 13-section PRD object', () => {
    const prd = generatePRDTemplate({
      name: 'Real-time WebSocket Notifications',
      description: 'Instant notification dispatch for mentions, alerts, and system updates.',
      category: 'Real-time / Collaboration',
      score: 8.6,
      targetRelease: 'v2.4.0',
    })

    expect(prd.overview).toContain('Real-time WebSocket Notifications')
    expect(prd.overview).toContain('8.6/10')
    expect(prd.problemStatement).toBeDefined()
    expect(prd.targetUsers).toBeDefined()
    expect(prd.customerPainPoints).toBeDefined()
    expect(prd.proposedSolution).toBeDefined()
    expect(prd.goalsAndSuccessMetrics).toBeDefined()
    expect(prd.functionalRequirements).toBeDefined()
    expect(prd.nonFunctionalRequirements).toBeDefined()
    expect(prd.userStories).toBeDefined()
    expect(prd.acceptanceCriteria).toBeDefined()
    expect(prd.dependenciesAndConstraints).toBeDefined()
    expect(prd.risksAndMitigations).toBeDefined()
    expect(prd.releasePlan).toContain('v2.4.0')

    const sections = Object.keys(prd)
    expect(sections.length).toBe(13)
  })

  it('responds deterministically via queryCopilot based on live state', () => {
    const mockState = {
      feedback: [
        { id: '1', title: 'Slow loading', sentiment: 'Negative', priority: 'High', category: 'Performance' },
        { id: '2', title: 'Great UI', sentiment: 'Positive', priority: 'Low', category: 'UI/UX' },
      ],
      features: [
        {
          id: 'f1',
          name: 'High-Performance Virtual Grid',
          score: 9.1,
          customerImpact: 9,
          urgency: 9,
          demand: 9,
          businessValue: 9,
          status: 'In Progress',
        },
      ],
      releases: [
        { id: 'r1', version: 'v2.1', status: 'Ready' }
      ]
    }

    const res = queryCopilot('Recommend features to prioritize', mockState)
    expect(typeof res).toBe('string')
    expect(res.length).toBeGreaterThan(50)
    expect(res).toContain('High-Performance Virtual Grid')
    expect(res).toContain('9.10')
  })
})
