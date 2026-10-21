import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import {
  BarChart3,
  Download,
  Printer,
  Filter,
  PieChart as PieIcon,
  TrendingUp,
  Smile,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react'
import { Card, Badge, Button } from '../components/common'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { exportFeedbackToCSV, exportFeaturesToCSV } from '../services/csvService'

export function ReportsPage() {
  const {
    feedback,
    features,
    prds,
    roadmap,
    experiments,
    releases,
    addToast,
  } = useApp()

  const [dateRange, setDateRange] = useState('30d')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedSentiment, setSelectedSentiment] = useState('All')

  // Filtered feedback
  const filteredFeedback = useMemo(() => {
    return feedback.filter(f => {
      if (selectedCategory !== 'All' && f.category !== selectedCategory) return false
      if (selectedSentiment !== 'All' && f.sentiment !== selectedSentiment) return false
      return true
    })
  }, [feedback, selectedCategory, selectedSentiment])

  // Category counts
  const categoryData = useMemo(() => {
    const counts = {}
    filteredFeedback.forEach(f => {
      counts[f.category] = (counts[f.category] || 0) + 1
    })
    return Object.entries(counts).map(([name, count]) => ({ name, count }))
  }, [filteredFeedback])

  // Sentiment counts
  const sentimentData = useMemo(() => {
    const pos = filteredFeedback.filter(f => f.sentiment === 'Positive').length
    const neu = filteredFeedback.filter(f => f.sentiment === 'Neutral').length
    const neg = filteredFeedback.filter(f => f.sentiment === 'Negative').length
    return [
      { name: 'Positive', value: pos, color: '#10b981' },
      { name: 'Neutral', value: neu, color: '#6366f1' },
      { name: 'Negative', value: neg, color: '#f43f5e' },
    ]
  }, [filteredFeedback])

  // Feature status counts
  const featureStatusData = useMemo(() => {
    const counts = {}
    features.forEach(f => {
      counts[f.status] = (counts[f.status] || 0) + 1
    })
    return Object.entries(counts).map(([name, count]) => ({ name, count }))
  }, [features])

  // Roadmap progress data
  const roadmapProgressData = useMemo(() => {
    return roadmap.map(r => ({
      name: r.title.slice(0, 16) + '...',
      Progress: r.progress,
    }))
  }, [roadmap])

  // Export handlers
  const handleExportFeedbackCSV = () => {
    const csv = exportFeedbackToCSV(filteredFeedback)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `feedback_report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    addToast('Exported filtered feedback report to CSV', 'success')
  }

  const handleExportFeaturesCSV = () => {
    const csv = exportFeaturesToCSV(features)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `feature_prioritization_report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    addToast('Exported feature priority report to CSV', 'success')
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Reports & Executive Analytics</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cross-module intelligence metrics, sentiment distribution, and delivery status
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" icon={FileSpreadsheet} onClick={handleExportFeedbackCSV}>
            Feedback CSV
          </Button>
          <Button variant="outline" size="sm" icon={FileSpreadsheet} onClick={handleExportFeaturesCSV}>
            Prioritization CSV
          </Button>
          <Button variant="primary" size="sm" icon={Printer} onClick={() => window.print()}>
            Print Report
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-3.5 flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Filter Reports:</span>
        </div>

        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="quarter">Current Quarter (Q4)</option>
          <option value="all">All-Time Cumulative</option>
        </select>

        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
        >
          <option value="All">All Categories</option>
          <option value="Performance">Performance</option>
          <option value="Integrations">Integrations</option>
          <option value="Usability">Usability</option>
          <option value="Reliability">Reliability</option>
          <option value="Pricing">Pricing</option>
          <option value="Feature Requests">Feature Requests</option>
          <option value="Satisfaction">Satisfaction</option>
        </select>

        <select
          value={selectedSentiment}
          onChange={e => setSelectedSentiment(e.target.value)}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
        >
          <option value="All">All Sentiments</option>
          <option value="Positive">Positive Only</option>
          <option value="Neutral">Neutral Only</option>
          <option value="Negative">Negative Only</option>
        </select>
      </Card>

      {/* Row 1: Category Distribution & Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Bar Chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Feedback Category Influx</h3>
              <p className="text-xs text-slate-400 mt-0.5">Distribution across primary product pillars</p>
            </div>
            <Badge variant="brand">{filteredFeedback.length} Items</Badge>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} width={90} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Sentiment Ratio Donut */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Sentiment Proportion</h3>
              <p className="text-xs text-slate-400 mt-0.5">Positive vs Neutral vs Negative feedback</p>
            </div>
            <Smile className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} label>
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center text-xs">
            {sentimentData.map(s => (
              <div key={s.name}>
                <span className="text-[10px] text-slate-400 block font-semibold">{s.name}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 2: Feature Status & Roadmap Delivery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Status Pipeline */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Feature Status Pipeline</h3>
              <p className="text-xs text-slate-400 mt-0.5">Active features across backlog to launched</p>
            </div>
            <Badge variant="electric">{features.length} Features</Badge>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Roadmap Progress Overview */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Roadmap Milestone Progress</h3>
              <p className="text-xs text-slate-400 mt-0.5">Completion percentage per active initiative</p>
            </div>
            <Badge variant="brand">{roadmap.length} Milestones</Badge>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roadmapProgressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Bar dataKey="Progress" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default ReportsPage
