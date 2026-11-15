import React, { useState, useMemo } from 'react'
import {
  ShieldCheck,
  RotateCcw,
  Loader2,
  Filter,
  Search,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Card, Button } from '../../common'
import ValidationSummary from './ValidationSummary'
import ValidationIssueCard from './ValidationIssueCard'

export function PRDValidationPanel({
  validationResult = null,
  isValidating = false,
  onRunValidation = () => {},
  onNavigateToSection = () => {},
  onClose = null,
}) {
  const [selectedSeverity, setSelectedSeverity] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const issues = validationResult?.issues || []
  const summary = validationResult?.summary

  // Filtered issues calculation
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Severity filter
      if (selectedSeverity !== 'all' && issue.severity !== selectedSeverity) {
        return false
      }
      // Category filter
      if (selectedCategory !== 'all' && issue.category !== selectedCategory) {
        return false
      }
      // Search text filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = issue.title?.toLowerCase().includes(q)
        const matchesMsg = (issue.description || issue.message)?.toLowerCase().includes(q)
        const matchesSuggestion = (issue.recommendation || issue.suggestion)?.toLowerCase().includes(q)
        const matchesId =
          (issue.issue_id || issue.id)?.toLowerCase().includes(q) ||
          issue.related_id?.toLowerCase().includes(q)
        if (!matchesTitle && !matchesMsg && !matchesSuggestion && !matchesId) {
          return false
        }
      }
      return true
    })
  }, [issues, selectedSeverity, selectedCategory, searchQuery])

  const categories = [
    { key: 'all', label: 'All Categories' },
    { key: 'completeness', label: 'Completeness' },
    { key: 'requirement_quality', label: 'Quality' },
    { key: 'evidence_traceability', label: 'Traceability' },
    { key: 'acceptance_criteria', label: 'Criteria' },
    { key: 'success_metrics', label: 'Metrics' },
    { key: 'risks_and_mitigations', label: 'Risks' },
  ]

  return (
    <Card className="p-4 sm:p-5 border-2 border-brand-500/30 bg-white dark:bg-navy-950 shadow-sm space-y-4">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                PRD Quality & Verification Audit
              </h3>
              {validationResult && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                  {issues.length} {issues.length === 1 ? 'Finding' : 'Findings'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Deterministic verification of completeness, zero-fabrication policies, and Given-When-Then criteria
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="primary"
            icon={isValidating ? Loader2 : RotateCcw}
            disabled={isValidating}
            onClick={onRunValidation}
          >
            {isValidating ? 'Running Audit...' : validationResult ? 'Re-run Quality Audit' : 'Run Quality Audit'}
          </Button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
              title="Close Audit Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Validation Result Content */}
      {validationResult ? (
        <div className="space-y-4">
          {/* Summary Scorecard */}
          <ValidationSummary summary={summary} />

          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
            {/* Severity Pills */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Severity:
              </span>
              {[
                { key: 'all', label: `All (${issues.length})` },
                { key: 'critical', label: `Critical (${summary.critical_issues || 0})` },
                { key: 'high', label: `High (${summary.high_severity_issues || 0})` },
                { key: 'medium', label: `Medium (${summary.medium_severity_issues || 0})` },
                { key: 'low', label: `Low (${summary.low_severity_issues || 0})` },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setSelectedSeverity(s.key)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                    selectedSeverity === s.key
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search issues, IDs, sections..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-xs rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map(c => (
              <button
                key={c.key}
                onClick={() => setSelectedCategory(c.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === c.key
                    ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Issues List */}
          {filteredIssues.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-navy-900/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {issues.length === 0
                  ? 'All Validation Checks Passed!'
                  : 'No issues match the selected filters.'}
              </h4>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                {issues.length === 0
                  ? 'The specification adheres to all 13 canonical sections, zero-fabrication metrics, Given-When-Then acceptance criteria, and traceability rules.'
                  : 'Try clearing the search query or selecting a different severity/category filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[32rem] overflow-y-auto pr-1">
              {filteredIssues.map((issue, idx) => (
                <ValidationIssueCard
                  key={issue.issue_id || issue.id || `issue-${idx}`}
                  issue={issue}
                  onNavigate={onNavigateToSection}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Unvalidated initial state */
        <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-navy-900/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <Sparkles className="w-8 h-8 text-brand-500 mx-auto" />
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Audit Specification Quality Before Human Review
          </h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Run automated deterministic validation across 13 canonical sections, Given-When-Then acceptance criteria, zero-fabrication metrics, and evidence traceability.
          </p>
          <Button
            size="xs"
            variant="primary"
            icon={isValidating ? Loader2 : ShieldCheck}
            disabled={isValidating}
            onClick={onRunValidation}
          >
            {isValidating ? 'Validating...' : 'Run PRD Quality Audit'}
          </Button>
        </div>
      )}
    </Card>
  )
}

export default PRDValidationPanel
