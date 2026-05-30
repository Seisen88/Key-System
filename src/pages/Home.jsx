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
  const [appVersion, setAppVersion]     = useState(null)
  const [downloading, setDownloading]   = useState(false)

  useEffect(() => {
    supabase
      .from('tiers')
      .select('*')
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setTiers(data ?? [])
        setLoading(false)
      })

    supabase
      .from('app_version')
      .select('version,download_url')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setAppVersion(data ?? null))
  }, [])

  const handleDownload = () => {
    if (!appVersion?.download_url) return
    setDownloading(true)
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

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-card border border-border
                          rounded-full px-4 py-1.5 text-xs text-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"/>
            Account Manager
          </div>
          <h1 className="text-3xl font-bold text-text mb-3">
            {step === 'tier' ? 'Get Your Key' : `${selectedTier?.label} Key`}
          </h1>
          <p className="text-muted text-sm leading-relaxed">
            {step === 'tier'
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
              onClick={() => { setStep('tier'); setRedirecting(false) }}
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

          {appVersion === null ? (
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

        <p className="text-center text-dim text-xs mt-6">
          Already have a key? Open the app and paste it in the key field.
        </p>
      </div>
    </div>
  )
}
