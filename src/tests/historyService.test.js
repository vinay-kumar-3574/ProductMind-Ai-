import { describe, it, expect } from 'vitest'
import { createHistoryRecord, appendHistory } from '../services/historyService'

describe('History Service - Audit Trail & Undo Queue', () => {
  it('creates well-formed history records with unique ID and ISO timestamp', () => {
    const record = createHistoryRecord({
      entityType: 'feedback',
      entityId: 'fb-101',
      action: 'created',
      description: 'Added new feedback item',
      previousState: null,
      newState: { id: 'fb-101', title: 'New request' },
      actor: 'Elena Vance',
    })

    expect(record.id).toBeDefined()
    expect(record.id.startsWith('evt-')).toBe(true)
    expect(record.timestamp).toBeDefined()
    expect(record.entityType).toBe('feedback')
    expect(record.entityId).toBe('fb-101')
    expect(record.action).toBe('created')
    expect(record.actor).toBe('Elena Vance')
    expect(record.canUndo).toBe(true)
    expect(record.newState.title).toBe('New request')
  })

  it('prepends new records to the history list', () => {
    const rec1 = createHistoryRecord({
      entityType: 'feature',
      entityId: 'f-1',
      action: 'created',
      description: 'Feature 1',
    })
    const rec2 = createHistoryRecord({
      entityType: 'feature',
      entityId: 'f-2',
      action: 'created',
      description: 'Feature 2',
    })

    let list = appendHistory([], rec1)
    expect(list.length).toBe(1)
    expect(list[0].entityId).toBe('f-1')

    list = appendHistory(list, rec2)
    expect(list.length).toBe(2)
    expect(list[0].entityId).toBe('f-2')
    expect(list[1].entityId).toBe('f-1')
  })

  it('caps history list at maximum 50 records to prevent memory exhaustion', () => {
    let list = []
    for (let i = 0; i < 60; i++) {
      const rec = createHistoryRecord({
        entityType: 'feedback',
        entityId: `fb-${i}`,
        action: 'updated',
        description: `Update item ${i}`,
      })
      list = appendHistory(list, rec)
    }

    expect(list.length).toBe(50)
    expect(list[0].entityId).toBe('fb-59')
  })
})
