import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Save,
  X,
  Sparkles,
  User,
  Database,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  ListChecks,
} from 'lucide-react'
import { Card, Badge, Button } from '../common'
import AcceptanceCriteriaList from './AcceptanceCriteriaList'

/**
 * Extracts capability portion from "As a [persona], I want [capability], so that [benefit]"
 */
export function extractCapability(description, persona, businessValue) {
  if (!description || typeof description !== 'string') return ''
  let text = description.trim()
  // Strip "As a [persona]," prefix if present
  text = text.replace(/^As a\s+[^,]+,\s*/i, '')
  // Strip "I want" prefix
  text = text.replace(/^I want\s+/i, '')
  // Strip ", so that [benefit]" suffix
  text = text.replace(/,\s*so that[\s\S]*$/i, '')
  return text.trim() || description
}

export function UserStoryCard({
  story,
  isApproved = false,
  onUpdateStory = () => { },
  onDeleteStory = () => { },
  allExistingCriterionIds = [],
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  // Edit form state
  const [editForm, setEditForm] = useState(() => ({
    title: story.title || '',
    persona: story.persona || '',
    capability: extractCapability(story.description, story.persona, story.business_value),
    business_value: story.business_value || '',
    priority: story.priority || 'High',
  }))

  const priorityColorMap = {
    critical: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    high: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    medium: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    low: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  }

  // Origin badge
  const renderOriginBadge = (origin) => {
    const o = String(origin || 'source_supported').toLowerCase()
    if (o === 'source_supported') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <Database className="w-3 h-3" />
          Source Supported
        </span>
      )
    }
    if (o === 'user_provided') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          <User className="w-3 h-3" />
          User Provided
        </span>
      )
    }
    if (o === 'assumption') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
          <HelpCircle className="w-3 h-3" />
          Assumption
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
        <Sparkles className="w-3 h-3" />
        AI Recommendation
      </span>
    )
  }

  const handleStartEdit = () => {
    setErrorMsg(null)
    setEditForm({
      title: story.title || '',
      persona: story.persona || '',
      capability: extractCapability(story.description, story.persona, story.business_value),
      business_value: story.business_value || '',
      priority: story.priority || 'High',
    })
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    setErrorMsg(null)
    const { title, persona, capability, business_value, priority } = editForm

    if (!title.trim()) {
      setErrorMsg('Story title cannot be empty.')
      return
    }
    if (!persona.trim()) {
      setErrorMsg('Persona is required (e.g. Financial Analyst, Product Manager).')
      return
    }
    if (!capability.trim()) {
      setErrorMsg('User story capability cannot be empty.')
      return
    }
    if (!business_value.trim()) {
      setErrorMsg('Business value / benefit is required.')
      return
    }

    const formattedDescription = `As a ${persona.trim()}, I want ${capability.trim()}, so that ${business_value.trim()}.`

    const updated = {
      ...story,
      title: title.trim(),
      persona: persona.trim(),
      description: formattedDescription,
      business_value: business_value.trim(),
      priority,
    }

    onUpdateStory(updated)
    setIsEditing(false)
  }

  const handleUpdateCriteria = (newCriteria) => {
    const updated = {
      ...story,
      acceptance_criteria: newCriteria,
    }
    onUpdateStory(updated)
  }

  const criteriaList = story.acceptance_criteria || []
  const capabilityText = extractCapability(story.description, story.persona, story.business_value)

  return (
    <Card className="p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-navy-950/70 shadow-xs border border-slate-200/90 dark:border-slate-800/90">
      {/* Story Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-xs text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
            {story.story_id}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${priorityColorMap[String(story.priority || 'high').toLowerCase()] || priorityColorMap.high
              }`}
          >
            {story.priority || 'High'} Priority
          </span>
          {renderOriginBadge(story.origin)}
          {story.is_confirmed ? (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" />
              Confirmed
            </span>
          ) : (
            <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-0.5">
              <AlertCircle className="w-3 h-3" />
              Needs PM Review
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {!isEditing && (
            <>
              <button
                type="button"
                onClick={handleStartEdit}
                disabled={isApproved}
                className="p-1.5 text-slate-400 hover:text-brand-500 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Edit User Story"
                aria-label="Edit User Story"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={isApproved}
                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Delete User Story"
                aria-label="Delete User Story"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-900 cursor-pointer flex items-center gap-1 text-[11px]"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ListChecks className="w-3.5 h-3.5 text-brand-500" />
            <span>Criteria ({criteriaList.length})</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Callout */}
      {confirmDelete && (
        <div className="mt-2.5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <span>Are you sure you want to delete user story <strong>{story.story_id}</strong>?</span>
          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button size="xs" variant="danger" onClick={() => onDeleteStory(story.story_id)}>
              Confirm Delete
            </Button>
          </div>
        </div>
      )}

      {/* Error Callout */}
      {errorMsg && (
        <div className="mt-2.5 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Story Content / Edit Form */}
      {isEditing ? (
        <div className="mt-3 space-y-3 pt-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                Story Title *
              </label>
              <input
                type="text"
                value={editForm.title}
                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                Priority
              </label>
              <select
                value={editForm.priority}
                onChange={e => setEditForm({ ...editForm, priority: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                Persona *
              </label>
              <input
                type="text"
                placeholder="e.g. Financial Analyst"
                value={editForm.persona}
                onChange={e => setEditForm({ ...editForm, persona: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                Business Value delivered *
              </label>
              <input
                type="text"
                placeholder="e.g. Saves 2 hours weekly during financial audits"
                value={editForm.business_value}
                onChange={e => setEditForm({ ...editForm, business_value: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
              Capability / Feature ("I want ...") *
            </label>
            <textarea
              rows={2}
              placeholder="e.g. to download CSV tables directly from the reports dashboard"
              value={editForm.capability}
              onChange={e => setEditForm({ ...editForm, capability: e.target.value })}
              className="w-full p-2 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button size="xs" variant="secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button size="xs" variant="primary" icon={Save} onClick={handleSaveEdit}>
              Save Story
            </Button>
          </div>
        </div>
      ) : (
        /* Formatted Display */
        <div className="mt-3 space-y-2.5">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {story.title}
          </h4>

          {/* Canonical As a... I want... So that... presentation */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200/70 dark:border-slate-800/70 text-xs space-y-1 leading-relaxed">
            <p>
              <strong className="text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider text-[10px]">
                As a
              </strong>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{story.persona || 'user'}</span>,
            </p>
            <p>
              <strong className="text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider text-[10px]">
                I want
              </strong>{' '}
              <span className="text-slate-700 dark:text-slate-300">{capabilityText || story.description}</span>,
            </p>
            <p>
              <strong className="text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider text-[10px]">
                So that
              </strong>{' '}
              <span className="text-slate-700 dark:text-slate-300">
                {story.business_value || 'commercial and operational efficiency is achieved'}.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Expandable Acceptance Criteria Studio */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
          <AcceptanceCriteriaList
            criteria={criteriaList}
            storyId={story.story_id}
            isApproved={isApproved}
            onChangeCriteria={handleUpdateCriteria}
            allExistingCriterionIds={allExistingCriterionIds}
          />
        </div>
      )}
    </Card>
  )
}

export default UserStoryCard

