import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useWorkspace } from '../context/WorkspaceContext'
import {
  Layers,
  Sparkles,
  GitMerge,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  Filter,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Plus,
  RefreshCw,
  Brain,
  Loader2,
  Users,
  CopyCheck,
  FileText,
  X,
  Eye,
  ShieldCheck,
  Calendar,
  Building,
  User as UserIcon,
} from 'lucide-react'
import { Card, Badge, Button, Modal, DemoModeBanner, EmptyState, LoadingState } from '../components/common'
import { aggregationService, normalizeFeatureGroup } from '../services/api/aggregationService'
import { isBackendConfigured } from '../services/api/apiClient'

const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)

export function AggregationPage() {
  const navigate = useNavigate()
  const { feedback, features, addFeature, addToast, updateFeedback } = useApp()
  const { currentWorkspace } = useWorkspace()

  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  // Modals & Panels
  const [mergeModalSource, setMergeModalSource] = useState(null)
  const [selectedMergeTargetId, setSelectedMergeTargetId] = useState('')
  const [isMerging, setIsMerging] = useState(false)

  // Feedback inspection modal
  const [inspectingGroup, setInspectingGroup] = useState(null)
  const [inspectingFeedback, setInspectingFeedback] = useState([])
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false)

  // Duplicate detection modal
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false)
  const [duplicateResults, setDuplicateResults] = useState([])
  const [duplicateError, setDuplicateError] = useState(null)

  // Backend state
  const [backendGroups, setBackendGroups] = useState(null)
  const [isLoadingBackend, setIsLoadingBackend] = useState(false)
  const [backendError, setBackendError] = useState(null)
  const [isClustering, setIsClustering] = useState(false)
  const [clusteringError, setClusteringError] = useState(null)

  // Fetch groups from backend on mount or workspace change
  const loadGroups = useCallback(async () => {
    if (!currentWorkspace?.id || !isValidObjectId(currentWorkspace.id) || !isBackendConfigured()) {
      setIsLoadingBackend(false)
      return
    }
    setIsLoadingBackend(true)
    setBackendError(null)
    try {
      const res = await aggregationService.getFeatureGroups(currentWorkspace.id)
      setBackendGroups(res || [])
    } catch (err) {
      console.warn('Could not fetch backend groups:', err)
      setBackendError(err?.message || 'Failed to retrieve feature groups from backend.')
    } finally {
      setIsLoadingBackend(false)
    }
  }, [currentWorkspace?.id])

  useEffect(() => {
    setBackendGroups(null)
    setInspectingGroup(null)
    setMergeModalSource(null)
    loadGroups()
  }, [currentWorkspace?.id, loadGroups])

  // Run AI Grouping
  const handleRunAIGrouping = async () => {
    if (!currentWorkspace?.id || !isValidObjectId(currentWorkspace.id)) {
      addToast('Please select a valid workspace first.', 'warning')
      return
    }

    setIsClustering(true)
    setClusteringError(null)

    try {
      const res = await aggregationService.groupFeatures({
        workspaceId: currentWorkspace.id,
        forceRegroup: true,
      })

      const groups = res?.groups || res?.feature_groups || []
      setBackendGroups(groups)
      const count = res?.total_feedback_analyzed ?? res?.groups_created ?? groups.length
      addToast(
        `AI successfully clustered ${count} feedback items into ${groups.length} feature groups!`,
        'success'
      )
    } catch (err) {
      const msg = err?.message || 'Feature Intelligence grouping failed.'
      setClusteringError(msg)
      addToast(msg, 'error')
    } finally {
      setIsClustering(false)
    }
  }

  // Open Feedback Detail modal
  const handleOpenGroupDetail = async (group) => {
    setInspectingGroup(group)
    setInspectingFeedback([])
    setIsLoadingFeedback(true)

    // Check if feedbackItems are already populated on the group
    if (group.feedbackItems && group.feedbackItems.length > 0 && group.feedbackItems[0].title) {
      setInspectingFeedback(group.feedbackItems)
      setIsLoadingFeedback(false)
      return
    }

    try {
      const items = await aggregationService.getGroupFeedback(group.id, currentWorkspace?.id)
      if (items && items.length > 0) {
        setInspectingFeedback(items)
      } else {
        // Match from local feedback if available
        const localMatched = feedback.filter(f => group.relatedFeedbackIds?.includes(String(f.id)))
        setInspectingFeedback(localMatched)
      }
    } catch (err) {
      console.warn('Could not fetch detailed feedback items:', err)
      const localMatched = feedback.filter(f => group.relatedFeedbackIds?.includes(String(f.id)))
      setInspectingFeedback(localMatched)
    } finally {
      setIsLoadingFeedback(false)
    }
  }

  // Run Duplicate Detection
  const handleRunDuplicateDetection = async () => {
    if (!currentWorkspace?.id || !isValidObjectId(currentWorkspace.id)) {
      addToast('Please select a valid workspace first.', 'warning')
      return
    }
    setShowDuplicateModal(true)
    setIsDetectingDuplicates(true)
    setDuplicateError(null)
    setDuplicateResults([])

    try {
      const res = await aggregationService.detectDuplicates({
        workspaceId: currentWorkspace.id,
      })
      setDuplicateResults(res?.results || [])
      addToast(`Analyzed ${res?.total_evaluated || 0} items; found ${res?.duplicates_found || 0} duplicate relationships`, 'info')
    } catch (err) {
      const msg = err?.message || 'Failed to run duplicate detection.'
      setDuplicateError(msg)
      addToast(msg, 'error')
    } finally {
      setIsDetectingDuplicates(false)
    }
  }

  // Merge Action
  const handleMergeConfirm = async () => {
    if (!mergeModalSource || !selectedMergeTargetId || !currentWorkspace?.id) return
    setIsMerging(true)
    try {
      const res = await aggregationService.mergeGroups(
        mergeModalSource.id,
        selectedMergeTargetId,
        currentWorkspace.id
      )
      addToast(res.message || 'Successfully merged feature groups', 'success')
      setMergeModalSource(null)
      setSelectedMergeTargetId('')
      await loadGroups()
    } catch (err) {
      addToast(err?.message || 'Failed to merge feature groups', 'error')
    } finally {
      setIsMerging(false)
    }
  }

  // Promote / Approve group into Prioritization
  const handlePromoteToFeature = (group) => {
    const existing = features.find(
      f => (group.promotedFeatureId && String(f.id) === String(group.promotedFeatureId)) ||
           f.name.toLowerCase() === group.title.toLowerCase()
    )
    if (existing) {
      addToast(`Feature "${existing.name}" is already in the prioritization pipeline`, 'info')
      navigate('/prioritization')
      return
    }

    // Default factors derived from group metrics
    const urgency = group.sentimentDistribution.Negative > 0 ? 8 : 6
    const demand = Math.min(10, Math.max(3, group.count * 2))
    const customerImpact = group.count >= 3 ? 8 : 6
    const businessValue = 7

    const created = addFeature({
      name: group.title,
      workspaceId: currentWorkspace?.id,
      description: group.description || `Aggregated feature request derived from ${group.count} customer feedback submissions. Primary focus: ${group.primaryTag}.`,
      customerImpact,
      urgency,
      demand,
      businessValue,
      status: 'Evaluating',
      owner: 'Alex Rivera',
      targetRelease: 'v2.5.0',
      relatedFeedbackIds: group.relatedFeedbackIds || (group.feedbackItems || []).map(f => f.id),
      featureGroupId: group.id,
    })

    // Update feedback items to link to created feature
    (group.relatedFeedbackIds || []).forEach(fid => {
      updateFeedback(fid, { linkedFeatureId: created.id })
    })

    addToast(`Approved and promoted "${group.title}" to Feature Prioritization!`, 'success')
    navigate('/prioritization')
  }

  // Fallback initial groups from local data (only when backend is offline or unconfigured)
  const initialLocalGroups = useMemo(() => {
    return aggregationService.generateAggregatedGroups(feedback, features)
  }, [feedback, features])

  // Active groups decision:
  // If backend is configured and workspace is an ObjectId, rely strictly on backendGroups
  const isLiveBackend = isBackendConfigured() && isValidObjectId(currentWorkspace?.id)
  const activeGroups = useMemo(() => {
    if (isLiveBackend) {
      return backendGroups !== null ? backendGroups : []
    }
    return initialLocalGroups
  }, [isLiveBackend, backendGroups, initialLocalGroups])

  const filteredGroups = useMemo(() => {
    return activeGroups.filter(grp => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        const matchTitle = grp.title.toLowerCase().includes(q)
        const matchCat = grp.category.toLowerCase().includes(q)
        const matchTag = grp.primaryTag.toLowerCase().includes(q)
        const matchDesc = grp.description?.toLowerCase().includes(q)
        if (!matchTitle && !matchCat && !matchTag && !matchDesc) return false
      }
      if (categoryFilter !== 'All' && grp.category !== categoryFilter) return false
      return true
    })
  }, [activeGroups, searchTerm, categoryFilter])

  const categories = ['All', 'Feature Requests', 'Performance', 'Integrations', 'Usability', 'Reliability', 'Pricing', 'Satisfaction']

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Demo / Live Status Banner */}
      {!isLiveBackend ? (
        <DemoModeBanner
          message="Displaying local deterministic clustering based on cached feedback items. Connect to backend to access persistent Groq-powered Feature Intelligence."
        />
      ) : (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-brand-500/10 to-indigo-500/10 border border-emerald-500/20 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  MongoDB Atlas Feature Intelligence Connected
                </span>
                <Badge variant="success" size="xs">Live Pipeline</Badge>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Workspace: <span className="font-mono text-slate-700 dark:text-slate-300">{currentWorkspace?.name || currentWorkspace?.id}</span> • {activeGroups.length} persistent feature groups
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              icon={RefreshCw}
              onClick={loadGroups}
              disabled={isLoadingBackend}
            >
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Feature Request Aggregation</h2>
            <Badge variant="brand">Cluster Pipeline</Badge>
            {isLiveBackend && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20">
                <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>AI-Powered Semantic Grouping</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Group, review, merge, and approve recurring customer demands into backlog features
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Detect Duplicates Button */}
          <Button
            variant="outline"
            size="sm"
            icon={CopyCheck}
            onClick={handleRunDuplicateDetection}
            title="Scan for duplicate or overlapping customer requests"
          >
            Detect Duplicates
          </Button>

          {/* Run AI Grouping Button */}
          <Button
            variant="primary"
            size="sm"
            disabled={isClustering}
            onClick={handleRunAIGrouping}
            icon={isClustering ? Loader2 : Brain}
          >
            {isClustering ? 'Clustering Feedback...' : 'Run AI Grouping'}
          </Button>

          <Link to="/feedback?tab=insights">
            <Button variant="outline" size="sm" icon={Sparkles}>
              AI Insights
            </Button>
          </Link>
          <Link to="/prioritization">
            <Button variant="secondary" size="sm" icon={SlidersHorizontal}>
              Prioritization Matrix
            </Button>
          </Link>
          <Link to="/feedback">
            <Button variant="outline" size="sm" icon={MessageSquare}>
              Feedback Explorer
            </Button>
          </Link>
        </div>
      </div>

      {clusteringError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{clusteringError}</span>
          </div>
          <button onClick={() => setClusteringError(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {backendError && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{backendError}</span>
          </div>
          <Button size="xs" variant="outline" onClick={loadGroups}>
            Retry
          </Button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-navy-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search aggregated requests by theme, category, or customer excerpt..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading state */}
      {isLoadingBackend && backendGroups === null ? (
        <LoadingState message="Loading feature groups from MongoDB Atlas..." />
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={searchTerm || categoryFilter !== 'All' ? 'No matching feature groups' : 'No feature groups created yet'}
          description={
            searchTerm || categoryFilter !== 'All'
              ? 'Try adjusting your search terms or category filter.'
              : 'Run AI Grouping to automatically cluster customer feedback and support tickets into actionable feature requests.'
          }
          actionLabel={!searchTerm && categoryFilter === 'All' ? 'Run AI Grouping' : 'Clear Filters'}
          onAction={
            !searchTerm && categoryFilter === 'All'
              ? handleRunAIGrouping
              : () => {
                  setSearchTerm('')
                  setCategoryFilter('All')
                }
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGroups.map(group => {
            return (
              <Card key={group.id} className="p-5 flex flex-col justify-between" hover>
                <div>
                  {/* Category, Count & AI Badge */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800/60">
                        {group.category}
                      </span>
                      {group.isAIGenerated ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          <Brain className="w-3 h-3 text-emerald-600" />
                          AI
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          Local
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-brand-500" />
                      {group.count} {group.count === 1 ? 'record' : 'records'}
                    </span>
                  </div>

                  {/* Title & Summary */}
                  <h3
                    onClick={() => handleOpenGroupDetail(group)}
                    className="text-sm font-bold text-slate-900 dark:text-white leading-snug cursor-pointer hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    title="Click to view full feature group details and original feedback"
                  >
                    {group.title}
                  </h3>

                  {group.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {group.description}
                    </p>
                  )}

                  {/* Sentiment Breakdown Pill */}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-semibold">Demand:</span>
                    <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold">
                      {group.uniqueCustomers} {group.uniqueCustomers === 1 ? 'customer' : 'customers'}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    {group.sentimentDistribution.Positive > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {group.sentimentDistribution.Positive} Pos
                      </span>
                    )}
                    {group.sentimentDistribution.Neutral > 0 && (
                      <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                        {group.sentimentDistribution.Neutral} Neu
                      </span>
                    )}
                    {group.sentimentDistribution.Negative > 0 && (
                      <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                        {group.sentimentDistribution.Negative} Neg
                      </span>
                    )}
                  </div>

                  {/* Recurring Pain Points */}
                  {group.painPoints && group.painPoints.length > 0 && (
                    <div className="mt-3 p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-[11px] text-rose-800 dark:text-rose-300">
                      <span className="font-bold block mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                        Top Customer Pain Point:
                      </span>
                      <p className="line-clamp-2 italic">"{group.painPoints[0]}"</p>
                    </div>
                  )}

                  {/* Supporting Feedback Excerpts */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Supporting Evidence ({group.excerpts.length})
                      </span>
                      <button
                        onClick={() => handleOpenGroupDetail(group)}
                        className="text-[10px] text-brand-600 dark:text-brand-400 font-semibold hover:underline flex items-center gap-0.5"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </div>
                    {group.excerpts.slice(0, 2).map(ex => (
                      <div
                        key={ex.id}
                        onClick={() => handleOpenGroupDetail(group)}
                        className="p-2 rounded-lg bg-slate-50 dark:bg-navy-950/60 border border-slate-100 dark:border-slate-800/80 hover:border-brand-300 dark:hover:border-brand-700 transition-colors cursor-pointer group"
                        title="Click to view full feedback record in detail"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {ex.customer} ({ex.company})
                          </span>
                          <span className="font-mono text-[9px] text-brand-600 dark:text-brand-400 group-hover:underline">
                            {ex.sentiment || 'Feedback'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {ex.snippet}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Actions: Inspect, Merge & Approve */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={Eye}
                      onClick={() => handleOpenGroupDetail(group)}
                      title="Inspect original customer feedback records"
                    >
                      Inspect
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={GitMerge}
                      onClick={() => setMergeModalSource(group)}
                      title="Merge this group with another request group"
                    >
                      Merge
                    </Button>
                  </div>

                  {group.isPromoted ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Promoted (Score: {group.promotedFeatureScore?.toFixed(2) || 'Active'})</span>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      size="xs"
                      icon={ArrowRight}
                      iconPosition="right"
                      onClick={() => handlePromoteToFeature(group)}
                    >
                      Approve for Prioritization
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Inspect Group Feedback Modal */}
      {inspectingGroup && (
        <Modal
          isOpen={Boolean(inspectingGroup)}
          onClose={() => setInspectingGroup(null)}
          title={inspectingGroup.title}
          subtitle={`Detailed view of feature group and ${inspectingGroup.count} original customer feedback submissions`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Metadata Pills */}
            <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-slate-100 dark:border-slate-800">
              <Badge variant="brand">{inspectingGroup.category}</Badge>
              {inspectingGroup.groupingConfidence && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Confidence: {Math.round(inspectingGroup.groupingConfidence * 100)}%
                </span>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {inspectingGroup.count} feedback items • {inspectingGroup.uniqueCustomers} unique customers
              </span>
            </div>

            {/* Feature Description */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Consolidated Feature Description
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-navy-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                {inspectingGroup.description || inspectingGroup.featureSummary || 'No extended description available.'}
              </p>
            </div>

            {/* Suggested Capability */}
            {inspectingGroup.suggestedCapability && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Suggested Capability
                </h4>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40">
                  {inspectingGroup.suggestedCapability}
                </p>
              </div>
            )}

            {/* Pain Points */}
            {inspectingGroup.painPoints && inspectingGroup.painPoints.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-1">
                  Customer Pain Points
                </h4>
                <ul className="space-y-1">
                  {inspectingGroup.painPoints.map((pain, idx) => (
                    <li key={idx} className="text-xs text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <span>{pain}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Associated Feedback Records List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Member Customer Feedback Records ({inspectingFeedback.length || inspectingGroup.count})
                </h4>
              </div>

              {isLoadingFeedback ? (
                <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
                  <span>Loading original feedback items from MongoDB...</span>
                </div>
              ) : inspectingFeedback.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No feedback items retrieved for this group.</p>
              ) : (
                <div className="space-y-2.5">
                  {inspectingFeedback.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            item.sentiment === 'Positive'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : item.sentiment === 'Negative'
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-500/20'
                          }`}>
                            {item.sentiment || 'Neutral'}
                          </span>
                          {item.sourceType && (
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {item.sourceType}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60 flex-wrap">
                        {(item.customer || item.customer_name) && (
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3 h-3" />
                            {item.customer || item.customer_name}
                          </span>
                        )}
                        {(item.company || item.company_name) && (
                          <span className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {item.company || item.company_name}
                          </span>
                        )}
                        {item.createdAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" size="sm" onClick={() => setInspectingGroup(null)}>
                Close
              </Button>
              {!inspectingGroup.isPromoted && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={ArrowRight}
                  iconPosition="right"
                  onClick={() => {
                    handlePromoteToFeature(inspectingGroup)
                    setInspectingGroup(null)
                  }}
                >
                  Approve for Prioritization
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Merge Groups Modal */}
      {mergeModalSource && (
        <Modal
          isOpen={Boolean(mergeModalSource)}
          onClose={() => setMergeModalSource(null)}
          title={`Merge: "${mergeModalSource.title}"`}
          subtitle="Combine feedback records into another aggregated feature request"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Select the destination feature group. All {mergeModalSource.count} feedback submissions from this group will be repointed to the destination, and metrics will be recalculated.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Destination Feature Group
              </label>
              <select
                value={selectedMergeTargetId}
                onChange={e => setSelectedMergeTargetId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">-- Choose destination group --</option>
                {activeGroups
                  .filter(g => g.id !== mergeModalSource.id && g.status !== 'merged')
                  .map(g => (
                    <option key={g.id} value={g.id}>
                      {g.title} ({g.count} feedback items)
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="secondary"
                size="sm"
                disabled={isMerging}
                onClick={() => setMergeModalSource(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedMergeTargetId || isMerging}
                icon={isMerging ? Loader2 : GitMerge}
                onClick={handleMergeConfirm}
              >
                {isMerging ? 'Merging...' : 'Confirm Merge'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Duplicate Detection Modal */}
      {showDuplicateModal && (
        <Modal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          title="Duplicate & Overlapping Request Detection"
          subtitle="AI & Lexical analysis identifying candidate duplicate customer requests"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {isDetectingDuplicates ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  Scanning workspace feedback for duplicate relationships...
                </p>
                <p className="text-[11px]">Evaluating lexical token overlap and LLM semantic equivalence</p>
              </div>
            ) : duplicateError ? (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs">
                {duplicateError}
              </div>
            ) : duplicateResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-slate-900 dark:text-white">No duplicate feature requests detected</p>
                <p className="text-[11px] text-slate-400 mt-1">All evaluated feedback requests represent distinct capabilities.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Found <strong className="text-slate-900 dark:text-white">{duplicateResults.length}</strong> duplicate relationships across workspace requests:
                </p>

                {duplicateResults.map((dup, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        {dup.duplicate_type || dup.duplicateType}
                      </span>
                      {dup.confidence && (
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          Confidence: {Math.round(dup.confidence * 100)}%
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                      <p>
                        <strong className="text-slate-900 dark:text-white">Explanation:</strong> {dup.similarity_explanation || dup.similarityExplanation}
                      </p>
                      {dup.recommendation && (
                        <p className="text-indigo-600 dark:text-indigo-400">
                          <strong>Recommendation:</strong> {dup.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" size="sm" onClick={() => setShowDuplicateModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default AggregationPage
