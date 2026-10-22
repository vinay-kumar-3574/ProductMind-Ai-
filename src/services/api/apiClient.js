/**
 * ProductMind AI — Centralized API Client
 * Provides robust HTTP request handling, authentication header injection,
 * error normalization, and transparent demo mode handling.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const AUTH_TOKEN_KEY = 'pmai_mock_auth_session'

export function isBackendConfigured() {
  return Boolean(API_BASE_URL && API_BASE_URL.trim().length > 0)
}

export function getApiBaseUrl() {
  return API_BASE_URL
}

/**
 * Get active auth token from local session
 */
export function getAuthToken() {
  try {
    const raw = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    return session?.token || null
  } catch {
    return null
  }
}

/**
 * Core HTTP Request Dispatcher
 * @param {string} endpoint - Relative endpoint path (e.g., '/api/v1/feedback')
 * @param {RequestInit & { fallbackDemoData?: any, timeout?: number }} options
 * @returns {Promise<{ success: boolean, data?: any, error?: string, status: number, isDemo: boolean }>}
 */
export async function request(endpoint, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    fallbackDemoData = null,
    timeout = 10000,
    ...rest
  } = options

  // When no backend is configured, return the demo data with clear demo flag
  if (!isBackendConfigured()) {
    return {
      success: true,
      data: typeof fallbackDemoData === 'function' ? fallbackDemoData() : fallbackDemoData,
      status: 200,
      isDemo: true,
      timestamp: new Date().toISOString(),
    }
  }

  // Live Backend Request
  const token = getAuthToken()
  const defaultHeaders = {
    'Accept': 'application/json',
    ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...headers,
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method,
      headers: defaultHeaders,
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : null),
      signal: controller.signal,
      ...rest,
    })

    clearTimeout(timeoutId)

    let parsed = null
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      parsed = await response.json()
    } else {
      parsed = await response.text()
    }

    if (!response.ok) {
      return {
        success: false,
        error: (parsed && (parsed.message || parsed.error)) || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        isDemo: false,
        timestamp: new Date().toISOString(),
      }
    }

    return {
      success: true,
      data: parsed?.data !== undefined ? parsed.data : parsed,
      status: response.status,
      isDemo: false,
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    clearTimeout(timeoutId)
    const isTimeout = err.name === 'AbortError'
    return {
      success: false,
      error: isTimeout ? 'Request timed out' : (err.message || 'Network error connecting to backend API'),
      status: isTimeout ? 408 : 0,
      isDemo: false,
      timestamp: new Date().toISOString(),
    }
  }
}

export const apiClient = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body, ...options }),
  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body, ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),
  isConfigured: isBackendConfigured,
  getBaseUrl: getApiBaseUrl,
}

export default apiClient
