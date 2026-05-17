import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, useAuthStore } from '../stores/authStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { brand } from '../brand.config'

const STATS = [
  { value: '2-Day',  label: 'Pre-ARB Cycle' },
  { value: '360°',   label: 'Domain Coverage' },
  { value: '3',      label: 'Governance Gates' },
]

const DECISIONS = [
  { label: '✓ Approve',             color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  { label: '⚡ Approve w/ Actions', color: 'bg-teal-500/20  text-teal-400  border border-teal-500/30'  },
  { label: '⏸ Defer',              color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  { label: '✕ Reject',             color: 'bg-red-500/20   text-red-400   border border-red-500/30'   },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      const role = useAuthStore.getState().user?.role
      navigate(role === 'super_admin' ? '/admin' : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left Panel — Brand & Messaging ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-10 xl:p-14">

        {/* Top: Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm tracking-tight">ARB</span>
          </div>
          <div>
            <p className="font-bold text-white text-base leading-tight">
              ARB <span className="text-teal-400">AI</span> Agent
            </p>
            <p className="text-xs text-slate-400">{brand.tagline}</p>
          </div>
        </div>

        {/* Middle: Headline + Stats */}
        <div className="space-y-8">
          <div>
            <p className="text-teal-400 text-xs font-semibold uppercase tracking-widest mb-3">
              Intelligent Architecture Governance
            </p>
            <h2 className="text-3xl xl:text-4xl font-bold text-white leading-snug">
              {brand.tagline}<br />Automation
            </h2>
            <p className="text-slate-400 text-sm mt-4 leading-relaxed max-w-sm">
              Automate the entire pre-review process — validating artefacts, scoring NFRs across six
              architecture domains, and delivering a fully structured dossier to your Enterprise Architect
              before the ARB panel ever convenes.
            </p>
          </div>

          {/* Stat Tiles */}
          <div className="grid grid-cols-3 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-teal-400">{s.value}</p>
                <p className="text-xs text-slate-400 mt-1 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Decision Outcome Badges */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
              Decision Outcomes Enforced
            </p>
            <div className="flex flex-wrap gap-2">
              {DECISIONS.map((d) => (
                <span key={d.label} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${d.color}`}>
                  {d.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: Tagline */}
        <p className="text-xs text-slate-500 italic">
          Intelligent automation. Governed by humans.
        </p>
      </div>

      {/* ── Right Panel — Login Form ── */}
      <div className="flex-1 flex items-center justify-center bg-white px-6">
        <div className="w-full max-w-sm">

          {/* Mobile logo (hidden on lg) */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">ARB</span>
            </div>
            <p className="font-bold text-slate-900">
              ARB <span className="text-teal-600">AI</span> Agent
            </p>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-8">Enter your credentials to access your workspace</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organisation.com"
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-8">
            Enterprise AI Products
          </p>
        </div>
      </div>

    </div>
  )
}
