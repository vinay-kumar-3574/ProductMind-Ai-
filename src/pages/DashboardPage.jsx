import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import {
  MessageSquareText,
  SlidersHorizontal,
  FileText,
  Milestone,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Smile,
  ShieldCheck,
  PlusCircle,
  PlayCircle,
  Presentation,
  ArrowUpRight,
  ChevronDown,
  Sliders,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { Card, Badge, Button, Modal } from '../components/common'

export function DashboardPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const {
    feedback,
    features,
    prds,
    roadmap,
    experiments,
    releases,
    history,
    startRecruiterDemo,
    setPresentationModeActive,
    dashboardLayout,
    setDashboardLayout,
  } = useApp()

  const [timeRange, setTimeRange] = useState('30d')
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)

  // Dynamic greeting
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Aggregated KPIs
  const totalFeedbackCount = feedback.length
  const activeFeaturesCount = features.filter(f => f.status === 'In Planning' || f.status === 'In Development').length
  const plannedFeaturesCount = features.filter(f => f.status === 'Backlog' || f.status === 'Evaluating').length
  const positiveSentiment = feedback.filter(f => f.sentiment === 'Positive').length
  const negativeSentiment = feedback.filter(f => f.sentiment === 'Negative').length
  const neutralSentiment = feedback.filter(f => f.sentiment === 'Neutral').length
  const avgCSAT = totalFeedbackCount > 0
    ? (((positiveSentiment * 5 + neutralSentiment * 3 + negativeSentiment * 1) / (totalFeedbackCount * 5)) * 5).toFixed(1)
    : '4.2'
  const urgentRequestsCount = feedback.filter(f => f.priority === 'Urgent').length
  const prdCount = prds.length

  // Chart data: Feedback volume over time
  const feedbackVolumeData = [
    { date: 'Oct 01', Volume: 4, Urgent: 1 },
    { date: 'Oct 05', Volume: 7, Urgent: 2 },
    { date: 'Oct 09', Volume: 5, Urgent: 1 },
    { date: 'Oct 13', Volume: 9, Urgent: 3 },
    { date: 'Oct 17', Volume: 12, Urgent: 4 },
    { date: 'Oct 21', Volume: 8, Urgent: 2 },
  ]

  // Chart data: Category breakdown
  const categoryCounts = {}
  feedback.forEach(f => {
    categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1
  })
  const categoryChartData = Object.entries(categoryCounts).map(([name, count]) => ({
    name,
    count,
  }))

  const CATEGORY_COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#6366f1', '#ec4899']

  // Chart data: Sentiment
  const sentimentData = [
    { name: 'Positive', value: positiveSentiment, color: '#10b981' },
    { name: 'Neutral', value: neutralSentiment, color: '#6366f1' },
    { name: 'Negative', value: negativeSentiment, color: '#f43f5e' },
  ]

  // Top customer pain points
  const customerPainPoints = feedback.filter(f => f.sentiment === 'Negative').slice(0, 4)

  // Top features sorted by priority score
  const sortedFeatures = [...features].sort((a, b) => b.score - a.score).slice(0, 4)

  // Active release candidate
  const activeRelease = releases[0] || {}
  const checklist = activeRelease.checklist || []
  const completedChecks = checklist.filter(c => c.completed).length
  const readinessPercent = Math.round((completedChecks / (checklist.length || 1)) * 100)

  // Reorder layout helper
  const moveWidget = (index, direction) => {
    const newLayout = [...dashboardLayout]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= newLayout.length) return
    const temp = newLayout[index]
    newLayout[index] = newLayout[targetIndex]
    newLayout[targetIndex] = temp
    setDashboardLayout(newLayout)
  }

  const toggleWidgetVisibility = (id) => {
    setDashboardLayout(prev => prev.map(w => (w.id === id ? { ...w, visible: !w.visible } : w)))
  }

  const isVisible = (id) => {
    const w = dashboardLayout.find(item => item.id === id)
    return w ? w.visible : true
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {getGreeting()}, {currentUser?.name || 'Product Architect'}
            </h2>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              Live Workspace
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {currentDateFormatted} • Workspace: <strong className="text-slate-700 dark:text-slate-300">{currentUser?.workspaceName}</strong>
          </p>
        </div>

        {/* Header Actions & Time Selector */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Time range selector */}
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="quarter">Current Quarter (Q4)</option>
            <option value="all">All-Time Cumulative</option>
          </select>

          {/* Quick Action: Customize Dashboard */}
          <button
            onClick={() => setShowCustomizeModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title="Reorder and customize widgets"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Customize</span>
          </button>

          {/* Quick Action: Recruiter Demo */}
          <button
            onClick={() => startRecruiterDemo(0)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/80 border border-brand-300/60 dark:border-brand-700/60 text-brand-700 dark:text-brand-300 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <PlayCircle className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>Recruiter Demo</span>
          </button>

          {/* Quick Action: Presentation Mode */}
          <button
            onClick={() => setPresentationModeActive(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-electric-600 hover:from-brand-500 hover:to-electric-500 text-white text-xs font-bold shadow-md hover:shadow-glow-sm transition-all cursor-pointer"
          >
            <Presentation className="w-3.5 h-3.5" />
            <span>Present Slides</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (6 Required) */}
      {isVisible('kpis') && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {/* 1. Total Feedback */}
          <Card className="p-4" hover>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Feedback</span>
              <MessageSquareText className="w-4 h-4 text-brand-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{totalFeedbackCount}</span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" /> +18%
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">From verified accounts</p>
          </Card>

          {/* 2. Active Features */}
          <Card className="p-4" hover>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Active Features</span>
              <SlidersHorizontal className="w-4 h-4 text-electric-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{activeFeaturesCount}</span>
              <span className="text-[11px] font-semibold text-electric-600 dark:text-electric-400">In Sprint</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Dev & planning stages</p>
          </Card>

          {/* 3. Planned Features */}
          <Card className="p-4" hover>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Planned Features</span>
              <Milestone className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{plannedFeaturesCount}</span>
              <span className="text-[11px] text-slate-400">Backlog queue</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Pending prioritization</p>
          </Card>

          {/* 4. Average CSAT */}
          <Card className="p-4" hover>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Avg Satisfaction</span>
              <Smile className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{avgCSAT}</span>
              <span className="text-[11px] text-slate-400">/ 5.0</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Derived from sentiment</p>
          </Card>

          {/* 5. High-Priority Requests */}
          <Card className="p-4" hover>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Urgent Requests</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{urgentRequestsCount}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                Action Req.
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Retention risk blockers</p>
          </Card>

          {/* 6. PRDs Generated */}
          <Card className="p-4" hover>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">PRDs Generated</span>
              <FileText className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{prdCount}</span>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">13 Sections</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Engineering-ready specs</p>
          </Card>
        </div>
      )}

      {/* Row 2: Charts (Feedback Volume & Sentiment) */}
      {isVisible('feedbackTrends') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Feedback Volume Area Chart */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Feedback Influx & Urgency Trend</h3>
                <p className="text-xs text-slate-400 mt-0.5">Daily volume vs critical urgent escalations</p>
              </div>
              <Badge variant="brand">Last 30 Days</Badge>
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={feedbackVolumeData}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="urgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="Volume" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#volGrad)" />
                  <Area type="monotone" dataKey="Urgent" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#urgGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Sentiment Distribution Donut Chart */}
          <Card className="p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sentiment Ratio</h3>
              <Smile className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4}>
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center text-xs">
              <div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">Positive</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{positiveSentiment}</span>
              </div>
              <div>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold block">Neutral</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{neutralSentiment}</span>
              </div>
              <div>
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold block">Negative</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{negativeSentiment}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Row 3: Feature Prioritization & Release Readiness */}
      {isVisible('priorityMatrix') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Feature Requests by Score */}
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Top Priority Feature Requests
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calculated: 0.35×Impact + 0.30×Urgency + 0.20×Demand + 0.15×Value
                </p>
              </div>
              <Link to="/prioritization" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">
                <span>View Matrix</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {sortedFeatures.map((feat, idx) => (
                <div
                  key={feat.id}
                  onClick={() => navigate('/prioritization')}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4 hover:border-brand-500/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                        {feat.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {feat.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="text-xs font-black text-brand-600 dark:text-brand-400 block">
                        {feat.score.toFixed(2)} / 10
                      </span>
                      <span className="text-[10px] text-slate-400">{feat.status}</span>
                    </div>
                    <Badge variant={feat.status === 'Ready for Release' ? 'success' : feat.status === 'In Development' ? 'brand' : 'default'}>
                      {feat.targetRelease}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Release Readiness Radar */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Release Gate</h3>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-xs text-slate-400 mb-4">{activeRelease.name} ({activeRelease.version})</p>

              {/* Progress bar */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Readiness Score</span>
                  <span className="font-bold text-brand-600 dark:text-brand-400">{readinessPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-electric-500 rounded-full transition-all duration-500"
                    style={{ width: `${readinessPercent}%` }}
                  />
                </div>
              </div>

              {/* Quality Checklist summary */}
              <div className="space-y-2">
                {checklist.slice(0, 3).map(check => (
                  <div key={check.id} className="flex items-center gap-2 text-xs">
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${check.completed ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                      {check.completed ? '✓' : ''}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 line-clamp-1">{check.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to="/release-readiness"
              className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center justify-between"
            >
              <span>View Release Checklist</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </Card>
        </div>
      )}

      {/* Row 4: Customer Pain Points & AI Insights */}
      {isVisible('painPoints') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Pain Points */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Pain Points Matrix</h3>
                <p className="text-xs text-slate-400 mt-0.5">Urgent qualitative friction points</p>
              </div>
              <Link to="/feedback" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                Explore All
              </Link>
            </div>

            <div className="space-y-2.5">
              {customerPainPoints.map(item => (
                <div
                  key={item.id}
                  onClick={() => navigate('/feedback')}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{item.title}</h4>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                      {item.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">{item.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                    <span>{item.customer} ({item.company})</span>
                    <span>•</span>
                    <span className="text-brand-500">{item.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* AI Insights Feed */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Simulated AI Insights Feed</h3>
              </div>
              <Link to="/insights" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                Analyze More
              </Link>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200/60 dark:border-brand-800/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                  Performance Spike
                </span>
                <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1">
                  High customer churn risk on large dataset rendering
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  FinTech Dynamics and 3 other enterprise accounts reported lag. Advance Virtualized Grid PRD into sprint.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-sky-50/50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Workflow Velocity
                </span>
                <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1">
                  Bi-directional Jira & Linear integration demand rising
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Engineers spending 4 hours weekly transcribing PRDs. Webhook sync prioritized at 8.70 score.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Customize Dashboard Modal */}
      <Modal
        isOpen={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        title="Customize Dashboard Layout"
        subtitle="Show, hide, and reorder widgets to tailor your workspace"
      >
        <div className="space-y-2">
          {dashboardLayout.map((widget, index) => (
            <div
              key={widget.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleWidgetVisibility(widget.id)}
                  className={`p-1 rounded-md ${widget.visible ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}
                  title={widget.visible ? 'Hide widget' : 'Show widget'}
                >
                  {widget.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <span className={`text-xs font-semibold ${widget.visible ? 'text-slate-900 dark:text-white' : 'text-slate-400 line-through'}`}>
                  {widget.title}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveWidget(index, -1)}
                  disabled={index === 0}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                  title="Move Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moveWidget(index, 1)}
                  disabled={index === dashboardLayout.length - 1}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                  title="Move Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <Button onClick={() => setShowCustomizeModal(false)}>Done</Button>
        </div>
      </Modal>
    </div>
  )
}

export default DashboardPage
