import React, { useState } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  User,
  Database,
  Check,
} from 'lucide-react'
import { Badge, Button } from '../common'

/**
 * Parses a description into { given, when, then } components.
 */
export function parseGivenWhenThen(text) {
  if (!text || typeof text !== 'string') {
    return { given: '', when: '', then: '' }
  }
  const match = text.match(/Given\s*(.*?)[,\s]+When\s*(.*?)[,\s]+Then\s*(.*)/i)
  if (match) {
    return {
      given: match[1].trim(),
      when: match[2].trim(),
      then: match[3].trim(),
    }
  }
  return {
    given: text,
    when: '',
    then: '',
  }
}

/**
 * Formats given, when, then components into a single Given-When-Then specification string.
 */
export function formatGivenWhenThen({ given, when, then }) {
  const g = (given || '').trim()
  const w = (when || '').trim()
  const t = (then || '').trim()
  if (g && w && t) {
    return `Given ${g}, When ${w}, Then ${t}`
  }
  return g || w || t || ''
}

export function AcceptanceCriteriaList({
  criteria = [],
  storyId = '',
  isApproved = false,
  onChangeCriteria,
  onChange,
  allExistingCriterionIds = [],
}) {
  const changeHandler = onChangeCriteria || onChange || (() => {})
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const [addForm, setAddForm] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Origin badge helper
  const renderOriginBadge = (origin) => {
    const o = String(origin || 'ai_recommendation').toLowerCase()
    if (o === 'source_supported') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <Database className="w-2.5 h-2.5" />
          Source Supported
        </span>
      )
    }
    if (o === 'user_provided') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          <User className="w-2.5 h-2.5" />
          User Provided
        </span>
      )
    }
    if (o === 'assumption') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
          <HelpCircle className="w-2.5 h-2.5" />
          Assumption
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
        <Sparkles className="w-2.5 h-2.5" />
        AI Recommendation
      </span>
    )
  }

  // Scenario type badge helper
  const renderScenarioBadge = (type) => {
    const t = String(type || 'positive').toLowerCase()
    if (t === 'negative') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          Negative Scenario
        </span>
      )
    }
    if (t === 'edge_case' || t === 'edge case') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          Edge Case
        </span>
      )
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        Positive Flow
      </span>
    )
  }

  // Start adding a new criterion
  const handleStartAdd = () => {
    setErrorMsg(null)
    const combinedIds = Array.from(new Set([
      ...criteria.map(c => c.criterion_id),
      ...allExistingCriterionIds,
    ]))
    let maxNum = 0
    combinedIds.forEach(id => {
      const match = String(id).match(/AC-(\d+)/i)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNum) maxNum = num
      }
    })
    const nextId = `AC-${String(maxNum + 1).padStart(3, '0')}`

    setAddForm({
      criterion_id: nextId,
      given: '',
      when: '',
      then: '',
      scenario_type: 'positive',
      testable: true,
      origin: 'user_provided',
      is_confirmed: true,
      requires_confirmation: false,
      related_story_id: storyId,
    })
    setIsAdding(true)
  }

  // Save new criterion
  const handleSaveAdd = () => {
    if (!addForm) return
    setErrorMsg(null)

    const cId = (addForm.criterion_id || '').trim()
    if (!cId) {
      setErrorMsg('Criterion ID is required.')
      return
    }

    // Check duplicate criterion ID
    const isDuplicate = criteria.some(c => c.criterion_id === cId) ||
      allExistingCriterionIds.some(id => id === cId)
    if (isDuplicate) {
      setErrorMsg(`Criterion ID '${cId}' already exists in this PRD.`)
      return
    }

    const { given, when, then } = addForm
    if (!given.trim() || !when.trim() || !then.trim()) {
      setErrorMsg('All Given, When, and Then fields are required.')
      return
    }

    const fullDescription = formatGivenWhenThen({ given, when, then })
    const newCriterion = {
      criterion_id: cId,
      description: fullDescription,
      scenario_type: addForm.scenario_type,
      testable: Boolean(addForm.testable),
      origin: 'user_provided',
      is_confirmed: true,
      requires_confirmation: false,
      related_story_id: storyId,
    }

    changeHandler([...criteria, newCriterion])
    setIsAdding(false)
    setAddForm(null)
  }

  // Start editing a criterion
  const handleStartEdit = (item) => {
    setErrorMsg(null)
    setEditingId(item.criterion_id)
    const parsed = parseGivenWhenThen(item.description)
    setEditForm({
      ...item,
      given: parsed.given,
      when: parsed.when,
      then: parsed.then,
    })
  }

  // Save edited criterion
  const handleSaveEdit = (cId) => {
    if (!editForm) return
    setErrorMsg(null)

    const { given, when, then } = editForm
    if (!given.trim() || !when.trim() || !then.trim()) {
      setErrorMsg('All Given, When, and Then fields are required.')
      return
    }

    const fullDescription = formatGivenWhenThen({ given, when, then })
    const updated = criteria.map(c => {
      if (c.criterion_id === cId) {
        return {
          ...c,
          description: fullDescription,
          scenario_type: editForm.scenario_type,
          testable: Boolean(editForm.testable),
        }
      }
      return c
    })

    changeHandler(updated)
    setEditingId(null)
    setEditForm(null)
  }

  // Delete criterion
  const handleDelete = (cId) => {
    const updated = criteria.filter(c => c.criterion_id !== cId)
    changeHandler(updated)
    setConfirmDeleteId(null)
  }

  return (
    <div className="space-y-3">
      {/* Header & Add Button */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Acceptance Criteria ({criteria.length})
        </span>

        {!isApproved && !isAdding && (
          <button
            onClick={handleStartAdd}
            className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-500 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Acceptance Criterion</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Add New Criterion Form */}
      {isAdding && addForm && (
        <div className="p-3.5 rounded-xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-brand-700 dark:text-brand-300">
              New Acceptance Criterion
            </span>
            <button
              onClick={() => {
                setIsAdding(false)
                setAddForm(null)
                setErrorMsg(null)
              }}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                Criterion ID *
              </label>
              <input
                type="text"
                value={addForm.criterion_id}
                onChange={e => setAddForm({ ...addForm, criterion_id: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                Scenario Type
              </label>
              <select
                value={addForm.scenario_type}
                onChange={e => setAddForm({ ...addForm, scenario_type: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="positive">Positive Flow</option>
                <option value="negative">Negative Flow</option>
                <option value="edge_case">Edge Case</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.testable}
                  onChange={e => setAddForm({ ...addForm, testable: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Independently Testable</span>
              </label>
            </div>
          </div>

          {/* Given-When-Then Form Fields */}
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 block mb-0.5">Given (Precondition) *</span>
              <input
                type="text"
                placeholder="e.g. The user is logged in and on the analytics dashboard"
                value={addForm.given}
                onChange={e => setAddForm({ ...addForm, given: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 block mb-0.5">When (Trigger Action) *</span>
              <input
                type="text"
                placeholder="e.g. The user clicks Export to CSV with 50,000 rows"
                value={addForm.when}
                onChange={e => setAddForm({ ...addForm, when: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 block mb-0.5">Then (Expected Result) *</span>
              <input
                type="text"
                placeholder="e.g. A downloadable CSV stream begins within 2 seconds"
                value={addForm.then}
                onChange={e => setAddForm({ ...addForm, then: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-brand-200 dark:border-brand-800">
            <Button size="xs" variant="secondary" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button size="xs" variant="primary" icon={Check} onClick={handleSaveAdd}>
              Add Criterion
            </Button>
          </div>
        </div>
      )}

      {/* Criteria Cards */}
      {criteria.length === 0 && !isAdding ? (
        <div className="p-3 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
          No acceptance criteria defined for this user story.
        </div>
      ) : (
        <div className="space-y-2">
          {criteria.map((item) => {
            const isThisEditing = editingId === item.criterion_id
            const parsed = parseGivenWhenThen(item.description)

            return (
              <div
                key={item.criterion_id}
                className="p-3 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2 shadow-2xs"
              >
                {/* Criterion Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-bold text-[11px] text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-1.5 py-0.5 rounded border border-brand-500/20">
                      {item.criterion_id}
                    </span>
                    {renderScenarioBadge(item.scenario_type)}
                    {renderOriginBadge(item.origin)}
                    <button
                      type="button"
                      disabled={isApproved}
                      onClick={() => {
                        const updated = criteria.map(c =>
                          c.criterion_id === item.criterion_id ? { ...c, testable: !c.testable } : c
                        )
                        changeHandler(updated)
                      }}
                      title={item.testable ? 'Mark as non-testable' : 'Mark as testable'}
                      className="cursor-pointer"
                    >
                      {item.testable ? (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium hover:underline">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Testable
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic hover:underline">Manual Review</span>
                      )}
                    </button>
                    {item.requires_confirmation && (
                      <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Requires Review
                      </span>
                    )}
                  </div>

                  {!isApproved && (
                    <div className="flex items-center gap-1">
                      {!isThisEditing ? (
                        <>
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1 text-slate-400 hover:text-brand-500 rounded cursor-pointer"
                            title="Edit Criterion"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(item.criterion_id)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                            title="Delete Criterion"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditForm(null)
                          }}
                          className="p-1 text-slate-400 hover:text-slate-200 rounded cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Delete Confirmation Banner */}
                {confirmDeleteId === item.criterion_id && (
                  <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-[11px] flex items-center justify-between">
                    <span>Delete criterion {item.criterion_id}?</span>
                    <div className="flex items-center gap-1">
                      <Button size="xs" variant="secondary" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </Button>
                      <Button size="xs" variant="danger" onClick={() => handleDelete(item.criterion_id)}>
                        Confirm
                      </Button>
                    </div>
                  </div>
                )}

                {/* Criterion Content: View vs Edit Mode */}
                {isThisEditing && editForm ? (
                  <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                          Scenario Type
                        </label>
                        <select
                          value={editForm.scenario_type}
                          onChange={e => setEditForm({ ...editForm, scenario_type: e.target.value })}
                          className="w-full px-2 py-1 text-xs rounded bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          <option value="positive">Positive Flow</option>
                          <option value="negative">Negative Flow</option>
                          <option value="edge_case">Edge Case</option>
                        </select>
                      </div>

                      <div className="flex items-center pt-3">
                        <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.testable}
                            onChange={e => setEditForm({ ...editForm, testable: e.target.checked })}
                            className="rounded text-brand-600"
                          />
                          <span>Testable</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 block">Given:</span>
                      <input
                        type="text"
                        value={editForm.given}
                        onChange={e => setEditForm({ ...editForm, given: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 block">When:</span>
                      <input
                        type="text"
                        value={editForm.when}
                        onChange={e => setEditForm({ ...editForm, when: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 block">Then:</span>
                      <input
                        type="text"
                        value={editForm.then}
                        onChange={e => setEditForm({ ...editForm, then: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1">
                      <Button size="xs" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button size="xs" variant="primary" icon={Save} onClick={() => handleSaveEdit(item.criterion_id)}>
                        Save Criterion
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Formatted Given-When-Then Display */
                  <div className="pl-2 border-l-2 border-brand-500/40 space-y-1 text-slate-700 dark:text-slate-300 font-normal">
                    {parsed.given && (
                      <p>
                        <strong className="text-brand-600 dark:text-brand-400 font-semibold">Given: </strong>
                        {parsed.given}
                      </p>
                    )}
                    {parsed.when && (
                      <p>
                        <strong className="text-brand-600 dark:text-brand-400 font-semibold">When: </strong>
                        {parsed.when}
                      </p>
                    )}
                    {parsed.then && (
                      <p>
                        <strong className="text-brand-600 dark:text-brand-400 font-semibold">Then: </strong>
                        {parsed.then}
                      </p>
                    )}
                    {!parsed.when && !parsed.then && (
                      <p>{item.description}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AcceptanceCriteriaList
