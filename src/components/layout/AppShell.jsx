import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNavbar } from './TopNavbar'
import { ToastContainer } from '../common/ToastContainer'
import { CinematicTitleIntro } from '../intro/CinematicTitleIntro'
import { GuidedTour } from '../tour/GuidedTour'
import { RecruiterDemoBar } from '../demo/RecruiterDemoBar'
import { PresentationMode } from '../presentation/PresentationMode'
import { GlobalSearchModal } from '../search/GlobalSearchModal'
import { CommandPaletteModal } from '../search/CommandPaletteModal'
import { useApp } from '../../context/AppContext'

export function AppShell() {
  const { introSeen, setIntroSeen } = useApp()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Global keyboard shortcuts (Ctrl+K, /, ?, Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is actively typing in input, textarea, or contentEditable
      const tag = e.target.tagName.toLowerCase()
      const isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(prev => !prev)
      } else if (e.key === '/' && !isInput) {
        e.preventDefault()
        setSearchOpen(true)
      } else if (e.key === 'Escape') {
        setSearchOpen(false)
        setCommandPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-navy-950 dark:text-slate-100">
      {/* Cinematic Intro Animation on first visit or when replayed */}
      {!introSeen && (
        <CinematicTitleIntro onComplete={() => setIntroSeen(true)} />
      )}

      {/* Persistent Collapsible Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <TopNavbar
          onOpenSearch={() => setSearchOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        {/* Recruiter Demonstration Interactive Bar */}
        <RecruiterDemoBar />

        {/* Page Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Modals & Overlays */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <CommandPaletteModal isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <PresentationMode />
      <GuidedTour />
      <ToastContainer />
    </div>
  )
}
