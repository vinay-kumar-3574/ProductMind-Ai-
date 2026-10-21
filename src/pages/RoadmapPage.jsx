import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import {
  Milestone,
  Plus,
  Search,
  Filter,
  Columns3,
  Calendar,
  List,
  Edit2,
  Trash2,
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { Card, Badge, Button, Modal } from '../components/common'

export function RoadmapPage() {
  const {
    roadmap,
    features,
    addRoadmapItem,
    updateRoadmapItem,
    deleteRoadmapItem,
    addToast,
  } = useApp()

  const [viewMode, setViewMode] = useState('timeline') // 'timeline', 'kanban', 'list'
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formFeatureId, setFormFeatureId] = useState('')
  const [formStatus, setFormStatus] = useState('Planned')
  const [formPriority, setFormPriority] = useState('Medium')
  const [formOwner, setFormOwner] = useState('Alex Rivera')
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0])
  const [formTargetDate, setFormTargetDate] = useState('2026-12-31')
  const [formMilestone, setFormMilestone] = useState('Q4 Platform')
  const [formProgress, setFormProgress] = useState(0)
  const [formNotes, setFormNotes] = useState('')

  const statuses = ['All', 'Planned', 'In Progress', 'In Review', 'Shipped']

  const filteredRoadmap = useMemo(() => {
    return roadmap.filter(item => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        if (!item.title.toLowerCase().includes(q) && !item.milestone.toLowerCase().includes(q)) return false
      }
      if (statusFilter !== 'All' && item.status !== statusFilter) return false
      return true
    })
  }, [roadmap, searchTerm, statusFilter])

  const handleOpenCreate = () => {
    setEditingItem(null)
    setFormTitle('')
    setFormDescription('')
    setFormFeatureId(features[0]?.id || '')
    setFormStatus('Planned')
    setFormPriority('Medium')
    setFormOwner('Alex Rivera')
    setFormStartDate(new Date().toISOString().split('T')[0])
    setFormTargetDate('2026-12-31')
    setFormMilestone('Q4 Core Platform')
    setFormProgress(0)
    setFormNotes('')
    setShowCreateModal(true)
  }

  const handleOpenEdit = (item) => {
    setEditingItem(item)
    setFormTitle(item.title)
    setFormDescription(item.description)
    setFormFeatureId(item.featureId || '')
    setFormStatus(item.status)
    setFormPriority(item.priority)
    setFormOwner(item.owner)
    setFormStartDate(item.startDate)
    setFormTargetDate(item.targetDate)
    setFormMilestone(item.milestone)
    setFormProgress(item.progress)
    setFormNotes(item.notes || '')
    setShowCreateModal(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!formTitle.trim()) return

    const payload = {
      title: formTitle.trim(),
      description: formDescription,
      featureId: formFeatureId || null,
      status: formStatus,
      priority: formPriority,
      owner: formOwner,
      startDate: formStartDate,
      targetDate: formTargetDate,
      milestone: formMilestone,
      progress: Number(formProgress),
      notes: formNotes,
    }

    if (editingItem) {
      updateRoadmapItem(editingItem.id, payload)
    } else {
      addRoadmapItem(payload)
    }

    setShowCreateModal(false)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Product Delivery Roadmap</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              Interactive Gantt & Kanban
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Quarterly execution milestones, progress tracking, and dependency sequencing
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 bg-slate-50 dark:bg-navy-950">
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded-md ${viewMode === 'timeline' ? 'bg-white dark:bg-navy-900 text-brand-600 shadow-xs' : 'text-slate-400'}`}
              title="Timeline Gantt View"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md ${viewMode === 'kanban' ? 'bg-white dark:bg-navy-900 text-brand-600 shadow-xs' : 'text-slate-400'}`}
              title="Kanban Board View"
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white dark:bg-navy-900 text-brand-600 shadow-xs' : 'text-slate-400'}`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreate}>
            Add Item
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3.5 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search roadmap milestones..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
        >
          {statuses.map(s => (
            <option key={s} value={s}>Status: {s}</option>
          ))}
        </select>
      </Card>

      {/* TIMELINE GANTT VIEW */}
      {viewMode === 'timeline' && (
        <Card className="p-5 overflow-x-auto">
          {/* Milestone quarters header */}
          <div className="grid grid-cols-4 gap-2 pb-3 mb-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
            <span className="p-1 rounded bg-slate-100 dark:bg-navy-950">Q3 Foundation</span>
            <span className="p-1 rounded bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">Q4 Core Platform (Current)</span>
            <span className="p-1 rounded bg-slate-100 dark:bg-navy-950">Q1 Enterprise Scale</span>
            <span className="p-1 rounded bg-slate-100 dark:bg-navy-950">Q2 Next-Gen</span>
          </div>

          <div className="space-y-4">
            {filteredRoadmap.map(item => {
              const linkedFeat = features.find(f => f.id === item.featureId)
              const isShipped = item.status === 'Shipped'
              return (
                <div key={item.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-navy-950/60 border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</span>
                      <Badge variant={isShipped ? 'success' : item.status === 'In Progress' ? 'brand' : 'default'} size="xs">
                        {item.status}
                      </Badge>
                      <span className="text-[10px] text-slate-400 font-mono">{item.milestone}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400">{item.progress}%</span>
                      <button onClick={() => handleOpenEdit(item)} className="p-1 text-slate-400 hover:text-white">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteRoadmapItem(item.id)} className="p-1 text-slate-400 hover:text-rose-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar visualizer */}
                  <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isShipped ? 'bg-emerald-500' : 'bg-gradient-to-r from-brand-500 to-electric-500'}`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Owner: {item.owner} • Window: {item.startDate} to {item.targetDate}</span>
                    {linkedFeat && (
                      <span className="font-semibold text-brand-500 truncate max-w-[200px]">
                        Linked: {linkedFeat.name}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {statuses.filter(s => s !== 'All').map(colStatus => {
            const colItems = filteredRoadmap.filter(i => i.status === colStatus)
            return (
              <div key={colStatus} className="rounded-2xl bg-slate-100/60 dark:bg-navy-900/60 border border-slate-200 dark:border-slate-800 p-3 min-h-[480px]">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{colStatus}</span>
                  <Badge size="xs">{colItems.length}</Badge>
                </div>

                <div className="space-y-2.5">
                  {colItems.map(item => (
                    <Card key={item.id} className="p-3 hover:border-brand-500/40 cursor-pointer" hover onClick={() => handleOpenEdit(item)}>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{item.description}</p>
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">{item.milestone}</span>
                        <span className="font-bold text-brand-600 dark:text-brand-400">{item.progress}%</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredRoadmap.map(item => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-navy-950/40">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                <span className="text-[10px] text-slate-400 block mt-1">{item.milestone} • Owner: {item.owner}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold font-mono text-brand-600 dark:text-brand-400">{item.progress}%</span>
                <Badge variant={item.status === 'Shipped' ? 'success' : 'brand'}>{item.status}</Badge>
                <Button variant="ghost" size="xs" onClick={() => handleOpenEdit(item)}>Edit</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingItem ? 'Edit Roadmap Milestone' : 'Add Roadmap Milestone'}
        subtitle="Schedule execution targets and map dependencies"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Title *</label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="e.g. Virtual Grid Architecture Delivery"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                {statuses.filter(s => s !== 'All').map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Milestone</label>
              <input
                type="text"
                value={formMilestone}
                onChange={e => setFormMilestone(e.target.value)}
                placeholder="e.g. Q4 Platform"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={formStartDate}
                onChange={e => setFormStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Date</label>
              <input
                type="date"
                value={formTargetDate}
                onChange={e => setFormTargetDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Progress</span>
              <span className="font-bold text-brand-600">{formProgress}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={formProgress}
              onChange={e => setFormProgress(Number(e.target.value))}
              className="w-full accent-brand-500 cursor-pointer"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Save Item</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default RoadmapPage
