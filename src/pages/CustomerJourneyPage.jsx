import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  Route,
  Plus,
  Compass,
  UserCheck,
  Zap,
  Heart,
  Repeat,
  Trash2,
  Edit2,
  Lightbulb,
  AlertTriangle,
  ChevronRight,
  Smile,
} from 'lucide-react'
import { Card, Badge, Button, Modal } from '../components/common'

export function CustomerJourneyPage() {
  const { journeys, updateJourneyStage, addTouchpoint, removeTouchpoint, addToast } = useApp()

  const [selectedStageId, setSelectedStageId] = useState(journeys[0]?.id || '')
  const [showAddTouchpointModal, setShowAddTouchpointModal] = useState(false)

  // Touchpoint form
  const [tpName, setTpName] = useState('')
  const [tpSentiment, setTpSentiment] = useState('Positive')
  const [tpPainPoints, setTpPainPoints] = useState('')
  const [tpOpportunity, setTpOpportunity] = useState('')

  const stageIcons = {
    'Discovery': Compass,
    'Onboarding': UserCheck,
    'Activation': Zap,
    'Engagement': Heart,
    'Retention & Expansion': Repeat,
  }

  const activeStage = journeys.find(s => s.id === selectedStageId) || journeys[0]

  const handleAddTP = (e) => {
    e.preventDefault()
    if (!tpName.trim()) return

    addTouchpoint(activeStage.id, {
      name: tpName.trim(),
      sentiment: tpSentiment,
      painPoints: tpPainPoints.trim(),
      opportunity: tpOpportunity.trim(),
    })

    setShowAddTouchpointModal(false)
    setTpName('')
    setTpPainPoints('')
    setTpOpportunity('')
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Customer Journey Mapping</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              End-to-End Lifecycle
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Trace touchpoints, friction nodes, and conversion opportunities from Discovery to Retention
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setShowAddTouchpointModal(true)}
        >
          Add Touchpoint
        </Button>
      </div>

      {/* Stage Progression Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {journeys.map((st, idx) => {
          const Icon = stageIcons[st.name] || Route
          const isSelected = st.id === activeStage?.id
          return (
            <button
              key={st.id}
              onClick={() => setSelectedStageId(st.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-brand-50 dark:bg-brand-950/80 border-brand-500 shadow-glow-sm'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                  isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  {idx + 1}
                </span>
                <Icon className={`w-4 h-4 ${isSelected ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{st.name}</h4>
              <span className="text-[10px] text-slate-400">{st.touchpoints?.length || 0} Touchpoints</span>
            </button>
          )
        })}
      </div>

      {/* Active Stage Details */}
      {activeStage && (
        <Card className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{activeStage.name} Stage</h3>
              <p className="text-xs text-slate-400 mt-0.5">{activeStage.description}</p>
            </div>
            <Badge variant="brand">{activeStage.touchpoints?.length || 0} Touchpoints</Badge>
          </div>

          {/* Touchpoints Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(activeStage.touchpoints || []).map(tp => (
              <div
                key={tp.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{tp.name}</h4>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={tp.sentiment === 'Positive' ? 'success' : 'default'} size="xs">
                        {tp.sentiment}
                      </Badge>
                      <button
                        onClick={() => removeTouchpoint(activeStage.id, tp.id)}
                        className="p-1 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {tp.painPoints && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-2 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>Friction: {tp.painPoints}</span>
                    </div>
                  )}

                  {tp.opportunity && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-2 flex items-start gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                      <span>Opportunity: {tp.opportunity}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Touchpoint Modal */}
      <Modal
        isOpen={showAddTouchpointModal}
        onClose={() => setShowAddTouchpointModal(false)}
        title={`Add Touchpoint to ${activeStage?.name}`}
        subtitle="Map customer interactions and uncover improvement opportunities"
      >
        <form onSubmit={handleAddTP} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Touchpoint Name *
            </label>
            <input
              type="text"
              required
              value={tpName}
              onChange={e => setTpName(e.target.value)}
              placeholder="e.g. CSV Feedback Upload Wizard"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Customer Sentiment
            </label>
            <select
              value={tpSentiment}
              onChange={e => setTpSentiment(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              <option value="Positive">Positive</option>
              <option value="Neutral">Neutral</option>
              <option value="Negative">Negative</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observed Pain Point / Friction
            </label>
            <input
              type="text"
              value={tpPainPoints}
              onChange={e => setTpPainPoints(e.target.value)}
              placeholder="e.g. Column mapping errors on malformed rows"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Strategic Product Opportunity
            </label>
            <input
              type="text"
              value={tpOpportunity}
              onChange={e => setTpOpportunity(e.target.value)}
              placeholder="e.g. Add 1-click sample CSV download and auto-correction"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowAddTouchpointModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Save Touchpoint</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default CustomerJourneyPage
