import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import {
  PlayCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Presentation,
  CheckCircle2,
  Sparkles,
  RotateCcw,
} from 'lucide-react'

export function RecruiterDemoBar() {
  const navigate = useNavigate()
  const {
    recruiterDemoActive,
    recruiterDemoStep,
    nextDemoStep,
    prevDemoStep,
    exitRecruiterDemo,
    startRecruiterDemo,
    setPresentationModeActive,
  } = useApp()

  if (!recruiterDemoActive) return null

  const demoSteps = [
    {
      title: 'Step 1: Inspect Customer Feedback Corpus',
      description: 'Notice the urgent customer complaints regarding table latency on large datasets (5k+ records) from FinTech Dynamics.',
      targetPath: '/feedback',
      actionLabel: 'Go to Feedback Explorer',
    },
    {
      title: 'Step 2: Synthesize AI Insights',
      description: 'Run the simulated AI analysis. The NLP engine detects a high-urgency Performance cluster and recommends building a Virtualized Data Grid.',
      targetPath: '/insights',
      actionLabel: 'Analyze AI Insights',
    },
    {
      title: 'Step 3: Algorithmic Feature Prioritization',
      description: 'Examine feature scores calculated via: (0.35 × Impact) + (0.30 × Urgency) + (0.20 × Demand) + (0.15 × Business Value). High-Performance Virtual Grid ranks #2 with 8.65/10.',
      targetPath: '/prioritization',
      actionLabel: 'View Prioritization Matrix',
    },
    {
      title: 'Step 4: What-If Trade-Off Simulation',
      description: 'Open the What-If Simulator sandbox. Adjust Urgency to 10 and Impact to 10 to simulate how the Virtual Grid jumps to Rank #1 before committing changes.',
      targetPath: '/simulator',
      actionLabel: 'Test What-If Sandbox',
    },
    {
      title: 'Step 5: Generate 13-Section Engineering PRD',
      description: 'Review the comprehensive auto-generated PRD for the Virtualized Grid, complete with user stories, acceptance criteria, and non-functional requirements.',
      targetPath: '/prd-generator',
      actionLabel: 'Open PRD Generator',
    },
    {
      title: 'Step 6: Map Delivery on Timeline Roadmap',
      description: 'Inspect the Gantt-style roadmap with quarterly markers. Virtual Grid (rd-1) is scheduled for Q4 delivery with 75% progress.',
      targetPath: '/roadmap',
      actionLabel: 'View Delivery Roadmap',
    },
    {
      title: 'Step 7: Audit Release Readiness Quality Gates',
      description: 'Check Release v2.4.0. The release is currently blocked (NO-GO) because 2 required quality checklist gates remain unverified.',
      targetPath: '/release-readiness',
      actionLabel: 'Audit Release Gates',
    },
    {
      title: 'Step 8: Present Executive Findings to Stakeholders',
      description: 'Launch Executive Presentation Mode to deliver a distraction-free 10-slide summary with live metrics and charts.',
      targetPath: '/',
      actionLabel: 'Open Presentation Mode',
      isFinal: true,
    },
  ]

  const current = demoSteps[recruiterDemoStep] || demoSteps[0]

  const handleNext = () => {
    if (current.isFinal) {
      exitRecruiterDemo()
      setPresentationModeActive(true)
    } else {
      nextDemoStep()
      navigate(demoSteps[recruiterDemoStep + 1].targetPath)
    }
  }

  const handlePrev = () => {
    prevDemoStep()
    navigate(demoSteps[recruiterDemoStep - 1].targetPath)
  }

  return (
    <div className="fixed top-18 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-[94%] bg-slate-900/95 text-white border border-brand-500/50 rounded-2xl shadow-2xl p-3 sm:p-4 backdrop-blur-xl animate-fadeIn select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Step details */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-electric-600 flex items-center justify-center shrink-0 shadow-glow-sm">
            <PlayCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Recruiter Demo • Step {recruiterDemoStep + 1} of {demoSteps.length}
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-white">{current.title}</h4>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">{current.description}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            onClick={() => startRecruiterDemo(0)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Restart demo from beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handlePrev}
            disabled={recruiterDemoStep === 0}
            className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <button
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-electric-600 hover:from-brand-500 hover:to-electric-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all"
          >
            <span>{current.isFinal ? 'Open Presentation' : 'Next Step'}</span>
            {current.isFinal ? <Presentation className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={exitRecruiterDemo}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
            title="Exit demonstration mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
