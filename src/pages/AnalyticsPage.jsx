import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  BarChart3,
  Upload,
  Calendar,
  Users,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts'
import { Card, Badge, Button, Modal, DemoModeBanner, EmptyState, LoadingState, ErrorState } from '../components/common'
import { analyticsService, DEMO_ANALYTICS_DATASET } from '../services/api/analyticsService'

export function AnalyticsPage() {
  const { addToast } = useApp()

  // State: dataset (null = demo dataset, array = custom imported)
  const [customDataset, setCustomDataset] = useState(null)
  const [datasetMeta, setDatasetMeta] = useState(null) // { fileName, fileSize, totalRows }
  const [timeRange, setTimeRange] = useState('30d') // '7d' | '30d' | '90d' | 'all'
  const [selectedFeature, setSelectedFeature] = useState(null) // for drill-down modal

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState(null)
  const [manualColumnMap, setManualColumnMap] = useState({})

  // Active dataset: custom or built-in demo
  const activeDataset = customDataset || DEMO_ANALYTICS_DATASET
  const isDemoData = !customDataset

  // Filtered dataset by date range
  const filteredEvents = useMemo(() => {
    return analyticsService.filterByTimeRange(activeDataset, timeRange)
  }, [activeDataset, timeRange])

  // Computed KPIs
  const kpis = useMemo(() => {
    return analyticsService.calculateKPIs(filteredEvents)
  }, [filteredEvents])

  // Computed Usage Trends
  const usageTrends = useMemo(() => {
    return analyticsService.getUsageTrends(filteredEvents)
  }, [filteredEvents])

  // Computed Feature Adoption
  const featureAnalytics = useMemo(() => {
    return analyticsService.getFeatureAnalytics(filteredEvents)
  }, [filteredEvents])

  // Computed Funnel / Drop-off
  const funnelSteps = useMemo(() => {
    return analyticsService.getFunnelAnalytics(filteredEvents)
  }, [filteredEvents])

  // Handle File Input Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadFile(file)
    setParsing(true)
    setParseResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        const result = analyticsService.parseAnalyticsFile(content, file.name)
        setParseResult(result)
        if (result.mappedColumns) {
          setManualColumnMap(result.mappedColumns)
        }
      }
      setParsing(false)
    }
    reader.onerror = () => {
      setParsing(false)
      setParseResult({
        success: false,
        error: 'Failed to read file from disk.',
        records: [],
        missingRequired: ['File read error'],
      })
    }
    reader.readAsText(file)
  }

  // Confirm Import
  const handleConfirmImport = () => {
    if (!parseResult || !parseResult.success) {
      addToast('Cannot import dataset with validation errors', 'warning')
      return
    }

    setCustomDataset(parseResult.records)
    setDatasetMeta({
      fileName: uploadFile?.name || 'imported_dataset.csv',
      fileSize: uploadFile ? `${(uploadFile.size / 1024).toFixed(1)} KB` : 'N/A',
      totalRows: parseResult.records.length,
    })
    setShowUploadModal(false)
    setUploadFile(null)
    setParseResult(null)
    addToast(`Successfully imported ${parseResult.records.length} analytics events`, 'success')
  }

  // Reset to Demo Dataset
  const handleResetToDemo = () => {
    setCustomDataset(null)
    setDatasetMeta(null)
    addToast('Restored built-in sample demo analytics dataset', 'info')
  }

  // Drill-down data for selected feature
  const selectedFeatureTrends = useMemo(() => {
    if (!selectedFeature) return []
    const featEvents = filteredEvents.filter(e => e.featureName === selectedFeature.name)
    return analyticsService.getUsageTrends(featEvents)
  }, [selectedFeature, filteredEvents])

  const FEATURE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6']

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Demo / Live Status Banner */}
      <DemoModeBanner
        message={
          isDemoData
            ? 'Displaying built-in product analytics demo dataset. Upload your own CSV or JSON telemetry data to inspect real metrics.'
            : `Active Imported Dataset: ${datasetMeta?.fileName} (${datasetMeta?.totalRows} events recorded)`
        }
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Product Analytics Studio</h2>
            <Badge variant={isDemoData ? 'warning' : 'success'}>
              {isDemoData ? 'Sample Demo Data' : 'Live Imported Data'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Active user velocity, telemetry trends, feature-level adoption curves, and conversion drop-off funnels
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
            {[
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: 'all', label: 'All Time' },
            ].map(range => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeRange === range.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Upload Button */}
          <Button
            variant="primary"
            size="sm"
            icon={Upload}
            onClick={() => setShowUploadModal(true)}
          >
            Import Telemetry (CSV/JSON)
          </Button>

          {/* Reset to Demo if custom dataset active */}
          {!isDemoData && (
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={handleResetToDemo}
              title="Reset to sample demo dataset"
            >
              Reset to Demo
            </Button>
          )}
        </div>
      </div>

      {/* 4 Core KPIs Responsive Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4" hover>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Monthly Active Users</span>
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {kpis.mau.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +14%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">DAU: ~{kpis.dau.toLocaleString()} daily active</p>
        </Card>

        <Card className="p-4" hover>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total User Sessions</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {kpis.totalSessions.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +9%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Avg Session: ~{kpis.avgSessionDuration}s duration</p>
        </Card>

        <Card className="p-4" hover>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Telemetry Events Logged</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {kpis.totalEvents.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              in {timeRange.toUpperCase()}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Across all product touchpoints</p>
        </Card>

        <Card className="p-4" hover>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Leading Feature by Volume</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate block" title={kpis.topFeature}>
              {kpis.topFeature}
            </span>
          </div>
          <p className="text-[10px] text-emerald-600 font-medium mt-1">Adoption Rate: {kpis.featureAdoptionRate}%</p>
        </Card>
      </div>

      {/* Main Charts: Usage Over Time + Funnel Drop-off */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Trends Line/Area Chart */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Product Usage & Activity Trends</h3>
              <p className="text-xs text-slate-400">Daily event volume and active user sessions over selected timeframe</p>
            </div>
            <Badge variant="brand">{timeRange.toUpperCase()}</Badge>
          </div>

          <div className="h-72 w-full pt-4">
            {usageTrends.length === 0 ? (
              <EmptyState title="No usage events" description="No activity recorded in this date range." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usageTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="eventGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '0.75rem',
                      border: '1px solid #334155',
                      fontSize: '11px',
                      color: '#f8fafc',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="events"
                    name="Telemetry Events"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#eventGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="activeUsers"
                    name="Active Users"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#userGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* User Drop-off Funnel Analysis */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Conversion & Drop-off Funnel</h3>
                <p className="text-xs text-slate-400">Step-by-step user retention drop-off</p>
              </div>
              <Activity className="w-4 h-4 text-brand-500" />
            </div>

            <div className="space-y-3 pt-2">
              {funnelSteps.map((step, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800 dark:text-slate-200">{step.step}</span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {step.users.toLocaleString()} users ({step.conversionRate}%)
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-600 to-electric-500 transition-all duration-500"
                      style={{ width: `${step.conversionRate}%` }}
                    />
                  </div>
                  {step.dropOffRate > 0 && (
                    <div className="flex justify-end">
                      <span className="text-[10px] font-semibold text-rose-500 flex items-center gap-0.5">
                        <ArrowDownRight className="w-3 h-3" />
                        {step.dropOffRate}% drop-off from previous
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 mt-4 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-500">
            💡 <strong>Opportunity:</strong> Biggest drop-off occurs between discovery and core action. Streamline onboarding flow to improve retention.
          </div>
        </Card>
      </div>

      {/* Feature Adoption Breakdown & Drill-Down Table */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Feature Adoption & Drill-Down Analytics</h3>
            <p className="text-xs text-slate-400">Click any feature row to inspect detailed usage trends and user telemetry</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Showing {featureAnalytics.length} tracked capabilities
          </span>
        </div>

        {/* Feature Analytics Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Feature Name</th>
                <th className="py-2.5 px-3">Total Events</th>
                <th className="py-2.5 px-3">Unique Users</th>
                <th className="py-2.5 px-3">Adoption Rate</th>
                <th className="py-2.5 px-3">Completion Rate</th>
                <th className="py-2.5 px-3 text-right">Drill Down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {featureAnalytics.map((feat, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedFeature(feat)}
                  className="hover:bg-slate-50 dark:hover:bg-navy-950/50 cursor-pointer transition-colors group"
                >
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: FEATURE_COLORS[idx % FEATURE_COLORS.length] }}
                    />
                    <span className="truncate">{feat.name}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono">
                    {feat.eventCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono">
                    {feat.uniqueUsers.toLocaleString()}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 w-9 font-mono">
                        {feat.adoptionPercent}%
                      </span>
                      <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${feat.adoptionPercent}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      feat.completionRate >= 50
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                    }`}>
                      {feat.completionRate}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button className="text-brand-600 dark:text-brand-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 font-semibold text-xs">
                      <span>View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Feature Drill-Down Modal */}
      {selectedFeature && (
        <Modal
          isOpen={Boolean(selectedFeature)}
          onClose={() => setSelectedFeature(null)}
          title={`Feature Telemetry: ${selectedFeature.name}`}
          subtitle="Detailed adoption trajectory and engagement breakdown"
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Total Invocations</span>
                <span className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                  {selectedFeature.eventCount.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Unique Users Engaged</span>
                <span className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                  {selectedFeature.uniqueUsers.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Adoption Percentage</span>
                <span className="text-xl font-black text-brand-600 dark:text-brand-400 font-mono mt-0.5 block">
                  {selectedFeature.adoptionPercent}%
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">Usage Activity Over Selected Window</h4>
              <div className="h-56 w-full p-2 rounded-xl bg-slate-50/50 dark:bg-navy-950/30 border border-slate-200 dark:border-slate-800">
                {selectedFeatureTrends.length === 0 ? (
                  <EmptyState title="No events in timeframe" description="Try selecting a wider date range filter." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedFeatureTrends} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderRadius: '0.5rem',
                          border: '1px solid #334155',
                          fontSize: '11px',
                          color: '#f8fafc',
                        }}
                      />
                      <Area type="monotone" dataKey="events" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" size="sm" onClick={() => setSelectedFeature(null)}>
                Close Drill-Down
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* CSV / JSON Upload & Column Mapping Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false)
          setUploadFile(null)
          setParseResult(null)
        }}
        title="Import Product Analytics Telemetry"
        subtitle="Upload CSV or JSON telemetry event logs with column validation and mapping"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Dropzone */}
          <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center hover:border-brand-500 transition-colors bg-slate-50/50 dark:bg-navy-950/30">
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              id="analytics-file-input"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="analytics-file-input" className="cursor-pointer block">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto mb-2">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Click to browse or drag and drop telemetry file
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Supports standard CSV or JSON event logs</p>
            </label>
          </div>

          {/* Parsing Spinner */}
          {parsing && <LoadingState message="Analyzing file structure and validating columns..." />}

          {/* Parse Result Summary */}
          {parseResult && (
            <div className="space-y-3">
              {parseResult.success ? (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>
                    Validation Passed: Found <strong>{parseResult.records.length}</strong> events across{' '}
                    <strong>{parseResult.detectedColumns.length}</strong> columns.
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{parseResult.error || 'Required fields missing from dataset.'}</span>
                </div>
              )}

              {/* Column Mapping Preview */}
              {parseResult.mappedColumns && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-2">
                    Detected Column Mappings:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">User Identifier:</span>{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {parseResult.mappedColumns.userId}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Timestamp:</span>{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {parseResult.mappedColumns.timestamp}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Feature/Action:</span>{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {parseResult.mappedColumns.featureName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Event Type:</span>{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {parseResult.mappedColumns.eventType}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sample Data Preview (First 3 Rows) */}
              {parseResult.records.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Data Preview (First 3 Records):
                  </span>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 dark:bg-navy-950 text-slate-500">
                        <tr>
                          <th className="p-2">User ID</th>
                          <th className="p-2">Date</th>
                          <th className="p-2">Feature</th>
                          <th className="p-2">Event</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {parseResult.records.slice(0, 3).map((r, i) => (
                          <tr key={i}>
                            <td className="p-2 font-mono text-slate-700 dark:text-slate-300">{r.userId}</td>
                            <td className="p-2 text-slate-500">{r.date}</td>
                            <td className="p-2 text-slate-700 dark:text-slate-300 font-semibold">{r.featureName}</td>
                            <td className="p-2 text-slate-500">{r.eventType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowUploadModal(false)
                setUploadFile(null)
                setParseResult(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!parseResult || !parseResult.success}
              onClick={handleConfirmImport}
            >
              Confirm & Import Dataset
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AnalyticsPage
