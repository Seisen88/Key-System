import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

const COOLDOWN_MS = 24 * 60 * 60 * 1000

function timeLeft(expiresAt) {
  const ms = new Date(expiresAt) - new Date()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h remaining`
  if (h > 0)  return `${h}h ${m}m remaining`
  return `${m}m remaining`
}

function cooldownLeft(hwid_reset_at) {
  if (!hwid_reset_at) return null
  const rem = COOLDOWN_MS - (Date.now() - new Date(hwid_reset_at).getTime())
  if (rem <= 0) return null
  const h = Math.floor(rem / 3_600_000)
  const m = Math.floor((rem % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function KeyLookup() {
  const navigate = useNavigate()
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [result,       setResult]       = useState(null)
  const [error,        setError]        = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetErr,     setResetErr]     = useState('')
  const [resetDone,    setResetDone]    = useState(false)

  const lookup = async (e) => {
    e.preventDefault()
    const val = input.trim().toUpperCase()
    if (!val) return
    setLoading(true)
    setError('')
    setResult(null)
    setResetDone(false)
    setResetErr('')

    const { data, error: fnErr } = await supabase.functions.invoke('lookup-key', {
      body: { key: val },
    })

    setLoading(false)

    if (fnErr || !data?.found) {
      setError('Key not found. Check you copied it correctly.')
      return
    }

    setResult(data)
  }

  const resetHwid = async () => {
    setResetLoading(true)
    setResetErr('')
    const { data, error } = await supabase.functions.invoke('reset-hwid', {
      body: { key: result.key_value },
    })
    setResetLoading(false)
    if (error || !data?.success) {
      setResetErr(data?.message || error?.message || 'Reset failed. Try again.')
      return
    }
    setResetDone(true)
    setResult(r => ({ ...r, hwid_locked: false, hwid_reset_at: new Date().toISOString() }))
  }

  const statusStyle = {
    active:   { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    expired:  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  },
    disabled: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">

        <div className="mb-10">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition mb-8 font-mono">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Back
          </button>
          <div className="flex items-center gap-4 mb-5">
            <span className="text-[10px] font-mono tracking-widest uppercase text-white/25">01 // KEY LOOKUP</span>
            <div className="flex-1 h-px bg-white/[0.06]"/>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-none mb-2">Check your key.</h1>
          <p className="text-white/35 text-sm">Enter your key to see its status, expiry, and details.</p>
        </div>

        <form onSubmit={lookup} className="space-y-3 mb-8">
          <input
            value={input}
            onChange={e => { setInput(e.target.value.toUpperCase()); setError(''); setResult(null) }}
            placeholder="RAM-XXXX-XXXX-XXXX-XXXX"
            spellCheck={false}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3.5 text-sm
                       font-mono text-white outline-none focus:border-white/20 transition placeholder-white/15
                       tracking-wider"
          />
          {error && (
            <div className="bg-red-500/8 border border-red-500/20 text-red-400 text-xs rounded-2xl px-4 py-3 font-mono">
              {error}
            </div>
          )}
          <button type="submit" disabled={loading || !input.trim()}
            className="w-full py-3 rounded-full bg-white text-[#0D0E12] font-bold text-sm
                       hover:bg-white/90 disabled:opacity-30 transition-all">
            {loading ? 'Looking up…' : 'Look Up Key'}
          </button>
        </form>

        {result && (() => {
          const s        = statusStyle[result.status]
          const left     = timeLeft(result.expires_at)
          const cooldown = cooldownLeft(result.hwid_reset_at)
          const canReset = result.status === 'active' && result.hwid_locked && !cooldown && !resetDone

          return (
            <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <span className="font-mono text-xs text-white/40 truncate mr-3">{result.key_value}</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold border font-mono flex-shrink-0"
                  style={{ color: s.color, background: s.bg, borderColor: s.border }}>
                  {result.status}
                </span>
              </div>

              <div className="px-5 py-5 space-y-3">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-4">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/20 mb-1">
                    {result.status === 'active' ? 'Time Remaining' : 'Expired'}
                  </p>
                  <p className="text-xl font-extrabold tracking-tight" style={{ color: s.color }}>
                    {result.status === 'active' && left ? left : 'Expired'}
                  </p>
                  <p className="text-xs text-white/25 font-mono mt-1">{fmtDate(result.expires_at)}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Tier',    result.is_premium ? '★ Premium' : 'Standard'],
                    ['Created', new Date(result.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
                    ['HWID',    resetDone ? 'Cleared' : result.hwid_locked ? 'Locked to device' : 'Not locked yet'],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-3">
                      <p className="text-[9px] font-mono tracking-widest uppercase text-white/20 mb-1">{label}</p>
                      <p className={`text-xs font-semibold ${
                        label === 'Tier' && result.is_premium ? 'text-amber-400' :
                        label === 'HWID' && resetDone ? 'text-emerald-400' : 'text-white/60'
                      }`}>{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-5 pb-5 flex flex-col gap-2">
                {result.status === 'expired' && (
                  <button onClick={() => navigate('/')}
                    className="w-full py-2.5 rounded-full bg-white text-[#0D0E12] font-bold text-sm hover:bg-white/90 transition">
                    Get a New Key →
                  </button>
                )}

                {result.status === 'active' && result.hwid_locked && !resetDone && (
                  <>
                    <button
                      onClick={canReset ? resetHwid : undefined}
                      disabled={resetLoading || !!cooldown}
                      className={`w-full py-2.5 rounded-full border text-sm font-medium transition
                        ${canReset
                          ? 'border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20 cursor-pointer'
                          : 'border-white/[0.05] text-white/20 cursor-not-allowed'
                        }`}
                    >
                      {resetLoading ? 'Resetting…' : cooldown ? `Reset available in ${cooldown}` : 'Reset HWID'}
                    </button>
                    {resetErr && <p className="text-red-400 text-xs font-mono text-center">{resetErr}</p>}
                  </>
                )}

                {resetDone && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 text-xs font-semibold justify-center">
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    HWID cleared — resets in 24h
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
