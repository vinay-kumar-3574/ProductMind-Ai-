import React, { useState, useMemo } from 'react'
import {
  History,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Clock,
  User,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button, Card, Badge } from '../components/common'

export default function ActivityHistoryPage() {
  const { history, undoAction, addToast } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [expandedDiffs, setExpandedDiffs] = useState({})

  const toggleDiff = (id) => {
    setExpandedDiffs(prev => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const filteredHistory = useMemo(() => {
    return (history || []).filter(item => {
      const matchSearch =
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.entityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.actor && item.actor.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchEntity = entityFilter === 'all' || item.entityType === entityFilter
      const matchAction = actionFilter === 'all' || item.action === actionFilter

      return matchSearch && matchEntity && matchAction
    })
  }, [history, searchQuery, entityFilter, actionFilter])

  const getActionBadge = (action) => {
    switch (action) {
      case 'created':
        return <Badge variant="success">Created</Badge>
      case 'updated':
        return <Badge variant="primary">Updated</Badge>
      case 'deleted':
        return <Badge variant="danger">Deleted</Badge>
      case 'restored':
        return <Badge variant="accent">Restored</Badge>
      default:
        return <Badge variant="default">{action}</Badge>
    }
  }

  const getEntityBadge = (entityType) => {
    switch (entityType) {
      case 'feedback':
        return <Badge variant="indigo">Feedback</Badge>
      case 'feature':
        return <Badge variant="primary">Feature</Badge>
      case 'prd':
        return <Badge variant="accent">PRD</Badge>
      case 'roadmap':
        return <Badge variant="warning">Roadmap</Badge>
      case 'experiment':
        return <Badge variant="cyan">Experiment</Badge>
      case 'release':
        return <Badge variant="success">Release</Badge>
      default:
        return <Badge variant="default">{entityType}</Badge>
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Activity History & Audit Trail</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Track modifications, inspect before & after diffs, and reverse changes with one-click undo
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1.5 text-xs font-mono">
            {history.length} Total Audit Records
          </Badge>
        </div>
      </div>

      {/* Audit Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Actions</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{history.length}</div>
        </Card>
        <Card className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Created Events</div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {history.filter(h => h.action === 'created').length}
          </div>
        </Card>
        <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30">
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Updated Events</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
            {history.filter(h => h.action === 'updated').length}
          </div>
        </Card>
        <Card className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Reversible Undos</div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {history.filter(h => h.canUndo).length} Available
          </div>
        </Card>
      </div>

      {/* Filter / Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit trail by description or actor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Entities</option>
              <option value="feedback">Feedback</option>
              <option value="feature">Features</option>
              <option value="prd">PRDs</option>
              <option value="roadmap">Roadmap</option>
              <option value="experiment">Experiments</option>
              <option value="release">Releases</option>
            </select>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Actions</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
        </div>
      </Card>

      {/* History Timeline */}
      <div className="space-y-3">
        {filteredHistory.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">No activity records match</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              Changes you make to feedback, prioritized features, roadmap milestones, and experiments will be logged here with state diffs.
            </p>
          </Card>
        ) : (
          filteredHistory.map((item) => {
            const isExpanded = expandedDiffs[item.id]
            const hasDiff = item.previousState || item.newState

            return (
              <Card
                key={item.id}
                className="p-4 transition hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {item.action === 'created' ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : item.action === 'deleted' ? (
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
                          <Trash2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                          <RotateCcw className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getActionBadge(item.action)}
                        {getEntityBadge(item.entityType)}
                        <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                          ID: {item.entityId}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Just now'}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {item.actor || 'Current User'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end lg:self-center">
                    {hasDiff && (
                      <button
                        onClick={() => toggleDiff(item.id)}
                        className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1 transition"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            Hide State Diff
                          </>
                        ) : (
                          <>
                            <ChevronRight className="w-3.5 h-3.5" />
                            View State Diff
                          </>
                        )}
                      </button>
                    )}

                    {item.canUndo && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => undoAction(item.id)}
                        className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Undo Change
                      </Button>
                    )}
                  </div>
                </div>

                {/* Diff Viewer */}
                {isExpanded && hasDiff && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Previous State (Before)
                      </div>
                      <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto max-h-48 p-2 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                        {item.previousState ? JSON.stringify(item.previousState, null, 2) : 'null (Newly Created)'}
                      </pre>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        New State (After)
                      </div>
                      <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto max-h-48 p-2 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800">
                        {item.newState ? JSON.stringify(item.newState, null, 2) : 'null (Item Deleted)'}
                      </pre>
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
