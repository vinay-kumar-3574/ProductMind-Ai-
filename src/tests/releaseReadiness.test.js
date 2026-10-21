import { describe, it, expect } from 'vitest'

describe('Release Readiness - Governance & Quality Gate Logic', () => {
  it('calculates readiness percentage accurately', () => {
    const checklist = [
      { id: 'c1', label: 'Security audit', required: true, completed: true },
      { id: 'c2', label: 'E2E tests pass', required: true, completed: true },
      { id: 'c3', label: 'Documentation updated', required: false, completed: false },
      { id: 'c4', label: 'Load test signoff', required: false, completed: false },
    ]

    const completed = checklist.filter(c => c.completed).length
    const total = checklist.length
    const percent = Math.round((completed / total) * 100)

    expect(percent).toBe(50)
  })

  it('blocks release if any required quality gate remains incomplete', () => {
    const checklist = [
      { id: 'c1', label: 'SOC2 & Pen test verified', required: true, completed: true },
      { id: 'c2', label: 'No P0/P1 blockers open', required: true, completed: false }, // Required but pending!
      { id: 'c3', label: 'Release notes drafted', required: false, completed: true },
    ]

    const requiredPending = checklist.filter(c => c.required && !c.completed)
    const isGated = requiredPending.length > 0

    expect(isGated).toBe(true)
    expect(requiredPending.length).toBe(1)
    expect(requiredPending[0].id).toBe('c2')
  })

  it('approves Go-Live status when all required gates pass', () => {
    const checklist = [
      { id: 'c1', label: 'Security audit', required: true, completed: true },
      { id: 'c2', label: 'E2E regression suite passes', required: true, completed: true },
      { id: 'c3', label: 'Staging smoke test verified', required: true, completed: true },
      { id: 'c4', label: 'Social announcement drafted', required: false, completed: false }, // Optional
    ]

    const requiredPending = checklist.filter(c => c.required && !c.completed)
    const isGated = requiredPending.length > 0

    expect(isGated).toBe(false)
  })

  it('detects unresolved urgent blockers from customer feedback', () => {
    const feedbackList = [
      { id: 'fb-1', title: 'Feature request for color customizer', priority: 'Low', sentiment: 'Positive' },
      { id: 'fb-2', title: 'Data corruption bug during export', priority: 'Urgent', sentiment: 'Negative' },
      { id: 'fb-3', title: 'API timeout under 100 req/sec', priority: 'Urgent', sentiment: 'Negative' },
    ]

    const urgentBlockers = feedbackList.filter(f => f.priority === 'Urgent' && f.sentiment === 'Negative')
    expect(urgentBlockers.length).toBe(2)
    expect(urgentBlockers.map(b => b.id)).toEqual(['fb-2', 'fb-3'])
  })
})
