import React from 'react'
import { AlertTriangle, RefreshCw, Sparkles, Server, Inbox, CheckCircle2, ShieldAlert } from 'lucide-react'
import { isBackendConfigured, getApiBaseUrl } from '../../services/api/apiClient'
import { Button } from './index'

/**
 * Banner showing whether the view is connected to a live backend or running in client demo mode
 */
export function DemoModeBanner({ className = '', message = null }) {
  const configured = isBackendConfigured()

  if (configured) {
    return (
      <div className={`p-2.5 px-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold">Connected to Backend API:</span>
          <code className="px-1.5 py-0.5 rounded bg-emerald-500/20 font-mono text-[11px]">
            {getApiBaseUrl()}
          </code>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20">
          Live Backend
        </span>
      </div>
    )
  }

  return (
    <div className={`p-2.5 px-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="font-medium">
          {message || 'Demo Simulation Mode: Operating locally with sample data. No external backend required.'}
        </span>
      </div>
      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 shrink-0 ml-2">
        Frontend Demo
      </span>
    </div>
  )
}

/**
 * Standard Loading State
 */
export function LoadingState({ message = 'Loading data...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center ${className}`}>
      <div className="w-10 h-10 rounded-2xl bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 animate-spin mb-3">
        <RefreshCw className="w-5 h-5" />
      </div>
      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{message}</p>
      <p className="text-[11px] text-slate-400 mt-1">Please wait while information is processed</p>
    </div>
  )
}

/**
 * Standard Error State with Retry
 */
export function ErrorState({ error = 'Failed to load data', onRetry, className = '' }) {
  return (
    <div className={`p-6 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-center ${className}`}>
      <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto mb-3">
        <ShieldAlert className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">Unable to Complete Request</h4>
      <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 max-w-md mx-auto">{error}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="danger" size="sm" icon={RefreshCw} onClick={onRetry}>
            Retry Request
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Standard Empty State
 */
export function EmptyState({
  icon: Icon = Inbox,
  title = 'No items found',
  description = 'There are no records matching your criteria.',
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-950/30 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * AI Classification & Theme Presentation Component (Requirement 6)
 */
export function AIClassificationCard({
  category = 'Feature Requests',
  sentiment = 'Neutral',
  themes = [],
  confidence = 0.92,
  status = 'completed',
  onRetry,
  className = '',
}) {
  const sentimentColors = {
    Positive: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
    Neutral: 'text-sky-700 bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800',
    Negative: 'text-rose-700 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
  }

  return (
    <div className={`p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-500" />
          <span className="text-xs font-bold text-slate-900 dark:text-white">Classification & Themes</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
          Status: {status}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-950/60 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] text-slate-400 block font-medium">Category</span>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
            {category}
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-950/60 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] text-slate-400 block font-medium">Sentiment</span>
          <span className={`inline-block mt-0.5 text-xs font-bold px-2 py-0.5 rounded-md border ${sentimentColors[sentiment] || sentimentColors.Neutral}`}>
            {sentiment}
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-950/60 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-400 block font-medium">Model Confidence</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
              {Math.round(confidence * 100)}%
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full"
                style={{ width: `${Math.round(confidence * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {themes.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Extracted Themes
          </span>
          <div className="flex flex-wrap gap-1.5">
            {themes.map((th, i) => (
              <span
                key={i}
                className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-brand-50/80 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800/60"
              >
                #{th}
              </span>
            ))}
          </div>
        </div>
      )}

      {status === 'failed' && onRetry && (
        <div className="mt-3 pt-3 border-t border-rose-100 dark:border-rose-950 flex items-center justify-between">
          <span className="text-xs text-rose-600">Classification failed</span>
          <Button variant="danger" size="xs" icon={RefreshCw} onClick={onRetry}>
            Retry Analysis
          </Button>
        </div>
      )}
    </div>
  )
}
