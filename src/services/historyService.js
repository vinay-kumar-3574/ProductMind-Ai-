const MAX_HISTORY_ITEMS = 50

export function createHistoryRecord({
  entityType,
  entityId,
  action,
  description,
  previousState = null,
  newState = null,
  actor = 'Alex Rivera',
  canUndo = true,
}) {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    entityType,
    entityId,
    action,
    description,
    previousState,
    newState,
    actor,
    canUndo,
  }
}

export function appendHistory(historyList = [], newRecord) {
  const updated = [newRecord, ...historyList]
  return updated.slice(0, MAX_HISTORY_ITEMS)
}
