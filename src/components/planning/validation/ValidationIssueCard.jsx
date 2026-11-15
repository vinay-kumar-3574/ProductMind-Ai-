import React from 'react'
import {
  AlertCircle,
  AlertTriangle,
  XCircle,
  Info,
  ArrowRight,
  Lightbulb,
  FileText,
  Tag,
} from 'lucide-react'
import { Button } from '../../common'

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    icon: XCircle,
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  high: {
    label: 'High',
    icon: AlertTriangle,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  medium: {
    label: 'Medium',
    icon: AlertCircle,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  low: {
    label: 'Low',
    icon: Info,
    color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  },
}

const CATEGORY_NAMES = {
  completeness: 'Completeness',
  requirement_quality: 'Requirement Quality',
  evidence_traceability: 'Evidence Traceability',
  acceptance_criteria: 'Acceptance Criteria',
  success_metrics: 'Success Metrics',
  risks_and_mitigations: 'Risks & Mitigations',
}

export function ValidationIssueCard({ issue, onNavigate = () => {} }) {
  if (!issue) return null

  const {
    id,
    issue_id,
    category,
    severity = 'medium',
    section_key = 'overview',
    title,
    message,
    description,
    suggestion,
    recommendation,
    related_id,
  } = issue

  const displayId = issue_id || id
  const displayMessage = description || message
  const displaySuggestion = recommendation || suggestion

  const sevConfig = SEVERITY_CONFIG[String(severity).toLowerCase()] || SEVERITY_CONFIG.medium
  const SevIcon = sevConfig.icon
  const categoryLabel = CATEGORY_NAMES[String(category).toLowerCase()] || category

  return (
    <div className="p-3.5 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5 transition-all hover:border-slate-300 dark:hover:border-slate-700">
      {/* Issue Badges Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-navy-950 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
            {displayId}
          </span>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${sevConfig.color}`}
          >
            <SevIcon className="w-2.5 h-2.5" />
            {sevConfig.label}
          </span>

          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
            {categoryLabel}
          </span>

          {related_id && (
            <span className="font-mono font-bold text-[10px] bg-slate-100 dark:bg-navy-950 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-0.5">
              <Tag className="w-2.5 h-2.5 text-slate-400" />
              {related_id}
            </span>
          )}
        </div>

        <button
          onClick={() => onNavigate(section_key, related_id)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-500 transition-colors cursor-pointer"
        >
          <span>Navigate to Section</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Title & Message */}
      <div>
        <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
          {title}
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {displayMessage}
        </p>
      </div>

      {/* Suggestion Callout */}
      {displaySuggestion && (
        <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="leading-snug">
            <strong className="font-semibold block text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Recommendation
            </strong>
            <span>{displaySuggestion}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ValidationIssueCard
