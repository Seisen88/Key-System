import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

function HwidResetModal({ keyValue, onClose }) {
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [err,     setErr]     = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setErr('')
    const { error } = await supabase.from('hwid_resets').insert({
      key_value: keyValue,
      reason: reason.trim() || null,
    })
    setLoading(false)
    if (error) { setErr('Could not submit request. Please try again.'); return }
    setDone(true)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-[#13141A] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-sm text-white">Request HWID Reset</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 p-1.5 rounded-lg hover:bg-white/[0.06] transition">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-6 py-5">
          {done ? (
            <div className="text-center py-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              </div>
              <p className="text-white font-semibold text-sm mb-1">Request submitted</p>
              <p className="text-white/35 text-xs">An admin will review and approve your reset shortly.</p>
              <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-full bg-white text-[#0D0E12] font-bold text-sm hover:bg-white/90 transition">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <p className="text-white/40 text-xs mb-3">
                  Your HWID is locked to a specific device. If you changed devices, submit a request below and an admin will clear it.
                </p>
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5 mb-3">
                  <p className="text-[10px] font-mono text-white/25 mb-1">KEY</p>
                  <p className="font-mono text-xs text-white/50">{keyValue}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-white/40 text-xs font-medium">Reason (optional)</label>
                <textarea
                  value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Got a new PC, reinstalled Windows…"
                  rows={3}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white
                             outline-none focus:border-white/20 transition placeholder-white/20 resize-none"
                />
              </div>
              {err && <p className="text-red-400 text-xs font-mono">{err}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 py-2.5 rounded-full border border-white/[0.08] text-white/40 text-sm hover:text-white/70 transition">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 rounded-full bg-white text-[#0D0E12] font-bold text-sm hover:bg-white/90 disabled:opacity-40 transition">
                  {loading ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function timeLeft(expiresAt) {
  const ms = new Date(expiresAt) - new Date()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h remaining`
  if (h > 0)  return `${h}h ${m}m remaining`
  return `${m}m remaining`
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function KeyLookup() {
  const navigate        = useNavigate()
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState('')
  const [resetModal, setResetModal] = useState(false)

  const lookup = async (e) => {
    e.preventDefault()
    const val = input.trim().toUpperCase()
    if (!val) return
    setLoading(true)
    setError('')
    setResult(null)

    const { data, error: dbErr } = await supabase
      .from('keys')
      .select('key_value, expires_at, is_disabled, is_premium, provider, created_at, hwid, discord_username, key_name')
      .eq('key_value', val)
      .single()

    setLoading(false)

    if (dbErr || !data) {
      setError('Key not found. Check you copied it correctly.')
      return
    }

    const now     = new Date()
    const expired = new Date(data.expires_at) <= now
    const status  = data.is_disabled ? 'disabled' : expired ? 'expired' : 'active'
    setResult({ ...data, status })
  }

  const statusStyle = {
    active:   { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    expired:  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  },
    disabled: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">

        {/* Header */}
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

        {/* Search form */}
        <form onSubmit={lookup} className="space-y-3 mb-8">
          <div className="relative">
            <input
              value={input}
              onChange={e => { setInput(e.target.value.toUpperCase()); setError(''); setResult(null) }}
              placeholder="RAM-XXXX-XXXX-XXXX-XXXX"
              spellCheck={false}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3.5 text-sm
                         font-mono text-white outline-none focus:border-white/20 transition placeholder-white/15
                         tracking-wider"
            />
          </div>
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

        {/* Result */}
        {result && (() => {
          const s     = statusStyle[result.status]
          const left  = timeLeft(result.expires_at)
          return (
            <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">

              {/* Status banner */}
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <span className="font-mono text-xs text-white/40 truncate mr-3">{result.key_value}</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold border font-mono flex-shrink-0"
                  style={{ color: s.color, background: s.bg, borderColor: s.border }}>
                  {result.status}
                </span>
              </div>

              {/* Details */}
              <div className="px-5 py-5 space-y-3">
                {/* Big expiry */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-4">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-white/20 mb-1">
                    {result.status === 'active' ? 'Time Remaining' : 'Expired'}
                  </p>
                  <p className="text-xl font-extrabold tracking-tight" style={{ color: s.color }}>
                    {result.status === 'active' && left ? left : 'Expired'}
                  </p>
                  <p className="text-xs text-white/25 font-mono mt-1">{fmtDate(result.expires_at)}</p>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Tier',     result.is_premium ? '★ Premium' : 'Standard'],
                    ['Provider', result.provider],
                    ['Created',  new Date(result.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })],
                    ['HWID',     result.hwid ? 'Locked to device' : 'Not locked yet'],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-3">
                      <p className="text-[9px] font-mono tracking-widest uppercase text-white/20 mb-1">{label}</p>
                      <p className={`text-xs font-semibold ${label === 'Tier' && result.is_premium ? 'text-amber-400' : 'text-white/60'}`}>{val}</p>
                    </div>
                  ))}
                </div>

                {result.discord_username && (
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-3">
                    <p className="text-[9px] font-mono tracking-widest uppercase text-white/20 mb-1">Discord</p>
                    <p className="text-xs font-semibold text-white/60">{result.discord_username}</p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-5 pb-5 flex flex-col gap-2">
                {result.status === 'expired' && (
                  <button onClick={() => navigate('/')}
                    className="w-full py-2.5 rounded-full bg-white text-[#0D0E12] font-bold text-sm hover:bg-white/90 transition">
                    Get a New Key →
                  </button>
                )}
                {result.hwid && result.status === 'active' && (
                  <button onClick={() => setResetModal(true)}
                    className="w-full py-2.5 rounded-full border border-white/[0.08] text-white/35 hover:text-white/70 text-sm font-medium transition">
                    Request HWID Reset
                  </button>
                )}
              </div>
            </div>
          )
        })()}
      </div>
      {resetModal && result && (
        <HwidResetModal keyValue={result.key_value} onClose={() => setResetModal(false)}/>
      )}
    </div>
  )
}
