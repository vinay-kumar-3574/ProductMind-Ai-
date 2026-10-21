import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import {
  Search,
  MessageSquareText,
  SlidersHorizontal,
  FileText,
  Milestone,
  Users,
  FlaskConical,
  ShieldCheck,
  X,
  ArrowRight,
} from 'lucide-react'

export function GlobalSearchModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { feedback, features, prds, roadmap, personas, experiments, releases } = useApp()
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const q = query.toLowerCase().trim()

  const matchedFeedback = q
    ? feedback.filter(f => f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.customer.toLowerCase().includes(q)).slice(0, 4)
    : []

  const matchedFeatures = q
    ? features.filter(f => f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)).slice(0, 4)
    : []

  const matchedPRDs = q
    ? prds.filter(p => p.title.toLowerCase().includes(q) || p.version.toLowerCase().includes(q)).slice(0, 3)
    : []

  const matchedRoadmap = q
    ? roadmap.filter(r => r.title.toLowerCase().includes(q) || r.milestone.toLowerCase().includes(q)).slice(0, 3)
    : []

  const totalMatches = matchedFeedback.length + matchedFeatures.length + matchedPRDs.length + matchedRoadmap.length

  const handleSelect = (url) => {
    navigate(url)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search feedback, features, PRDs, roadmap milestones..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mr-2">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="px-2 py-0.5 text-[10px] font-mono text-slate-400 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results area */}
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
          {!q && (
            <div className="text-center py-10">
              <Search className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Type to search workspace data</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Search through customer feedback, algorithmic feature rankings, PRDs, and milestones</p>
            </div>
          )}

          {q && totalMatches === 0 && (
            <div className="text-center py-10">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No results found for "{query}"</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try searching for keywords like "latency", "jira", "grid", or "release"</p>
            </div>
          )}

          {/* Features matches */}
          {matchedFeatures.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2">Features ({matchedFeatures.length})</span>
              <div className="mt-1 space-y-1">
                {matchedFeatures.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect('/prioritization')}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                        <SlidersHorizontal className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.description}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400 shrink-0 ml-2">Score: {item.score?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback matches */}
          {matchedFeedback.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2">Feedback ({matchedFeedback.length})</span>
              <div className="mt-1 space-y-1">
                {matchedFeedback.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect('/feedback')}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                        <MessageSquareText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.customer} ({item.company})</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0 ml-2">
                      {item.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRD matches */}
          {matchedPRDs.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2">PRDs ({matchedPRDs.length})</span>
              <div className="mt-1 space-y-1">
                {matchedPRDs.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect('/prd-generator')}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Version {item.version} • {item.status}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roadmap matches */}
          {matchedRoadmap.length > 0 && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2">Roadmap Milestones ({matchedRoadmap.length})</span>
              <div className="mt-1 space-y-1">
                {matchedRoadmap.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect('/roadmap')}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Milestone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.milestone} • Progress: {item.progress}%</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0 ml-2">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
