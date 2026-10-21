import {
  initialUser,
  initialFeedback,
  initialFeatures,
  initialPersonas,
  initialPRDs,
  initialRoadmap,
  initialExperiments,
  initialReleases,
  initialCompetitors,
  initialCustomerJourneys,
  initialScenarios,
  initialNotifications,
} from '../data/seedData'

const STORAGE_PREFIX = 'pmai_v1_'

export const STORAGE_KEYS = {
  USER: `${STORAGE_PREFIX}user`,
  FEEDBACK: `${STORAGE_PREFIX}feedback`,
  FEATURES: `${STORAGE_PREFIX}features`,
  PERSONAS: `${STORAGE_PREFIX}personas`,
  PRDS: `${STORAGE_PREFIX}prds`,
  ROADMAP: `${STORAGE_PREFIX}roadmap`,
  EXPERIMENTS: `${STORAGE_PREFIX}experiments`,
  RELEASES: `${STORAGE_PREFIX}releases`,
  COMPETITORS: `${STORAGE_PREFIX}competitors`,
  JOURNEYS: `${STORAGE_PREFIX}journeys`,
  SCENARIOS: `${STORAGE_PREFIX}scenarios`,
  NOTIFICATIONS: `${STORAGE_PREFIX}notifications`,
  HISTORY: `${STORAGE_PREFIX}history`,
  INTRO_SEEN: `${STORAGE_PREFIX}intro_seen`,
  TOUR_SEEN: `${STORAGE_PREFIX}tour_seen`,
  DASHBOARD_LAYOUT: `${STORAGE_PREFIX}dashboard_layout`,
  SAVED_VIEWS: `${STORAGE_PREFIX}saved_views`,
  COPILOT_CHATS: `${STORAGE_PREFIX}copilot_chats`,
}

export function safeGet(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaultValue
    const parsed = JSON.parse(raw)
    return parsed !== null && parsed !== undefined ? parsed : defaultValue
  } catch (err) {
    console.warn(`[ProductMind Storage] Failed to parse key ${key}, falling back to default.`, err)
    return defaultValue
  }
}

export function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    console.error(`[ProductMind Storage] Failed to set key ${key}. Possible storage quota reached.`, err)
    return false
  }
}

export function safeRemove(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch (err) {
    console.error(`[ProductMind Storage] Failed to remove key ${key}.`, err)
    return false
  }
}

export function initializeAppState() {
  return {
    user: safeGet(STORAGE_KEYS.USER, initialUser),
    feedback: safeGet(STORAGE_KEYS.FEEDBACK, initialFeedback),
    features: safeGet(STORAGE_KEYS.FEATURES, initialFeatures),
    personas: safeGet(STORAGE_KEYS.PERSONAS, initialPersonas),
    prds: safeGet(STORAGE_KEYS.PRDS, initialPRDs),
    roadmap: safeGet(STORAGE_KEYS.ROADMAP, initialRoadmap),
    experiments: safeGet(STORAGE_KEYS.EXPERIMENTS, initialExperiments),
    releases: safeGet(STORAGE_KEYS.RELEASES, initialReleases),
    competitors: safeGet(STORAGE_KEYS.COMPETITORS, initialCompetitors),
    journeys: safeGet(STORAGE_KEYS.JOURNEYS, initialCustomerJourneys),
    scenarios: safeGet(STORAGE_KEYS.SCENARIOS, initialScenarios),
    notifications: safeGet(STORAGE_KEYS.NOTIFICATIONS, initialNotifications),
    history: safeGet(STORAGE_KEYS.HISTORY, []),
    introSeen: safeGet(STORAGE_KEYS.INTRO_SEEN, false),
    tourSeen: safeGet(STORAGE_KEYS.TOUR_SEEN, false),
    copilotChats: safeGet(STORAGE_KEYS.COPILOT_CHATS, [
      {
        id: 'chat-1',
        title: 'Initial Product Strategy Discussion',
        createdAt: '2026-10-18T10:00:00Z',
        messages: [
          {
            id: 'm-1',
            role: 'assistant',
            content: 'Hello! I am your **Product Mind AI Copilot**. I analyze your customer feedback, calculate algorithmic priority scores, and synthesize roadmap recommendations in real time. How can I help you today?',
            timestamp: '10:00 AM'
          }
        ]
      }
    ]),
    savedViews: safeGet(STORAGE_KEYS.SAVED_VIEWS, [
      { id: 'view-urgent', name: 'Urgent & Negative', filters: { priority: 'Urgent', sentiment: 'Negative' } },
      { id: 'view-perf', name: 'Performance Triage', filters: { category: 'Performance' } },
      { id: 'view-unlinked', name: 'Unlinked Requests', filters: { unlinkedOnly: true } },
    ]),
    dashboardLayout: safeGet(STORAGE_KEYS.DASHBOARD_LAYOUT, [
      { id: 'kpis', visible: true, title: 'Executive KPIs' },
      { id: 'feedbackTrends', visible: true, title: 'Feedback Volume & Sentiment' },
      { id: 'priorityMatrix', visible: true, title: 'Feature Prioritization Breakdown' },
      { id: 'aiInsightsFeed', visible: true, title: 'Simulated AI Insights Feed' },
      { id: 'painPoints', visible: true, title: 'Customer Pain Points' },
      { id: 'topFeatures', visible: true, title: 'High-Demand Feature Requests' },
      { id: 'roadmapProgress', visible: true, title: 'Roadmap Milestone Progress' },
      { id: 'recentPRDs', visible: true, title: 'Recent PRD Documents' },
      { id: 'releaseReadiness', visible: true, title: 'Release Readiness Overview' },
      { id: 'recentActivity', visible: true, title: 'Activity Timeline' },
    ]),
  }
}

export function resetAllData() {
  safeSet(STORAGE_KEYS.USER, initialUser)
  safeSet(STORAGE_KEYS.FEEDBACK, initialFeedback)
  safeSet(STORAGE_KEYS.FEATURES, initialFeatures)
  safeSet(STORAGE_KEYS.PERSONAS, initialPersonas)
  safeSet(STORAGE_KEYS.PRDS, initialPRDs)
  safeSet(STORAGE_KEYS.ROADMAP, initialRoadmap)
  safeSet(STORAGE_KEYS.EXPERIMENTS, initialExperiments)
  safeSet(STORAGE_KEYS.RELEASES, initialReleases)
  safeSet(STORAGE_KEYS.COMPETITORS, initialCompetitors)
  safeSet(STORAGE_KEYS.JOURNEYS, initialCustomerJourneys)
  safeSet(STORAGE_KEYS.SCENARIOS, initialScenarios)
  safeSet(STORAGE_KEYS.NOTIFICATIONS, initialNotifications)
  safeSet(STORAGE_KEYS.HISTORY, [])
  safeSet(STORAGE_KEYS.COPILOT_CHATS, [])
  return initializeAppState()
}

export function exportBackupJSON(state) {
  const payload = {
    appName: 'Product Mind AI',
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    data: state
  }
  return JSON.stringify(payload, null, 2)
}

export function exportAllData() {
  const state = initializeAppState()
  return exportBackupJSON(state)
}

export function validateBackupJSON(jsonString) {
  try {
    const obj = JSON.parse(jsonString)
    if (!obj || typeof obj !== 'object') {
      return { valid: false, error: 'Invalid JSON structure.' }
    }
    if (!obj.data || typeof obj.data !== 'object') {
      return { valid: false, error: 'Missing root data node in backup file.' }
    }
    const data = obj.data
    if (!Array.isArray(data.feedback) || !Array.isArray(data.features)) {
      return { valid: false, error: 'Backup does not contain valid feedback or features arrays.' }
    }
    return {
      valid: true,
      summary: {
        feedbackCount: data.feedback?.length || 0,
        featuresCount: data.features?.length || 0,
        prdsCount: data.prds?.length || 0,
        roadmapCount: data.roadmap?.length || 0,
        exportedAt: obj.exportedAt || 'Unknown'
      },
      parsedData: data
    }
  } catch (err) {
    return { valid: false, error: 'Malformed JSON syntax: ' + err.message }
  }
}
