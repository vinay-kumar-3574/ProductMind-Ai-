import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  Users,
  Plus,
  Sparkles,
  Star,
  Search,
  Edit2,
  Trash2,
  Target,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import { Card, Badge, Button, Modal } from '../components/common'

export function PersonasPage() {
  const navigate = useNavigate()
  const { personas, feedback, features, addPersona, updatePersona, deletePersona, addToast } = useApp()

  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPersona, setEditingPersona] = useState(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formRole, setFormRole] = useState('')
  const [formCompanyType, setFormCompanyType] = useState('Enterprise Tier')
  const [formDescription, setFormDescription] = useState('')
  const [formGoals, setFormGoals] = useState('')
  const [formFrustrations, setFormFrustrations] = useState('')
  const [formNeeds, setFormNeeds] = useState('')

  const filteredPersonas = personas.filter(p => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    }
    return true
  })

  const toggleFavorite = (id, currentVal) => {
    updatePersona(id, { isFavorite: !currentVal })
  }

  const handleOpenCreate = () => {
    setEditingPersona(null)
    setFormName('')
    setFormRole('')
    setFormCompanyType('Enterprise Tier')
    setFormDescription('')
    setFormGoals('')
    setFormFrustrations('')
    setFormNeeds('')
    setShowCreateModal(true)
  }

  const handleOpenEdit = (p) => {
    setEditingPersona(p)
    setFormName(p.name)
    setFormRole(p.role)
    setFormCompanyType(p.companyType)
    setFormDescription(p.description)
    setFormGoals(Array.isArray(p.goals) ? p.goals.join('\n') : p.goals)
    setFormFrustrations(Array.isArray(p.frustrations) ? p.frustrations.join('\n') : p.frustrations)
    setFormNeeds(Array.isArray(p.needs) ? p.needs.join('\n') : p.needs)
    setShowCreateModal(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!formName.trim() || !formRole.trim()) return

    const payload = {
      name: formName.trim(),
      role: formRole.trim(),
      companyType: formCompanyType,
      description: formDescription,
      goals: formGoals.split('\n').filter(Boolean),
      frustrations: formFrustrations.split('\n').filter(Boolean),
      needs: formNeeds.split('\n').filter(Boolean),
      featurePreferences: ['High-Performance Virtual Grid', 'Release Readiness Quality Gates'],
    }

    if (editingPersona) {
      updatePersona(editingPersona.id, payload)
    } else {
      addPersona(payload)
    }

    setShowCreateModal(false)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Customer Persona Intelligence</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              NLP Clustering
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Simulated customer profiles synthesized from recurring feedback sentiment and user goals
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreate}>
            New Persona
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="p-3.5 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search personas by name, job role, or industry..."
          className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
        />
      </Card>

      {/* Personas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredPersonas.map(persona => (
          <Card key={persona.id} className="p-6 flex flex-col justify-between" hover>
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-electric-600 flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0">
                    {persona.avatar || persona.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{persona.name}</h3>
                    <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold">{persona.role}</p>
                    <span className="text-[10px] text-slate-400">{persona.companyType}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleFavorite(persona.id, persona.isFavorite)}
                    className={`p-1.5 rounded-lg ${persona.isFavorite ? 'text-amber-400' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Favorite persona"
                  >
                    <Star className="w-4 h-4" fill={persona.isFavorite ? 'currentColor' : 'none'} />
                  </button>
                  <button onClick={() => handleOpenEdit(persona)} className="p-1.5 text-slate-400 hover:text-white">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deletePersona(persona.id)} className="p-1.5 text-slate-400 hover:text-rose-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                {persona.description}
              </p>

              {/* Goals, Frustrations & Needs */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                {/* Goals */}
                <div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center gap-1 mb-1">
                    <Target className="w-3.5 h-3.5" />
                    <span>Primary Objectives:</span>
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                    {(persona.goals || []).map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>

                {/* Frustrations */}
                <div>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px] flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Key Frustrations:</span>
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                    {(persona.frustrations || []).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                {/* Needs */}
                <div>
                  <span className="font-bold text-sky-600 dark:text-sky-400 text-[11px] flex items-center gap-1 mb-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Product Requirements:</span>
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                    {(persona.needs || []).map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Bottom pills */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">
                Sentiment: <strong className="text-slate-700 dark:text-slate-300">{persona.sentimentSummary || 'Neutral'}</strong>
              </span>
              <button
                onClick={() => navigate('/prioritization')}
                className="font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <span>View Priorities</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingPersona ? 'Edit Customer Persona' : 'Create Customer Persona'}
        subtitle="Define user archetypes to ground feature decisions in customer reality"
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Name *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Jordan Miller"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Job Role *</label>
              <input
                type="text"
                required
                value={formRole}
                onChange={e => setFormRole(e.target.value)}
                placeholder="e.g. Lead Product Architect"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / Segment</label>
            <input
              type="text"
              value={formCompanyType}
              onChange={e => setFormCompanyType(e.target.value)}
              placeholder="e.g. High-Growth B2B SaaS"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Profile Summary</label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="Brief summary of their day-to-day focus..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Objectives (one per line)</label>
            <textarea
              rows={2}
              value={formGoals}
              onChange={e => setFormGoals(e.target.value)}
              placeholder="Primary goals..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Frustrations (one per line)</label>
            <textarea
              rows={2}
              value={formFrustrations}
              onChange={e => setFormFrustrations(e.target.value)}
              placeholder="Friction points..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Save Persona</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PersonasPage
