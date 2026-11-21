import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useWorkspace } from '../context/WorkspaceContext'
import {
  Milestone,
  Plus,
  Search,
  Filter,
  Columns3,
  Calendar,
  List,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  FolderPlus,
  Sparkles,
  ArrowUpRight,
  ChevronDown,
  Layers,
  Check,
  X,
  Lock,
} from 'lucide-react'
import { Card, Badge, Button, Modal } from '../components/common'
import { ReleaseReadinessPage } from './ReleaseReadinessPage'
import { roadmapService } from '../services/api/roadmapService'
import { getActiveWorkspaceId } from '../services/api/apiClient'

export function RoadmapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'readiness' ? 'readiness' : 'roadmap'

  const handleTabChange = (tab) => {
    if (tab === 'readiness') {
      setSearchParams({ tab: 'readiness' })
    } else {
      setSearchParams({})
    }
  }

  const {
    activeWorkspace,
    currentWorkspace: appWorkspace,
    features = [],
    addToast,
  } = useApp()
  const { currentWorkspace: contextWorkspace } = useWorkspace()

  // Prefer reactive WorkspaceContext; allow useApp workspace override for isolated testing
  const currentWorkspace = appWorkspace || activeWorkspace || contextWorkspace
  const workspaceId = currentWorkspace?.id || getActiveWorkspaceId()

  // ---------------------------------------------------------------------------
  // Data State (Backed by MongoDB Atlas)
  // ---------------------------------------------------------------------------
  const [roadmaps, setRoadmaps] = useState([])
  const [selectedRoadmapId, setSelectedRoadmapId] = useState('')
  const [items, setItems] = useState([])
  const [candidates, setCandidates] = useState([])

  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [isPromoting, setIsPromoting] = useState(false)
  const [error, setError] = useState(null)

  // View & Filter State
  const [viewMode, setViewMode] = useState('timeline') // 'timeline', 'kanban', 'list'
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [commitmentFilter, setCommitmentFilter] = useState('All') // 'All', 'Committed', 'Uncommitted'

  // Modals
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showNewRoadmapModal, setShowNewRoadmapModal] = useState(false)
  const [showPromoteModal, setShowPromoteModal] = useState(false)

  // Item Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formFeatureId, setFormFeatureId] = useState('')
  const [formStatus, setFormStatus] = useState('Planned')
  const [formPriority, setFormPriority] = useState('Medium')
  const [formOwner, setFormOwner] = useState('Lead PM')
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0])
  const [formTargetDate, setFormTargetDate] = useState('2026-12-31')
  const [formMilestone, setFormMilestone] = useState('Phase 1')
  const [formProgress, setFormProgress] = useState(0)
  const [formNotes, setFormNotes] = useState('')
  const [formIsCommitted, setFormIsCommitted] = useState(false)

  // New Roadmap Form state
  const [newRoadmapTitle, setNewRoadmapTitle] = useState('')
  const [newRoadmapDesc, setNewRoadmapDesc] = useState('')
  const [newRoadmapType, setNewRoadmapType] = useState('Product')
  const [newRoadmapHorizon, setNewRoadmapHorizon] = useState('Quarterly')

  const statuses = ['All', 'Planned', 'In Progress', 'In Review', 'Shipped', 'Blocked']

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const loadRoadmapsAndItems = useCallback(async () => {
    if (!workspaceId) return
    setIsLoading(true)
    setError(null)
    try {
      // 1. Fetch available roadmaps
      const rmResp = await roadmapService.listRoadmaps(workspaceId)
      const rms = rmResp?.items || []
      setRoadmaps(rms)

      // Determine active roadmap
      let activeRmId = selectedRoadmapId
      if (!activeRmId || !rms.some(r => r.id === activeRmId)) {
        const defaultRm = rms.find(r => r.isDefault) || rms[0]
        activeRmId = defaultRm ? defaultRm.id : ''
        setSelectedRoadmapId(activeRmId)
      }

      // 2. Fetch roadmap items
      const itemsResp = await roadmapService.listRoadmapItems(workspaceId, {
        roadmapId: activeRmId || undefined,
      })
      setItems(itemsResp?.items || [])
    } catch (err) {
      console.error('Failed to load roadmap data from Atlas:', err)
      setError(err?.message || 'Failed to load roadmap from server.')
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId, selectedRoadmapId])

  const loadCandidates = useCallback(async () => {
    if (!workspaceId) return
    setIsLoadingCandidates(true)
    try {
      const resp = await roadmapService.getCandidates(workspaceId)
      setCandidates(resp?.items || [])
    } catch (err) {
      console.error('Failed to load roadmap candidates:', err)
    } finally {
      setIsLoadingCandidates(false)
    }
  }, [workspaceId])

  useEffect(() => {
    loadRoadmapsAndItems()
  }, [loadRoadmapsAndItems])

  // Refetch when active roadmap selection changes
  const handleRoadmapChange = async (e) => {
    const newId = e.target.value
    setSelectedRoadmapId(newId)
    setIsLoading(true)
    try {
      const itemsResp = await roadmapService.listRoadmapItems(workspaceId, {
        roadmapId: newId || undefined,
      })
      setItems(itemsResp?.items || [])
    } catch (err) {
      addToast(err?.message || 'Failed to load items for roadmap', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Promotion of Approved PRD
  // ---------------------------------------------------------------------------
  const handlePromotePRD = async (cand) => {
    if (!cand.isApprovedForRoadmap) {
      addToast(`PRD '${cand.prdTitle || cand.title}' is not Approved. Status is '${cand.prdStatus || 'None'}'. Only approved PRDs can be committed.`, 'error')
      return
    }

    setIsPromoting(true)
    try {
      const resp = await roadmapService.promoteApprovedPRD(workspaceId, {
        prdId: cand.prdId,
        roadmapId: selectedRoadmapId || undefined,
      })
      addToast(resp?.message || `Successfully committed '${cand.prdTitle}' to roadmap!`, 'success')
      // Refresh items and candidates
      await loadRoadmapsAndItems()
      await loadCandidates()
    } catch (err) {
      addToast(err?.message || 'Failed to promote approved PRD', 'error')
    } finally {
      setIsPromoting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Create / Update Roadmap Item
  // ---------------------------------------------------------------------------
  const handleOpenCreate = () => {
    setEditingItem(null)
    setFormTitle('')
    setFormDescription('')
    setFormFeatureId(features[0]?.id || '')
    setFormStatus('Planned')
    setFormPriority('Medium')
    setFormOwner('Lead PM')
    setFormStartDate(new Date().toISOString().split('T')[0])
    setFormTargetDate('2026-12-31')
    setFormMilestone('Phase 1')
    setFormProgress(0)
    setFormNotes('')
    setFormIsCommitted(false)
    setShowItemModal(true)
  }

  const handleOpenEdit = (item) => {
    setEditingItem(item)
    setFormTitle(item.title)
    setFormDescription(item.description)
    setFormFeatureId(item.featureId || '')
    setFormStatus(item.status)
    setFormPriority(item.priority)
    setFormOwner(item.owner)
    setFormStartDate(item.startDate || new Date().toISOString().split('T')[0])
    setFormTargetDate(item.targetDate || '2026-12-31')
    setFormMilestone(item.milestone || 'Phase 1')
    setFormProgress(item.progress || 0)
    setFormNotes(item.notes || '')
    setFormIsCommitted(item.isCommitted || false)
    setShowItemModal(true)
  }

  const handleSaveItem = async (e) => {
    e.preventDefault()
    if (!formTitle.trim()) return

    if (formStartDate && formTargetDate && formStartDate > formTargetDate) {
      addToast('Start date cannot be after target date', 'error')
      return
    }

    const payload = {
      title: formTitle.trim(),
      description: formDescription,
      roadmapId: selectedRoadmapId || null,
      featureId: formFeatureId || null,
      status: formStatus,
      priority: formPriority,
      owner: formOwner,
      startDate: formStartDate,
      targetDate: formTargetDate,
      milestone: formMilestone,
      progress: Number(formProgress),
      notes: formNotes,
      isCommitted: formIsCommitted,
    }

    try {
      if (editingItem) {
        const updated = await roadmapService.updateRoadmapItem(workspaceId, editingItem.id, {
          ...payload,
          expectedVersion: editingItem.version,
        })
        setItems(prev => prev.map(it => (it.id === editingItem.id ? updated : it)))
        addToast(`Updated roadmap item '${updated.title}'`, 'success')
      } else {
        const created = await roadmapService.createRoadmapItem(workspaceId, payload)
        setItems(prev => [...prev, created])
        addToast(`Created roadmap item '${created.title}'`, 'success')
      }
      setShowItemModal(false)
    } catch (err) {
      addToast(err?.message || 'Failed to save roadmap item', 'error')
    }
  }

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this roadmap item?')) return
    try {
      await roadmapService.deleteRoadmapItem(workspaceId, itemId)
      setItems(prev => prev.filter(it => it.id !== itemId))
      addToast('Roadmap item deleted successfully', 'warning')
    } catch (err) {
      addToast(err?.message || 'Failed to delete roadmap item', 'error')
    }
  }

  // ---------------------------------------------------------------------------
  // Create New Roadmap Container
  // ---------------------------------------------------------------------------
  const handleCreateRoadmapContainer = async (e) => {
    e.preventDefault()
    if (!newRoadmapTitle.trim()) return

    try {
      const created = await roadmapService.createRoadmap(workspaceId, {
        title: newRoadmapTitle.trim(),
        description: newRoadmapDesc.trim(),
        roadmapType: newRoadmapType,
        timeHorizon: newRoadmapHorizon,
        status: 'Active',
        isDefault: roadmaps.length === 0,
      })
      setRoadmaps(prev => [...prev, created])
      setSelectedRoadmapId(created.id)
      setNewRoadmapTitle('')
      setNewRoadmapDesc('')
      setShowNewRoadmapModal(false)
      addToast(`Created roadmap '${created.title}'`, 'success')
      await loadRoadmapsAndItems()
    } catch (err) {
      addToast(err?.message || 'Failed to create roadmap', 'error')
    }
  }

  // ---------------------------------------------------------------------------
  // Filtering & Search
  // ---------------------------------------------------------------------------
  const filteredRoadmap = useMemo(() => {
    return items.filter(item => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        const matchesTitle = item.title?.toLowerCase().includes(q)
        const matchesMilestone = item.milestone?.toLowerCase().includes(q)
        const matchesDesc = item.description?.toLowerCase().includes(q)
        if (!matchesTitle && !matchesMilestone && !matchesDesc) return false
      }
      if (statusFilter !== 'All' && item.status !== statusFilter) return false
      if (commitmentFilter === 'Committed' && !item.isCommitted) return false
      if (commitmentFilter === 'Uncommitted' && item.isCommitted) return false
      return true
    })
  }, [items, searchTerm, statusFilter, commitmentFilter])

  const activeRoadmap = useMemo(() => {
    return roadmaps.find(r => r.id === selectedRoadmapId) || roadmaps[0] || null
  }, [roadmaps, selectedRoadmapId])

  // Count approved candidate PRDs ready for promotion
  const readyCandidatesCount = useMemo(() => {
    return candidates.filter(c => c.isApprovedForRoadmap && !c.isFullyCommitted).length
  }, [candidates])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Primary Workflow Sub-Tabs: Roadmap Timeline vs Release Readiness */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => handleTabChange('roadmap')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'roadmap'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Milestone className="w-4 h-4" />
          <span>Roadmap Timeline</span>
        </button>

        <button
          onClick={() => handleTabChange('readiness')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'readiness'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Release Readiness</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'readiness'
                ? 'bg-white/20 text-white'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            }`}
          >
            Governance
          </span>
        </button>
      </div>

      {activeTab === 'readiness' ? (
        <ReleaseReadinessPage />
      ) : (
        <>
          {/* Header Controls & Roadmap Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Product Delivery Roadmap</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Atlas Persistence
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-tenant roadmap containers, approved PRD commitment, and execution tracking
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Roadmap Container Selector */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-navy-900 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <Layers className="w-3.5 h-3.5 text-brand-500" />
                <select
                  value={selectedRoadmapId}
                  onChange={handleRoadmapChange}
                  className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  {roadmaps.map(rm => (
                    <option key={rm.id} value={rm.id} className="bg-white dark:bg-navy-950 text-slate-900 dark:text-white">
                      {rm.title} ({rm.status})
                    </option>
                  ))}
                  {roadmaps.length === 0 && (
                    <option value="">No Roadmaps Found</option>
                  )}
                </select>

                <button
                  onClick={() => setShowNewRoadmapModal(true)}
                  title="Create New Roadmap Container"
                  className="p-1 text-slate-400 hover:text-brand-500 transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* View mode toggle */}
              <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 bg-slate-50 dark:bg-navy-950">
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`p-1.5 rounded-md ${viewMode === 'timeline' ? 'bg-white dark:bg-navy-900 text-brand-600 shadow-xs' : 'text-slate-400'}`}
                  title="Timeline Gantt View"
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`p-1.5 rounded-md ${viewMode === 'kanban' ? 'bg-white dark:bg-navy-900 text-brand-600 shadow-xs' : 'text-slate-400'}`}
                  title="Kanban Board View"
                >
                  <Columns3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white dark:bg-navy-900 text-brand-600 shadow-xs' : 'text-slate-400'}`}
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Promote Approved PRD Drawer Button */}
              <Button
                variant="secondary"
                size="sm"
                icon={Sparkles}
                onClick={() => {
                  loadCandidates()
                  setShowPromoteModal(true)
                }}
                className="relative"
              >
                Promote Approved PRD
                {readyCandidatesCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                    {readyCandidatesCount}
                  </span>
                )}
              </Button>

              <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreate}>
                Add Item
              </Button>

              <button
                onClick={loadRoadmapsAndItems}
                disabled={isLoading}
                title="Refresh from MongoDB Atlas"
                className="p-2 rounded-xl text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Active Container Metadata Pill */}
          {activeRoadmap && (
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl bg-brand-500/5 border border-brand-500/15 text-xs">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-500" />
                {activeRoadmap.title}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">Horizon: <strong className="text-slate-700 dark:text-slate-300">{activeRoadmap.timeHorizon}</strong></span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">Type: <strong className="text-slate-700 dark:text-slate-300">{activeRoadmap.roadmapType}</strong></span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">Version: <strong className="text-slate-700 dark:text-slate-300 font-mono">v{activeRoadmap.version}</strong></span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">Committed Deliverables: <strong className="text-brand-600 dark:text-brand-400 font-mono">{items.length}</strong></span>
            </div>
          )}

          {/* Filter and Search Bar */}
          <Card className="p-3.5 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search roadmap milestones, deliverables, owners..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                {statuses.map(s => (
                  <option key={s} value={s}>Status: {s}</option>
                ))}
              </select>

              <select
                value={commitmentFilter}
                onChange={e => setCommitmentFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="All">Commitment: All</option>
                <option value="Committed">Committed Only</option>
                <option value="Uncommitted">Uncommitted Only</option>
              </select>
            </div>
          </Card>

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Button size="xs" variant="secondary" onClick={loadRoadmapsAndItems}>
                Retry
              </Button>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-500 mb-2" />
              <span>Synchronizing with MongoDB Atlas...</span>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredRoadmap.length === 0 && (
            <Card className="p-12 text-center">
              <Milestone className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                {items.length === 0 ? 'No Roadmap Items Committed Yet' : 'No Items Match Current Filter'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
                {items.length === 0
                  ? 'Commit approved PRDs to this roadmap or add manual execution milestones to begin tracking delivery.'
                  : 'Adjust your search query or filters to display matching roadmap deliverables.'}
              </p>
              <div className="flex justify-center gap-2">
                <Button size="sm" variant="primary" icon={Plus} onClick={handleOpenCreate}>
                  Add Item
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Sparkles}
                  onClick={() => {
                    loadCandidates()
                    setShowPromoteModal(true)
                  }}
                >
                  Promote Approved PRD
                </Button>
              </div>
            </Card>
          )}

          {/* TIMELINE GANTT VIEW */}
          {!isLoading && viewMode === 'timeline' && filteredRoadmap.length > 0 && (
            <Card className="p-5 overflow-x-auto">
              <div className="space-y-4">
                {filteredRoadmap.map(item => {
                  const linkedFeat = features.find(f => f.id === item.featureId)
                  const isShipped = item.status === 'Shipped'
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</span>
                          <Badge
                            variant={
                              isShipped ? 'success' : item.status === 'In Progress' ? 'brand' : item.status === 'Blocked' ? 'danger' : 'default'
                            }
                            size="xs"
                          >
                            {item.status}
                          </Badge>
                          {item.isCommitted && (
                            <Badge variant="success" size="xs">
                              Committed
                            </Badge>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono bg-slate-200/60 dark:bg-slate-800/80 px-1.5 py-0.5 rounded">
                            {item.milestone}
                          </span>
                          {item.priorityScore !== null && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                              Score: {item.priorityScore}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400">{item.progress}%</span>
                          <button onClick={() => handleOpenEdit(item)} className="p-1 text-slate-400 hover:text-white" title="Edit Item">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-slate-400 hover:text-rose-500" title="Delete Item">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Progress bar visualizer */}
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${isShipped ? 'bg-emerald-500' : 'bg-gradient-to-r from-brand-500 to-electric-500'}`}
                          style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                        <span>Owner: {item.owner} • Window: {item.startDate || 'TBD'} to {item.targetDate || 'TBD'}</span>
                        {item.notes && (
                          <span className="text-slate-500 truncate max-w-md italic">{item.notes}</span>
                        )}
                        {linkedFeat && (
                          <span className="font-semibold text-brand-500 truncate max-w-[200px]">
                            Linked: {linkedFeat.name}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* KANBAN VIEW */}
          {!isLoading && viewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
              {statuses.filter(s => s !== 'All').map(colStatus => {
                const colItems = filteredRoadmap.filter(i => i.status === colStatus)
                return (
                  <div key={colStatus} className="rounded-2xl bg-slate-100/60 dark:bg-navy-900/60 border border-slate-200 dark:border-slate-800 p-3 min-h-[440px]">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{colStatus}</span>
                      <Badge size="xs">{colItems.length}</Badge>
                    </div>

                    <div className="space-y-2.5">
                      {colItems.map(item => (
                        <Card key={item.id} className="p-3 hover:border-brand-500/40 cursor-pointer" hover onClick={() => handleOpenEdit(item)}>
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">{item.title}</h4>
                            {item.isCommitted && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1" title="Committed Deliverable" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2">{item.description || item.notes}</p>
                          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 font-mono">{item.milestone}</span>
                            <span className="font-bold text-brand-600 dark:text-brand-400">{item.progress}%</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* LIST VIEW */}
          {!isLoading && viewMode === 'list' && filteredRoadmap.length > 0 && (
            <Card className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRoadmap.map(item => (
                <div key={item.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-navy-950/40">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</h4>
                      {item.isCommitted && (
                        <Badge variant="success" size="xs">Committed</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.description || item.notes}</p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {item.milestone} • Owner: {item.owner} • {item.startDate || 'TBD'} → {item.targetDate || 'TBD'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="text-xs font-bold font-mono text-brand-600 dark:text-brand-400">{item.progress}%</span>
                    <Badge variant={item.status === 'Shipped' ? 'success' : item.status === 'In Progress' ? 'brand' : 'default'}>
                      {item.status}
                    </Badge>
                    <Button variant="ghost" size="xs" onClick={() => handleOpenEdit(item)}>Edit</Button>
                    <Button variant="ghost" size="xs" onClick={() => handleDeleteItem(item.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* CANDIDATES / PROMOTE APPROVED PRD MODAL */}
          <Modal
            isOpen={showPromoteModal}
            onClose={() => setShowPromoteModal(false)}
            title="Promote Approved PRD to Roadmap"
            subtitle="Connect high-priority intelligence and formally commit approved PRDs"
          >
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {isLoadingCandidates ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-500 mb-2" />
                  <span>Scanning workspace for feature groups and PRD candidates...</span>
                </div>
              ) : candidates.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No feature groups or PRDs found in this workspace. Generate PRDs first in the PRD Studio.
                </div>
              ) : (
                candidates.map((cand, idx) => {
                  const isApproved = cand.isApprovedForRoadmap
                  return (
                    <div
                      key={cand.prdId || cand.featureGroupId || idx}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-950/50 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {cand.prdTitle || cand.title}
                            </span>
                            {cand.prdStatus && (
                              <Badge variant={isApproved ? 'success' : 'default'} size="xs">
                                PRD: {cand.prdStatus}
                              </Badge>
                            )}
                            {cand.isFullyCommitted && (
                              <Badge variant="brand" size="xs">
                                Already Committed
                              </Badge>
                            )}
                          </div>
                          {cand.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                              {cand.description}
                            </p>
                          )}
                        </div>

                        {/* Promotion Action */}
                        <div>
                          {isApproved ? (
                            <Button
                              size="xs"
                              variant="primary"
                              icon={Check}
                              disabled={isPromoting}
                              onClick={() => handlePromotePRD(cand)}
                            >
                              Commit to Roadmap
                            </Button>
                          ) : (
                            <span
                              className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 bg-slate-200/50 dark:bg-slate-800 px-2 py-1 rounded"
                              title="Strict rule: Only Approved PRDs can be committed to the roadmap."
                            >
                              <Lock className="w-3 h-3 text-slate-400" />
                              Approval Required
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Candidate Metrics */}
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                        {cand.priorityScore !== null && (
                          <span>Priority Score: <strong className="text-amber-500 font-mono">{cand.priorityScore}</strong></span>
                        )}
                        {cand.priorityLevel && (
                          <span>Tier: <strong className="text-slate-300">{cand.priorityLevel}</strong></span>
                        )}
                        {cand.feedbackCount > 0 && (
                          <span>Feedback: <strong className="text-slate-300 font-mono">{cand.feedbackCount}</strong></span>
                        )}
                        {cand.roadmapRecommendations?.length > 0 && (
                          <span>Recommendations: <strong className="text-brand-500">{cand.roadmapRecommendations.length} phases</strong></span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}

              <div className="pt-2 flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowPromoteModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Modal>

          {/* CREATE NEW ROADMAP CONTAINER MODAL */}
          <Modal
            isOpen={showNewRoadmapModal}
            onClose={() => setShowNewRoadmapModal(false)}
            title="Create Product Roadmap"
            subtitle="Establish a new workspace roadmap container for strategic execution"
          >
            <form onSubmit={handleCreateRoadmapContainer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Roadmap Title *</label>
                <input
                  type="text"
                  required
                  value={newRoadmapTitle}
                  onChange={e => setNewRoadmapTitle(e.target.value)}
                  placeholder="e.g. 2026 Core Delivery Roadmap"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newRoadmapDesc}
                  onChange={e => setNewRoadmapDesc(e.target.value)}
                  placeholder="Strategic scope and high-level deliverables..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Roadmap Type</label>
                  <select
                    value={newRoadmapType}
                    onChange={e => setNewRoadmapType(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Product">Product</option>
                    <option value="Strategic">Strategic</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Release">Release</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Time Horizon</label>
                  <select
                    value={newRoadmapHorizon}
                    onChange={e => setNewRoadmapHorizon(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Quarterly">Quarterly</option>
                    <option value="Half-Yearly">Half-Yearly</option>
                    <option value="Yearly">Yearly</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowNewRoadmapModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Create Roadmap</Button>
              </div>
            </form>
          </Modal>

          {/* CREATE / EDIT ROADMAP ITEM MODAL */}
          <Modal
            isOpen={showItemModal}
            onClose={() => setShowItemModal(false)}
            title={editingItem ? 'Edit Roadmap Deliverable' : 'Add Roadmap Deliverable'}
            subtitle="Schedule execution targets and maintain Atlas persistence"
          >
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Webhook Delivery Service Architecture"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Scope of work and deliverables..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Milestone</label>
                  <input
                    type="text"
                    value={formMilestone}
                    onChange={e => setFormMilestone(e.target.value)}
                    placeholder="e.g. Phase 1 / Q4 Platform"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Owner</label>
                  <input
                    type="text"
                    value={formOwner}
                    onChange={e => setFormOwner(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={e => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={formTargetDate}
                    onChange={e => setFormTargetDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Progress</span>
                  <span className="font-bold text-brand-600">{formProgress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formProgress}
                  onChange={e => setFormProgress(Number(e.target.value))}
                  className="w-full accent-brand-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="formIsCommitted"
                  checked={formIsCommitted}
                  onChange={e => setFormIsCommitted(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="formIsCommitted" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Mark as formally committed deliverable
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Dependencies, context or release notes..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowItemModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Save Item</Button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  )
}

export default RoadmapPage
