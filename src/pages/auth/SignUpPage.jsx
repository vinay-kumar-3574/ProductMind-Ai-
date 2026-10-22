import React from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Sparkles, ArrowLeft, ShieldCheck, Lock } from 'lucide-react'

export function SignUpPage() {
  // Public signup is disabled as per requirements: only single PM login exists.
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
      <div className="w-full max-w-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8 z-10 text-center animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-electric-500 flex items-center justify-center text-white mx-auto shadow-glow-sm mb-4">
          <Lock className="w-6 h-6 text-white" />
        </div>

        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Product Manager Portal Only
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
          Public self-registration is disabled. Access is provisioned exclusively for Product Managers through the centralized PM Workspace login.
        </p>

        <div className="mt-6">
          <Link
            to="/signin"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Proceed to PM Sign-In</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SignUpPage
