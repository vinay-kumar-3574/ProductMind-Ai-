import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard,
  MessageSquareText,
  Sparkles,
  SlidersHorizontal,
  FileText,
  Milestone,
  BotMessageSquare,
  TrendingUp,
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building2,
} from 'lucide-react'

export function Sidebar({ collapsed, setCollapsed }) {
  const { currentUser, logout } = useAuth()

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Product Analytics', path: '/analytics', icon: TrendingUp, badge: 'Data' },
    { name: 'Feedback Explorer', path: '/feedback', icon: MessageSquareText },
    { name: 'Feature Aggregation', path: '/aggregation', icon: Layers, badge: 'New' },
    { name: 'Prioritization', path: '/prioritization', icon: SlidersHorizontal },
    { name: 'PRD Studio', path: '/prd-generator', icon: FileText },
    { name: 'Roadmap', path: '/roadmap', icon: Milestone },
    { name: 'AI Copilot', path: '/copilot', icon: BotMessageSquare, badge: 'Live' },
  ]

  return (
    <aside
      className={`relative flex flex-col shrink-0 bg-white dark:bg-navy-900 border-r border-slate-200 dark:border-slate-800/80 transition-all duration-300 z-30 select-none ${
        collapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800/80">
        <NavLink to="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-electric-500 flex items-center justify-center text-white font-black shadow-glow-sm shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Product Mind
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 font-extrabold border border-brand-500/20">
                  AI
                </span>
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                Product Intelligence
              </span>
            </div>
          )}
        </NavLink>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Workspace Indicator (Non-collapsed) */}
      {!collapsed && (
        <div className="px-3 py-2.5 mx-3 my-2 rounded-xl bg-slate-50 dark:bg-navy-950/70 border border-slate-200/80 dark:border-slate-800/60 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col truncate">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              {currentUser?.workspaceName || 'Apex Product Ops'}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Enterprise Live Mode
            </span>
          </div>
        </div>
      )}

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 font-semibold shadow-sm border border-brand-200/60 dark:border-brand-800/50'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
              {!collapsed && <span className="truncate">{item.name}</span>}
              {!collapsed && item.badge && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  {item.badge}
                </span>
              )}

              {/* Tooltip in collapsed mode */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                  {item.name}
                </div>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Settings link & User profile bottom pill */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `group relative flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
              isActive
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 font-semibold shadow-sm border border-brand-200/60 dark:border-brand-800/50'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
            }`
          }
        >
          <Settings className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
          {!collapsed && <span className="truncate">Settings</span>}
          {collapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
              Settings
            </div>
          )}
        </NavLink>

        <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-200/80 dark:border-slate-800/60">
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-electric-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {currentUser?.avatar || 'PM'}
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {currentUser?.name || 'Alex Rivera'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {currentUser?.role || 'Lead PM'}
                </span>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
