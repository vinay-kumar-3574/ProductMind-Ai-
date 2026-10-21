import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

const THEME_STORAGE_KEY = 'pmai_theme'
const MOTION_STORAGE_KEY = 'pmai_reduced_motion'

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved) return saved
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark' // default to modern dark
  })

  const [reducedMotion, setReducedMotion] = useState(() => {
    const saved = localStorage.getItem(MOTION_STORAGE_KEY)
    if (saved !== null) return saved === 'true'
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(MOTION_STORAGE_KEY, String(reducedMotion))
  }, [reducedMotion])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, reducedMotion, setReducedMotion }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
