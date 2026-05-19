import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, useAuthStore } from '../stores/authStore'
import { brand } from '../brand.config'

const STATS = [
  { value: '2-Day', label: 'Pre-ARB Cycle' },
  { value: '360°',  label: 'Domain Coverage' },
  { value: '3',     label: 'Governance Gates' },
]

const DECISIONS = [
  { label: 'Approve',             dot: '#16A34A' },
  { label: 'Approve w/ Actions',  dot: '#00B09C' },
  { label: 'Defer',               dot: '#F59E0B' },
  { label: 'Reject',              dot: '#EF4444' },
]

const BENEFITS = [
  {
    icon: '⚡',
    title: 'SLA-Enforced Pipeline',
    body: 'SA intake ≤ 1 day · AI processing < 2 hrs · EA review ≤ 1 day — fully automated, zero chasing.',
  },
  {
    icon: '🎯',
    title: 'Evidence-Based Scoring',
    body: 'RAG 1–5 across 6 architecture domains & 4 NFR categories. Every score traces to a retrieved enterprise standard.',
  },
  {
    icon: '📋',
    title: 'Binding Decision Records',
    body: 'Auto-generated ADRs with rationale, assigned owner & SLA target date. Written back to CMDB and Confluence.',
  },
  {
    icon: '🛡️',
    title: 'EA Always in Control',
    body: 'Three mandatory human-in-the-loop gates: EAs validate, override & approve every decision. Agent advises; your people govern.',
  },
  {
    icon: '🌐',
    title: 'Six Parallel Domain Agents',
    body: 'App, Integration, Data, Security, Infra & DevSecOps — surfacing cross-cutting platform risk invisible to single-view reviews.',
  },
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
    <div className="min-h-screen flex" style={{ fontFamily: "'Barlow', sans-serif" }}>

      {/* ── Left panel — navy brand ── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 xl:p-16"
        style={{ background: '#1A2D45' }}
      >
        {/* Logo block */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-[10px] grid place-items-center flex-shrink-0"
            style={{ background: '#00B09C', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.15)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B1B2E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, color: '#fff', letterSpacing: '0.02em', lineHeight: 1.05 }}>
              ARB <span style={{ color: '#00B09C' }}>AI</span> Agent
            </div>
            {brand.company && (
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5, fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {brand.company}
              </div>
            )}
          </div>
        </div>

        {/* Headline + body */}
        <div style={{ marginBottom: 'auto', marginTop: 64 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#00B09C', marginBottom: 12 }}>
            Intelligent Architecture Governance
          </div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 40, color: '#fff', lineHeight: 1.15, margin: 0, whiteSpace: 'nowrap' }}>
            Architecture Review Board Automation
          </h1>
          <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, marginTop: 16 }}>
            Automate the entire pre-review process — validating artefacts, scoring domains and delivering<br />
             a fully structured dossier to your Enterprise Architect before the ARB panel ever convenes.
          </p>

          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 36 }}>
            {STATS.map(s => (
              <div key={s.label}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 12px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 26, color: '#00B09C' }}>{s.value}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'rgba(255,255,255,0.45)', marginTop: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Decision outcome pills — compact row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 20 }}>
            {DECISIONS.map(d => (
              <span key={d.label}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.dot, flexShrink: 0 }} />
                {d.label}
              </span>
            ))}
          </div>

          {/* Benefits delivered */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11.5, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 10 }}>
              Benefits Delivered
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {BENEFITS.slice(0, 4).map(b => (
                <div key={b.title}
                  style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10, padding: '11px 13px' }}>
                  <div style={{ fontSize: 15, marginBottom: 5 }}>{b.icon}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 13, color: '#fff', lineHeight: 1.2, marginBottom: 4 }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.47)', lineHeight: 1.5 }}>{b.body}</div>
                </div>
              ))}
              {/* 5th card spans full width */}
              <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 10, padding: '11px 13px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{BENEFITS[4].icon}</div>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 13, color: '#fff', lineHeight: 1.2, marginBottom: 4 }}>{BENEFITS[4].title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.47)', lineHeight: 1.5 }}>{BENEFITS[4].body}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom tagline */}
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', marginTop: 48 }}>
          Intelligent automation. Governed by humans.
        </p>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex items-center justify-center px-6" style={{ background: '#F4F7FA' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-[10px] grid place-items-center flex-shrink-0"
              style={{ background: '#00B09C', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.15)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B1B2E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: '#1A2D45' }}>
              ARB <span style={{ color: '#00B09C' }}>AI</span> Agent
            </div>
          </div>

          {/* Form card */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #D9E2EA', padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 26, color: '#1A2D45', margin: '0 0 4px' }}>
              Sign in
            </h2>
            <p style={{ fontSize: 15, color: '#8CA0B3', margin: '0 0 28px' }}>
              Enter your credentials to access your workspace
            </p>

            <form onSubmit={handleLogin}>
              {/* Email */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#3D5166', marginBottom: 6, letterSpacing: '0.02em' }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@organisation.com"
                  required
                  disabled={loading}
                  style={{
                    width: '100%', height: 42, borderRadius: 8, border: '1px solid #D9E2EA',
                    padding: '0 12px', fontSize: 15, color: '#1A2D45', background: '#F4F7FA',
                    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#00B09C'; e.target.style.background = '#fff' }}
                  onBlur={e  => { e.target.style.borderColor = '#D9E2EA'; e.target.style.background = '#F4F7FA' }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#3D5166', marginBottom: 6, letterSpacing: '0.02em' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  style={{
                    width: '100%', height: 42, borderRadius: 8, border: '1px solid #D9E2EA',
                    padding: '0 12px', fontSize: 15, color: '#1A2D45', background: '#F4F7FA',
                    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#00B09C'; e.target.style.background = '#fff' }}
                  onBlur={e  => { e.target.style.borderColor = '#D9E2EA'; e.target.style.background = '#F4F7FA' }}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{ fontSize: 14, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', height: 44, borderRadius: 8, border: 'none',
                  background: loading ? '#4DB8AB' : '#00B09C',
                  color: '#fff', fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700, fontSize: 15, letterSpacing: '0.06em', textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s', boxShadow: '0 2px 8px rgba(0,176,156,0.3)',
                }}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>

          {brand.company && (
            <p style={{ fontSize: 13, color: '#8CA0B3', textAlign: 'center', marginTop: 20 }}>
              {brand.company} · Enterprise AI Products
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
