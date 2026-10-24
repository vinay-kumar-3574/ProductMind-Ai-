import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useTheme } from '../../context/ThemeContext'
import {
  Command,
  LayoutDashboard,
  MessageSquareText,
  Sparkles,
  SlidersHorizontal,
  GitCompare,
  FileText,
  Milestone,
  FlaskConical,
  ShieldCheck,
  BotMessageSquare,
  Crosshair,
  Route,
  BarChart3,
  History,
  Settings,
  PlayCircle,
  Presentation,
  Sun,
  Moon,
  RotateCcw,
  Sparkle,
  PlusCircle,
} from 'lucide-react'

export function CommandPaletteModal({ isOpen, onClose, onOpenNewFeedback, onOpenNewFeature }) {
  const navigate = useNavigate()
  const { toggleTheme, theme } = useTheme()
  const {
    startRecruiterDemo,
    setPresentationModeActive,
    setIntroSeen,
    setTourSeen,
    resetToDemo,
  } = useApp()

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  const commands = [
    // Navigation
    { id: 'nav-dash', category: 'Navigation', label: 'Go to Dashboard', icon: LayoutDashboard, action: () => navigate('/') },
    { id: 'nav-feed', category: 'Navigation', label: 'Go to Feedback Explorer', icon: MessageSquareText, action: () => navigate('/feedback') },
    { id: 'nav-ins', category: 'Navigation', label: 'Go to AI Insights & Clustering', icon: Sparkles, action: () => navigate('/feedback?tab=insights') },
    { id: 'nav-prio', category: 'Navigation', label: 'Go to Feature Prioritization', icon: SlidersHorizontal, action: () => navigate('/prioritization') },
    { id: 'nav-sim', category: 'Navigation', label: 'Go to What-If Simulator', icon: GitCompare, action: () => navigate('/prioritization?tab=simulator') },
    { id: 'nav-prd', category: 'Navigation', label: 'Go to PRD Studio', icon: FileText, action: () => navigate('/prd-generator') },
    { id: 'nav-rd', category: 'Navigation', label: 'Go to Product Roadmap', icon: Milestone, action: () => navigate('/roadmap') },
    { id: 'nav-exp', category: 'Navigation', label: 'Go to Product Experiment Lab', icon: FlaskConical, action: () => navigate('/experiments') },
    { id: 'nav-rel', category: 'Navigation', label: 'Go to Release Readiness Center', icon: ShieldCheck, action: () => navigate('/roadmap?tab=readiness') },
    { id: 'nav-copilot', category: 'Navigation', label: 'Open AI Copilot Chat', icon: BotMessageSquare, action: () => navigate('/copilot') },
    { id: 'nav-comp', category: 'Navigation', label: 'Go to Competitor Intelligence', icon: Crosshair, action: () => navigate('/competitors') },
    { id: 'nav-jrn', category: 'Navigation', label: 'Go to Customer Journey Mapping', icon: Route, action: () => navigate('/journey') },
    { id: 'nav-rep', category: 'Navigation', label: 'Go to Reports & Analytics', icon: BarChart3, action: () => navigate('/?report=true') },
    { id: 'nav-hist', category: 'Navigation', label: 'Go to Activity History & Undo', icon: History, action: () => navigate('/history') },
    { id: 'nav-set', category: 'Navigation', label: 'Go to Settings', icon: Settings, action: () => navigate('/settings') },

    // Actions
    {
      id: 'act-new-feedback',
      category: 'Actions',
      label: 'Submit New Customer Feedback',
      icon: PlusCircle,
      action: () => {
        navigate('/feedback')
        if (onOpenNewFeedback) onOpenNewFeedback()
      }
    },
    {
      id: 'act-new-feat',
      category: 'Actions',
      label: 'Create New Feature to Prioritize',
      icon: PlusCircle,
      action: () => {
        navigate('/prioritization')
        if (onOpenNewFeature) onOpenNewFeature()
      }
    },
    {
      id: 'act-demo',
      category: 'Demonstration',
      label: 'Launch Interactive Recruiter Demo',
      icon: PlayCircle,
      action: () => startRecruiterDemo(0)
    },
    {
      id: 'act-present',
      category: 'Demonstration',
      label: 'Launch Executive Presentation Mode (10 Slides)',
      icon: Presentation,
      action: () => setPresentationModeActive(true)
    },
    {
      id: 'act-theme',
      category: 'Preferences',
      label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      icon: theme === 'dark' ? Sun : Moon,
      action: () => toggleTheme()
    },
    {
      id: 'act-intro',
      category: 'Preferences',
      label: 'Replay Cinematic Animated Introduction',
      icon: Sparkle,
      action: () => setIntroSeen(false)
    },
    {
      id: 'act-tour',
      category: 'Preferences',
      label: 'Restart Guided Onboarding Tour',
      icon: RotateCcw,
      action: () => setTourSeen(false)
    },
    {
      id: 'act-reset',
      category: 'Preferences',
      label: 'Reset Workspace to Demo Seed Data',
      icon: RotateCcw,
      action: () => resetToDemo()
    },
  ]

  const filtered = commands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [isOpen])

  // Key navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action()
        onClose()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-xl bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Command Search Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Command className="w-5 h-5 text-brand-500 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search actions..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono text-slate-400 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div className="p-2 max-h-80 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-center text-slate-400 py-8">No matching commands found.</p>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon
              const isSelected = index === selectedIndex
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action()
                    onClose()
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal">{item.category}</span>
                </div>
              )
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-navy-950/40 text-[10px] text-slate-400">
          <div className="flex items-center gap-2">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>Product Mind AI Workspace</span>
        </div>
      </div>
    </div>
  )
}
