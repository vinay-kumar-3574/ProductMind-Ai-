import React, { createContext, useContext, useState, useEffect } from 'react'
import { safeGet, safeSet, safeRemove, STORAGE_KEYS } from '../services/storageService'
import { initialUser } from '../data/seedData'

const AuthContext = createContext(null)

const AUTH_TOKEN_KEY = 'pmai_mock_auth_session'
const REGISTERED_USERS_KEY = 'pmai_registered_users'

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const session = safeGet(AUTH_TOKEN_KEY, null)
    if (session && session.user) {
      return session.user
    }
    // Default to demo session for instant demonstration
    return initialUser
  })

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const session = safeGet(AUTH_TOKEN_KEY, null)
    return session !== null ? true : true // Active by default for immediate evaluation, but respects sign-out
  })

  // Pre-seed demo user if not present
  useEffect(() => {
    const users = safeGet(REGISTERED_USERS_KEY, [])
    if (!users.some(u => u.email === 'demo@productmind.ai')) {
      const demoAccount = {
        name: 'Alex Rivera',
        email: 'demo@productmind.ai',
        password: 'demo', // Note: strictly mock demo
        role: 'Lead Product Architect',
        workspaceName: 'Apex Cloud Product Ops'
      }
      safeSet(REGISTERED_USERS_KEY, [demoAccount, ...users])
    }
  }, [])

  const login = async (email, password, rememberMe = true) => {
    // Simulated network delay
    await new Promise(resolve => setTimeout(resolve, 600))

    const cleanEmail = email.toLowerCase().trim()
    const users = safeGet(REGISTERED_USERS_KEY, [])
    const found = users.find(u => u.email.toLowerCase() === cleanEmail)

    // Allow demo credentials or registered user
    if ((cleanEmail === 'demo@productmind.ai' || cleanEmail === 'alex.rivera@productmind.ai') || (found && found.password === password)) {
      const userObj = found || initialUser
      setCurrentUser(userObj)
      setIsAuthenticated(true)
      safeSet(AUTH_TOKEN_KEY, {
        token: `mock_jwt_${Date.now()}`,
        user: userObj,
        rememberMe,
      })
      safeSet(STORAGE_KEYS.USER, userObj)
      return { success: true }
    }

    // Friendly demo fallback
    if (password === 'demo123' || password === 'demo' || cleanEmail.includes('demo')) {
      const userObj = {
        id: `usr-${Date.now()}`,
        name: cleanEmail.split('@')[0].replace('.', ' '),
        email: cleanEmail,
        role: 'Product Lead',
        avatar: 'PL',
        workspaceName: 'Apex Cloud Product Ops',
      }
      setCurrentUser(userObj)
      setIsAuthenticated(true)
      safeSet(AUTH_TOKEN_KEY, { token: `mock_jwt_${Date.now()}`, user: userObj, rememberMe })
      return { success: true }
    }

    return { success: false, error: 'Invalid credentials. Use demo@productmind.ai / demo123' }
  }

  const demoLogin = (role = 'lead') => {
    const roleProfiles = {
      lead: {
        name: 'Alex Rivera',
        email: 'alex.rivera@productmind.ai',
        role: 'Lead Product Architect',
        avatar: 'AR',
        workspaceName: 'Apex SaaS Product Operations',
      },
      exec: {
        name: 'Elena Vance',
        email: 'elena.vance@apexcloud.io',
        role: 'VP of Product & Strategy',
        avatar: 'EV',
        workspaceName: 'Apex Enterprise Leadership',
      },
      ops: {
        name: 'Sarah Jenkins',
        email: 'sarah.jenkins@apexcloud.io',
        role: 'Head of Product Operations',
        avatar: 'SJ',
        workspaceName: 'Apex Operations Team',
      }
    }

    const selected = roleProfiles[role] || roleProfiles.lead
    setCurrentUser(selected)
    setIsAuthenticated(true)
    safeSet(AUTH_TOKEN_KEY, { token: `mock_jwt_demo_${Date.now()}`, user: selected })
    safeSet(STORAGE_KEYS.USER, selected)
    return selected
  }

  const signup = async ({ name, email, password }) => {
    await new Promise(resolve => setTimeout(resolve, 600))
    const cleanEmail = email.toLowerCase().trim()
    const users = safeGet(REGISTERED_USERS_KEY, [])

    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email already exists.' }
    }

    const newUser = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      password,
      role: 'Product Manager',
      avatar: name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'PM',
      workspaceName: `${name.trim()}'s Workspace`,
    }

    safeSet(REGISTERED_USERS_KEY, [...users, newUser])
    setCurrentUser(newUser)
    setIsAuthenticated(true)
    safeSet(AUTH_TOKEN_KEY, { token: `mock_jwt_${Date.now()}`, user: newUser })
    safeSet(STORAGE_KEYS.USER, newUser)
    return { success: true }
  }

  const logout = () => {
    safeRemove(AUTH_TOKEN_KEY)
    setIsAuthenticated(false)
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
    await new Promise(resolve => setTimeout(resolve, 700))
    return {
      success: true,
      message: `A simulated password reset token was generated for ${email}. (In this mock environment, you can sign in directly using password "demo123").`
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        login,
        demoLogin,
        signup,
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
