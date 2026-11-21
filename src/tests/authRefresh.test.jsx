import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { authService } from '../services/api/authService'
import { apiClient, request, refreshAuthSession } from '../services/api/apiClient'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { ProtectedRoute } from '../components/layout/ProtectedRoute'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const AUTH_TOKEN_KEY = 'pmai_mock_auth_session'

describe('Authentication Lifecycle & Refresh-Token Handling', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('Session Lifecycle & Expiry Separation', () => {
    it('does not destroy a valid 30-day refresh session when access token has expired', () => {
      const expiredAccessTokenTime = Date.now() - 5000 // Expired 5 seconds ago
      const validRefreshTokenTime = Date.now() + 30 * 24 * 60 * 60 * 1000 // Valid for 30 days

      const session = {
        token: 'expired_jwt_access_token',
        accessToken: 'expired_jwt_access_token',
        refreshToken: 'valid_jwt_refresh_token_xyz',
        user: { id: 'usr-1', name: 'Alex Rivera', email: 'alex@productmind.ai' },
        expiresAt: validRefreshTokenTime,
        accessTokenExpiresAt: expiredAccessTokenTime,
        refreshTokenExpiresAt: validRefreshTokenTime,
        sessionExpiresAt: validRefreshTokenTime,
        isDemo: false,
      }
      localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(session))

      const retrieved = authService.getCurrentSession()
      expect(retrieved).not.toBeNull()
      expect(retrieved.refreshToken).toBe('valid_jwt_refresh_token_xyz')
      expect(authService.isAccessTokenExpired(retrieved)).toBe(true)
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).not.toBeNull()
    })

    it('purges session when the 30-day refresh session has expired', () => {
      const expiredTime = Date.now() - 10000
      const session = {
        token: 'expired_access',
        accessToken: 'expired_access',
        refreshToken: 'expired_refresh',
        user: { id: 'usr-1' },
        expiresAt: expiredTime,
        accessTokenExpiresAt: expiredTime,
        refreshTokenExpiresAt: expiredTime,
        sessionExpiresAt: expiredTime,
      }
      localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(session))

      const retrieved = authService.getCurrentSession()
      expect(retrieved).toBeNull()
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
    })
  })

  describe('Centralized Single-Flight Refresh in apiClient', () => {
    it('retries original failed GET request after successful token refresh', async () => {
      const initialSession = {
        token: 'stale_token',
        accessToken: 'stale_token',
        refreshToken: 'valid_refresh_token',
        user: { id: 'usr-1', name: 'Alex' },
        accessTokenExpiresAt: Date.now() - 1000,
        refreshTokenExpiresAt: Date.now() + 86400000,
      }
      localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(initialSession))

      // Mock global fetch:
      // 1. First GET /api/v1/ai/feedback/fb-1/analysis -> 401 Unauthorized
      // 2. POST /api/v1/auth/refresh -> 200 OK with fresh tokens
      // 3. Retry GET /api/v1/ai/feedback/fb-1/analysis -> 200 OK
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ detail: 'Access token has expired' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: {
              accessToken: 'fresh_access_token_123',
              refreshToken: 'rotated_refresh_token_456',
              expiresIn: 900,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: {
              feedback_id: 'fb-1',
              analysis: { category: 'Performance', confidence: 0.95 },
            },
          }),
        })

      vi.stubGlobal('fetch', fetchMock)

      const result = await request('/api/v1/ai/feedback/fb-1/analysis')

      expect(fetchMock).toHaveBeenCalledTimes(3)
      // Check that refresh endpoint was invoked
      expect(fetchMock.mock.calls[1][0]).toContain('/api/v1/auth/refresh')
      // Check that original request was retried with fresh access token
      expect(fetchMock.mock.calls[2][1].headers['Authorization']).toBe('Bearer fresh_access_token_123')
      expect(result.success).toBe(true)
      expect(result.data.analysis.category).toBe('Performance')

      // Check updated storage
      const stored = JSON.parse(localStorage.getItem(AUTH_TOKEN_KEY))
      expect(stored.accessToken).toBe('fresh_access_token_123')
      expect(stored.refreshToken).toBe('rotated_refresh_token_456')
    })

    it('deduplicates multiple simultaneous 401 requests into a single refresh operation', async () => {
      const initialSession = {
        token: 'stale_token',
        accessToken: 'stale_token',
        refreshToken: 'shared_refresh_token',
        accessTokenExpiresAt: Date.now() - 1000,
        refreshTokenExpiresAt: Date.now() + 86400000,
      }
      localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(initialSession))

      let refreshCallsCount = 0

      const fetchMock = vi.fn(async (url, opts) => {
        if (url.includes('/auth/refresh')) {
          refreshCallsCount++
          // Simulate slight network delay to allow concurrency
          await new Promise(r => setTimeout(r, 50))
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              data: {
                accessToken: 'brand_new_token_777',
                refreshToken: 'brand_new_refresh_888',
                expiresIn: 900,
              },
            }),
          }
        }

        // Check if authorization has been updated
        const authHeader = opts?.headers?.['Authorization'] || ''
        if (authHeader === 'Bearer brand_new_token_777') {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ data: { url, success: true } }),
          }
        }

        // First attempt with stale token -> 401
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ detail: 'Access token has expired' }),
        }
      })

      vi.stubGlobal('fetch', fetchMock)

      // Fire 3 simultaneous requests
      const [res1, res2, res3] = await Promise.all([
        request('/api/v1/workspaces'),
        request('/api/v1/feedback'),
        request('/api/v1/ai/feedback/item-1/analysis'),
      ])

      // Crucial requirement: EXACTLY ONE refresh call occurred
      expect(refreshCallsCount).toBe(1)
      expect(res1.success).toBe(true)
      expect(res2.success).toBe(true)
      expect(res3.success).toBe(true)
    })

    it('prevents infinite retry loops and handles refresh failure cleanly', async () => {
      const initialSession = {
        token: 'stale_token',
        accessToken: 'stale_token',
        refreshToken: 'revoked_refresh_token',
        accessTokenExpiresAt: Date.now() - 1000,
        refreshTokenExpiresAt: Date.now() + 86400000,
      }
      localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(initialSession))

      const fetchMock = vi.fn()
        // Initial request -> 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ detail: 'Access token has expired' }),
        })
        // Refresh request -> 401 Revoked
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ detail: 'Invalid or reused refresh token' }),
        })

      vi.stubGlobal('fetch', fetchMock)

      const result = await request('/api/v1/feedback')

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(false)
      expect(result.status).toBe(401)
      // Storage should be cleared on revoked refresh token
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
    })

    it('does not trigger token refresh for login, refresh, or register endpoints', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Invalid email or password' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await request('/api/v1/auth/login', {
        method: 'POST',
        body: { email: 'bad@productmind.ai', password: 'wrong' },
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result.status).toBe(401)
    })
  })

  describe('AuthContext Initialization & ProtectedRoute Guard', () => {
    function ProtectedView() {
      return <div data-testid="protected-content">Secure PM Portal</div>
    }

    it('waits for auth initialization before rendering protected routes', async () => {
      const session = {
        token: 'valid_token',
        accessToken: 'valid_token',
        refreshToken: 'valid_refresh',
        user: { name: 'Alex Rivera', email: 'alex@productmind.ai' },
        accessTokenExpiresAt: Date.now() + 900000,
        refreshTokenExpiresAt: Date.now() + 86400000,
        isDemo: false,
      }
      localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(session))

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <ProtectedView />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      })
    })

    it('redirects to signin if session is missing or unauthenticated', async () => {
      localStorage.clear()

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/signin" element={<div data-testid="signin-page">Sign In Page</div>} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <ProtectedView />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('signin-page')).toBeInTheDocument()
      })
    })
  })
})
