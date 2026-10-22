import React, { createContext, useContext, useState, useEffect } from 'react'
import { safeGet, safeSet, safeRemove, STORAGE_KEYS } from '../services/storageService'
import { initialUser } from '../data/seedData'
import { authService } from '../services/api/authService'
import { isBackendConfigured } from '../services/api/apiClient'

const AuthContext = createContext(null)

const AUTH_TOKEN_KEY = 'pmai_mock_auth_session'

export function AuthProvider({ children }) {
  // Check active session and expiration on initialization
  const [currentUser, setCurrentUser] = useState(() => {
    const session = authService.getCurrentSession()
    return session?.user || initialUser
  })

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const session = authService.getCurrentSession()
    return session !== null
  })

  const [isDemoAuth, setIsDemoAuth] = useState(() => {
    const session = authService.getCurrentSession()
    return session?.isDemo ?? !isBackendConfigured()
  })

  // Periodic session expiration check
  useEffect(() => {
    const interval = setInterval(() => {
      const session = authService.getCurrentSession()
      if (!session && isAuthenticated) {
        setIsAuthenticated(false)
        safeRemove(AUTH_TOKEN_KEY)
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  /**
   * Sole Product Manager (PM) login method
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
    return { success: false, error: res.error || 'Failed to authenticate as Product Manager.' }
  }

  /**
   * 1-Click Instant PM Demo Login (single PM profile, no role selection)
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
  }

  const updateProfile = (updates) => {
    const updated = { ...currentUser, ...updates }
    setCurrentUser(updated)
    safeSet(STORAGE_KEYS.USER, updated)
    const session = safeGet(AUTH_TOKEN_KEY, null)
    if (session) {
      safeSet(AUTH_TOKEN_KEY, { ...session, user: updated })
    }
  }

  const forgotPassword = async (email) => {
    await new Promise(resolve => setTimeout(resolve, 600))
    return {
      success: true,
      message: `If a Product Manager account exists for ${email}, password reset instructions will be provided by your workspace administrator.`
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        isDemoAuth,
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
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
