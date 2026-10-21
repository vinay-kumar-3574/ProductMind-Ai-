import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Filter,
  Check,
} from 'lucide-react'
import { Card, Badge, Button } from '../components/common'
import { synthesizeInsights } from '../services/aiSimulationService'

export function InsightsPage() {
  const navigate = useNavigate()
  const { feedback, features, addToast } = useApp()

  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [severityFilter, setSeverityFilter] = useState('All')
  const [insights, setInsights] = useState(() => synthesizeInsights(feedback, features))

  const analysisSteps = [
    'Scanning customer feedback corpus...',
    'Extracting sentiment clusters & frequency vectors...',
    'Correlating customer pain points with backlog features...',
    'Synthesizing product opportunities & release blockers...',
  ]

  const handleRunAnalysis = () => {
    setAnalyzing(true)
    setAnalysisStep(0)

    const stepInterval = setInterval(() => {
      setAnalysisStep(prev => {
        if (prev < analysisSteps.length - 1) {
          return prev + 1
        }
        clearInterval(stepInterval)
        setTimeout(() => {
          setInsights(synthesizeInsights(feedback, features))
          setAnalyzing(false)
          addToast('AI Insights updated from current feedback corpus', 'success')
        }, 500)
        return prev
      })
    }, 450)
  }

  const filteredInsights = severityFilter === 'All'
    ? insights
    : insights.filter(ins => ins.severity === severityFilter.toLowerCase())

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Insights Workspace</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              Simulated Intelligence
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Deterministic NLP pattern recognition, pain point clustering, and strategic product recommendations
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Analyze / Refresh Button */}
          <Button
            variant="electric"
            size="sm"
            disabled={analyzing}
            onClick={handleRunAnalysis}
            icon={analyzing ? RefreshCw : Sparkles}
            className={analyzing ? 'animate-pulse' : ''}
          >
            {analyzing ? 'Analyzing Corpus...' : 'Analyze Feedback'}
          </Button>
        </div>
      </div>

      {/* Animated Analysis Progress Banner */}
      {analyzing && (
        <Card className="p-5 border-brand-500/40 glow-border-brand animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white shrink-0 animate-spin">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                Phase {analysisStep + 1} of {analysisSteps.length}
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                {analysisSteps[analysisStep]}
              </p>
            </div>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-electric-500 transition-all duration-300"
              style={{ width: `${((analysisStep + 1) / analysisSteps.length) * 100}%` }}
            />
          </div>
        </Card>
      )}

      {/* Filter Chips */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Severity:</span>
          </span>
          {['All', 'Critical', 'High', 'Medium', 'Info'].map(sev => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                severityFilter === sev
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400">
          Showing <strong>{filteredInsights.length}</strong> active observations
        </span>
      </div>

      {/* Insights Grid */}
      <div className="space-y-4">
        {filteredInsights.map(insight => {
          const isCritical = insight.severity === 'critical'
          const isHigh = insight.severity === 'high'
          const matchingFeedback = feedback.filter(f => insight.supportingFeedbackIds?.includes(f.id))
          const associatedFeat = features.find(f => f.id === insight.associatedFeatureId)

          return (
            <Card
              key={insight.id}
              className={`p-5 transition-all ${
                isCritical
                  ? 'border-rose-500/40 bg-rose-50/10 dark:bg-rose-950/10'
                  : isHigh
                  ? 'border-amber-500/40 bg-amber-50/10 dark:bg-amber-950/10'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
              hover
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isCritical
                        ? 'bg-rose-500/20 text-rose-500'
                        : isHigh
                        ? 'bg-amber-500/20 text-amber-500'
                        : 'bg-brand-500/20 text-brand-500'
                    }`}
                  >
                    {isCritical ? <ShieldAlert className="w-4 h-4" /> : isHigh ? <AlertTriangle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{insight.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold text-slate-400">Category: {insight.category}</span>
                      <span>•</span>
                      <span className="text-[10px] font-semibold text-slate-400">{insight.evidenceCount} Feedback Signals</span>
                    </div>
                  </div>
                </div>

                <Badge
                  variant={isCritical ? 'danger' : isHigh ? 'warning' : 'brand'}
                  size="sm"
                >
                  {insight.severity.toUpperCase()}
                </Badge>
              </div>

              {/* Summary paragraph */}
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                {insight.summary}
              </p>

              {/* Action Recommendation Box */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950/80 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-2.5 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">Recommended Action: </span>
                  <span className="text-slate-600 dark:text-slate-300">{insight.recommendation}</span>
                </div>
              </div>

              {/* Associated Feature link */}
              {associatedFeat && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Associated Roadmap Feature:</span>
                  <button
                    onClick={() => navigate('/prioritization')}
                    className="font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <span>{associatedFeat.name} (Score: {associatedFeat.score.toFixed(2)})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Supporting evidence collapsibles */}
              {matchingFeedback.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Supporting Customer Quotes ({matchingFeedback.length}):
                  </span>
                  <div className="space-y-1.5">
                    {matchingFeedback.map(fb => (
                      <div key={fb.id} className="p-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">"{fb.title}"</span> — {fb.customer} ({fb.company})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default InsightsPage
