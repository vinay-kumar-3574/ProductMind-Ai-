/**
 * ProductMind AI — Centralized API Types and Contracts
 * Defines standard schemas, endpoints, and request/response envelopes
 * for frontend-to-backend integration.
 */

/**
 * Standard API Response Envelope
 * @template T
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the request succeeded
 * @property {T} [data] - Response payload if successful
 * @property {string} [error] - Error message if failed
 * @property {number} status - HTTP status code
 * @property {boolean} isDemo - Flag indicating if response was resolved via frontend demo fallback
 * @property {string} [timestamp] - ISO timestamp of response
 */

/**
 * Configured API Endpoints (Documentation and contract definitions)
 * All endpoints are prefixed by VITE_API_BASE_URL when deployed against a backend.
 */
export const API_ENDPOINTS = {
  // Authentication (PM Login only)
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    SESSION: '/api/v1/auth/session',
    REFRESH: '/api/v1/auth/refresh',
  },
  // Customer Feedback
  FEEDBACK: {
    LIST: '/api/v1/feedback',
    DETAIL: (id) => `/api/v1/feedback/${id}`,
    CREATE: '/api/v1/feedback',
    UPDATE: (id) => `/api/v1/feedback/${id}`,
    DELETE: (id) => `/api/v1/feedback/${id}`,
    BATCH_IMPORT: '/api/v1/feedback/batch',
    CLASSIFY: '/api/v1/feedback/classify',
  },
  // Product Analytics
  ANALYTICS: {
    OVERVIEW: '/api/v1/analytics/overview',
    USAGE_TRENDS: '/api/v1/analytics/usage-trends',
    FEATURE_ADOPTION: '/api/v1/analytics/features',
    FUNNEL: '/api/v1/analytics/funnel',
    UPLOAD_DATASET: '/api/v1/analytics/datasets/upload',
  },
  // Feature Request Aggregation
  AGGREGATION: {
    GROUPS: '/api/v1/aggregation/groups',
    GROUP_DETAIL: (id) => `/api/v1/aggregation/groups/${id}`,
    MERGE: '/api/v1/aggregation/merge',
    APPROVE: (id) => `/api/v1/aggregation/groups/${id}/approve`,
    LINK_FEEDBACK: '/api/v1/aggregation/link-feedback',
  },
  // Feature Prioritization
  PRIORITIZATION: {
    FEATURES: '/api/v1/prioritization/features',
    CALCULATE: '/api/v1/prioritization/calculate',
    UPDATE_FACTORS: (id) => `/api/v1/prioritization/features/${id}/factors`,
  },
  // PRD and User Stories
  PRD: {
    LIST: '/api/v1/prds',
    DETAIL: (id) => `/api/v1/prds/${id}`,
    GENERATE: '/api/v1/prds/generate',
    UPDATE: (id) => `/api/v1/prds/${id}`,
  },
  // Roadmap
  ROADMAP: {
    MILESTONES: '/api/v1/roadmap/milestones',
    UPDATE: (id) => `/api/v1/roadmap/milestones/${id}`,
  },
  // Product Copilot
  COPILOT: {
    CHAT: '/api/v1/copilot/chat',
    HISTORY: '/api/v1/copilot/history',
  },
}
