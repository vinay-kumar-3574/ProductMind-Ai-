import React, { useState } from 'react'
import {
  Plus,
  Save,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  ListChecks,
} from 'lucide-react'
import { Card, Button, Badge } from '../common'
import UserStoryCard from './UserStoryCard'
import { formatGivenWhenThen, validateUserStory } from './storyHelpers'

export function UserStoryStudio({
  stories = [],
  isApproved = false,
  isSaving = false,
  onSaveStories = () => {},
  onChangeStories = () => {},
  onRegenerate = null,
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [formError, setFormError] = useState(null)

  // New Story Form State
  const [newForm, setNewForm] = useState({
    story_id: '',
    title: '',
    persona: '',
    capability: '',
    business_value: '',
    priority: 'High',
    given: '',
    when: '',
    then: '',
  })

  // All existing criterion IDs across all stories (for collision prevention)
  const allExistingCriterionIds = stories.flatMap(s => (s.acceptance_criteria || []).map(ac => ac.criterion_id))

  const handleStartAdd = () => {
    setFormError(null)
    let maxStoryNum = 0
    stories.forEach(s => {
      const match = String(s.story_id).match(/US-(\d+)/i)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxStoryNum) maxStoryNum = num
      }
    })
    const nextStoryId = `US-${String(maxStoryNum + 1).padStart(3, '0')}`

    let maxAcNum = 0
    allExistingCriterionIds.forEach(id => {
      const match = String(id).match(/AC-(\d+)/i)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxAcNum) maxAcNum = num
      }
    })
    const nextAcId = `AC-${String(maxAcNum + 1).padStart(3, '0')}`

    setNewForm({
      story_id: nextStoryId,
      title: '',
      persona: '',
      capability: '',
      business_value: '',
      priority: 'High',
      given: '',
      when: '',
      then: '',
      ac_id: nextAcId,
    })
    setIsAdding(true)
  }

  const handleSaveAdd = () => {
    setFormError(null)
    const { story_id, title, persona, capability, business_value, priority, given, when, then, ac_id } = newForm

    const storyToValidate = {
      story_id: story_id?.trim() || '',
      title: title?.trim() || '',
      persona: persona?.trim() || '',
      description: `As a ${persona?.trim() || 'user'}, I want ${capability?.trim() || ''}, so that ${business_value?.trim() || ''}.`,
      business_value: business_value?.trim() || '',
    }

    const existingIds = stories.map(s => s.story_id.toUpperCase())
    const validationErr = validateUserStory(storyToValidate, existingIds)
    if (validationErr) {
      setFormError(validationErr)
      return
    }

    if (!capability.trim()) {
      setFormError('Capability ("I want ...") cannot be empty.')
      return
    }

    // Prepare initial acceptance criterion
    const initialCriteria = []
    if (given.trim() || when.trim() || then.trim()) {
      if (!given.trim() || !when.trim() || !then.trim()) {
        setFormError('If specifying acceptance criteria, Given, When, and Then must all be provided.')
        return
      }
      initialCriteria.push({
        criterion_id: ac_id || `AC-${String(allExistingCriterionIds.length + 1).padStart(3, '0')}`,
        description: formatGivenWhenThen({ given, when, then }),
        scenario_type: 'positive',
        testable: true,
        origin: 'user_provided',
        is_confirmed: true,
        requires_confirmation: false,
        related_story_id: story_id.trim().toUpperCase(),
      })
    } else {
      // Default initial criterion
      initialCriteria.push({
        criterion_id: ac_id || `AC-${String(allExistingCriterionIds.length + 1).padStart(3, '0')}`,
        description: `Given authenticated product user, When ${title.trim()} flow is executed, Then system responds with expected outcome.`,
        scenario_type: 'positive',
        testable: true,
        origin: 'user_provided',
        is_confirmed: true,
        requires_confirmation: false,
        related_story_id: story_id.trim().toUpperCase(),
      })
    }

    const createdStory = {
      story_id: story_id.trim().toUpperCase(),
      title: title.trim(),
      persona: persona.trim(),
      description: `As a ${persona.trim()}, I want ${capability.trim()}, so that ${business_value.trim()}.`,
      business_value: business_value.trim(),
      priority,
      origin: 'user_provided',
      is_confirmed: true,
      requires_confirmation: false,
      related_requirements: [],
      acceptance_criteria: initialCriteria,
      dependencies: [],
    }

    const updatedList = [...stories, createdStory]
    onChangeStories(updatedList)
    setHasUnsavedChanges(true)
    setIsAdding(false)
  }

  const handleUpdateStory = (updatedStory) => {
    const updatedList = stories.map(s => (s.story_id === updatedStory.story_id ? updatedStory : s))
    onChangeStories(updatedList)
    setHasUnsavedChanges(true)
  }

  const handleDeleteStory = (storyId) => {
    const updatedList = stories.filter(s => s.story_id !== storyId)
    onChangeStories(updatedList)
    setHasUnsavedChanges(true)
  }

  const handleSaveToAtlas = async () => {
    await onSaveStories(stories)
    setHasUnsavedChanges(false)
  }

  return (
    <div className="space-y-4">
      {/* Studio Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-navy-950/80 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
            <ListChecks className="w-4 h-4 text-brand-500" />
            Interactive User Story Studio
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
            {stories.length} {stories.length === 1 ? 'Story' : 'Stories'}
          </span>
          {hasUnsavedChanges && (
            <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onRegenerate && (
            <Button
              size="xs"
              variant="outline"
              icon={Sparkles}
              disabled={isApproved}
              onClick={onRegenerate}
              title={isApproved ? 'Approved PRD is locked' : 'Regenerate user stories with AI'}
            >
              AI Assist
            </Button>
          )}

          {!isApproved && !isAdding && (
            <Button
              size="xs"
              variant="secondary"
              icon={Plus}
              onClick={handleStartAdd}
            >
              Add User Story
            </Button>
          )}

          {!isApproved && (
            <Button
              size="xs"
              variant="primary"
              icon={isSaving ? Loader2 : Save}
              disabled={isSaving}
              onClick={handleSaveToAtlas}
            >
              {isSaving ? 'Saving to Atlas...' : 'Save Stories to Atlas'}
            </Button>
          )}
        </div>
      </div>

      {/* Inline Add Story Form */}
      {isAdding && (
        <Card className="p-4 border-2 border-brand-500/40 bg-brand-50/20 dark:bg-brand-950/20 space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-brand-200 dark:border-brand-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-brand-500" />
              Create New User Story & Initial Acceptance Criteria
            </h4>
            <button
              onClick={() => {
                setIsAdding(false)
                setFormError(null)
              }}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                Story ID *
              </label>
              <input
                type="text"
                value={newForm.story_id}
                onChange={e => setNewForm({ ...newForm, story_id: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                Story Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Export Search Results to CSV"
                value={newForm.title}
                onChange={e => setNewForm({ ...newForm, title: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                Priority
              </label>
              <select
                value={newForm.priority}
                onChange={e => setNewForm({ ...newForm, priority: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                Persona (As a...) *
              </label>
              <input
                type="text"
                placeholder="e.g. Financial Auditor"
                value={newForm.persona}
                onChange={e => setNewForm({ ...newForm, persona: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                Business Benefit (So that...) *
              </label>
              <input
                type="text"
                placeholder="e.g. quarterly reconciliation takes minutes instead of hours"
                value={newForm.business_value}
                onChange={e => setNewForm({ ...newForm, business_value: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
              Capability / Feature (I want...) *
            </label>
            <input
              type="text"
              placeholder="e.g. an Export button that downloads filtered rows in standard CSV"
              value={newForm.capability}
              onChange={e => setNewForm({ ...newForm, capability: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          {/* Initial Acceptance Criterion Inputs */}
          <div className="p-3 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 block">
              Initial Acceptance Criterion ({newForm.ac_id})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 block mb-0.5">Given:</span>
                <input
                  type="text"
                  placeholder="e.g. table is populated"
                  value={newForm.given}
                  onChange={e => setNewForm({ ...newForm, given: e.target.value })}
                  className="w-full px-2 py-1 text-xs rounded bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 block mb-0.5">When:</span>
                <input
                  type="text"
                  placeholder="e.g. user clicks export"
                  value={newForm.when}
                  onChange={e => setNewForm({ ...newForm, when: e.target.value })}
                  className="w-full px-2 py-1 text-xs rounded bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 block mb-0.5">Then:</span>
                <input
                  type="text"
                  placeholder="e.g. file is downloaded"
                  value={newForm.then}
                  onChange={e => setNewForm({ ...newForm, then: e.target.value })}
                  className="w-full px-2 py-1 text-xs rounded bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-brand-200 dark:border-brand-800">
            <Button size="xs" variant="secondary" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button size="xs" variant="primary" icon={Check} onClick={handleSaveAdd}>
              Create Story
            </Button>
          </div>
        </Card>
      )}

      {/* Stories List */}
      {stories.length === 0 && !isAdding ? (
        <Card className="p-8 text-center border-dashed">
          <ListChecks className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
            No User Stories Defined
          </h4>
          <p className="text-[11px] text-slate-400 mb-3 max-w-sm mx-auto">
            Break down this initiative into actionable agile stories with Given-When-Then acceptance criteria.
          </p>
          {!isApproved && (
            <Button size="xs" variant="primary" icon={Plus} onClick={handleStartAdd}>
              Add First User Story
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {stories.map(story => (
            <UserStoryCard
              key={story.story_id}
              story={story}
              isApproved={isApproved}
              onUpdateStory={handleUpdateStory}
              onDeleteStory={handleDeleteStory}
              allExistingCriterionIds={allExistingCriterionIds}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default UserStoryStudio
