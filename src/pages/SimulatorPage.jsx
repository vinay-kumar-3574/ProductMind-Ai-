import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import {
  GitCompare,
  Plus,
  Save,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Download,
  Trash2,
  Copy,
  Sliders,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { Card, Badge, Button, Modal } from '../components/common'
import { calculatePriorityScore, getScoreBreakdown } from '../data/scoringFormulas'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'

export function SimulatorPage() {
  const {
    features,
    scenarios,
    createScenario,
    updateScenario,
    deleteScenario,
    updateFeature,
    addToast,
  } = useApp()

  // Active scenario ID
  const [activeScenarioId, setActiveScenarioId] = useState(() => scenarios[0]?.id || '')

  // Working scenario feature adjustments: map of featureId -> { customerImpact, urgency, demand, businessValue }
  const [adjustments, setAdjustments] = useState(() => {
    const sc = scenarios[0]
    if (sc && sc.adjustedFeatures) {
      const map = {}
      sc.adjustedFeatures.forEach(a => {
        map[a.featureId] = { ...a }
      })
      return map
    }
    return {}
  })

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newScenarioName, setNewScenarioName] = useState('')
  const [newScenarioDesc, setNewScenarioDesc] = useState('')
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)

  // Current active scenario object
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0]

  // Switch scenario
  const handleSelectScenario = (scenId) => {
    setActiveScenarioId(scenId)
    const target = scenarios.find(s => s.id === scenId)
    if (target && target.adjustedFeatures) {
      const map = {}
      target.adjustedFeatures.forEach(a => {
        map[a.featureId] = { ...a }
      })
      setAdjustments(map)
    } else {
      setAdjustments({})
    }
  }

  // Update adjustment slider for a feature
  const handleAdjustFactor = (featId, factor, val) => {
    setAdjustments(prev => {
      const current = prev[featId] || {
        featureId: featId,
        customerImpact: features.find(f => f.id === featId)?.customerImpact || 7,
        urgency: features.find(f => f.id === featId)?.urgency || 7,
        demand: features.find(f => f.id === featId)?.demand || 7,
        businessValue: features.find(f => f.id === featId)?.businessValue || 7,
      }
      return {
        ...prev,
        [featId]: {
          ...current,
          [factor]: Number(val),
        },
      }
    })
  }

  // Compute comparison calculations: Original vs Scenario
  const comparisonResults = useMemo(() => {
    // 1. Calculate original rankings
    const originalRanked = [...features].sort((a, b) => b.score - a.score)
    const originalRankMap = {}
    originalRanked.forEach((f, idx) => {
      originalRankMap[f.id] = idx + 1
    })

    // 2. Calculate scenario scores & rankings
    const scenarioList = features.map(f => {
      const adj = adjustments[f.id]
      const simImpact = adj ? adj.customerImpact : f.customerImpact
      const simUrgency = adj ? adj.urgency : f.urgency
      const simDemand = adj ? adj.demand : f.demand
      const simValue = adj ? adj.businessValue : f.businessValue

      const scenarioScore = calculatePriorityScore({
        customerImpact: simImpact,
        urgency: simUrgency,
        demand: simDemand,
        businessValue: simValue,
      })

      return {
        ...f,
        simImpact,
        simUrgency,
        simDemand,
        simValue,
        scenarioScore,
        originalScore: f.score,
        scoreDelta: Math.round((scenarioScore - f.score) * 100) / 100,
        originalRank: originalRankMap[f.id],
      }
    })

    const scenarioRanked = [...scenarioList].sort((a, b) => b.scenarioScore - a.scenarioScore)
    return scenarioRanked.map((item, idx) => {
      const scenarioRank = idx + 1
      const rankDelta = item.originalRank - scenarioRank // positive means rank improved (e.g. 3 - 1 = +2)
      return {
        ...item,
        scenarioRank,
        rankDelta,
      }
    })
  }, [features, adjustments])

  // Save current adjustments to active scenario
  const handleSaveScenario = () => {
    if (!activeScenario) return
    const adjustedFeaturesArray = Object.values(adjustments)
    updateScenario(activeScenario.id, { adjustedFeatures: adjustedFeaturesArray })
    addToast(`Saved scenario "${activeScenario.name}"`, 'success')
  }

  // Create new scenario
  const handleCreateNew = (e) => {
    e.preventDefault()
    if (!newScenarioName.trim()) return

    const newScen = createScenario({
      name: newScenarioName.trim(),
      description: newScenarioDesc.trim(),
      adjustedFeatures: Object.values(adjustments),
    })

    setActiveScenarioId(newScen.id)
    setShowCreateModal(false)
    setNewScenarioName('')
    setNewScenarioDesc('')
  }

  // Duplicate scenario
  const handleDuplicate = () => {
    if (!activeScenario) return
    const dup = createScenario({
      name: `${activeScenario.name} (Copy)`,
      description: activeScenario.description,
      adjustedFeatures: activeScenario.adjustedFeatures || [],
    })
    setActiveScenarioId(dup.id)
  }

  // Reset sliders to original features
  const handleResetAdjustments = () => {
    setAdjustments({})
    addToast('Sliders reset to original baseline scores', 'info')
  }

  // Apply scenario to live matrix (with explicit confirmation)
  const handleApplyToLive = () => {
    comparisonResults.forEach(item => {
      if (adjustments[item.id]) {
        updateFeature(item.id, {
          customerImpact: item.simImpact,
          urgency: item.simUrgency,
          demand: item.simDemand,
          businessValue: item.simValue,
        })
      }
    })
    setShowApplyConfirm(false)
    addToast('Scenario scores applied to primary prioritization matrix', 'success')
  }

  // Recharts before-and-after comparison chart data
  const chartData = comparisonResults.slice(0, 6).map(item => ({
    name: item.name.slice(0, 14) + '...',
    'Original Score': item.originalScore,
    'Scenario Score': item.scenarioScore,
  }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">What-If Product Simulator</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-electric-500/10 text-electric-600 dark:text-electric-400 border border-electric-500/20">
              Sandbox Mode
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Safely test hypothetical resource shifts and rank changes without modifying production feature scores
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" icon={RotateCcw} onClick={handleResetAdjustments}>
            Reset Sliders
          </Button>
          <Button variant="outline" size="sm" icon={Copy} onClick={handleDuplicate}>
            Duplicate
          </Button>
          <Button variant="secondary" size="sm" icon={Save} onClick={handleSaveScenario}>
            Save Scenario
          </Button>
          <Button
            variant="electric"
            size="sm"
            onClick={() => setShowApplyConfirm(true)}
          >
            Apply to Live
          </Button>
        </div>
      </div>

      {/* Scenario Selector Bar */}
      <Card className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 shrink-0">Active Scenario:</span>
          <select
            value={activeScenarioId}
            onChange={e => handleSelectScenario(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
          >
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Button variant="ghost" size="xs" icon={Plus} onClick={() => setShowCreateModal(true)}>
            New
          </Button>
        </div>

        {activeScenario && (
          <p className="text-xs text-slate-400 italic truncate max-w-md">
            {activeScenario.description || 'Custom sandbox simulation'}
          </p>
        )}
      </Card>

      {/* Before and After Visual Comparison Chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Before vs. After Priority Score Trade-Offs
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live side-by-side comparison of Top initiatives based on adjusted factors
            </p>
          </div>
          <Badge variant="brand">Formulaic Comparison</Badge>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Original Score" fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Scenario Score" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Comparison Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Adjust Factors & Inspect Rank Shifts ({comparisonResults.length} Features)
        </h3>

        <div className="grid grid-cols-1 gap-3">
          {comparisonResults.map(feat => {
            const isRankUp = feat.rankDelta > 0
            const isRankDown = feat.rankDelta < 0
            const isScoreUp = feat.scoreDelta > 0

            return (
              <Card key={feat.id} className="p-4" hover>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Rank & Title */}
                  <div className="flex items-start gap-3 min-w-[280px]">
                    {/* Rank pill */}
                    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 min-w-[56px] text-center">
                      <span className="text-sm font-black text-brand-600 dark:text-brand-400">
                        #{feat.scenarioRank}
                      </span>
                      {feat.rankDelta !== 0 ? (
                        <span className={`text-[10px] font-bold flex items-center ${isRankUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isRankUp ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                          {isRankUp ? `+${feat.rankDelta}` : feat.rankDelta}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">No shift</span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {feat.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{feat.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className="text-slate-400">Original Rank: #{feat.originalRank}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-400">Orig Score: {feat.originalScore.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Factor Sliders */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 px-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>Impact (35%)</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{feat.simImpact}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={feat.simImpact}
                        onChange={e => handleAdjustFactor(feat.id, 'customerImpact', e.target.value)}
                        className="w-full accent-brand-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>Urgency (30%)</span>
                        <span className="font-bold text-rose-500">{feat.simUrgency}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={feat.simUrgency}
                        onChange={e => handleAdjustFactor(feat.id, 'urgency', e.target.value)}
                        className="w-full accent-rose-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>Demand (20%)</span>
                        <span className="font-bold text-electric-500">{feat.simDemand}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={feat.simDemand}
                        onChange={e => handleAdjustFactor(feat.id, 'demand', e.target.value)}
                        className="w-full accent-electric-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>Value (15%)</span>
                        <span className="font-bold text-amber-500">{feat.simValue}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={feat.simValue}
                        onChange={e => handleAdjustFactor(feat.id, 'businessValue', e.target.value)}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Right: Simulated Score & Delta */}
                  <div className="text-right shrink-0 min-w-[90px] border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100 dark:border-slate-800">
                    <span className="text-lg font-black text-brand-600 dark:text-brand-400 block font-mono">
                      {feat.scenarioScore.toFixed(2)}
                    </span>
                    <span className={`text-[10px] font-bold ${isScoreUp ? 'text-emerald-500' : feat.scoreDelta < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                      {feat.scoreDelta > 0 ? `+${feat.scoreDelta.toFixed(2)}` : feat.scoreDelta.toFixed(2)} pts
                    </span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Create New Scenario Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create What-If Scenario"
        subtitle="Save current slider values as an isolated comparison scenario"
      >
        <form onSubmit={handleCreateNew} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Scenario Name *
            </label>
            <input
              type="text"
              required
              value={newScenarioName}
              onChange={e => setNewScenarioName(e.target.value)}
              placeholder="e.g. Q4 Mobile Acceleration vs Enterprise Focus"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Hypothesis / Description
            </label>
            <textarea
              rows={2}
              value={newScenarioDesc}
              onChange={e => setNewScenarioDesc(e.target.value)}
              placeholder="Describe strategic assumption and expected trade-offs..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Create Scenario</Button>
          </div>
        </form>
      </Modal>

      {/* Apply to Live Confirmation Dialog */}
      <Modal
        isOpen={showApplyConfirm}
        onClose={() => setShowApplyConfirm(false)}
        title="Apply Scenario Scores to Live Prioritization?"
        subtitle="This will update the baseline weights of features in your production matrix"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Permanent Matrix Overwrite</p>
              <p className="mt-0.5 leading-relaxed">
                Applying will replace existing factor weights on features with current scenario values. You can still use Activity History to undo if needed.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowApplyConfirm(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleApplyToLive}>
              Yes, Apply Scores
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SimulatorPage
