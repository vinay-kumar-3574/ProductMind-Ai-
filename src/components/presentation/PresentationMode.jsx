import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Printer,
  Sparkles,
  BarChart3,
  TrendingUp,
  ShieldAlert,
  SlidersHorizontal,
  FileText,
  Milestone,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts'

export function PresentationMode() {
  const {
    presentationModeActive,
    setPresentationModeActive,
    feedback,
    features,
    prds,
    roadmap,
    experiments,
    releases,
  } = useApp()

  const [currentSlide, setCurrentSlide] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Keyboard navigation
  useEffect(() => {
    if (!presentationModeActive) return

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault()
        setCurrentSlide(prev => (prev < 9 ? prev + 1 : prev))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentSlide(prev => (prev > 0 ? prev - 1 : prev))
      } else if (e.key === 'Escape') {
        setPresentationModeActive(false)
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [presentationModeActive])

  if (!presentationModeActive) return null

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Live aggregated data for slides
  const totalFeedback = feedback.length
  const positiveSentiment = feedback.filter(f => f.sentiment === 'Positive').length
  const negativeSentiment = feedback.filter(f => f.sentiment === 'Negative').length
  const neutralSentiment = feedback.filter(f => f.sentiment === 'Neutral').length
  const urgentCount = feedback.filter(f => f.priority === 'Urgent').length

  const sortedFeatures = [...features].sort((a, b) => b.score - a.score)
  const topFeatures = sortedFeatures.slice(0, 5)

  const activeRelease = releases[0] || {}
  const checklist = activeRelease.checklist || []
  const completedChecks = checklist.filter(c => c.completed).length
  const totalChecks = checklist.length || 1
  const readinessPercent = Math.round((completedChecks / totalChecks) * 100)

  // Sentiment chart data
  const sentimentData = [
    { name: 'Positive', value: positiveSentiment, color: '#10b981' },
    { name: 'Neutral', value: neutralSentiment, color: '#6366f1' },
    { name: 'Negative', value: negativeSentiment, color: '#f43f5e' },
  ]

  // Priority chart data
  const priorityChartData = topFeatures.map(f => ({
    name: f.name.slice(0, 18) + '...',
    Score: f.score,
    Impact: f.customerImpact,
    Urgency: f.urgency,
    Demand: f.demand,
    Value: f.businessValue,
  }))

  const slideTitles = [
    '1. Product Overview & Vision',
    '2. Executive Dashboard Metrics',
    '3. Customer Voice & Feedback',
    '4. Critical Pain Points Matrix',
    '5. AI Strategic Insights',
    '6. Priority Rankings & Formula',
    '7. Engineering PRD Highlights',
    '8. Roadmap Timeline & Delivery',
    '9. Product Experiment Lab',
    '10. Release Readiness Governance',
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-navy-950 text-white select-none overflow-hidden animate-fadeIn">
      {/* Top Bar */}
      <header className="h-14 px-6 flex items-center justify-between border-b border-slate-800 bg-navy-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-electric-600 flex items-center justify-center text-white text-xs font-black shadow-glow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Product Mind AI • Executive Presentation</h2>
            <p className="text-[11px] text-slate-400">Product Intelligence Workspace</p>
          </div>
        </div>

        {/* Slide Counter & Indicators */}
        <div className="flex items-center gap-1.5">
          {slideTitles.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentSlide ? 'w-6 bg-brand-400' : 'w-2 bg-slate-700 hover:bg-slate-500'
              }`}
              title={slideTitles[idx]}
            />
          ))}
          <span className="text-xs font-mono text-slate-400 ml-3">
            {currentSlide + 1} / 10
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Print Slide"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setPresentationModeActive(false)}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
            title="Exit Presentation (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Slide Canvas */}
      <main className="flex-1 p-6 sm:p-12 overflow-y-auto flex flex-col items-center justify-center max-w-6xl mx-auto w-full">
        {/* Slide 1: Overview */}
        {currentSlide === 0 && (
          <div className="text-center space-y-6 animate-fadeIn">
            <span className="text-xs uppercase font-extrabold tracking-widest px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
              Executive Briefing Deck
            </span>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white">
              Product Mind <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-electric-400">AI</span>
            </h1>
            <p className="text-xl sm:text-2xl font-medium text-slate-300">
              Product Intelligence Workspace
            </p>
            <div className="max-w-2xl mx-auto text-sm text-slate-400 leading-relaxed pt-4 border-t border-slate-800">
              A comprehensive system translating qualitative customer friction into mathematically ranked feature priorities, 13-section engineering PRDs, roadmap planning, and release governance.
            </div>
          </div>
        )}

        {/* Slide 2: Dashboard KPIs */}
        {currentSlide === 1 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-2">Executive Dashboard & Core Metrics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800">
                <p className="text-xs text-slate-400">Total Verified Feedback</p>
                <p className="text-3xl font-extrabold text-white mt-1">{totalFeedback}</p>
                <span className="text-xs text-emerald-400">+14% vs last cycle</span>
              </div>
              <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800">
                <p className="text-xs text-slate-400">Active Prioritized Features</p>
                <p className="text-3xl font-extrabold text-brand-400 mt-1">{features.length}</p>
                <span className="text-xs text-slate-400">Ranked by 4-factor formula</span>
              </div>
              <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800">
                <p className="text-xs text-slate-400">Generated PRDs</p>
                <p className="text-3xl font-extrabold text-electric-400 mt-1">{prds.length}</p>
                <span className="text-xs text-slate-400">13-section specs</span>
              </div>
              <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800">
                <p className="text-xs text-slate-400">Customer CSAT</p>
                <p className="text-3xl font-extrabold text-amber-400 mt-1">4.2 / 5.0</p>
                <span className="text-xs text-emerald-400">Trending positive</span>
              </div>
              <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800">
                <p className="text-xs text-slate-400">High-Urgency Requests</p>
                <p className="text-3xl font-extrabold text-rose-400 mt-1">{urgentCount}</p>
                <span className="text-xs text-rose-400">Immediate triage priority</span>
              </div>
              <div className="p-5 rounded-2xl bg-navy-900 border border-slate-800">
                <p className="text-xs text-slate-400">Release Target</p>
                <p className="text-3xl font-extrabold text-emerald-400 mt-1">{activeRelease.version || 'v2.4.0'}</p>
                <span className="text-xs text-slate-400">{readinessPercent}% checklist pass</span>
              </div>
            </div>
          </div>
        )}

        {/* Slide 3: Customer Feedback */}
        {currentSlide === 2 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-2">Customer Voice & Sentiment Intelligence</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-navy-900 border border-emerald-500/30">
                  <span className="text-xs font-bold text-emerald-400">Positive Drivers</span>
                  <p className="text-xs text-slate-300 mt-1">AI Smart Tagging, Executive Presentation Mode, and What-If trade-off simulation.</p>
                </div>
                <div className="p-4 rounded-xl bg-navy-900 border border-rose-500/30">
                  <span className="text-xs font-bold text-rose-400">Negative Drivers</span>
                  <p className="text-xs text-slate-300 mt-1">Table latency on 5k+ records, PRD draft loss fears, and viewer seat limits.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Slide 4: Pain Points */}
        {currentSlide === 3 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-2">Critical Customer Pain Points</h2>
            <div className="space-y-3">
              {feedback.filter(f => f.sentiment === 'Negative').slice(0, 4).map(item => (
                <div key={item.id} className="p-4 rounded-xl bg-navy-900 border border-slate-800 flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                    <span className="inline-block text-[10px] text-slate-500 mt-2 font-mono">
                      Reported by {item.customer} • {item.company}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                    {item.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slide 5: AI Insights */}
        {currentSlide === 4 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-2">Simulated AI Strategic Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-navy-900 border border-rose-500/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Urgent Platform Risk</span>
                <h4 className="text-sm font-bold text-white mt-1">High-Urgency Performance Cluster</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  5,000+ row customer feedback sets trigger noticeable UI latency. Recommended: High-Performance Virtualized Grid.
                </p>
              </div>
              <div className="p-5 rounded-xl bg-navy-900 border border-brand-500/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Integration Opportunity</span>
                <h4 className="text-sm font-bold text-white mt-1">Bi-directional Jira & Linear Sync</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  High customer demand to push generated user stories directly to engineering tickets without manual copy-pasting.
                </p>
              </div>
              <div className="p-5 rounded-xl bg-navy-900 border border-emerald-500/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Delight Driver</span>
                <h4 className="text-sm font-bold text-white mt-1">AI Smart Tagging & Triage Savings</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Teams report saving 8 hours weekly on manual categorization and deduplication.
                </p>
              </div>
              <div className="p-5 rounded-xl bg-navy-900 border border-amber-500/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Governance Gate</span>
                <h4 className="text-sm font-bold text-white mt-1">Automated Release Quality Gating</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Enforce strict checklist verification before shipping release v2.4.0 to enterprise customers.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Slide 6: Priority Rankings */}
        {currentSlide === 5 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-bold text-white">Algorithmic Feature Prioritization</h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Priority Score = (0.35 × Impact) + (0.30 × Urgency) + (0.20 × Demand) + (0.15 × Business Value)
              </p>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  <Bar dataKey="Score" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Slide 7: PRD Highlights */}
        {currentSlide === 6 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-2">PRD Generator & Engineering Specifications</h2>
            <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-brand-300">High-Performance Virtual Grid Architecture</h3>
                <span className="text-xs font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">v1.2.0 • Signed Off</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Standard 13-section documentation generated with zero manual boilerplates. Defines row windowing, Web Worker multi-column search pipelines, accessibility roles, and sub-16ms frame render targets.
              </p>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Target Users</span>
                  <span className="text-slate-200 font-medium">ProdOps & Lead PMs</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Success Metric</span>
                  <span className="text-slate-200 font-medium">&lt;200ms on 20k rows</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Release Target</span>
                  <span className="text-slate-200 font-medium">v2.4.0 Spring</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Slide 8: Roadmap */}
        {currentSlide === 7 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-2">Execution Roadmap & Milestone Delivery</h2>
            <div className="space-y-3">
              {roadmap.slice(0, 4).map(item => (
                <div key={item.id} className="p-4 rounded-xl bg-navy-900 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-white">{item.title}</span>
                    <span className="font-mono text-brand-400">{item.progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-electric-500 rounded-full" style={{ width: `${item.progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <span>{item.milestone}</span>
                    <span>Target: {item.targetDate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slide 9: Experiment Results */}
        {currentSlide === 8 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-2">Product Experimentation Lab</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {experiments.map(exp => (
                <div key={exp.id} className="p-5 rounded-2xl bg-navy-900 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">{exp.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/20 text-brand-300">
                      {exp.conclusion}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mb-3">{exp.hypothesis}</p>
                  <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-2 font-mono">
                    <span className="text-slate-400">Baseline: {exp.baseline}%</span>
                    <span className="text-emerald-400 font-bold">Observed: {exp.observedValue}%</span>
                    <span className="text-slate-400">Target: {exp.target}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slide 10: Release Readiness */}
        {currentSlide === 9 && (
          <div className="w-full space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-2">Release Readiness Governance</h2>
            <div className="p-6 rounded-2xl bg-navy-900 border border-slate-800">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">{activeRelease.name}</h3>
                  <p className="text-xs text-slate-400">Version {activeRelease.version} • Target: {activeRelease.plannedDate}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${readinessPercent >= 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {readinessPercent >= 100 ? 'GO: Ready to Ship' : 'NO-GO: Checklist Incomplete'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">{completedChecks} of {totalChecks} checks complete ({readinessPercent}%)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
                {checklist.map(c => (
                  <div key={c.id} className="flex items-center gap-2.5 text-xs text-slate-300">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${c.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {c.completed ? '✓' : '✗'}
                    </div>
                    <span className={c.completed ? 'line-through opacity-70' : 'font-semibold text-white'}>{c.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation Controls */}
      <footer className="h-14 px-6 flex items-center justify-between border-t border-slate-800 bg-navy-900/60 backdrop-blur-md">
        <button
          onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
          disabled={currentSlide === 0}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Slide</span>
        </button>

        <span className="text-xs text-slate-500 hidden sm:inline">
          Use ← / → Arrow keys or Space to advance
        </span>

        <button
          onClick={() => setCurrentSlide(prev => Math.min(9, prev + 1))}
          disabled={currentSlide === 9}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
        >
          <span>Next Slide</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  )
}
