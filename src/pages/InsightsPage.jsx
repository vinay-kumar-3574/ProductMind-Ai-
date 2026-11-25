import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useWorkspace } from '../context/WorkspaceContext'
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Filter,
  Brain,
  FileText,
  Lightbulb,
  Clock,
  Layers,
} from 'lucide-react'
import { Card, Badge, Button } from '../components/common'
import { reportingService } from '../services/api/reportingService'

export function InsightsPage() {
  const navigate = useNavigate()
  const { feedback, features, addToast } = useApp()
  const { currentWorkspace } = useWorkspace()

  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false)
  const [executiveSummary, setExecutiveSummary] = useState(null)

  // AI Briefing State
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false)
  const [executiveBriefing, setExecutiveBriefing] = useState(null)
  const [briefingError, setBriefingError] = useState(null)
  const [severityFilter, setSeverityFilter] = useState('All')

  // Load Executive Summary on mount or workspace change
  const loadIntelligence = async () => {
    if (!currentWorkspace?.id) return
    setIsLoadingIntelligence(true)
    try {
      const summary = await reportingService.getExecutiveSummary({
        workspaceId: currentWorkspace.id,
        timeRange: '30d',
      })
      setExecutiveSummary(summary)
    } catch (err) {
      console.warn('Failed to fetch product intelligence:', err)
    } finally {
      setIsLoadingIntelligence(false)
    }
  }

  useEffect(() => {
    loadIntelligence()
  }, [currentWorkspace?.id])

  // Trigger Live LLM Executive Briefing
  const handleGenerateBriefing = async () => {
    if (!currentWorkspace?.id) return
    setIsGeneratingBriefing(true)
    setBriefingError(null)

    try {
      const res = await reportingService.generateExecutiveBriefing({
        workspaceId: currentWorkspace.id,
        timeRange: '30d',
      })
      const briefingContent = res?.briefing || res || {}
      setExecutiveBriefing({
        ...res,
        ...briefingContent,
        executiveSummary: briefingContent.executiveSummary || briefingContent.executive_summary || res?.executiveSummary || '',
        strategicRecommendations: briefingContent.strategicRecommendations || briefingContent.strategic_recommendations || [],
        deliveryRisks: briefingContent.deliveryRisks || briefingContent.delivery_risks || [],
        keyDrivers: briefingContent.keyDrivers || briefingContent.key_drivers || [],
        confidenceScore: briefingContent.confidenceScore || briefingContent.confidence_score || 1.0,
      })
      addToast('Executive Product Briefing generated successfully', 'success')
    } catch (err) {
      const msg = err.message || 'Failed to generate executive briefing'
      setBriefingError(msg)
      addToast(msg, 'error')
    } finally {
      setIsGeneratingBriefing(false)
    }
  }

  // Aggregate cross-domain observations from live summary
  const observations = React.useMemo(() => {
    const list = []

    // 1. Feature opportunities
    if (executiveSummary?.featureOpportunities) {
      executiveSummary.featureOpportunities.forEach((opp, idx) => {
        list.push({
          id: `opp-${idx}`,
          title: `Opportunity: ${opp.title || opp.category}`,
          category: opp.category || 'Feature Request',
          severity: opp.opportunityScore > 75 ? 'critical' : opp.opportunityScore > 50 ? 'high' : 'medium',
          summary: opp.reason || opp.recommendation || `Demand count: ${opp.demandCount}`,
          recommendation: `Align upcoming sprint backlog to address ${opp.title || opp.category} demand. Priority score: ${opp.opportunityScore?.toFixed(0)}`,
          score: opp.opportunityScore,
          type: 'opportunity',
          evidenceCount: opp.evidenceFeedbackIds?.length || opp.demandCount || 0,
        })
      })
    }

    // 2. Customer Pain Points
    const painPointsList = executiveSummary?.topCustomerPainPoints || executiveSummary?.customerSentiment?.topCustomerPainPoints || []
    painPointsList.forEach((pain, idx) => {
      list.push({
        id: `pain-${idx}`,
        title: `Pain Point: ${pain.theme || pain.category || 'Customer Friction'}`,
        category: pain.theme || pain.category || 'General',
        severity: (pain.severity || 'high').toLowerCase(),
        summary: pain.customerPainPoint || pain.summary || `${pain.frequency || 1} feedback occurrences recorded.`,
        recommendation: `Investigate root cause in ${pain.theme || pain.category || 'friction area'}. Review feedback items and prioritize remediations.`,
        type: 'pain_point',
        evidenceCount: pain.frequency || pain.negativeCount || 1,
      })
    })

    // 3. Delivery Risks
    if (executiveSummary?.deliveryRisk?.itemsAtRisk) {
      executiveSummary.deliveryRisk.itemsAtRisk.forEach((riskItem, idx) => {
        list.push({
          id: `risk-${idx}`,
          title: `Delivery Risk: ${riskItem.title || riskItem.itemTitle}`,
          category: 'Delivery',
          severity: riskItem.severity || (riskItem.riskLevel === 'high' ? 'critical' : riskItem.riskLevel === 'medium' ? 'high' : 'medium'),
          summary: riskItem.reason || `Risk detected for roadmap item ${riskItem.title || riskItem.itemTitle}`,
          recommendation: `Unblock dependencies and reassign engineering resources. Item status: ${riskItem.status}.`,
          type: 'risk',
          evidenceCount: 1,
        })
      })
    }

    return list
  }, [executiveSummary])

  const filteredObservations = severityFilter === 'All'
    ? observations
    : observations.filter(obs => obs.severity === severityFilter.toLowerCase())

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Product Intelligence & Strategic Insights</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Atlas Grounded
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cross-domain intelligence synthesis: Customer sentiment, feature adoption, delivery risks, and AI briefings
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoadingIntelligence}
            onClick={loadIntelligence}
            icon={RefreshCw}
            className={isLoadingIntelligence ? 'animate-spin' : ''}
          >
            Refresh Data
          </Button>
          <Button
            variant="electric"
            size="sm"
            disabled={isGeneratingBriefing}
            onClick={handleGenerateBriefing}
            icon={isGeneratingBriefing ? RefreshCw : Sparkles}
            className={isGeneratingBriefing ? 'animate-pulse' : ''}
          >
            {isGeneratingBriefing ? 'Generating AI Briefing...' : 'Generate AI Briefing'}
          </Button>
        </div>
      </div>

      {/* AI Executive Briefing Card (if available or loading) */}
      {isGeneratingBriefing && (
        <Card className="p-5 border-brand-500/40 glow-border-brand animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white shrink-0 animate-spin">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                Synthesizing Executive Product Briefing...
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Aggregating customer signals, backlog priorities, roadmap milestones, and telemetry from Atlas
              </p>
            </div>
          </div>
        </Card>
      )}

      {briefingError && (
        <Card className="p-4 border-rose-500/40 bg-rose-50/10 dark:bg-rose-950/10 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <div className="flex-1">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Briefing Generation Notice</span>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{briefingError}</p>
          </div>
        </Card>
      )}

      {executiveBriefing && (
        <Card className="p-6 border-brand-500/50 bg-gradient-to-br from-brand-500/5 via-electric-500/5 to-transparent">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-electric-600 flex items-center justify-center text-white shadow-md">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Executive Product Briefing
                </h3>
                <span className="text-[10px] text-slate-400">
                  Model: {executiveBriefing.modelUsed || 'qwen/qwen3.8-27b'} • Generated {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
            <Badge variant="brand" size="sm">
              Strategic Briefing
            </Badge>
          </div>

          {/* Executive Summary Narrative */}
          <div className="p-4 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 mb-4">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Executive Overview
            </h4>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              {executiveBriefing.executiveSummary || executiveBriefing.summary || 'Summary unavailable.'}
            </p>
          </div>

          {/* Strategic Recommendations */}
          {executiveBriefing.strategicRecommendations?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                Strategic Recommendations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {executiveBriefing.strategicRecommendations.map((rec, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-900 dark:text-white block mb-1">
                      {i + 1}. {rec.recommendation || rec.title || rec}
                    </span>
                    {rec.rationale && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        <strong>Rationale:</strong> {rec.rationale}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Drivers */}
          {executiveBriefing.keyDrivers?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Key Strategic Drivers
              </h4>
              <div className="flex flex-wrap gap-2">
                {executiveBriefing.keyDrivers.map((driver, i) => (
                  <Badge key={i} variant="neutral" size="sm">
                    {driver}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Delivery & Operational Risks */}
          {executiveBriefing.deliveryRisks?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                Key Delivery Risks
              </h4>
              <div className="space-y-2">
                {executiveBriefing.deliveryRisks.map((risk, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-rose-50/20 dark:bg-rose-950/20 border border-rose-500/20 text-xs flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-rose-700 dark:text-rose-300">
                        {risk.itemTitle || risk.risk || risk}
                      </span>
                      {risk.mitigation && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          <strong>Mitigation:</strong> {risk.mitigation}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence Citations */}
          {executiveBriefing.evidenceCitations?.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Grounding Citations: </span>
              {executiveBriefing.evidenceCitations.join(' • ')}
            </div>
          )}
        </Card>
      )}

      {/* Filter Chips */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Severity:</span>
          </span>
          {['All', 'Critical', 'High', 'Medium'].map(sev => (
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
          Showing <strong>{filteredObservations.length}</strong> active intelligence signals
        </span>
      </div>

      {/* Observations Grid */}
      <div className="space-y-4">
        {filteredObservations.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-200 dark:border-slate-800">
            <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No signals match current filter</h3>
            <p className="text-xs text-slate-500 mt-1">
              Select another severity tier or ingest additional customer feedback and roadmap milestones.
            </p>
          </Card>
        ) : (
          filteredObservations.map(item => {
            const isCritical = item.severity === 'critical'
            const isHigh = item.severity === 'high'

            return (
              <Card
                key={item.id}
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
                      {isCritical ? (
                        <ShieldAlert className="w-4 h-4" />
                      ) : isHigh ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-semibold text-slate-400">Category: {item.category}</span>
                        {item.evidenceCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] font-semibold text-slate-400">{item.evidenceCount} Signals</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant={isCritical ? 'danger' : isHigh ? 'warning' : 'brand'}
                    size="sm"
                  >
                    {item.severity.toUpperCase()}
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  {item.summary}
                </p>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950/80 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">Recommended Action: </span>
                    <span className="text-slate-600 dark:text-slate-300">{item.recommendation}</span>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

export default InsightsPage
