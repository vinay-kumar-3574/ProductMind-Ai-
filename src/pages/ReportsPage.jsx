import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useWorkspace } from '../context/WorkspaceContext'
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
  FileJson,
  Bookmark,
  Star,
  Trash2,
  Plus,
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'
import { Card, Badge, Button, Modal } from '../components/common'
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
import { reportingService } from '../services/api/reportingService'

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

  const { currentWorkspace } = useWorkspace()

  const [dateRange, setDateRange] = useState('30d')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedSentiment, setSelectedSentiment] = useState('All')

  // Live Atlas Intelligence State
  const [executiveSummary, setExecutiveSummary] = useState(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)

  // Saved Reports State
  const [savedReports, setSavedReports] = useState([])
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newReportTitle, setNewReportTitle] = useState('')
  const [newReportType, setNewReportType] = useState('executive_kpi')
  const [isExporting, setIsExporting] = useState(false)

  // Fetch Executive Summary
  const loadExecutiveSummary = async () => {
    if (!currentWorkspace?.id) return
    setIsLoadingSummary(true)
    try {
      const data = await reportingService.getExecutiveSummary({
        workspaceId: currentWorkspace.id,
        timeRange: dateRange,
      })
      setExecutiveSummary(data)
    } catch (err) {
      console.warn('Failed to load live executive summary:', err)
    } finally {
      setIsLoadingSummary(false)
    }
  }

  // Fetch Saved Reports
  const loadSavedReports = async () => {
    if (!currentWorkspace?.id) return
    setIsLoadingSaved(true)
    try {
      const data = await reportingService.getSavedReports({
        workspaceId: currentWorkspace.id,
      })
      setSavedReports(data || [])
    } catch (err) {
      console.warn('Failed to load saved reports:', err)
    } finally {
      setIsLoadingSaved(false)
    }
  }

  useEffect(() => {
    loadExecutiveSummary()
    loadSavedReports()
  }, [currentWorkspace?.id, dateRange])

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
      name: (r.title || 'Initiative').slice(0, 16) + '...',
      Progress: r.progress || 0,
    }))
  }, [roadmap])

  // Export handlers
  const handleExportBackendCSV = async () => {
    if (!currentWorkspace?.id) return
    setIsExporting(true)
    try {
      const csvBlob = await reportingService.exportReport({
        workspaceId: currentWorkspace.id,
        format: 'csv',
        timeRange: dateRange,
      })
      const url = URL.createObjectURL(csvBlob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `executive_report_${currentWorkspace.id}_${dateRange}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      addToast('Exported executive report to CSV', 'success')
    } catch (err) {
      // Fallback to client CSV
      handleExportFeedbackCSV()
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportBackendJSON = async () => {
    if (!currentWorkspace?.id) return
    setIsExporting(true)
    try {
      const jsonData = await reportingService.exportReport({
        workspaceId: currentWorkspace.id,
        format: 'json',
        timeRange: dateRange,
      })
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `executive_report_${currentWorkspace.id}_${dateRange}.json`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      addToast('Exported executive report to JSON', 'success')
    } catch (err) {
      addToast(err.message || 'JSON export failed', 'error')
    } finally {
      setIsExporting(false)
    }
  }

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
    addToast('Exported feedback report to CSV', 'success')
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

  // Saved Reports Actions
  const handleCreateSavedReport = async e => {
    e.preventDefault()
    if (!newReportTitle.trim() || !currentWorkspace?.id) return
    try {
      const created = await reportingService.createSavedReport({
        workspaceId: currentWorkspace.id,
        title: newReportTitle.trim(),
        reportType: newReportType,
        filters: { timeRange: dateRange, category: selectedCategory, sentiment: selectedSentiment },
      })
      setSavedReports(prev => [created, ...prev])
      setShowCreateModal(false)
      setNewReportTitle('')
      addToast('Saved report view created successfully', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to save report', 'error')
    }
  }

  const handleToggleFavorite = async report => {
    if (!currentWorkspace?.id) return
    try {
      const updated = await reportingService.updateSavedReport(
        report.id,
        { isFavorite: !report.isFavorite },
        { workspaceId: currentWorkspace.id }
      )
      setSavedReports(prev =>
        prev.map(r => (r.id === report.id ? { ...r, isFavorite: !r.isFavorite } : r))
      )
      addToast(report.isFavorite ? 'Removed from favorites' : 'Marked as favorite', 'info')
    } catch (err) {
      addToast('Failed to update favorite status', 'error')
    }
  }

  const handleDeleteSavedReport = async reportId => {
    if (!currentWorkspace?.id) return
    try {
      await reportingService.deleteSavedReport(reportId, { workspaceId: currentWorkspace.id })
      setSavedReports(prev => prev.filter(r => r.id !== reportId))
      addToast('Saved report deleted', 'info')
    } catch (err) {
      addToast('Failed to delete report', 'error')
    }
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
          <Button
            variant="outline"
            size="sm"
            icon={Plus}
            onClick={() => setShowCreateModal(true)}
          >
            Save Current View
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={FileSpreadsheet}
            disabled={isExporting}
            onClick={handleExportBackendCSV}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={FileJson}
            disabled={isExporting}
            onClick={handleExportBackendJSON}
          >
            Export JSON
          </Button>
          <Button variant="primary" size="sm" icon={Printer} onClick={() => window.print()}>
            Print Report
          </Button>
        </div>
      </div>

      {/* Live Executive Summary Overview */}
      {executiveSummary && (
        <Card className="p-4 bg-gradient-to-r from-brand-500/10 via-electric-500/10 to-transparent border border-brand-500/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Health Score</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-brand-600 dark:text-brand-400">
                  {executiveSummary.productHealthScore?.score?.toFixed(1) ?? 'N/A'}
                </span>
                <span className="text-xs font-semibold text-slate-500">/ 100</span>
              </div>
              <span className="text-[11px] text-slate-500">Rating: {executiveSummary.productHealthScore?.rating ?? 'Unknown'}</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Sentiment Ratio</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {executiveSummary.customerSentiment?.positiveRatio != null
                    ? `${(executiveSummary.customerSentiment.positiveRatio * 100).toFixed(0)}%`
                    : 'N/A'}
                </span>
                <span className="text-xs font-semibold text-slate-500">Positive</span>
              </div>
              <span className="text-[11px] text-slate-500">{executiveSummary.customerSentiment?.totalAnalyzed ?? 0} Feedback Items</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Delivery Predictability</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-electric-600 dark:text-electric-400">
                  {executiveSummary.deliveryPredictability?.predictabilityScore?.toFixed(0) ?? 'N/A'}%
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                {executiveSummary.deliveryPredictability?.overdueMilestones ?? 0} Overdue Milestones
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Delivery Risk Level</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-black capitalize ${
                  executiveSummary.deliveryRisk?.overallRiskLevel === 'high' ? 'text-rose-500' :
                  executiveSummary.deliveryRisk?.overallRiskLevel === 'medium' ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {executiveSummary.deliveryRisk?.overallRiskLevel ?? 'Low'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">{executiveSummary.deliveryRisk?.itemsAtRisk?.length ?? 0} Items At Risk</span>
            </div>
          </div>
        </Card>
      )}

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
          <option value="quarter">Current Quarter</option>
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

        <div className="ml-auto">
          <Button
            size="xs"
            variant="ghost"
            icon={RefreshCw}
            className={isLoadingSummary ? 'animate-spin' : ''}
            onClick={loadExecutiveSummary}
          >
            Refresh Data
          </Button>
        </div>
      </Card>

      {/* Saved Reports Drawer / Section */}
      {savedReports.length > 0 && (
        <Card className="p-4 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-brand-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Saved Report Views ({savedReports.length})</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {savedReports.map(report => (
              <div
                key={report.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{report.title}</span>
                    {report.isFavorite && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Type: {report.reportType} • {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleFavorite(report)}
                    className="p-1 text-slate-400 hover:text-amber-500 rounded"
                    title={report.isFavorite ? 'Unfavorite' : 'Favorite'}
                  >
                    <Star className={`w-3.5 h-3.5 ${report.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleDeleteSavedReport(report.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded"
                    title="Delete saved report"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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

      {/* Create Saved Report Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Save Report Configuration"
        >
          <form onSubmit={handleCreateSavedReport} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Report Title
              </label>
              <input
                type="text"
                required
                value={newReportTitle}
                onChange={e => setNewReportTitle(e.target.value)}
                placeholder="e.g. Q4 Executive Leadership Digest"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Report Type
              </label>
              <select
                value={newReportType}
                onChange={e => setNewReportType(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-950 text-slate-900 dark:text-white"
              >
                <option value="executive_kpi">Executive KPI Summary</option>
                <option value="sentiment_trend">Sentiment & Feedback Drilldown</option>
                <option value="delivery_risk">Delivery & Milestone Risk</option>
                <option value="feature_prioritization">Feature Prioritization Matrix</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save View
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ReportsPage
