import React from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  CheckCircle2,
  Award,
} from 'lucide-react'

export function ValidationSummary({ summary }) {
  if (!summary) return null

  const {
    quality_score = 100,
    quality_score_calculation = '',
    total_checks = 0,
    passed_checks = 0,
    failed_checks = 0,
    critical_issues = 0,
    high_severity_issues = 0,
    medium_severity_issues = 0,
    low_severity_issues = 0,
    is_valid_for_review = true,
    has_blocking_issues = false,
  } = summary

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
    if (score >= 60) return 'text-amber-500 border-amber-500/30 bg-amber-500/10'
    return 'text-rose-500 border-rose-500/30 bg-rose-500/10'
  }

  return (
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-950/80 border border-slate-200 dark:border-slate-800 space-y-4">
      {/* Top Banner: Score & Readiness State */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black border ${getScoreColor(
              quality_score
            )}`}
          >
            <span className="text-xl leading-none">{quality_score}</span>
            <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">Score</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Award className="w-4 h-4 text-brand-500" />
                PRD Quality & Integrity Scorecard
              </h3>
              {has_blocking_issues ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <XCircle className="w-3 h-3" />
                  Blocking Issues ({critical_issues + high_severity_issues})
                </span>
              ) : is_valid_for_review ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  Review Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3" />
                  Needs Attention
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {quality_score_calculation || `${passed_checks} of ${total_checks} quality criteria verified`}
            </p>
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Verification Ratio</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {passed_checks} / {total_checks} Checks Passed
          </span>
        </div>
      </div>

      {/* Severity Breakdown Stat Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20 text-rose-600 dark:text-rose-400">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              Critical
            </span>
            <span className="text-base font-black">{critical_issues}</span>
          </div>
          <p className="text-[10px] opacity-80 mt-0.5">Blocks PM approval</p>
        </div>

        <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-600 dark:text-amber-400">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              High
            </span>
            <span className="text-base font-black">{high_severity_issues}</span>
          </div>
          <p className="text-[10px] opacity-80 mt-0.5">Missing/unbacked requirements</p>
        </div>

        <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-blue-600 dark:text-blue-400">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Medium
            </span>
            <span className="text-base font-black">{medium_severity_issues}</span>
          </div>
          <p className="text-[10px] opacity-80 mt-0.5">Incomplete criteria/mitigations</p>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/20 text-slate-600 dark:text-slate-400">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              Low
            </span>
            <span className="text-base font-black">{low_severity_issues}</span>
          </div>
          <p className="text-[10px] opacity-80 mt-0.5">Non-testable / formatting</p>
        </div>
      </div>
    </div>
  )
}

export default ValidationSummary
