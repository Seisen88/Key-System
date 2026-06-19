import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import IntegrationCard from '../components/IntegrationCard'

const COLOR_MAP = {
  accent: {
    border: 'border-accent',
    glow:   'hover:shadow-accent/20',
    badge:  'bg-accent/10 text-accent border-accent/30',
    text:   'text-accent',
  },
  purple: {
    border: 'border-purple-500',
    glow:   'hover:shadow-purple-500/20',
    badge:  'bg-purple-500/10 text-purple-400 border-purple-500/30',
    text:   'text-purple-400',
  },
  yellow: {
    border: 'border-yellow-500',
    glow:   'hover:shadow-yellow-500/20',
    badge:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    text:   'text-yellow-400',
  },
  red: {
    border: 'border-red-500',
    glow:   'hover:shadow-red-500/20',
    badge:  'bg-red-500/10 text-red-400 border-red-500/30',
    text:   'text-red-400',
  },
}

export default function Home() {
  const [step, setStep]                 = useState('tier')
  const [selectedTier, setSelectedTier] = useState(null)
  const [tiers, setTiers]               = useState([])
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading]           = useState(true)
  const [redirecting, setRedirecting]   = useState(false)
  const [appVersion, setAppVersion]     = useState(undefined) // undefined=loading, null=none, obj=ready
  const [downloading, setDownloading]   = useState(false)
  const [activeKey, setActiveKey]       = useState(null)     // { key, expires_at } if valid
  const [keyCopied, setKeyCopied]       = useState(false)
  const [extending, setExtending]       = useState(false)    // true = extending existing key
  const [visitCount, setVisitCount]     = useState(null)
  const [downloadCount, setDownloadCount] = useState(null)

  useEffect(() => {
    supabase.rpc('increment_visits').then(({ data }) => {
      if (data != null) setVisitCount(data)
    })

    supabase
      .from('site_stats')
      .select('downloads')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data != null) setDownloadCount(data.downloads)
      })

    supabase
      .from('tiers')
      .select('*')
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setTiers(data ?? [])
        setLoading(false)
      })

    // Check localStorage for a saved active key
    try {
      const saved = JSON.parse(localStorage.getItem('seistem_key') || 'null')
      if (saved?.key && saved?.expires_at) {
        if (new Date(saved.expires_at) > new Date()) {
          setActiveKey(saved)
        } else {
          localStorage.removeItem('seistem_key')
        }
      }
    } catch { localStorage.removeItem('seistem_key') }

    supabase
      .from('releases')
      .select('version, download_url, release_notes')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!data) { setAppVersion(null); return }
        setAppVersion({ version: data.version, download_url: data.download_url, notes: data.release_notes })
      })
      .catch(() => setAppVersion(null))
  }, [])

  const handleDownload = () => {
    if (!appVersion?.download_url) return
    setDownloading(true)
    supabase.rpc('increment_downloads').then(({ data }) => {
      if (data != null) setDownloadCount(data)
    })
    window.location.href = appVersion.download_url
    setTimeout(() => setDownloading(false), 3000)
  }

  const selectTier = async (tier) => {
    setSelectedTier(tier)
    setLoading(true)
    const { data } = await supabase
      .from('integrations')
      .select('*')
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
    setIntegrations(data ?? [])
    setLoading(false)
    setStep('integration')
  }

  const handleSelectIntegration = async (integration) => {
    setRedirecting(true)
    try {
      const { data, error } = await supabase.functions.invoke('get-link', {
        body: {
          provider:  integration.name,
          key_hours: selectedTier.hours,
          step:      1,
          total:     selectedTier.checkpoints,
          ...(extending && activeKey ? { extend_key: activeKey.key } : {})
        }
      })
      if (error || !data?.link) throw new Error('Could not get link')
      window.location.href = data.link
    } catch {
      setRedirecting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Active key banner */}
        {activeKey && (
          <div className="mb-6 bg-card border border-accent/40 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse inline-block"/>
              <span className="text-xs font-bold text-accent uppercase tracking-widest">Active Key</span>
            </div>
            <div
              onClick={() => {
                navigator.clipboard.writeText(activeKey.key)
                setKeyCopied(true)
                setTimeout(() => setKeyCopied(false), 2000)
              }}
              className="w-full bg-bg border border-accent/30 rounded-xl px-4 py-3 text-center
                         font-mono text-accent tracking-widest text-sm cursor-pointer
                         hover:border-accent transition-colors mb-3 select-all"
            >
              {activeKey.key}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-dim text-xs">
                Expires: <span className="text-muted">{new Date(activeKey.expires_at).toLocaleString()}</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeKey.key)
                    setKeyCopied(true)
                    setTimeout(() => setKeyCopied(false), 2000)
                  }}
                  className="text-xs px-3 py-1.5 bg-accent text-bg rounded-lg font-semibold
                             hover:brightness-110 transition"
                >
                  {keyCopied ? '✓ Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => { setExtending(true); setStep('tier') }}
                  className="text-xs px-3 py-1.5 bg-card border border-accent/40 text-accent
                             rounded-lg hover:bg-accent/10 transition font-semibold"
                >
                  + Extend
                </button>
                <button
                  onClick={() => { localStorage.removeItem('seistem_key'); setActiveKey(null); setExtending(false) }}
                  className="text-xs px-3 py-1.5 bg-card border border-border text-dim
                             rounded-lg hover:text-muted transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-card border border-border
                          rounded-full px-4 py-1.5 text-xs text-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"/>
            Account Manager
          </div>
          <h1 className="text-3xl font-bold text-text mb-3">
            {extending
              ? (step === 'tier' ? 'Extend Your Key' : `Add ${selectedTier?.label}`)
              : (step === 'tier' ? 'Get Your Key'    : `${selectedTier?.label} Key`)}
          </h1>
          <p className="text-muted text-sm leading-relaxed">
            {extending && step === 'tier'
              ? 'Choose how much time to add to your key.'
              : step === 'tier'
                ? 'Choose how long you want your key to last.'
                : 'Choose a checkpoint provider to complete.'}
          </p>
        </div>

        {/* ── Step 1: Tier selection ── */}
        {step === 'tier' && (
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse"/>
              ))
            ) : tiers.map(tier => {
              const c = COLOR_MAP[tier.color] ?? COLOR_MAP.accent
              return (
                <button
                  key={tier.hours}
                  onClick={() => selectTier(tier)}
                  className={`w-full bg-card border ${c.border} rounded-xl p-5 text-left
                             hover:bg-[#1a1b24] hover:shadow-lg ${c.glow}
                             transition-all duration-200 group flex items-center gap-4`}
                >
                  <div className={`w-12 h-12 rounded-lg border ${c.border} flex items-center
                                   justify-center shrink-0 text-xl font-bold ${c.text}`}>
                    {tier.hours}h
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-text text-sm">{tier.label}</span>
                      <span className={`text-xs border rounded-full px-2 py-0.5 ${c.badge}`}>
                        {tier.checkpoints} checkpoint{tier.checkpoints !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-dim text-xs">
                      Complete {tier.checkpoints} checkpoint{tier.checkpoints !== 1 ? 's' : ''} to unlock
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-dim group-hover:text-text transition-colors shrink-0"
                       fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Step 2: Integration selection ── */}
        {step === 'integration' && (
          <>
            <button
              onClick={() => { setStep('tier'); setRedirecting(false); setExtending(false) }}
              className="flex items-center gap-1 text-dim text-xs hover:text-muted
                         transition mb-5"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Back
            </button>

            {redirecting && (
              <div className="text-center text-muted text-sm mb-4 animate-pulse">
                Opening checkpoint...
              </div>
            )}

            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse"/>
                ))
              ) : integrations.length === 0 ? (
                <div className="text-center text-dim text-sm py-10">
                  No integrations available right now.
                </div>
              ) : (
                integrations.map(i => (
                  <IntegrationCard
                    key={i.id}
                    integration={{ ...i, key_hours: selectedTier?.hours }}
                    onSelect={handleSelectIntegration}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ── Download section ── */}
        <div className="mt-10 border-t border-border pt-8">
          <p className="text-center text-muted text-xs uppercase tracking-widest mb-4 font-semibold">
            Download the App
          </p>

          {appVersion === undefined ? (
            <div className="h-20 bg-card border border-border rounded-xl animate-pulse"/>
          ) : appVersion ? (
            <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
              {/* Icon */}
              <div className="w-12 h-12 rounded-lg border border-accent/40 bg-accent/10
                              flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm font-semibold">Seistem Account Manager</p>
                <p className="text-dim text-xs mt-0.5">
                  Latest&nbsp;
                  <span className="text-accent font-mono">v{appVersion.version}</span>
                  &nbsp;· Windows x64
                </p>
              </div>

              {/* Button */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="shrink-0 bg-accent hover:bg-accent/80 disabled:opacity-50
                           text-bg text-xs font-bold px-4 py-2 rounded-lg
                           transition-all duration-200 flex items-center gap-1.5"
              >
                {downloading ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                              stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Starting…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Download
                  </>
                )}
              </button>
            </div>
          ) : (
            <p className="text-center text-dim text-xs py-4">No release available yet.</p>
          )}
        </div>

        {/* ── Stats ── */}
        {(visitCount != null || downloadCount != null) && (
          <div className="flex items-center justify-center gap-4 mt-5">
            {visitCount != null && (
              <div className="inline-flex items-center gap-1.5 text-xs text-dim">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7
                           -1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                {visitCount.toLocaleString()} visits
              </div>
            )}
            {visitCount != null && downloadCount != null && (
              <span className="text-border text-xs">·</span>
            )}
            {downloadCount != null && (
              <div className="inline-flex items-center gap-1.5 text-xs text-dim">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                {downloadCount.toLocaleString()} downloads
              </div>
            )}
          </div>
        )}

        {/* ── Discord ── */}
        <div className="mt-6 flex justify-center">
          <a
            href="https://discord.gg/F4sAf6z8Ph"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#5865F2]/10 hover:bg-[#5865F2]/20
                       border border-[#5865F2]/40 hover:border-[#5865F2]/70
                       text-[#7289da] text-sm font-semibold px-5 py-2.5 rounded-xl
                       transition-all duration-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Join our Discord
          </a>
        </div>

        <p className="text-center text-dim text-xs mt-4">
          Already have a key? Open the app and paste it in the key field.
        </p>
      </div>
    </div>
  )
}
