import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Sparkles, ArrowRight, ArrowLeft, X, Check } from 'lucide-react'

export function GuidedTour() {
  const navigate = useNavigate()
  const { tourSeen, setTourSeen } = useApp()
  const [currentStep, setCurrentStep] = useState(0)

  if (tourSeen) return null

  const tourSteps = [
    {
      title: 'Welcome to Product Mind AI',
      description: 'Your Product Intelligence Workspace transforms noisy customer feedback into mathematically prioritized product decisions, 13-section PRDs, and delivery roadmaps.',
      targetPath: '/',
      highlight: 'Executive Dashboard & Live KPIs',
    },
    {
      title: '1. Customer Feedback Explorer',
      description: 'Review incoming customer requests, filter by sentiment and priority, auto-detect duplicate tickets, and import CSV batches with smart tagging.',
      targetPath: '/feedback',
      highlight: 'Feedback Explorer & CSV Importer',
    },
    {
      title: '2. Simulated AI Insights Feed',
      description: 'Trigger deterministic NLP clustering to identify recurring pain points, integration spikes, and enterprise churn risks before they escalate.',
      targetPath: '/feedback?tab=insights',
      highlight: 'AI Insights Workspace',
    },
    {
      title: '3. Algorithmic Feature Prioritization',
      description: 'Features are ranked using our exact formula: (0.35 × Impact) + (0.30 × Urgency) + (0.20 × Demand) + (0.15 × Business Value). No more subjective opinions.',
      targetPath: '/prioritization',
      highlight: 'Priority Score Matrix',
    },
    {
      title: '4. What-If Scenario Simulator',
      description: 'Test hypothetical resource trade-offs with interactive sliders and compare before-and-after ranking shifts without overwriting original feature scores.',
      targetPath: '/prioritization?tab=simulator',
      highlight: 'What-If Comparison Sandbox',
    },
    {
      title: '5. Complete 13-Section PRD Generator',
      description: 'Generate production-grade product requirement specifications with user stories, acceptance criteria, and risks ready for engineering handoff.',
      targetPath: '/prd-generator',
      highlight: 'PRD Specifications Studio',
    },
    {
      title: '6. Release Readiness Quality Gates',
      description: 'Ensure releases are not marked ready until all required compliance and security checklist gates pass.',
      targetPath: '/roadmap?tab=readiness',
      highlight: 'Release Readiness Center',
    },
  ]

  const step = tourSteps[currentStep]

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      const next = currentStep + 1
      setCurrentStep(next)
      navigate(tourSteps[next].targetPath)
    } else {
      setTourSeen(true)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1
      setCurrentStep(prev)
      navigate(tourSteps[prev].targetPath)
    }
  }

  const handleDismiss = () => {
    setTourSeen(true)
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 max-w-md w-full bg-white dark:bg-navy-900 border border-brand-500/40 rounded-2xl shadow-2xl p-5 glow-border-brand animate-fadeIn select-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Workspace Tour • Step {currentStep + 1} of {tourSteps.length}
          </span>
        </div>
        <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="py-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{step.title}</h4>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">{step.description}</p>
        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-300 border border-brand-200 dark:border-brand-800/60">
          Location: {step.highlight}
        </span>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDismiss}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1"
          >
            Skip Tour
          </button>
          <button
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <span>{currentStep === tourSteps.length - 1 ? 'Finish Tour' : 'Next Step'}</span>
            {currentStep === tourSteps.length - 1 ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
