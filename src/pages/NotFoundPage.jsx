import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Compass, Home, ArrowLeft, Search, Layers, FileText, Map } from 'lucide-react'
import { Button, Card } from '../components/common'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 mx-auto flex items-center justify-center shadow-lg shadow-primary-500/10">
          <Compass className="w-10 h-10 animate-pulse" />
        </div>

        <div className="space-y-2">
          <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 dark:from-primary-400 dark:via-indigo-400 dark:to-purple-400">
            404
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The view you requested does not exist or has been relocated within the Product Intelligence Workspace.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Go Back
          </Button>
          <Link to="/">
            <Button variant="primary">
              <Home className="w-4 h-4 mr-1.5" />
              Dashboard
            </Button>
          </Link>
        </div>

        <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
            Quick Navigation Links
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link
              to="/feedback"
              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 transition text-left flex items-center gap-2"
            >
              <Search className="w-3.5 h-3.5 text-primary-500" />
              <span>Feedback Repository</span>
            </Link>
            <Link
              to="/prioritization"
              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 transition text-left flex items-center gap-2"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Priority Matrix</span>
            </Link>
            <Link
              to="/prds"
              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 transition text-left flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5 text-purple-500" />
              <span>PRD Generator</span>
            </Link>
            <Link
              to="/roadmap"
              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 transition text-left flex items-center gap-2"
            >
              <Map className="w-3.5 h-3.5 text-amber-500" />
              <span>Roadmap Planner</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
