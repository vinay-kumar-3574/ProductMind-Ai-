import React, { createContext, useContext, useState, useEffect } from 'react'
import { safeSet, safeRemove, STORAGE_KEYS } from '../services/storageService'
import { initialUser } from '../data/seedData'
import { authService } from '../services/api/authService'
import { isBackendConfigured } from '../services/api/apiClient'

const AuthContext = createContext(null)
const AUTH_TOKEN_KEY = 'pmai_mock_auth_session'

export function AuthProvider({ children }) {
  // Check active session and expiration on initialization
  const [currentUser, setCurrentUser] = useState(() => {
    const session = authService.getCurrentSession()
    return session?.user || null
  })

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const session = authService.getCurrentSession()
    return session !== null
  })

  const [isDemoAuth, setIsDemoAuth] = useState(() => {
    const session = authService.getCurrentSession()
    return session?.isDemo ?? !isBackendConfigured()
  })

  const [isAuthReady, setIsAuthReady] = useState(false)

  // Primary session restoration & initial proactive token refresh
  useEffect(() => {
    let mounted = true

    async function initSession() {
      const session = authService.getCurrentSession()
      if (session && !session.isDemo && isBackendConfigured()) {
        const refreshToken = session.refreshToken || session.refresh_token
        // Proactively refresh if access token expired or expires within 3 minutes
        const accessExpiry = session.accessTokenExpiresAt || session.expiresAt || 0
        const isExpiringSoon = (accessExpiry - Date.now()) < 3 * 60 * 1000

        if (isExpiringSoon && refreshToken) {
          try {
            const refreshed = await authService.refreshSession()
            if (mounted) {
              if (refreshed?.user) {
                setCurrentUser(refreshed.user)
                setIsAuthenticated(true)
              } else if (!refreshed) {
                // If refresh token has expired or is revoked on backend, reset session
                setIsAuthenticated(false)
                setCurrentUser(null)
              }
            }
          } catch (err) {
            console.warn('Initial session refresh error:', err)
          }
        }
      }
      if (mounted) {
        setIsAuthReady(true)
      }
    }

    initSession()

    // Listen for cross-request session refresh & expiration events
    const handleSessionRefreshed = (e) => {
      if (e.detail?.user) {
        setCurrentUser(e.detail.user)
        setIsAuthenticated(true)
      }
    }
    const handleAuthExpired = () => {
      setIsAuthenticated(false)
      setCurrentUser(null)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('pmai:session_refreshed', handleSessionRefreshed)
      window.addEventListener('pmai:auth_expired', handleAuthExpired)
    }

    return () => {
      mounted = false
      if (typeof window !== 'undefined') {
        window.removeEventListener('pmai:session_refreshed', handleSessionRefreshed)
        window.removeEventListener('pmai:auth_expired', handleAuthExpired)
      }
    }
  }, [])

  // Periodic session expiration check & refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      const session = authService.getCurrentSession()
      if (!session && isAuthenticated) {
        setIsAuthenticated(false)
        setCurrentUser(null)
        safeRemove(AUTH_TOKEN_KEY)
      } else if (session && !session.isDemo && isBackendConfigured()) {
        // Refresh token if within 5 minutes of access token expiration
        const timeLeft = (session.accessTokenExpiresAt || session.expiresAt || 0) - Date.now()
        if (timeLeft < 5 * 60 * 1000) {
          const refreshed = await authService.refreshSession()
          if (refreshed?.user) {
            setCurrentUser(refreshed.user)
          } else if (!refreshed && timeLeft <= 0) {
            setIsAuthenticated(false)
            setCurrentUser(null)
          }
        }
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  /**
   * User Registration
   */
  const register = async ({ name, email, password }) => {
    const res = await authService.register({ name, email, password })
    if (res.success) {
      // Auto-login after successful registration
      return await login(email, password, true)
    }
    return { success: false, error: res.error || 'Registration failed.' }
  }

  /**
   * User Login
   */
  const login = async (email, password, rememberMe = true) => {
    const res = await authService.login(email, password, rememberMe)
    if (res.success && res.data) {
      setCurrentUser(res.data.user)
      setIsAuthenticated(true)
      setIsDemoAuth(Boolean(res.isDemo))
      safeSet(STORAGE_KEYS.USER, res.data.user)
      return { success: true }
    }
    return { success: false, error: res.error || 'Failed to authenticate.' }
  }

  /**
   * 1-Click Instant PM Demo Login
   */
  const demoLogin = () => {
    const res = authService.demoPMLogin()
    if (res.success && res.data) {
      setCurrentUser(res.data.user)
      setIsAuthenticated(true)
      setIsDemoAuth(true)
      safeSet(STORAGE_KEYS.USER, res.data.user)
      return res.data.user
    }
    return initialUser
  }

  /**
   * Log out and clear session state
   */
  const logout = async () => {
    await authService.logout()
    setIsAuthenticated(false)
    setIsDemoAuth(false)
    setCurrentUser(null)
    safeRemove(AUTH_TOKEN_KEY)
  }

  const updateProfile = async (updates) => {
    const res = await authService.updateProfile(updates)
    if (res.success && res.data) {
      setCurrentUser(res.data)
      safeSet(STORAGE_KEYS.USER, res.data)
      return { success: true, data: res.data }
    }
    const updated = { ...currentUser, ...updates }
    setCurrentUser(updated)
    safeSet(STORAGE_KEYS.USER, updated)
    const session = authService.getCurrentSession()
    if (session) {
      safeSet(AUTH_TOKEN_KEY, { ...session, user: updated })
    }
    return { success: true, data: updated }
  }

  const forgotPassword = async (email) => {
    await new Promise(resolve => setTimeout(resolve, 600))
    return {
      success: true,
      message: `If an account exists for ${email}, password reset instructions will be provided by your administrator.`,
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthReady,
        isAuthenticated,
        currentUser,
        isDemoAuth,
        register,
        login,
        demoLogin,
        logout,
        updateProfile,
        forgotPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    const session = authService.getCurrentSession()
    return {
      isAuthReady: true,
      currentUser: session?.user || null,
      isAuthenticated: Boolean(session),
      isDemoAuth: session?.isDemo ?? true,
      login: authService.login,
      demoLogin: authService.demoPMLogin,
      register: authService.register,
      logout: authService.logout,
      updateProfile: () => {},
      forgotPassword: () => {},
    }
  }
  return context
}

export default AuthContext
