import { describe, it, expect } from 'vitest'
import {
  parseFeedbackCSV,
  generateSampleCSV,
  exportFeedbackToCSV,
  exportFeaturesToCSV,
} from '../services/csvService'

describe('CSV Service - Import, Parsing & Export', () => {
  it('parses sample CSV template correctly', () => {
    const sample = generateSampleCSV()
    const result = parseFeedbackCSV(sample)

    expect(result.success).toBe(true)
    expect(result.records.length).toBe(4)
    expect(result.records[0].title).toBe('Mobile app crashes on checkout')
    expect(result.records[0].customer).toBe('Carlos Mendez')
    expect(result.records[0].sentiment).toBe('Negative')
  })

  it('handles quotes, commas, and escaped quotes properly', () => {
    const rawCSV = `title,description,customer,company
"Special, comma title","Contains ""quoted"" words, and commas","Alice, Tech","Acme, Inc."`

    const res = parseFeedbackCSV(rawCSV)
    expect(res.success).toBe(true)
    expect(res.records.length).toBe(1)
    expect(res.records[0].title).toBe('Special, comma title')
    expect(res.records[0].description).toBe('Contains "quoted" words, and commas')
    expect(res.records[0].customer).toBe('Alice, Tech')
  })

  it('fails gracefully when CSV has no valid headers or data', () => {
    const emptyRes = parseFeedbackCSV('')
    expect(emptyRes.success).toBe(false)
    expect(emptyRes.error).toBeDefined()

    const noHeaderRes = parseFeedbackCSV('Just a single line of random text')
    expect(noHeaderRes.success).toBe(false)

    const invalidHeaderRes = parseFeedbackCSV('random1,random2\nfoo,bar')
    expect(invalidHeaderRes.success).toBe(false)
  })

  it('exports feedback items into a valid CSV string with escaped fields', () => {
    const mockFeedback = [
      {
        id: 'fb-1',
        title: 'Crash on "Login" page, iOS',
        description: 'System fails with 500 code, user logged out',
        customer: 'John Doe',
        company: 'MegaCorp, LLC',
        category: 'Performance',
        sentiment: 'Negative',
        priority: 'Urgent',
        tags: ['crash', 'ios'],
        date: '2026-10-15',
        linkedFeatureId: 'feat-1',
      },
    ]

    const csvOut = exportFeedbackToCSV(mockFeedback)
    expect(csvOut).toContain('Crash on ""Login"" page, iOS')
    expect(csvOut).toContain('MegaCorp, LLC')
    expect(csvOut).toContain('fb-1')
  })

  it('exports features into a structured CSV string with formula metrics', () => {
    const mockFeatures = [
      {
        id: 'f-1',
        name: 'Enterprise SAML SSO',
        description: 'Single sign-on integration',
        score: 8.85,
        customerImpact: 9,
        urgency: 9,
        demand: 8,
        businessValue: 9,
        status: 'In Progress',
        owner: 'Alex Rivera',
        targetRelease: 'v2.1',
        relatedFeedbackIds: ['fb-1', 'fb-2'],
      },
    ]

    const csvOut = exportFeaturesToCSV(mockFeatures)
    expect(csvOut).toContain('Enterprise SAML SSO')
    expect(csvOut).toContain('8.85')
    expect(csvOut).toContain('v2.1')
  })
})
