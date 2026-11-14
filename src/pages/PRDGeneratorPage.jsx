import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  FileText,
  Plus,
  Sparkles,
  Download,
  Copy,
  Printer,
  Save,
  CheckCircle2,
  Trash2,
  Edit2,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Layers,
  Link as LinkIcon,
  Brain,
  Loader2,
  Check,
  XCircle,
  AlertCircle,
  Lock,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  ListChecks,
} from 'lucide-react'
import { Card, Badge, Button, Modal } from '../components/common'
import { prdService, normalizePlanSections } from '../services/api/prdService'
import { useWorkspace } from '../context/WorkspaceContext'
import UserStoryStudio from '../components/planning/UserStoryStudio'
import {
  parseTextToStories,
  formatStoriesToText,
  formatCriteriaToText,
} from '../components/planning/storyHelpers'

export function PRDGeneratorPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const targetFeatureId = searchParams.get('featureId') || location.state?.featureId

  const {
    features,
    feedback,
    addToast,
  } = useApp()
  const { currentWorkspace } = useWorkspace()

  // Authoritative MongoDB Atlas PRD list & selection
  const [plans, setPlans] = useState([])
  const [isLoadingPlans, setIsLoadingPlans] = useState(true)
  const [plansError, setPlansError] = useState(null)
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const [activePlan, setActivePlan] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Draft editing state
  const [editableSections, setEditableSections] = useState({})
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [conflictError, setConflictError] = useState(null)

  // Structured User Stories state
  const [structuredStories, setStructuredStories] = useState([])
  const [isSavingStories, setIsSavingStories] = useState(false)

  // Section regeneration state
  const [isRegeneratingSection, setIsRegeneratingSection] = useState(null)
  const [regenerateModal, setRegenerateModal] = useState(null) // { sectionKey, title }
  const [customInstructions, setCustomInstructions] = useState('')

  // Human Review state
  const [isReviewing, setIsReviewing] = useState(false)
  const [confirmApproveModal, setConfirmApproveModal] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')

  // Generation Modal state
  const [showNewModal, setShowNewModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState(null)
  const [selectedFeatureId, setSelectedFeatureId] = useState(() => targetFeatureId || features[0]?.id || '')
  const [customTitle, setCustomTitle] = useState('')

  // 13 canonical sections configuration
  const sectionsConfig = [
    { key: 'overview', title: '1. Overview' },
    { key: 'problemStatement', title: '2. Problem Statement' },
    { key: 'targetUsers', title: '3. Target Users' },
    { key: 'customerPainPoints', title: '4. Customer Pain Points' },
    { key: 'proposedSolution', title: '5. Proposed Solution' },
    { key: 'goalsAndSuccessMetrics', title: '6. Goals and Success Metrics' },
    { key: 'functionalRequirements', title: '7. Functional Requirements' },
    { key: 'nonFunctionalRequirements', title: '8. Non-Functional Requirements' },
    { key: 'userStories', title: '9. User Stories' },
    { key: 'acceptanceCriteria', title: '10. Acceptance Criteria' },
    { key: 'dependenciesAndConstraints', title: '11. Dependencies and Constraints' },
    { key: 'risksAndMitigations', title: '12. Risks and Mitigations' },
    { key: 'releasePlan', title: '13. Release Plan' },
  ]

  // Approval protection status
  const normalizedStatus = String(activePlan?.status || 'draft').toLowerCase()
  const isApproved = normalizedStatus === 'approved'
  const isPendingReview = normalizedStatus === 'pending_review'
  const isRejected = normalizedStatus === 'rejected'
  const isDraft = normalizedStatus === 'draft'

  // Extract structured stories from a plan document
  const extractStories = useCallback((plan) => {
    if (!plan) return []
    if (Array.isArray(plan.user_stories) && plan.user_stories.length > 0) {
      return plan.user_stories
    }
    if (Array.isArray(plan.userStories) && plan.userStories.length > 0) {
      return plan.userStories
    }
    return parseTextToStories(plan.sections?.userStories, plan.sections?.acceptanceCriteria)
  }, [])

  // Synchronize text sections whenever structured stories are updated
  const syncSectionsFromStories = useCallback((stories) => {
    const textStories = formatStoriesToText(stories)
    const textAC = formatCriteriaToText(stories)
    setEditableSections(prev => ({
      ...prev,
      userStories: textStories,
      acceptanceCriteria: textAC,
    }))
  }, [])

  // Fetch plans from MongoDB Atlas with workspace switch and stale response protection
  const loadWorkspacePlans = useCallback(async (preferredPlanId = null) => {
    const wsId = currentWorkspace?.id
    if (!wsId) {
      setPlans([])
      setActivePlan(null)
      setStructuredStories([])
      setEditableSections({})
      setIsLoadingPlans(false)
      setPlansError(null)
      return
    }

    setIsLoadingPlans(true)
    setPlansError(null)
    setConflictError(null)
    setSaveError(null)

    try {
      const docs = await prdService.listProductPlans(wsId)
      setPlans(docs)

      if (docs.length > 0) {
        let target = null
        if (preferredPlanId) {
          target = docs.find(p => p.id === preferredPlanId || p.planning_id === preferredPlanId)
        }
        if (!target && targetFeatureId) {
          target = docs.find(p => p.featureId === targetFeatureId || p.feature_group_id === targetFeatureId)
        }
        if (!target && selectedPlanId) {
          target = docs.find(p => p.id === selectedPlanId || p.planning_id === selectedPlanId)
        }
        if (!target) {
          target = docs[0]
        }
        setSelectedPlanId(target.id)
        setActivePlan(target)
        setStructuredStories(extractStories(target))
        setEditableSections(target.sections || {})
        setIsEditing(false)
      } else {
        setSelectedPlanId(null)
        setActivePlan(null)
        setStructuredStories([])
        setEditableSections({})
        setIsEditing(false)
      }
    } catch (err) {
      setPlansError(err.message || 'Failed to load product plans from MongoDB Atlas.')
      setPlans([])
      setActivePlan(null)
      setStructuredStories([])
      setEditableSections({})
    } finally {
      setIsLoadingPlans(false)
    }
  }, [currentWorkspace?.id, targetFeatureId, selectedPlanId, extractStories])

  // Refetch when workspace changes or on mount
  useEffect(() => {
    let isCancelled = false
    const wsId = currentWorkspace?.id

    if (!wsId) {
      setPlans([])
      setActivePlan(null)
      setStructuredStories([])
      setEditableSections({})
      setIsLoadingPlans(false)
      setPlansError(null)
      return
    }

    setIsLoadingPlans(true)
    setPlansError(null)
    setConflictError(null)
    setSaveError(null)

    prdService.listProductPlans(wsId)
      .then(docs => {
        if (isCancelled) return
        setPlans(docs)
        if (docs.length > 0) {
          let target = null
          if (targetFeatureId) {
            target = docs.find(p => p.featureId === targetFeatureId || p.feature_group_id === targetFeatureId)
          }
          if (!target) {
            target = docs[0]
          }
          setSelectedPlanId(target.id)
          setActivePlan(target)
          setStructuredStories(extractStories(target))
          setEditableSections(target.sections || {})
          setIsEditing(false)
        } else {
          setSelectedPlanId(null)
          setActivePlan(null)
          setStructuredStories([])
          setEditableSections({})
        }
      })
      .catch(err => {
        if (isCancelled) return
        setPlansError(err.message || 'Failed to load product plans from MongoDB Atlas.')
        setPlans([])
        setActivePlan(null)
        setStructuredStories([])
        setEditableSections({})
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingPlans(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [currentWorkspace?.id, extractStories])

  // Select a PRD and load its full details
  const handleSelectPlan = async (plan) => {
    if (!plan) return
    setSelectedPlanId(plan.id)
    setIsEditing(false)
    setConflictError(null)
    setSaveError(null)

    setIsLoadingDetail(true)
    try {
      const detail = await prdService.getProductPlan(plan.id, currentWorkspace?.id)
      setActivePlan(detail)
      setStructuredStories(extractStories(detail))
      setEditableSections(detail.sections || {})
    } catch {
      setActivePlan(plan)
      setStructuredStories(extractStories(plan))
      setEditableSections(plan.sections || {})
    } finally {
      setIsLoadingDetail(false)
    }
  }

  // Auto-generate from selected feature via real backend service
  const handleGenerateFromFeature = async () => {
    const wsId = currentWorkspace?.id
    if (!wsId) {
      addToast('Active workspace is required.', 'error')
      return
    }
    const feat = features.find(f => f.id === selectedFeatureId)
    setIsGenerating(true)
    setGenerationError(null)

    try {
      const docTitle = customTitle.trim() || (feat ? `${feat.name} Specification` : 'Product Requirements Document')
      const plan = await prdService.generateProductPlan({
        workspaceId: wsId,
        featureGroupId: selectedFeatureId,
        strategicContext: docTitle,
      })

      // Update plans list in Atlas state
      setPlans(prev => [plan, ...prev.filter(p => p.id !== plan.id)])
      setSelectedPlanId(plan.id)
      setActivePlan(plan)
      setStructuredStories(extractStories(plan))
      setEditableSections(plan.sections || {})
      setIsEditing(false)
      setShowNewModal(false)
      setCustomTitle('')
      addToast('Product Requirements Document generated with AI grounding and persisted to Atlas!', 'success')
    } catch (err) {
      setGenerationError(err?.message || 'Failed to generate PRD')
      addToast(err?.message || 'Failed to generate PRD', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  // Handle updates to user stories from UserStoryStudio
  const handleStoriesChange = (updatedStories) => {
    setStructuredStories(updatedStories)
    syncSectionsFromStories(updatedStories)
  }

  // Save structured user stories & criteria to Atlas
  const handleSaveStories = async (storiesToSave = structuredStories) => {
    if (!activePlan) return
    if (isApproved) {
      addToast('Cannot modify an approved PRD. Modifications are protected.', 'warning')
      return
    }

    setIsSavingStories(true)
    setSaveError(null)
    setConflictError(null)

    try {
      const updated = await prdService.updatePRDSections(activePlan.id, {
        sections: editableSections,
        userStories: storiesToSave,
        expectedVersion: activePlan.version,
        versionBump: 'patch',
        workspaceId: currentWorkspace?.id,
      })

      setActivePlan(updated)
      setStructuredStories(extractStories(updated))
      setEditableSections(updated.sections || {})
      setPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      setIsEditing(false)
      addToast(`User stories and acceptance criteria saved to Atlas (v${updated.version})!`, 'success')
    } catch (err) {
      if (err.status === 409 || err.message?.includes('409') || err.message?.toLowerCase().includes('concurrent')) {
        setConflictError(
          `Version conflict: This PRD has been updated in another session (current database version differs from expected v${activePlan.version}). Please reload the document.`
        )
        addToast('Concurrency Conflict: Version mismatch. Please reload.', 'error')
      } else {
        setSaveError(err.message || 'Failed to save user stories to MongoDB Atlas.')
        addToast(err.message || 'Failed to save user stories.', 'error')
      }
    } finally {
      setIsSavingStories(false)
    }
  }

  // Save changes to PRD with Atlas persistence & concurrency control
  const handleSaveSections = async () => {
    if (!activePlan) return
    if (isApproved) {
      addToast('Cannot edit an approved PRD. Modifications are protected.', 'warning')
      return
    }

    setIsSaving(true)
    setSaveError(null)
    setConflictError(null)

    try {
      // Isolate modified sections
      const originalSections = activePlan.sections || {}
      const modifiedSections = {}
      Object.entries(editableSections).forEach(([k, v]) => {
        if (v !== originalSections[k]) {
          modifiedSections[k] = v
        }
      })

      const payloadSections = Object.keys(modifiedSections).length > 0 ? modifiedSections : editableSections

      const updated = await prdService.updatePRDSections(activePlan.id, {
        sections: payloadSections,
        userStories: structuredStories,
        expectedVersion: activePlan.version,
        versionBump: 'patch',
        workspaceId: currentWorkspace?.id,
      })

      setActivePlan(updated)
      setStructuredStories(extractStories(updated))
      setEditableSections(updated.sections || {})
      setPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      setIsEditing(false)
      addToast(`PRD revisions persisted to MongoDB Atlas (v${updated.version})!`, 'success')
    } catch (err) {
      if (err.status === 409 || err.message?.includes('409') || err.message?.toLowerCase().includes('concurrent')) {
        setConflictError(
          `Version conflict: This PRD has been updated in another session (current database version differs from expected v${activePlan.version}). Please reload the document to merge or resolve differences.`
        )
        addToast('Concurrency Conflict: Document version mismatch. Please reload.', 'error')
      } else {
        setSaveError(err.message || 'Failed to save PRD revisions to MongoDB Atlas.')
        addToast(err.message || 'Failed to save revisions.', 'error')
      }
    } finally {
      setIsSaving(false)
    }
  }

  // Open section regeneration modal
  const handleOpenRegenerate = (sectionKey, title) => {
    if (isApproved) {
      addToast('Cannot regenerate sections on an approved PRD.', 'warning')
      return
    }
    setRegenerateModal({ sectionKey, title })
    setCustomInstructions('')
  }

  // Execute single-section regeneration via Groq LLM
  const handleConfirmRegenerate = async () => {
    if (!regenerateModal || !activePlan) return
    const { sectionKey, title } = regenerateModal
    setIsRegeneratingSection(sectionKey)

    try {
      const updated = await prdService.regenerateSection(activePlan.id, {
        sectionKey,
        customInstructions: customInstructions.trim() || null,
        workspaceId: currentWorkspace?.id,
      })

      const newSecs = updated.sections || {}
      const regeneratedContent = newSecs[sectionKey] || ''
      setEditableSections(prev => ({
        ...prev,
        [sectionKey]: regeneratedContent,
      }))

      if (sectionKey === 'userStories' || sectionKey === 'user_stories') {
        const regeneratedStories = extractStories(updated)
        setStructuredStories(regeneratedStories)
      }

      setActivePlan(updated)
      setPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      setRegenerateModal(null)
      addToast(`Section "${title}" regenerated and persisted to Atlas.`, 'success')
    } catch (err) {
      addToast(err.message || `Failed to regenerate section "${title}".`, 'error')
    } finally {
      setIsRegeneratingSection(null)
    }
  }

  // Submit plan for human review
  const handleSubmitForReview = async () => {
    if (!activePlan) return
    setIsReviewing(true)
    try {
      const updated = await prdService.reviewProductPlan(activePlan.id, 'pending_review')
      setActivePlan(updated)
      setPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      addToast('Document submitted for PM human review.', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to submit plan for review.', 'error')
    } finally {
      setIsReviewing(false)
    }
  }

  // Approve plan
  const handleApprovePlan = async () => {
    if (!activePlan) return
    setIsReviewing(true)
    try {
      const updated = await prdService.reviewProductPlan(activePlan.id, 'approved')
      setActivePlan(updated)
      setPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      setConfirmApproveModal(false)
      setIsEditing(false)
      addToast('Plan approved successfully! Document modifications are now protected.', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to approve plan.', 'error')
    } finally {
      setIsReviewing(false)
    }
  }

  // Reject plan with review feedback notes
  const handleRejectPlan = async () => {
    if (!activePlan) return
    if (!reviewNotes.trim()) {
      addToast('Please provide review notes explaining requested changes.', 'warning')
      return
    }
    setIsReviewing(true)
    try {
      const updated = await prdService.reviewProductPlan(activePlan.id, 'rejected', reviewNotes.trim())
      setActivePlan(updated)
      setPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)))
      setRejectModal(false)
      setReviewNotes('')
      addToast('Review decision recorded: Changes Requested.', 'info')
    } catch (err) {
      addToast(err.message || 'Failed to update review status.', 'error')
    } finally {
      setIsReviewing(false)
    }
  }

  // Copy section text
  const copySection = (title, text) => {
    navigator.clipboard.writeText(`### ${title}\n\n${text}`)
    addToast(`Copied section "${title}" to clipboard`, 'info')
  }

  // Copy full document
  const copyFullDocument = () => {
    if (!activePlan) return
    let full = `# ${activePlan.title}\nVersion: ${activePlan.version} | Status: ${activePlan.status}\n\n`
    sectionsConfig.forEach(({ key, title }) => {
      full += `## ${title}\n${editableSections[key] || 'N/A'}\n\n`
    })
    navigator.clipboard.writeText(full)
    addToast('Full PRD copied to clipboard as Markdown', 'success')
  }

  // Export as Markdown file
  const exportMarkdown = () => {
    if (!activePlan) return
    let full = `# ${activePlan.title}\n\n**Version:** ${activePlan.version}\n**Status:** ${activePlan.status}\n**Last Updated:** ${activePlan.updatedAt}\n\n---\n\n`
    sectionsConfig.forEach(({ key, title }) => {
      full += `## ${title}\n\n${editableSections[key] || 'N/A'}\n\n`
    })

    const blob = new Blob([full], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${activePlan.title.replace(/\s+/g, '_')}_PRD.md`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    addToast('Exported clean Markdown PRD file', 'success')
  }

  // Status badge component helper
  const renderStatusBadge = (status) => {
    const s = String(status || 'draft').toLowerCase()
    if (s === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Approved
        </span>
      )
    }
    if (s === 'pending_review') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          Pending Review
        </span>
      )
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <XCircle className="w-3.5 h-3.5" />
          Changes Requested
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
        Draft
      </span>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Product Requirements Document Studio</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Atlas-Backed
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Auto-generate and curate 13-section specifications with zero-fabrication LLM inference directly in MongoDB Atlas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" icon={Copy} onClick={copyFullDocument} disabled={!activePlan}>
            Copy All
          </Button>
          <Button variant="outline" size="sm" icon={Download} onClick={exportMarkdown} disabled={!activePlan}>
            Export .MD
          </Button>
          <Button variant="outline" size="sm" icon={Printer} onClick={() => window.print()} disabled={!activePlan}>
            Print View
          </Button>
          <Button variant="primary" size="sm" icon={Sparkles} onClick={() => setShowNewModal(true)}>
            AI PRD Generator
          </Button>
        </div>
      </div>

      {/* Traceability Bar */}
      {activePlan && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950/70 border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Artifact Traceability:
            </span>
            {features.find(f => f.id === activePlan.featureId) ? (
              <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                Linked to Feature: <strong className="text-brand-600 dark:text-brand-400">{features.find(f => f.id === activePlan.featureId)?.name}</strong>
              </span>
            ) : (
              <span className="text-slate-400 italic">Feature Group: {activePlan.featureId || 'Standalone PRD'}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/prioritization">
              <button className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-brand-600 flex items-center gap-1 cursor-pointer">
                <LinkIcon className="w-3 h-3 text-brand-500" />
                <span>Prioritization Matrix</span>
              </button>
            </Link>
            <Link to="/aggregation">
              <button className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-brand-600 flex items-center gap-1 cursor-pointer">
                <Layers className="w-3 h-3 text-brand-500" />
                <span>Aggregated Feedback</span>
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Layout: PRD Sidebar & Document Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Documents List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Atlas PRDs ({plans.length})
            </span>
            {isLoadingPlans && <Loader2 className="w-3 h-3 animate-spin text-brand-500" />}
          </div>

          {isLoadingPlans ? (
            <div className="space-y-2 p-4 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading workspace PRDs...</p>
            </div>
          ) : plansError ? (
            <Card className="p-4 text-center border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20">
              <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">{plansError}</p>
              <Button size="xs" variant="outline" onClick={() => loadWorkspacePlans()}>
                Retry
              </Button>
            </Card>
          ) : plans.length === 0 ? (
            <Card className="p-6 text-center">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">No PRDs Found</p>
              <p className="text-[11px] text-slate-400 mt-1 mb-3">
                No product plans stored in MongoDB Atlas for this workspace.
              </p>
              <Button size="xs" variant="primary" icon={Sparkles} onClick={() => setShowNewModal(true)}>
                Generate with AI
              </Button>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
              {plans.map(doc => {
                const isSelected = doc.id === activePlan?.id
                return (
                  <Card
                    key={doc.id}
                    onClick={() => handleSelectPlan(doc)}
                    className={`p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 shadow-sm ring-1 ring-brand-500'
                        : 'hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-slate-400">v{doc.version}</span>
                      {renderStatusBadge(doc.status)}
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{doc.title}</h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Updated {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : 'recently'}
                    </p>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Right 3-Columns: Active Document Viewer & Editor */}
        <div className="lg:col-span-3 space-y-4">
          {isLoadingDetail ? (
            <Card className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Retrieving PRD details from Atlas...</p>
            </Card>
          ) : activePlan ? (
            <Card className="p-6">
              {/* Concurrency Conflict Banner */}
              {conflictError && (
                <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">Optimistic Concurrency Conflict</span>
                      <p>{conflictError}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button size="xs" variant="outline" onClick={() => handleSelectPlan(activePlan)}>
                      Reload from Atlas
                    </Button>
                    <button
                      onClick={() => setConflictError(null)}
                      className="text-slate-400 hover:text-slate-200 text-xs p-1"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Save Error Banner */}
              {saveError && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
                  <span>{saveError}</span>
                  <button onClick={() => setSaveError(null)} className="text-slate-400 hover:text-slate-200 text-xs">Dismiss</button>
                </div>
              )}

              {/* Document Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-black text-slate-900 dark:text-white">{activePlan.title}</h1>
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <Lock className="w-3 h-3" />
                        Locked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Author: <strong className="text-slate-300">{activePlan.author || 'Product Manager'}</strong> • Version: {activePlan.version} • Status: {renderStatusBadge(activePlan.status)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={isSaving ? Loader2 : Save}
                      disabled={isSaving}
                      onClick={handleSaveSections}
                    >
                      {isSaving ? 'Persisting to Atlas...' : 'Save Revisions'}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Edit2}
                      disabled={isApproved}
                      title={isApproved ? 'Approved PRD is locked against modifications.' : 'Edit sections'}
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Sections
                    </Button>
                  )}
                  {isEditing && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditableSections(activePlan.sections || {})
                        setStructuredStories(extractStories(activePlan))
                        setIsEditing(false)
                        setSaveError(null)
                        setConflictError(null)
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {/* Human Review Action Bar */}
              <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-navy-950/80 border border-slate-200 dark:border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Human Review Workflow:
                    </span>
                    {renderStatusBadge(activePlan.status)}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Submit for Review: eligible when in draft or changes requested */}
                    {(isDraft || isRejected) && (
                      <Button
                        size="xs"
                        variant="outline"
                        icon={isReviewing ? Loader2 : AlertCircle}
                        disabled={isReviewing}
                        onClick={handleSubmitForReview}
                      >
                        Submit for Review
                      </Button>
                    )}

                    {/* Approve Plan: eligible when in review or draft */}
                    {(isPendingReview || isDraft || isRejected) && (
                      <Button
                        size="xs"
                        variant="primary"
                        icon={CheckCircle2}
                        disabled={isReviewing}
                        onClick={() => setConfirmApproveModal(true)}
                      >
                        Approve Plan
                      </Button>
                    )}

                    {/* Request Changes: eligible when in review */}
                    {(isPendingReview || isDraft) && (
                      <Button
                        size="xs"
                        variant="secondary"
                        icon={MessageSquare}
                        disabled={isReviewing}
                        onClick={() => {
                          setReviewNotes('')
                          setRejectModal(true)
                        }}
                      >
                        Request Changes
                      </Button>
                    )}

                    {isApproved && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 italic flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        Approved by Product Manager
                      </span>
                    )}
                  </div>
                </div>

                {/* Review Notes Display */}
                {activePlan.reviewNotes && (
                  <div className="mt-3 p-3 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      Reviewer Feedback / Notes:
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                      {activePlan.reviewNotes}
                    </p>
                    {activePlan.reviewedAt && (
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Recorded on {new Date(activePlan.reviewedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 13 Structured Sections */}
              <div className="space-y-6">
                {sectionsConfig.map(({ key, title }) => {
                  const isRegeneratingThis = isRegeneratingSection === key

                  // Section 9: Interactive User Story Studio
                  if (key === 'userStories') {
                    return (
                      <div
                        key={key}
                        className="p-4 rounded-xl bg-slate-50/60 dark:bg-navy-950/60 border border-slate-200/80 dark:border-slate-800/80 transition-all space-y-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                              {title}
                            </h3>
                            {isRegeneratingThis && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-brand-500 font-semibold">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Regenerating with Groq...
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenRegenerate(key, title)}
                              disabled={isApproved || Boolean(isRegeneratingSection)}
                              className="text-[10px] text-slate-400 hover:text-brand-500 disabled:opacity-40 disabled:hover:text-slate-400 flex items-center gap-1 cursor-pointer"
                              title={isApproved ? 'Section regeneration disabled on approved PRD' : `Regenerate ${title} with AI`}
                            >
                              <Sparkles className="w-3 h-3 text-brand-500" />
                              <span>Regenerate</span>
                            </button>

                            <button
                              onClick={() => copySection(title, editableSections[key] || '')}
                              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </button>
                          </div>
                        </div>

                        <UserStoryStudio
                          stories={structuredStories}
                          isApproved={isApproved}
                          isSaving={isSavingStories}
                          onSaveStories={handleSaveStories}
                          onChangeStories={handleStoriesChange}
                          onRegenerate={() => handleOpenRegenerate(key, title)}
                        />

                        {/* Collapsible Raw Markdown Spec for Section 9 */}
                        <details className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                          <summary className="cursor-pointer hover:text-brand-500 font-semibold select-none">
                            View Markdown Spec (Section 9)
                          </summary>
                          <pre className="mt-2 p-2.5 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 font-mono text-[10px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap overflow-x-auto">
                            {editableSections[key] || ''}
                          </pre>
                        </details>
                      </div>
                    )
                  }

                  // Section 10: Aggregated Acceptance Criteria Traceability
                  if (key === 'acceptanceCriteria') {
                    const totalCriteria = structuredStories.reduce(
                      (acc, s) => acc + (s.acceptance_criteria?.length || 0),
                      0
                    )

                    return (
                      <div
                        key={key}
                        className="p-4 rounded-xl bg-slate-50/60 dark:bg-navy-950/60 border border-slate-200/80 dark:border-slate-800/80"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                              {title}
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {totalCriteria} Given-When-Then Criteria
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenRegenerate(key, title)}
                              disabled={isApproved || Boolean(isRegeneratingSection)}
                              className="text-[10px] text-slate-400 hover:text-brand-500 disabled:opacity-40 disabled:hover:text-slate-400 flex items-center gap-1 cursor-pointer"
                              title={isApproved ? 'Section regeneration disabled on approved PRD' : `Regenerate ${title} with AI`}
                            >
                              <Sparkles className="w-3 h-3 text-brand-500" />
                              <span>Regenerate</span>
                            </button>

                            <button
                              onClick={() => copySection(title, editableSections[key] || '')}
                              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          Acceptance criteria are managed directly within their parent user stories above to guarantee traceability and independent testability.
                        </p>

                        {totalCriteria > 0 ? (
                          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                            {structuredStories
                              .filter(s => Array.isArray(s.acceptance_criteria) && s.acceptance_criteria.length > 0)
                              .map(s => (
                                <div
                                  key={s.story_id}
                                  className="p-2.5 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 text-xs"
                                >
                                  <span className="font-mono font-bold text-brand-600 dark:text-brand-400 block mb-1">
                                    [{s.story_id}] {s.title}
                                  </span>
                                  <div className="pl-2 border-l border-brand-500/30 space-y-1">
                                    {s.acceptance_criteria.map(ac => (
                                      <div key={ac.criterion_id} className="text-slate-700 dark:text-slate-300">
                                        <span className="font-mono font-bold text-[10px] text-slate-500 mr-1.5">
                                          [{ac.criterion_id}]
                                        </span>
                                        <span className="font-semibold text-brand-500">
                                          ({ac.scenario_type || 'positive'})
                                        </span>{' '}
                                        {ac.description}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">
                            No acceptance criteria defined yet. Expand any user story in the Studio above and click "+ Add Acceptance Criterion".
                          </div>
                        )}
                      </div>
                    )
                  }

                  // Default 11 Sections
                  return (
                    <div
                      key={key}
                      className="p-4 rounded-xl bg-slate-50/60 dark:bg-navy-950/60 border border-slate-200/80 dark:border-slate-800/80 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                            {title}
                          </h3>
                          {isRegeneratingThis && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-brand-500 font-semibold">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Regenerating with Groq...
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Section Regeneration Button */}
                          <button
                            onClick={() => handleOpenRegenerate(key, title)}
                            disabled={isApproved || Boolean(isRegeneratingSection)}
                            className="text-[10px] text-slate-400 hover:text-brand-500 disabled:opacity-40 disabled:hover:text-slate-400 flex items-center gap-1 cursor-pointer"
                            title={isApproved ? 'Section regeneration disabled on approved PRD' : `Regenerate ${title} with AI`}
                          >
                            <Sparkles className="w-3 h-3 text-brand-500" />
                            <span>Regenerate</span>
                          </button>

                          {/* Copy Button */}
                          <button
                            onClick={() => copySection(title, editableSections[key] || '')}
                            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                      </div>

                      {isEditing && !isApproved ? (
                        <textarea
                          rows={4}
                          value={editableSections[key] || ''}
                          onChange={e => setEditableSections({ ...editableSections, [key]: e.target.value })}
                          className="w-full p-2.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-brand-500"
                        />
                      ) : (
                        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-normal">
                          {editableSections[key] || 'No specification written.'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No PRD Selected</p>
              <Button size="sm" onClick={() => setShowNewModal(true)} className="mt-3">
                Generate PRD
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Auto-Generate PRD Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="AI Product Planning Agent (PRD Studio)"
        subtitle="Transform prioritized backlog features into complete 13-section specifications with user stories and acceptance criteria"
      >
        <div className="space-y-4">
          {generationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs">
              {generationError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Feature to Specify *
            </label>
            <select
              value={selectedFeatureId}
              onChange={e => {
                const val = e.target.value
                setSelectedFeatureId(val)
                const f = features.find(item => item.id === val)
                if (f) setCustomTitle(`${f.name} Specification`)
              }}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              {features.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} (Priority Score: {f.score?.toFixed ? f.score.toFixed(2) : f.score})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Custom Document Title (Optional)
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              placeholder="e.g. Enterprise Dark Mode Architecture PRD v2"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-bold text-brand-600 dark:text-brand-400 block mb-1">
              ⚡ Grounded AI Specification Architecture:
            </span>
            <p className="text-[11px] leading-relaxed">
              Synthesizes 13 sections grounded strictly in customer feedback quotes, user stories with Given/When/Then acceptance criteria, engineering technical specs, and null baseline metrics in accordance with product governance standards.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button
              variant="electric"
              disabled={isGenerating}
              icon={isGenerating ? Loader2 : Sparkles}
              onClick={handleGenerateFromFeature}
            >
              {isGenerating ? 'Synthesizing with AI...' : 'Generate 13 Sections with AI'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Single Section Regeneration Modal */}
      <Modal
        isOpen={Boolean(regenerateModal)}
        onClose={() => setRegenerateModal(null)}
        title={`Regenerate ${regenerateModal?.title || 'Section'}`}
        subtitle="Regenerate only this section using targeted Groq LLM inference without full-document loops"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            You are regenerating <strong className="text-brand-600 dark:text-brand-400">{regenerateModal?.title}</strong>. All other sections and existing edits will remain completely untouched.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Custom PM Instructions or Directives (Optional)
            </label>
            <textarea
              rows={3}
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              placeholder="e.g. Focus on enterprise RBAC permissions and SOC2 compliance."
              className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRegenerateModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={isRegeneratingSection ? Loader2 : Sparkles}
              disabled={Boolean(isRegeneratingSection)}
              onClick={handleConfirmRegenerate}
            >
              {isRegeneratingSection ? 'Regenerating...' : 'Regenerate Section'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Approve Modal */}
      <Modal
        isOpen={confirmApproveModal}
        onClose={() => setConfirmApproveModal(false)}
        title="Confirm Plan Approval"
        subtitle="Approving this PRD marks it as production-ready and protects it from accidental edits"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to approve <strong className="text-slate-900 dark:text-white">{activePlan?.title}</strong>? Once approved, direct edits and section regeneration will be locked to ensure governance.
          </p>
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmApproveModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={isReviewing ? Loader2 : CheckCircle2}
              disabled={isReviewing}
              onClick={handleApprovePlan}
            >
              {isReviewing ? 'Approving...' : 'Approve Plan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Request Changes / Reject Modal */}
      <Modal
        isOpen={rejectModal}
        onClose={() => setRejectModal(false)}
        title="Request Changes on PRD"
        subtitle="Provide feedback or rejection notes for the product planning team"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Review Feedback & Notes *
            </label>
            <textarea
              rows={4}
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="e.g. Non-functional latency threshold needs to be reviewed by the infrastructure team before approval."
              className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={isReviewing ? Loader2 : MessageSquare}
              disabled={isReviewing}
              onClick={handleRejectPlan}
            >
              {isReviewing ? 'Submitting...' : 'Submit Changes Requested'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PRDGeneratorPage
