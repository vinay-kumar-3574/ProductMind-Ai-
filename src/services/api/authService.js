/**
 * Authentication Service (PM Login Only)
 * Enforces a single product manager login pathway with session verification.
 */
import { apiClient } from './apiClient'
import { API_ENDPOINTS } from './types'
import { initialUser } from '../../data/seedData'

const AUTH_TOKEN_KEY = 'pmai_mock_auth_session'
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

export const authService = {
  /**
   * Log in as Product Manager
   */
  async login(email, password, rememberMe = true) {
    if (apiClient.isConfigured()) {
      return apiClient.post(API_ENDPOINTS.AUTH.LOGIN, { email, password, rememberMe })
    }

    // Demo Mode local validation for PM
    const cleanEmail = (email || '').toLowerCase().trim()
    const isPMEmail = cleanEmail === 'demo@productmind.ai' || cleanEmail === 'alex.rivera@productmind.ai' || cleanEmail.includes('pm') || cleanEmail.includes('product')
    const isDemoPass = password === 'demo123' || password === 'demo' || password.length >= 4

    if (isPMEmail || isDemoPass) {
      const pmUser = {
        id: 'pm-lead-01',
        name: 'Alex Rivera',
        email: cleanEmail || 'demo@productmind.ai',
        role: 'Lead Product Architect',
        avatar: 'PM',
        workspaceName: 'Apex Cloud Product Ops',
      }
      const session = {
        token: `mock_pm_jwt_${Date.now()}`,
        user: pmUser,
        rememberMe,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_EXPIRY_MS,
        isDemo: true,
      }
      localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(session))
      return {
        success: true,
        data: { user: pmUser, token: session.token },
        status: 200,
        isDemo: true,
      }
    }

    return {
      success: false,
      error: 'Invalid PM credentials. Enter demo@productmind.ai with password demo123, or use 1-Click PM Login.',
      status: 401,
      isDemo: true,
    }
  },

  /**
   * Demo 1-Click PM Login
   */
  demoPMLogin() {
    const pmUser = {
      ...initialUser,
      role: 'Lead Product Architect',
      workspaceName: 'Apex Cloud Product Ops',
    }
    const session = {
      token: `mock_pm_jwt_${Date.now()}`,
      user: pmUser,
      rememberMe: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_EXPIRY_MS,
      isDemo: true,
    }
    localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(session))
    return {
      success: true,
      data: { user: pmUser, token: session.token },
      isDemo: true,
    }
  },

  /**
   * Check if current session exists and is unexpired
   */
  getCurrentSession() {
    try {
      const raw = localStorage.getItem(AUTH_TOKEN_KEY)
      if (!raw) return null
      const session = JSON.parse(raw)
      const expiry = typeof session.expiresAt === 'string' ? new Date(session.expiresAt).getTime() : session.expiresAt
      if (expiry && Date.now() > expiry) {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        return null
      }
      return session
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      return null
    }
  },

  /**
   * Log out and clear session
   */
  async logout() {
    if (apiClient.isConfigured()) {
      try {
        await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT, {})
      } catch {
        // Clear local storage regardless of backend error
      }
    }
    localStorage.removeItem(AUTH_TOKEN_KEY)
    return { success: true }
  },
}

export default authService
