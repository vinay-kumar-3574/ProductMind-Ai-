import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Sparkles, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldAlert, CheckCircle2, UserCheck } from 'lucide-react'
import { isBackendConfigured } from '../../services/api/apiClient'

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, demoLogin, isAuthenticated } = useAuth()

  const [email, setEmail] = useState('demo@productmind.ai')
  const [password, setPassword] = useState('demo123')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const from = location.state?.from?.pathname || '/'

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate(from, { replace: true })
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await login(email, password, rememberMe)
    setLoading(false)

    if (res.success) {
      navigate(from, { replace: true })
    } else {
      setError(res.error || 'Failed to sign in as Product Manager.')
    }
  }

  const handle1ClickPMLogin = () => {
    demoLogin()
    navigate(from, { replace: true })
  }

  const backendConfigured = isBackendConfigured()

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute w-96 h-96 rounded-full bg-brand-600/10 blur-[100px] -top-10 -left-10 pointer-events-none" />
      <div className="absolute w-96 h-96 rounded-full bg-electric-500/10 blur-[100px] -bottom-10 -right-10 pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 z-10 animate-fadeIn">
        {/* Logo and Wordmark */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-electric-500 flex items-center justify-center text-white mx-auto shadow-glow-sm mb-3">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Product Mind <span className="text-brand-500">AI</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Product Manager (PM) Workspace Portal
          </p>
        </div>

        {/* 1-Click Instant PM Demo Quick Access (Single PM Flow, No Multiple Roles) */}
        <div className="mb-6 p-3.5 rounded-2xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200/70 dark:border-brand-800/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              <span>Product Manager Demo Access</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-200/60 dark:bg-brand-900/60 text-brand-800 dark:text-brand-200">
              1-Click PM
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2.5 leading-snug">
            Sign in directly to the Lead Product Manager workspace with pre-populated intelligence datasets.
          </p>
          <button
            type="button"
            onClick={handle1ClickPMLogin}
            className="w-full py-2 px-3 rounded-xl bg-white dark:bg-navy-900 border border-brand-300 dark:border-brand-700/80 text-xs font-bold text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/50 shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <UserCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Launch PM Workspace Demo</span>
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Product Manager Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="pm@productmind.ai"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <Link to="/forgot-password" className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2 text-xs rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Remember PM session</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-electric-600 hover:from-brand-500 hover:to-electric-500 text-white font-bold text-xs shadow-md hover:shadow-glow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating PM Account...</span>
            ) : (
              <>
                <span>Sign In to PM Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security / Backend Integration Notice */}
        <div className="mt-5 p-2.5 rounded-xl bg-slate-100/70 dark:bg-navy-950/70 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 text-center leading-snug">
          {backendConfigured ? (
            <span>🔒 Connected to Backend Authentication Server</span>
          ) : (
            <span>🔒 Frontend Demonstration Mode: PM Credentials validated locally. Prepared for future backend API integration.</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default SignInPage
