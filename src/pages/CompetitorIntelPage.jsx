import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  Crosshair,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { Card, Badge, Button, Modal } from '../components/common'

export function CompetitorIntelPage() {
  const { competitors, addCompetitor, updateCompetitor, deleteCompetitor } = useApp()

  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingComp, setEditingComp] = useState(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formWebsite, setFormWebsite] = useState('')
  const [formAudience, setFormAudience] = useState('')
  const [formFeatures, setFormFeatures] = useState('')
  const [formStrengths, setFormStrengths] = useState('')
  const [formWeaknesses, setFormWeaknesses] = useState('')
  const [formDifferentiators, setFormDifferentiators] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const filtered = competitors.filter(c => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      return c.name.toLowerCase().includes(q) || c.productDescription.toLowerCase().includes(q)
    }
    return true
  })

  const handleOpenCreate = () => {
    setEditingComp(null)
    setFormName('')
    setFormDesc('')
    setFormWebsite('')
    setFormAudience('Enterprise Product Teams')
    setFormFeatures('')
    setFormStrengths('')
    setFormWeaknesses('')
    setFormDifferentiators('')
    setFormNotes('')
    setShowCreateModal(true)
  }

  const handleOpenEdit = (c) => {
    setEditingComp(c)
    setFormName(c.name)
    setFormDesc(c.productDescription)
    setFormWebsite(c.website)
    setFormAudience(c.targetAudience)
    setFormFeatures(c.keyFeatures?.join('\n') || '')
    setFormStrengths(c.strengths?.join('\n') || '')
    setFormWeaknesses(c.weaknesses?.join('\n') || '')
    setFormDifferentiators(c.differentiators?.join('\n') || '')
    setFormNotes(c.researchNotes || '')
    setShowCreateModal(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!formName.trim()) return

    const payload = {
      name: formName.trim(),
      productDescription: formDesc,
      website: formWebsite,
      targetAudience: formAudience,
      keyFeatures: formFeatures.split('\n').filter(Boolean),
      strengths: formStrengths.split('\n').filter(Boolean),
      weaknesses: formWeaknesses.split('\n').filter(Boolean),
      differentiators: formDifferentiators.split('\n').filter(Boolean),
      researchNotes: formNotes,
    }

    if (editingComp) {
      updateCompetitor(editingComp.id, payload)
    } else {
      addCompetitor(payload)
    }

    setShowCreateModal(false)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Competitor Intelligence Workspace</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              Market Benchmarking
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manually curated competitive landscape, feature differentiation matrices, and strategic gaps
          </p>
        </div>

        <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreate}>
          Add Competitor
        </Button>
      </div>

      {/* Feature Comparison Matrix Table */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          Product Mind AI vs. Market Competitors Matrix
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold text-[10px] uppercase">
                <th className="py-2.5 px-3">Capability / Capability</th>
                <th className="py-2.5 px-3 text-brand-600 dark:text-brand-400 font-bold bg-brand-50/50 dark:bg-brand-950/40 rounded-t-lg">
                  Product Mind AI
                </th>
                <th className="py-2.5 px-3">ProductBoard</th>
                <th className="py-2.5 px-3">Pendo</th>
                <th className="py-2.5 px-3">Aha!</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              <tr>
                <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">Formulaic Priority Scoring</td>
                <td className="py-2.5 px-3 bg-brand-50/30 dark:bg-brand-950/20 font-bold text-emerald-500">✓ Exact Weights (0.35/0.30/0.20/0.15)</td>
                <td className="py-2.5 px-3 text-amber-500">⚠️ Subjective 1-3 Stars</td>
                <td className="py-2.5 px-3 text-rose-500">✗ Voting Counts Only</td>
                <td className="py-2.5 px-3 text-amber-500">⚠️ Complex Custom Calcs</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">What-If Trade-Off Sandbox</td>
                <td className="py-2.5 px-3 bg-brand-50/30 dark:bg-brand-950/20 font-bold text-emerald-500">✓ Live Sliders & Diff Delta</td>
                <td className="py-2.5 px-3 text-rose-500">✗ No Sandbox</td>
                <td className="py-2.5 px-3 text-rose-500">✗ No Sandbox</td>
                <td className="py-2.5 px-3 text-rose-500">✗ Static Scenarios</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">13-Section Engineering PRD Generator</td>
                <td className="py-2.5 px-3 bg-brand-50/30 dark:bg-brand-950/20 font-bold text-emerald-500">✓ 1-Click Feature Synthesis</td>
                <td className="py-2.5 px-3 text-rose-500">✗ Basic Notes Only</td>
                <td className="py-2.5 px-3 text-rose-500">✗ No PRD Tool</td>
                <td className="py-2.5 px-3 text-amber-500">⚠️ Static Document Editor</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">Release Readiness Quality Gating</td>
                <td className="py-2.5 px-3 bg-brand-50/30 dark:bg-brand-950/20 font-bold text-emerald-500">✓ Hard Gate (Go / No-Go)</td>
                <td className="py-2.5 px-3 text-rose-500">✗ No Gating Policy</td>
                <td className="py-2.5 px-3 text-rose-500">✗ None</td>
                <td className="py-2.5 px-3 text-emerald-500">✓ Checklist Gates</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">Executive 10-Slide Deck Mode</td>
                <td className="py-2.5 px-3 bg-brand-50/30 dark:bg-brand-950/20 font-bold text-emerald-500">✓ Live Data Presentation</td>
                <td className="py-2.5 px-3 text-rose-500">✗ Export to PPT Only</td>
                <td className="py-2.5 px-3 text-rose-500">✗ None</td>
                <td className="py-2.5 px-3 text-amber-500">⚠️ Complex Dashboards</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Competitor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filtered.map(comp => (
          <Card key={comp.id} className="p-5 flex flex-col justify-between" hover>
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{comp.name}</h3>
                  <a
                    href={comp.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <span>{comp.website.replace('https://', '')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => handleOpenEdit(comp)} className="p-1 text-slate-400 hover:text-white">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteCompetitor(comp.id)} className="p-1 text-slate-400 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed mb-3">
                {comp.productDescription}
              </p>

              {/* Strengths & Weaknesses */}
              <div className="space-y-2 text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-500 block mb-0.5">Strengths</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                    {comp.strengths?.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-rose-500 block mb-0.5">Weaknesses</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                    {comp.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Audience: {comp.targetAudience}</span>
              <span>Reviewed: {comp.lastReviewed}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingComp ? 'Edit Competitor Record' : 'Record Competitor Research'}
        subtitle="Benchmark features, pricing, and strategic market gaps"
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Competitor Name *</label>
              <input
                type="text"
                required
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. ProductBoard"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Website URL</label>
              <input
                type="text"
                value={formWebsite}
                onChange={e => setFormWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Strengths (one per line)</label>
              <textarea
                rows={2}
                value={formStrengths}
                onChange={e => setFormStrengths(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Weaknesses (one per line)</label>
              <textarea
                rows={2}
                value={formWeaknesses}
                onChange={e => setFormWeaknesses(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Save Competitor</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default CompetitorIntelPage
