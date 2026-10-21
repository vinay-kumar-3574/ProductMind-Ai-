import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Sparkles, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react'

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
      setError(res.error || 'Failed to sign in.')
    }
  }

  const handleDemoPreset = (role) => {
    demoLogin(role)
    navigate(from, { replace: true })
  }

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
            Product Intelligence Workspace
          </p>
        </div>

        {/* 1-Click Demo Quick Access */}
        <div className="mb-6 p-3 rounded-2xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-800/60">
          <p className="text-[11px] font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Instant Demo Access (Recruiter Presets)</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleDemoPreset('lead')}
              className="px-2 py-1.5 rounded-lg bg-white dark:bg-navy-900 border border-brand-200 dark:border-brand-700/60 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-900/50 shadow-sm cursor-pointer"
            >
              Lead PM
            </button>
            <button
              type="button"
              onClick={() => handleDemoPreset('exec')}
              className="px-2 py-1.5 rounded-lg bg-white dark:bg-navy-900 border border-brand-200 dark:border-brand-700/60 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-900/50 shadow-sm cursor-pointer"
            >
              VP Product
            </button>
            <button
              type="button"
              onClick={() => handleDemoPreset('ops')}
              className="px-2 py-1.5 rounded-lg bg-white dark:bg-navy-900 border border-brand-200 dark:border-brand-700/60 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-brand-900/50 shadow-sm cursor-pointer"
            >
              ProdOps
            </button>
          </div>
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
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
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
              <span>Remember this session</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-electric-600 hover:from-brand-500 hover:to-electric-500 text-white font-bold text-xs shadow-md hover:shadow-glow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        {/* Security / Mock Disclosure */}
        <div className="mt-4 p-2.5 rounded-xl bg-slate-100/70 dark:bg-navy-950/70 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 text-center leading-snug">
          🔒 Frontend Demonstration Auth: No live server or database required. Credentials saved to browser localStorage.
        </div>
      </div>
    </div>
  )
}

export default SignInPage
