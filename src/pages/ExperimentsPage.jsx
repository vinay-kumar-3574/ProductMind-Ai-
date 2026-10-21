import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  FlaskConical,
  Plus,
  Play,
  Pause,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Edit2,
  Trash2,
  Target,
  Sparkles,
  Link as LinkIcon,
} from 'lucide-react'
import { Card, Badge, Button, Modal } from '../components/common'

export function ExperimentsPage() {
  const {
    experiments,
    features,
    addExperiment,
    updateExperiment,
    deleteExperiment,
    addToast,
  } = useApp()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingExp, setEditingExp] = useState(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formProblem, setFormProblem] = useState('')
  const [formHypothesis, setFormHypothesis] = useState('')
  const [formAudience, setFormAudience] = useState('All workspace users')
  const [formChange, setFormChange] = useState('')
  const [formMetric, setFormMetric] = useState('Activation Rate (%)')
  const [formBaseline, setFormBaseline] = useState(25)
  const [formTarget, setFormTarget] = useState(45)
  const [formObserved, setFormObserved] = useState(30)
  const [formStatus, setFormStatus] = useState('Running')
  const [formConclusion, setFormConclusion] = useState('Continue')
  const [formFeatureId, setFormFeatureId] = useState('')

  const statuses = ['Draft', 'Planned', 'Running', 'Completed', 'Paused', 'Cancelled']
  const conclusions = ['Continue', 'Iterate', 'Roll Out', 'Stop']

  // Summary counts
  const total = experiments.length
  const running = experiments.filter(e => e.status === 'Running').length
  const completed = experiments.filter(e => e.status === 'Completed').length
  const rolledOut = experiments.filter(e => e.conclusion === 'Roll Out').length

  const handleOpenCreate = () => {
    setEditingExp(null)
    setFormName('')
    setFormProblem('')
    setFormHypothesis('')
    setFormAudience('All workspace users')
    setFormChange('')
    setFormMetric('Activation Rate (%)')
    setFormBaseline(25)
    setFormTarget(45)
    setFormObserved(30)
    setFormStatus('Running')
    setFormConclusion('Continue')
    setFormFeatureId(features[0]?.id || '')
    setShowCreateModal(true)
  }

  const handleOpenEdit = (exp) => {
    setEditingExp(exp)
    setFormName(exp.name)
    setFormProblem(exp.problem)
    setFormHypothesis(exp.hypothesis)
    setFormAudience(exp.targetAudience)
    setFormChange(exp.proposedChange)
    setFormMetric(exp.successMetric)
    setFormBaseline(exp.baseline)
    setFormTarget(exp.target)
    setFormObserved(exp.observedValue)
    setFormStatus(exp.status)
    setFormConclusion(exp.conclusion)
    setFormFeatureId(exp.linkedFeatureId || '')
    setShowCreateModal(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!formName.trim()) return

    const payload = {
      name: formName.trim(),
      problem: formProblem,
      hypothesis: formHypothesis,
      targetAudience: formAudience,
      proposedChange: formChange,
      successMetric: formMetric,
      baseline: Number(formBaseline),
      target: Number(formTarget),
      observedValue: Number(formObserved),
      status: formStatus,
      conclusion: formConclusion,
      linkedFeatureId: formFeatureId || null,
    }

    if (editingExp) {
      updateExperiment(editingExp.id, payload)
    } else {
      addExperiment(payload)
    }

    setShowCreateModal(false)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Product Experiment Lab</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              Hypothesis Validation
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Test product hypotheses against baseline metrics before committing full engineering roadmaps
          </p>
        </div>

        <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreate}>
          New Experiment
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="text-xs text-slate-400">Total Experiments</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{total}</p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-brand-600 dark:text-brand-400">Currently Running</span>
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-1">{running}</p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Successfully Rolled Out</span>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{rolledOut}</p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-slate-400">Completed Lifecycle</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{completed}</p>
        </Card>
      </div>

      {/* Experiments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {experiments.map(exp => {
          const linkedFeat = features.find(f => f.id === exp.linkedFeatureId)
          const achievementPercent = Math.round(
            ((exp.observedValue - exp.baseline) / ((exp.target - exp.baseline) || 1)) * 100
          )
          const isWin = exp.observedValue >= exp.target

          return (
            <Card key={exp.id} className="p-5 flex flex-col justify-between" hover>
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <Badge variant={exp.status === 'Running' ? 'electric' : exp.status === 'Completed' ? 'success' : 'default'} size="xs">
                      {exp.status}
                    </Badge>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{exp.name}</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => handleOpenEdit(exp)} className="p-1 text-slate-400 hover:text-white">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteExperiment(exp.id)} className="p-1 text-slate-400 hover:text-rose-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  {exp.hypothesis}
                </p>

                {/* Metric comparisons */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Metric: {exp.successMetric}</span>
                    <span className={`font-bold font-mono ${isWin ? 'text-emerald-500' : 'text-brand-500'}`}>
                      Observed: {exp.observedValue}%
                    </span>
                  </div>

                  {/* Visual delta */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                    <div>
                      <span className="text-slate-400 block">Baseline</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{exp.baseline}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Target</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{exp.target}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Status</span>
                      <span className="font-bold text-emerald-500">{exp.conclusion}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Owner: {exp.owner}</span>
                {linkedFeat && (
                  <span className="font-semibold text-brand-500 truncate max-w-[160px]">
                    Linked: {linkedFeat.name}
                  </span>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingExp ? 'Edit Product Experiment' : 'Launch New Experiment'}
        subtitle="Frame hypothesis, configure baseline/target metrics, and link to roadmap"
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Experiment Name *</label>
            <input
              type="text"
              required
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="e.g. 1-Click Guided Onboarding Adoption"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Hypothesis</label>
            <textarea
              rows={2}
              value={formHypothesis}
              onChange={e => setFormHypothesis(e.target.value)}
              placeholder="If we [change], then [metric] will improve because [reason]..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Baseline (%)</label>
              <input
                type="number"
                value={formBaseline}
                onChange={e => setFormBaseline(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Observed (%)</label>
              <input
                type="number"
                value={formObserved}
                onChange={e => setFormObserved(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target (%)</label>
              <input
                type="number"
                value={formTarget}
                onChange={e => setFormTarget(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {statuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Conclusion</label>
              <select
                value={formConclusion}
                onChange={e => setFormConclusion(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {conclusions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Save Experiment</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default ExperimentsPage
