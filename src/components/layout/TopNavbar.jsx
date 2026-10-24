import React, { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import {
  Search,
  Command,
  Sun,
  Moon,
  Bell,
  HelpCircle,
  Presentation,
  PlayCircle,
  CheckCheck,
  Trash2,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'

export function TopNavbar({ onOpenSearch, onOpenCommandPalette }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
    startRecruiterDemo,
    setTourSeen,
    setPresentationModeActive,
  } = useApp()
  const { currentUser, logout } = useAuth()

  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  // Generate dynamic page title and breadcrumbs
  const getBreadcrumb = () => {
    const path = location.pathname
    const search = new URLSearchParams(location.search)
    const tab = search.get('tab')

    if (path === '/') return { title: 'Executive Dashboard', parent: 'Workspace' }
    if (path === '/analytics') return { title: 'Product Analytics & Ingestion', parent: 'Analytics' }
    if (path === '/feedback') {
      if (tab === 'insights') return { title: 'AI Insights & Clustering', parent: 'Intelligence' }
      return { title: 'Feedback Explorer', parent: 'Intelligence' }
    }
    if (path === '/aggregation') return { title: 'Feature Request Aggregation', parent: 'Product Decisions' }
    if (path === '/prioritization') {
      if (tab === 'simulator') return { title: 'What-If Product Simulator', parent: 'Product Decisions' }
      return { title: 'Feature Prioritization', parent: 'Product Decisions' }
    }
    if (path === '/prd-generator') return { title: 'PRD Studio', parent: 'Specifications' }
    if (path === '/roadmap') {
      if (tab === 'readiness') return { title: 'Release Readiness Center', parent: 'Governance' }
      return { title: 'Product Roadmap', parent: 'Execution' }
    }
    if (path === '/copilot') return { title: 'AI Copilot Assistant', parent: 'Intelligence' }
    if (path === '/personas') return { title: 'Customer Personas', parent: 'Intelligence' }
    if (path === '/experiments') return { title: 'Product Experiment Lab', parent: 'Execution' }
    if (path === '/competitors') return { title: 'Competitor Intelligence', parent: 'Market Research' }
    if (path === '/journey') return { title: 'Customer Journey Mapping', parent: 'Customer Experience' }
    if (path === '/reports') return { title: 'Reports & Analytics', parent: 'Executive' }
    if (path === '/history') return { title: 'Activity History & Undo', parent: 'Audit' }
    if (path === '/settings') return { title: 'Settings', parent: 'Preferences' }
    return { title: 'Overview', parent: 'Workspace' }
  }

  const { title, parent } = getBreadcrumb()

  return (
    <header className="h-16 shrink-0 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 flex items-center justify-between z-20 select-none">
      {/* Left: Breadcrumbs & Page Title */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 hidden sm:inline">
          {parent}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 hidden sm:inline" />
        <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h1>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 text-xs transition-all cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Search everything...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[10px] text-slate-500 font-mono">
            /
          </kbd>
        </button>

        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          title="Command Palette (Ctrl+K)"
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 text-xs cursor-pointer"
        >
          <Command className="w-3.5 h-3.5 text-brand-500" />
          <kbd className="text-[10px] font-mono text-slate-500">⌘K</kbd>
        </button>

        {/* Interactive Recruiter Demo Mode Button */}
        <button
          onClick={() => startRecruiterDemo(0)}
          className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/80 border border-brand-300/60 dark:border-brand-700/60 text-brand-700 dark:text-brand-300 text-xs font-semibold shadow-sm cursor-pointer transition-all"
          title="Interactive Guided Recruiter Demo"
        >
          <PlayCircle className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span>Recruiter Demo</span>
        </button>

        {/* Executive Presentation Mode Button */}
        <button
          onClick={() => setPresentationModeActive(true)}
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-electric-50 hover:bg-electric-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/80 border border-sky-300/60 dark:border-sky-700/60 text-sky-700 dark:text-sky-300 text-xs font-semibold cursor-pointer transition-all"
          title="Launch Executive Presentation Slide Deck"
        >
          <Presentation className="w-3.5 h-3.5 text-electric-600 dark:text-sky-400" />
          <span className="hidden xl:inline">Presentation Mode</span>
        </button>

        {/* Guided Tour Trigger */}
        <button
          onClick={() => setTourSeen(false)}
          className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Replay Guided Tour"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Notification Center */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={markAllNotificationsAsRead}
                    className="text-[11px] font-medium text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Read all</span>
                  </button>
                  <button
                    onClick={clearAllNotifications}
                    className="text-[11px] font-medium text-slate-500 hover:text-rose-500 flex items-center gap-1"
                    title="Clear all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="py-2 max-h-72 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-center text-slate-400 py-6">No notifications</p>
                ) : (
                  notifications.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        markNotificationAsRead(item.id)
                        if (item.link) {
                          navigate(item.link)
                          setShowNotifications(false)
                        }
                      }}
                      className={`p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                        item.read
                          ? 'bg-slate-50/50 dark:bg-navy-950/40 opacity-70'
                          : 'bg-brand-50/50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {item.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-electric-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {currentUser?.avatar || 'PM'}
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-fadeIn">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser?.name}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{currentUser?.email}</p>
              </div>
              <Link
                to="/settings"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center justify-between px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <span>Workspace Settings</span>
              </Link>
              <button
                onClick={() => {
                  setShowProfileMenu(false)
                  logout()
                }}
                className="w-full text-left px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
