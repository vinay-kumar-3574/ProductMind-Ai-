import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  FileText,
  Milestone,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Card, Badge, Button, Modal } from '../components/common'

export function ReleaseReadinessPage() {
  const {
    releases,
    features,
    roadmap,
    feedback,
    addRelease,
    updateRelease,
    toggleChecklistItem,
    deleteRelease,
    addToast,
  } = useApp()

  const [activeReleaseId, setActiveReleaseId] = useState(() => releases[0]?.id || '')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formVersion, setFormVersion] = useState('v2.6.0')
  const [formDescription, setFormDescription] = useState('')
  const [formDate, setFormDate] = useState('2027-01-15')
  const [formOwner, setFormOwner] = useState('Alex Rivera')

  const activeRelease = releases.find(r => r.id === activeReleaseId) || releases[0]

  const checklist = activeRelease?.checklist || []
  const completedCount = checklist.filter(c => c.completed).length
  const totalCount = checklist.length || 1
  const readinessPercent = Math.round((completedCount / totalCount) * 100)

  // Required checks
  const requiredChecks = checklist.filter(c => c.required)
  const requiredPending = requiredChecks.filter(c => !c.completed)
  const isGated = requiredPending.length > 0 // Release is BLOCKED if required checks remain

  // Included features & blockers
  const includedFeatures = features.filter(f => activeRelease?.includedFeatureIds?.includes(f.id))
  const urgentBlockers = feedback.filter(f => f.priority === 'Urgent' && f.sentiment === 'Negative')

  const handleToggleCheck = (checkId) => {
    if (!activeRelease) return
    toggleChecklistItem(activeRelease.id, checkId)
    addToast('Release checklist state updated', 'info')
  }

  const handleCreate = (e) => {
    e.preventDefault()
    if (!formName.trim() || !formVersion.trim()) return

    const newRel = addRelease({
      name: formName.trim(),
      version: formVersion.trim(),
      description: formDescription.trim(),
      plannedDate: formDate,
      owner: formOwner,
    })

    setActiveReleaseId(newRel.id)
    setShowCreateModal(false)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Release Readiness Center</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Gated Governance
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit release candidates against mandatory quality, security, and verification checkpoints before shipping
          </p>
        </div>

        <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowCreateModal(true)}>
          New Release Candidate
        </Button>
      </div>

      {/* Main release container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-cols: Active Release Candidate Audit */}
        <div className="lg:col-span-2 space-y-4">
          {activeRelease ? (
            <Card className="p-6">
              {/* Release Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{activeRelease.name}</h3>
                    <Badge variant="brand">{activeRelease.version}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Target Deployment: <strong className="text-slate-300">{activeRelease.plannedDate}</strong> • Owner: {activeRelease.owner}
                  </p>
                </div>

                {/* Go / No-Go Gating Badge */}
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                    isGated
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {isGated ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>{isGated ? 'NO-GO: RELEASE GATED' : 'GO: READY TO SHIP'}</span>
                  </div>
                </div>
              </div>

              {/* Readiness Progress Bar */}
              <div className="space-y-1.5 mb-6">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Mandatory Quality Gate Completion
                  </span>
                  <span className="font-bold text-brand-600 dark:text-brand-400 font-mono">
                    {completedCount} of {totalCount} ({readinessPercent}%)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isGated ? 'bg-gradient-to-r from-brand-500 to-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${readinessPercent}%` }}
                  />
                </div>
              </div>

              {/* Checklist items */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Verification Checklist ({checklist.length} Controls)
                </h4>

                {checklist.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleCheck(item.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      item.completed
                        ? 'bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-500/30'
                        : item.required
                        ? 'bg-slate-50 dark:bg-navy-950 border-rose-500/30 hover:border-rose-500/50'
                        : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                        item.completed ? 'bg-emerald-500 text-white' : 'border border-slate-400 text-transparent'
                      }`}>
                        {item.completed ? '✓' : ''}
                      </div>
                      <span className={`text-xs ${item.completed ? 'line-through text-slate-400' : 'font-semibold text-slate-900 dark:text-white'}`}>
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.required && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          Required Gate
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Release notes summary */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white block mb-1">Release Scope & Notes:</span>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                  {activeRelease.releaseNotes}
                </p>
              </div>
            </Card>
          ) : null}
        </div>

        {/* Right 1-col: Releases List & Urgent Risks */}
        <div className="space-y-4">
          {/* Release Candidates */}
          <Card className="p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Release Candidates</span>
            <div className="space-y-2">
              {releases.map(rel => {
                const isSelected = rel.id === activeRelease?.id
                return (
                  <div
                    key={rel.id}
                    onClick={() => setActiveReleaseId(rel.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-brand-50/60 dark:bg-brand-950/40 border-brand-500'
                        : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-900 dark:text-white">{rel.version}</span>
                      <span className="text-slate-400 text-[10px]">{rel.plannedDate}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{rel.name}</p>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Unresolved High-Priority Issues Gate */}
          <Card className="p-4 border-rose-500/30 bg-rose-50/10 dark:bg-rose-950/10">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h4 className="text-xs font-bold text-rose-500">Unresolved Urgent Blockers ({urgentBlockers.length})</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              Gating policy strictly flags open Urgent customer complaints as potential deployment showstoppers.
            </p>
            <div className="space-y-1.5">
              {urgentBlockers.map(ub => (
                <div key={ub.id} className="p-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-300">
                  <span className="font-semibold text-rose-400 block line-clamp-1">{ub.title}</span>
                  <span className="text-[10px] text-slate-500">{ub.customer} ({ub.company})</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Create Release Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Release Candidate"
        subtitle="Establish target date and baseline verification controls"
      >
        <form onSubmit={handleCreate} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Release Name *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Autumn Enterprise Release"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Version String *</label>
              <input
                type="text"
                required
                value={formVersion}
                onChange={e => setFormVersion(e.target.value)}
                placeholder="e.g. v2.6.0"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Release Scope & Description</label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Planned Target Date</label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Release Lead</label>
              <input
                type="text"
                value={formOwner}
                onChange={e => setFormOwner(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Initialize Release</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default ReleaseReadinessPage
