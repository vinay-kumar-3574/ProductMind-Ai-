import React, { useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  SlidersHorizontal,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  Columns3,
  Edit2,
  Trash2,
  Link as LinkIcon,
  Sparkles,
  TrendingUp,
  MessageSquare,
  Send,
  HelpCircle,
  FileText,
  ChevronRight,
  ArrowUpDown,
  Layers,
  ExternalLink,
  GitCompare,
  Brain,
  Loader2,
  Quote,
} from 'lucide-react'
import { Card, Badge, Button, Modal, DemoModeBanner } from '../components/common'
import { prioritizationService } from '../services/api/prioritizationService'
import { useWorkspace } from '../context/WorkspaceContext'

export function PrioritizationPage() {
  const navigate = useNavigate()
  const {
    features,
    feedback,
    addFeature,
    updateFeature,
    deleteFeature,
    addToast,
  } = useApp()
  const { currentWorkspace } = useWorkspace()

  // AI Prioritization state
  const [aiPrioritizationResults, setAiPrioritizationResults] = useState([])
  const [isLoadingAiPrioritization, setIsLoadingAiPrioritization] = useState(false)
  const [aiError, setAiError] = useState(null)

  // Fetch stored prioritization results from backend
  const loadPrioritization = React.useCallback(async () => {
    if (!currentWorkspace?.id) {
      setAiPrioritizationResults([])
      setIsLoadingAiPrioritization(false)
      return
    }
    setIsLoadingAiPrioritization(true)
    setAiError(null)
    try {
      const results = await prioritizationService.getPrioritizationResults(currentWorkspace.id)
      if (Array.isArray(results)) {
        setAiPrioritizationResults(results)
      } else {
        setAiPrioritizationResults([])
      }
    } catch (err) {
      console.warn('Could not load prioritization results:', err)
      setAiError(err?.message || 'Failed to load prioritization results.')
      setAiPrioritizationResults([])
    } finally {
      setIsLoadingAiPrioritization(false)
    }
  }, [currentWorkspace?.id])

  React.useEffect(() => {
    setAiPrioritizationResults([])
    setAiError(null)
    loadPrioritization()
  }, [currentWorkspace?.id, loadPrioritization])

  // Run AI Prioritization Engine
  const handleRunAIPrioritization = async () => {
    if (!currentWorkspace?.id) {
      addToast('Please select a workspace first.', 'warning')
      return
    }

    setIsLoadingAiPrioritization(true)
    setAiError(null)

    try {
      const res = await prioritizationService.analyzePrioritization({
        workspaceId: currentWorkspace.id,
      })

      if (res?.results) {
        setAiPrioritizationResults(res.results)
        addToast(`Prioritization Agent evaluated ${res.total_evaluated || res.results.length} features!`, 'success')
      } else {
        await loadPrioritization()
      }
    } catch (err) {
      const msg = err?.message || 'Prioritization evaluation failed.'
      setAiError(msg)
      addToast(msg, 'error')
    } finally {
      setIsLoadingAiPrioritization(false)
    }
  }

  // View modes: 'table', 'card', 'kanban'
  const [viewMode, setViewMode] = useState('table')

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [releaseFilter, setReleaseFilter] = useState('All')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingFeature, setEditingFeature] = useState(null)
  const [inspectingFeature, setInspectingFeature] = useState(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formStatus, setFormStatus] = useState('In Planning')
  const [formOwner, setFormOwner] = useState('Alex Rivera')
  const [formRelease, setFormRelease] = useState('v2.4.0')

  // New comment input for inspecting modal
  const [newCommentText, setNewCommentText] = useState('')

  const statuses = ['All', 'Backlog', 'Evaluating', 'In Planning', 'In Development', 'Ready for Release', 'Launched']
  const releasesList = ['All', 'v2.3.0', 'v2.4.0', 'v2.5.0', 'v3.0.0']

  // Feature priority resolution: AI 6-Factor Prioritization Engine is the single source of truth
  const getFeaturePriority = React.useCallback((feat) => {
    const matchedAi = aiPrioritizationResults.find(
      r => (feat.featureGroupId && r.feature_group_id === feat.featureGroupId) ||
           r.feature_group_id === feat.id ||
           r.result_id === feat.id ||
           (r.group_name && feat.name && r.group_name.trim().toLowerCase() === feat.name.trim().toLowerCase())
    )
    if (matchedAi) {
      return {
        score: Number(matchedAi.final_score ?? 0),
        priorityLevel: matchedAi.priority_level || 'Medium',
        isAiEvaluated: true,
        matchedAi,
        coverage: matchedAi.coverage_percentage ?? 100,
        factorScores: matchedAi.factor_scores || {},
      }
    }
    const baseScore = typeof feat.score === 'number' ? feat.score : 7.0
    const normalized = baseScore <= 10 ? baseScore * 10 : baseScore
    let level = 'Medium'
    if (normalized >= 80) level = 'Critical'
    else if (normalized >= 65) level = 'High'
    else if (normalized < 45) level = 'Low'
    return {
      score: normalized,
      priorityLevel: level,
      isAiEvaluated: false,
      matchedAi: null,
      coverage: null,
      factorScores: {},
    }
  }, [aiPrioritizationResults])

  // Filter and sort features strictly by authoritative AI priority score and workspace
  const sortedFeatures = useMemo(() => {
    return [...features]
      .filter(f => {
        // Enforce workspace scoping
        if (currentWorkspace?.id && f.workspaceId && f.workspaceId !== currentWorkspace.id) {
          return false
        }
        if (searchTerm) {
          const q = searchTerm.toLowerCase()
          if (!f.name.toLowerCase().includes(q) && !f.description.toLowerCase().includes(q)) return false
        }
        if (statusFilter !== 'All' && f.status !== statusFilter) return false
        if (releaseFilter !== 'All' && f.targetRelease !== releaseFilter) return false
        return true
      })
      .map(f => ({
        ...f,
        priority: getFeaturePriority(f),
      }))
      .sort((a, b) => b.priority.score - a.priority.score)
  }, [features, currentWorkspace?.id, searchTerm, statusFilter, releaseFilter, getFeaturePriority])

  const handleOpenCreate = () => {
    setEditingFeature(null)
    setFormName('')
    setFormDescription('')
    setFormStatus('In Planning')
    setFormOwner('Alex Rivera')
    setFormRelease('v2.4.0')
    setShowCreateModal(true)
  }

  const handleOpenEdit = (feat) => {
    setEditingFeature(feat)
    setFormName(feat.name)
    setFormDescription(feat.description)
    setFormStatus(feat.status)
    setFormOwner(feat.owner)
    setFormRelease(feat.targetRelease)
    setShowCreateModal(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!formName.trim()) {
      addToast('Please provide a feature name', 'warning')
      return
    }

    const payload = {
      name: formName,
      workspaceId: currentWorkspace?.id,
      description: formDescription,
      status: formStatus,
      owner: formOwner,
      targetRelease: formRelease,
    }

    if (editingFeature) {
      updateFeature(editingFeature.id, payload)
    } else {
      addFeature(payload)
    }

    setShowCreateModal(false)
  }

  // Add comment
  const handleAddComment = () => {
    if (!newCommentText.trim() || !inspectingFeature) return
    const newComment = {
      id: `c-${Date.now()}`,
      author: 'Alex Rivera',
      text: newCommentText.trim(),
      date: new Date().toISOString().split('T')[0],
    }
    const updatedComments = [...(inspectingFeature.comments || []), newComment]
    updateFeature(inspectingFeature.id, { comments: updatedComments })
    setInspectingFeature({ ...inspectingFeature, comments: updatedComments })
    setNewCommentText('')
    addToast('Comment added', 'success')
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Feature Prioritization Matrix</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              AI 6-Factor Model
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Authoritative feature ranking driven by the Automated AI 6-Factor Prioritization Engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 bg-slate-50 dark:bg-navy-950">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md ${viewMode === 'table' ? 'bg-white dark:bg-navy-900 text-brand-600 shadow-xs' : 'text-slate-400'}`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md ${viewMode === 'card' ? 'bg-white dark:bg-navy-900 text-brand-600 shadow-xs' : 'text-slate-400'}`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md ${viewMode === 'kanban' ? 'bg-white dark:bg-navy-900 text-brand-600 shadow-xs' : 'text-slate-400'}`}
              title="Kanban Board View"
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={isLoadingAiPrioritization}
            onClick={loadPrioritization}
            icon={isLoadingAiPrioritization ? Loader2 : Sparkles}
            title="Refresh priority ranking from background AI evaluation"
          >
            {isLoadingAiPrioritization ? 'Syncing...' : 'Sync Priority'}
          </Button>

          <Link to="/aggregation">
            <Button variant="secondary" size="sm" icon={Layers}>
              Aggregation Clusters
            </Button>
          </Link>

          <Button variant="outline" size="sm" icon={Plus} onClick={handleOpenCreate}>
            New Feature
          </Button>
        </div>
      </div>

      {aiError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs">
          {aiError}
        </div>
      )}

      {/* AI 6-Factor Prioritization Engine Results */}
      {aiPrioritizationResults.length > 0 && (
        <Card className="p-4 border border-brand-200/80 dark:border-brand-800/70 bg-white dark:bg-navy-900 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  AI 6-Factor Prioritization Results ({aiPrioritizationResults.length})
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Live 0–100 Composite Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                Composite = 0.25 Demand + 0.20 Urgency + 0.20 Business Impact + 0.15 Strategic Alignment + 0.10 Sentiment + 0.10 Usage Impact
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {aiPrioritizationResults.map((res, idx) => {
              const factorDefs = [
                { key: 'customer_demand', label: 'Customer Demand', defaultWeight: 0.25, color: 'bg-brand-500' },
                { key: 'urgency', label: 'Urgency', defaultWeight: 0.20, color: 'bg-rose-500' },
                { key: 'business_impact', label: 'Business Impact', defaultWeight: 0.20, color: 'bg-indigo-500' },
                { key: 'strategic_alignment', label: 'Strategic Alignment', defaultWeight: 0.15, color: 'bg-sky-500' },
                { key: 'sentiment', label: 'Sentiment', defaultWeight: 0.10, color: 'bg-amber-500' },
                { key: 'usage_impact', label: 'Usage Impact', defaultWeight: 0.10, color: 'bg-emerald-500' },
              ]
              const factorScores = res.factor_scores || {}
              const factorWeights = res.factor_weights || {}
              const missingList = res.missing_data || []

              return (
                <div
                  key={res.result_id || res.feature_group_id || idx}
                  className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-navy-950/70 border border-slate-200/80 dark:border-slate-800 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-brand-600/10 text-brand-600 dark:text-brand-400 font-bold text-xs inline-flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {res.group_name}
                          </h4>
                          {res.analysis_status && res.analysis_status !== 'completed' && (
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                              res.analysis_status === 'processing'
                                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                                : res.analysis_status === 'pending'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            }`}>
                              {res.analysis_status.toUpperCase()}
                            </span>
                          )}
                          {res.analysis_status === 'completed' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              AUTOMATIC AI
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>
                            Data Coverage: {Number(res.coverage_percentage ?? 100).toFixed(1)}%
                            {missingList.length > 0 ? ` • Reweighted (missing: ${missingList.join(', ')})` : ' • All 6 Factors Measured'}
                          </span>
                          {(res.last_analyzed_at || res.updated_at) && (
                            <span>
                              • Last Analyzed: {new Date(res.last_analyzed_at || res.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-base font-black text-brand-600 dark:text-brand-400 font-mono">
                          {Number(res.final_score ?? 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">/ 100</span>
                      </div>
                      <Badge variant={res.priority_level === 'Critical' ? 'danger' : res.priority_level === 'High' ? 'warning' : 'brand'}>
                        {res.priority_level}
                      </Badge>
                      {res.feature_group_id && (
                        <Button
                          variant="outline"
                          size="xs"
                          icon={FileText}
                          onClick={() => navigate(`/prd-generator?featureId=${res.feature_group_id}`, { state: { featureId: res.feature_group_id } })}
                        >
                          Generate PRD
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* All 6 Factor Scores */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {factorDefs.map(f => {
                      const rawScore = factorScores[f.key]
                      const isMeasured = rawScore !== undefined && rawScore !== null
                      const weightVal = factorWeights[f.key]
                      const weightPct = weightVal !== undefined ? `${(Number(weightVal) * 100).toFixed(1)}%` : `${(f.defaultWeight * 100).toFixed(0)}%`
                      return (
                        <div
                          key={f.key}
                          className="p-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/70 dark:border-slate-800 text-[11px]"
                        >
                          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                            <span className="truncate font-medium">{f.label}</span>
                            <span className="text-[10px] font-mono">{weightPct}</span>
                          </div>
                          {isMeasured ? (
                            <>
                              <div className="font-bold text-slate-900 dark:text-white font-mono">
                                {Number(rawScore).toFixed(1)}
                              </div>
                              <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                                <div className={f.color + ' h-full'} style={{ width: `${Math.min(100, Math.max(0, Number(rawScore)))}%` }} />
                              </div>
                            </>
                          ) : (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              Unmeasured
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {res.explanation && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {res.explanation}
                    </p>
                  )}

                  {/* Grounded Customer Evidence & Pain Point Severity */}
                  {(res.customer_pain_point_severity || (res.supporting_evidence && res.supporting_evidence.length > 0)) && (
                    <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-navy-900/60 border border-slate-200/60 dark:border-slate-800 text-[11px] space-y-1.5">
                      {res.customer_pain_point_severity && (
                        <div className="text-slate-700 dark:text-slate-200">
                          <strong className="text-slate-900 dark:text-white">Customer Pain Point Severity:</strong>{' '}
                          {res.customer_pain_point_severity}
                        </div>
                      )}
                      {res.supporting_evidence && res.supporting_evidence.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                            <Quote className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                            Grounded Customer Evidence ({res.supporting_evidence.length}):
                          </span>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 italic pl-1">
                            {res.supporting_evidence.slice(0, 3).map((ev, i) => (
                              <li key={i} className="line-clamp-2">
                                &ldquo;{ev}&rdquo;
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Usage Analytics Evidence Explainability */}
                  {(() => {
                    const ue = res.agent_metadata?.usage_analytics_evidence
                    if (ue && ue.available) {
                      return (
                        <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-800/50 text-[11px] space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-emerald-800 dark:text-emerald-300">
                              Usage Analytics Evidence ({ue.matched_feature || res.group_name})
                            </span>
                            <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                              Coverage: {ue.coverage_status || 'measured'} • Weight: {(Number(ue.weight_applied ?? 0.1) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                            <span>Events: {ue.event_count ?? 'Unavailable'}</span>
                            <span>Unique Users: {ue.unique_users ?? 'Unavailable'}</span>
                            <span>Adoption: {ue.adoption_rate !== null && ue.adoption_rate !== undefined ? `${ue.adoption_rate}%` : 'Unavailable'}</span>
                            <span>Trend: {ue.trend_direction || 'stable'}</span>
                          </div>
                        </div>
                      )
                    }
                    if (missingList.includes('usage_impact') || (ue && !ue.available)) {
                      return (
                        <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300">
                          <strong>Usage Analytics Unavailable:</strong>{' '}
                          {ue?.missing_reason || 'No matching feature usage telemetry found in workspace MongoDB Atlas rollups; 10% weight reweighted across measured factors.'}
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Feature Name & Details</th>
                  <th className="py-3 px-4 text-center">AI Priority Score</th>
                  <th className="py-3 px-4">AI 6-Factor Coverage</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {sortedFeatures.map((feat, idx) => {
                  return (
                    <tr key={feat.id} className="hover:bg-slate-50/70 dark:hover:bg-navy-950/40 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <span className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold text-xs inline-flex items-center justify-center">
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-sm">
                        <div className="flex flex-col">
                          <button
                            onClick={() => setInspectingFeature(feat)}
                            className="font-bold text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 text-left line-clamp-1"
                          >
                            {feat.name}
                          </button>
                          <span className="text-slate-400 line-clamp-1 mt-0.5">{feat.description}</span>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                            <span>Owner: {feat.owner}</span>
                            <span>•</span>
                            <span>{feat.relatedFeedbackIds?.length || 0} Linked Feedback</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-base font-black text-brand-600 dark:text-brand-400 block font-mono">
                          {feat.priority.score.toFixed(1)}
                        </span>
                        <Badge variant={feat.priority.priorityLevel === 'Critical' ? 'danger' : feat.priority.priorityLevel === 'High' ? 'warning' : 'brand'}>
                          {feat.priority.priorityLevel}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {feat.priority.isAiEvaluated ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              <Brain className="w-3 h-3" />
                              <span>6-Factor Evaluated ({Number(feat.priority.coverage).toFixed(0)}%)</span>
                            </div>
                            {feat.priority.matchedAi?.customer_pain_point_severity && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                Severity: {feat.priority.matchedAi.customer_pain_point_severity}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            Standard Matrix Rank
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="default">{feat.status}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="brand">{feat.targetRelease}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/prd-generator?featureId=${feat.id}`, { state: { featureId: feat.id } })}
                            className="p-1 text-slate-400 hover:text-brand-600 rounded-md"
                            title="Generate PRD"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(feat)}
                            className="p-1 text-slate-400 hover:text-brand-600 rounded-md"
                            title="Edit Feature"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteFeature(feat.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                            title="Delete Feature"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* CARD VIEW */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedFeatures.map((feat, idx) => {
            return (
              <Card key={feat.id} className="p-5 flex flex-col justify-between" hover>
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{feat.name}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-brand-600 dark:text-brand-400 font-mono">
                        {feat.priority.score.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1">/ 100</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {feat.description}
                  </p>

                  {/* AI Prioritization Summary */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                        AI 6-Factor Prioritization
                      </span>
                      <Badge variant={feat.priority.priorityLevel === 'Critical' ? 'danger' : feat.priority.priorityLevel === 'High' ? 'warning' : 'brand'}>
                        {feat.priority.priorityLevel}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Priority Rank</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                        #{idx + 1} ({feat.priority.score.toFixed(1)} / 100)
                      </span>
                    </div>
                    {feat.priority.isAiEvaluated ? (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Data Coverage:</span>
                          <span className="font-mono">{Number(feat.priority.coverage).toFixed(0)}%</span>
                        </div>
                        {feat.priority.matchedAi?.customer_pain_point_severity && (
                          <div className="line-clamp-1">
                            <strong className="text-slate-700 dark:text-slate-300">Severity:</strong> {feat.priority.matchedAi.customer_pain_point_severity}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic">
                        Standard prioritization score mapped to 0–100 scale.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{feat.status}</Badge>
                    <Badge variant="brand">{feat.targetRelease}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/prd-generator?featureId=${feat.id}`, { state: { featureId: feat.id } })}
                      className="text-slate-500 hover:text-brand-600 flex items-center gap-1"
                      title="Generate PRD"
                    >
                      <FileText className="w-3 h-3" />
                      <span>PRD</span>
                    </button>
                    <button onClick={() => setInspectingFeature(feat)} className="text-brand-600 dark:text-brand-400 hover:underline">
                      Details
                    </button>
                    <button onClick={() => handleOpenEdit(feat)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                      Edit
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {statuses.filter(s => s !== 'All').map(colStatus => {
            const colFeatures = sortedFeatures.filter(f => f.status === colStatus)
            return (
              <div key={colStatus} className="flex flex-col rounded-2xl bg-slate-100/60 dark:bg-navy-900/60 border border-slate-200 dark:border-slate-800 p-3 min-h-[500px]">
                <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{colStatus}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {colFeatures.length}
                  </span>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto">
                  {colFeatures.map(feat => (
                    <Card
                      key={feat.id}
                      onClick={() => setInspectingFeature(feat)}
                      className="p-3 cursor-pointer hover:border-brand-500/50 transition-all"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 font-mono">
                          Score {feat.priority.score.toFixed(1)}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {feat.targetRelease}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">{feat.name}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{feat.description}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Feature Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingFeature ? 'Edit Feature' : 'Prioritize New Feature'}
        subtitle="Features are evaluated and prioritized automatically by the AI 6-Factor Prioritization Engine"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Feature Name *
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="e.g. High-Performance Virtualized Data Grid"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Scope
            </label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="Describe user story and architectural goal..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {statuses.filter(s => s !== 'All').map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Owner</label>
              <input
                type="text"
                value={formOwner}
                onChange={e => setFormOwner(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Release</label>
              <select
                value={formRelease}
                onChange={e => setFormRelease(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {releasesList.filter(r => r !== 'All').map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">
              {editingFeature ? 'Update Feature' : 'Add Feature'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Feature Details & Discussion Modal */}
      {inspectingFeature && (
        <Modal
          isOpen={!!inspectingFeature}
          onClose={() => setInspectingFeature(null)}
          title={inspectingFeature.name}
          subtitle={`AI Priority Score: ${(inspectingFeature.priority?.score ?? inspectingFeature.score ?? 70).toFixed(1)}/100 • ${inspectingFeature.status}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {inspectingFeature.description}
            </p>

            {/* AI 6-Factor metrics or score summary */}
            {inspectingFeature.priority?.isAiEvaluated && inspectingFeature.priority?.factorScores && Object.keys(inspectingFeature.priority.factorScores).length > 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-brand-600" />
                    AI 6-Factor Prioritization Metrics
                  </span>
                  <Badge variant={inspectingFeature.priority.priorityLevel === 'Critical' ? 'danger' : inspectingFeature.priority.priorityLevel === 'High' ? 'warning' : 'brand'}>
                    {inspectingFeature.priority.priorityLevel}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px] font-mono text-center">
                  {Object.entries(inspectingFeature.priority.factorScores).map(([key, val]) => (
                    <div key={key} className="p-1.5 rounded-lg bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-slate-800">
                      <div className="text-slate-400 capitalize truncate">{key.replace(/_/g, ' ')}</div>
                      <div className="font-bold text-slate-900 dark:text-white">{Number(val).toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-xs flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-brand-600" />
                  Prioritization Rank:
                </span>
                <span className="font-bold text-brand-600 dark:text-brand-400 font-mono text-sm">
                  {(inspectingFeature.priority?.score ?? inspectingFeature.score ?? 70).toFixed(1)} / 100
                </span>
              </div>
            )}

            {/* Linked Feedback Section */}
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block mb-2">
                Linked Customer Feedback ({inspectingFeature.relatedFeedbackIds?.length || 0})
              </span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {feedback.filter(f => inspectingFeature.relatedFeedbackIds?.includes(f.id)).map(fb => (
                  <div
                    key={fb.id}
                    onClick={() => {
                      setInspectingFeature(null)
                      navigate('/feedback')
                    }}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-[11px] hover:border-brand-500 cursor-pointer transition-colors group flex items-center justify-between"
                    title="Click to view feedback record in Feedback Explorer"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {fb.title}
                      </span>
                      <span className="text-slate-400 block mt-0.5">{fb.customer} ({fb.company})</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-500 shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>

            {/* Comments & Discussion */}
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block mb-2">
                Team Notes & Discussion ({inspectingFeature.comments?.length || 0})
              </span>
              <div className="space-y-2 mb-3 max-h-36 overflow-y-auto">
                {(inspectingFeature.comments || []).map(comm => (
                  <div key={comm.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{comm.author}</span>
                      <span>{comm.date}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{comm.text}</p>
                  </div>
                ))}
              </div>

              {/* Add comment */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add note or rationale..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
                <Button size="sm" onClick={handleAddComment} icon={Send}>Post</Button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <Button
                variant="outline"
                size="xs"
                icon={FileText}
                onClick={() => {
                  const featId = inspectingFeature.id
                  setInspectingFeature(null)
                  navigate(`/prd-generator?featureId=${featId}`, { state: { featureId: featId } })
                }}
              >
                Generate PRD
              </Button>
              <Button size="xs" onClick={() => setInspectingFeature(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default PrioritizationPage
