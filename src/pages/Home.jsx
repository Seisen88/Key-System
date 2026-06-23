import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [step,           setStep]           = useState('tier')
  const [selectedTier,   setSelectedTier]   = useState(null)
  const [tiers,          setTiers]          = useState([])
  const [integrations,   setIntegrations]   = useState([])
  const [loading,        setLoading]        = useState(true)
  const [redirecting,    setRedirecting]    = useState(false)
  const [appVersion,     setAppVersion]     = useState(undefined)
  const [downloading,    setDownloading]    = useState(false)
  const [activeKey,      setActiveKey]      = useState(null)
  const [keyCopied,      setKeyCopied]      = useState(false)
  const [extending,      setExtending]      = useState(false)
  const [visitCount,     setVisitCount]     = useState(null)
  const [downloadCount,  setDownloadCount]  = useState(null)

  useEffect(() => {
    supabase.rpc('increment_visits').then(({ data }) => {
      if (data != null) setVisitCount(data)
    })
    supabase.from('site_stats').select('downloads').eq('id', 1).single().then(({ data }) => {
      if (data != null) setDownloadCount(data.downloads)
    })
    supabase.from('tiers').select('*').eq('enabled', true).order('sort_order', { ascending: true }).then(({ data }) => {
      setTiers(data ?? [])
      setLoading(false)
    })
    try {
      const saved = JSON.parse(localStorage.getItem('seistem_key') || 'null')
      if (saved?.key && saved?.expires_at) {
        if (new Date(saved.expires_at) > new Date()) setActiveKey(saved)
        else localStorage.removeItem('seistem_key')
      }
    } catch { localStorage.removeItem('seistem_key') }

    fetch('https://api.github.com/repos/Seisen88/Key-System/releases/latest', {
      headers: { 'Accept': 'application/vnd.github+json' }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setAppVersion(null); return }
        const exe = data.assets?.find(a => a.name.endsWith('.exe'))
        setAppVersion(exe ? { version: data.tag_name.replace(/^v/i, ''), download_url: exe.browser_download_url } : null)
      })
      .catch(() => setAppVersion(null))
  }, [])

  const handleDownload = () => {
    if (!appVersion?.download_url) return
    setDownloading(true)
    supabase.rpc('increment_downloads').then(({ data }) => { if (data != null) setDownloadCount(data) })
    window.location.href = appVersion.download_url
    setTimeout(() => setDownloading(false), 3000)
  }

  const selectTier = async (tier) => {
    setSelectedTier(tier)
    setLoading(true)
    const { data } = await supabase.from('integrations').select('*').eq('enabled', true).order('sort_order', { ascending: true })
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
      if (error || !data?.link) throw new Error()
      window.location.href = data.link
    } catch { setRedirecting(false) }
  }

  const formatDuration = (h) => h < 24 ? `${h}h` : `${Math.floor(h / 24)}d${h % 24 ? ` ${h % 24}h` : ''}`

  const getTimeLeft = (expiresAt) => {
    const ms = new Date(expiresAt) - new Date()
    if (ms <= 0) return { label: 'Expired', urgent: true }
    const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000)
    const label = h > 48 ? `${Math.floor(h/24)}d ${h%24}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`
    return { label, urgent: h < 6 }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(activeKey.key)
    setKeyCopied(true)
    setTimeout(() => setKeyCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-[420px]">

        {/* ── Active key ─────────────────────────────────────────── */}
        {activeKey && (
          <div className="mb-10 border border-border rounded-2xl p-5 bg-card">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-mono tracking-widest uppercase text-dim">Active Key</span>
              <div className="flex-1 h-px bg-border"/>
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"/>
            </div>
            <p
              onClick={copyKey}
              className="font-mono text-xs text-muted bg-bg border border-border rounded-xl
                         px-4 py-3 cursor-pointer hover:text-text hover:border-muted/30
                         transition-all duration-200 truncate mb-4 select-all"
            >
              {activeKey.key}
            </p>
            {(() => { const {label, urgent} = getTimeLeft(activeKey.expires_at); return (
              <div className={`mb-4 px-3.5 py-2 rounded-xl border text-xs font-mono flex items-center gap-2
                ${urgent ? 'bg-red-500/8 border-red-500/20 text-red-400' : 'bg-accent/5 border-accent/15 text-accent'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgent ? 'bg-red-400' : 'bg-accent'}`}/>
                {label}
                {urgent && <span className="ml-auto font-semibold">Renew now →</span>}
              </div>
            )})()}
            <div className="flex items-center justify-between">
              <span className="text-xs text-dim font-mono">
                {new Date(activeKey.expires_at).toLocaleDateString()}
              </span>
              <div className="flex gap-2">
                <button onClick={copyKey}
                  className="text-xs px-3.5 py-1.5 rounded-full bg-text text-bg font-semibold
                             hover:bg-muted transition-all duration-200">
                  {keyCopied ? 'Copied ✓' : 'Copy'}
                </button>
                <button onClick={() => { setExtending(true); setStep('tier') }}
                  className="text-xs px-3.5 py-1.5 rounded-full border border-border text-muted
                             hover:border-muted/50 hover:text-text transition-all duration-200">
                  Extend
                </button>
                <button onClick={() => { localStorage.removeItem('seistem_key'); setActiveKey(null); setExtending(false) }}
                  className="text-xs px-3.5 py-1.5 rounded-full border border-border text-dim
                             hover:text-muted transition-all duration-200">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-5">
            <span className="text-[10px] font-mono tracking-widest uppercase text-dim whitespace-nowrap">
              {step === 'tier' ? (extending ? '02 // EXTEND' : '01 // GET KEY') : '02 // PROVIDER'}
            </span>
            <div className="flex-1 h-px bg-border"/>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text leading-none mb-3">
            {extending
              ? step === 'tier' ? 'Add more time.' : `+ ${selectedTier?.label}`
              : step === 'tier' ? 'Get your key.' : selectedTier?.label + '.'}
          </h1>
          <p className="text-muted text-sm leading-relaxed">
            {extending && step === 'tier'
              ? 'Choose how much time to add to your existing key.'
              : step === 'tier'
                ? 'Select a duration to begin.'
                : 'Complete a checkpoint provider to unlock your key.'}
          </p>
        </div>

        {/* ── Tier step ──────────────────────────────────────────── */}
        {step === 'tier' && (
          <div className="space-y-2.5">
            {loading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-[68px] rounded-2xl bg-card border border-border animate-pulse"/>
                ))
              : tiers.map(tier => (
                  <button key={tier.hours} onClick={() => selectTier(tier)}
                    className="w-full bg-card border border-border rounded-2xl px-5 py-4
                               flex items-center justify-between group
                               hover:border-muted/40 hover:bg-[#1c1d25]
                               transition-all duration-200">
                    <div className="text-left">
                      <p className="text-sm font-semibold text-text">{tier.label}</p>
                      <p className="text-xs text-dim mt-0.5">
                        {tier.checkpoints} checkpoint{tier.checkpoints !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-accent tracking-wide">
                        {formatDuration(tier.hours)}
                      </span>
                      <svg className="w-4 h-4 text-dim group-hover:text-muted group-hover:translate-x-0.5 transition-all duration-200"
                           fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </button>
                ))
            }
          </div>
        )}

        {/* ── Integration step ───────────────────────────────────── */}
        {step === 'integration' && (
          <div>
            <button onClick={() => { setStep('tier'); setRedirecting(false); setExtending(false) }}
              className="flex items-center gap-2 text-xs text-dim hover:text-muted
                         transition-colors duration-200 mb-6 font-mono tracking-wide">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Back
            </button>

            {redirecting && (
              <p className="text-xs text-dim font-mono text-center mb-5 animate-pulse tracking-wide">
                Opening checkpoint…
              </p>
            )}

            <div className="space-y-2.5">
              {loading
                ? Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-[68px] rounded-2xl bg-card border border-border animate-pulse"/>
                  ))
                : integrations.length === 0
                  ? <p className="text-center text-dim text-sm py-12">No providers available.</p>
                  : integrations.map(integration => (
                      <button key={integration.id} onClick={() => handleSelectIntegration(integration)}
                        className="w-full bg-card border border-border rounded-2xl px-5 py-4
                                   flex items-center justify-between group
                                   hover:border-muted/40 hover:bg-[#1c1d25]
                                   transition-all duration-200">
                        <div className="flex items-center gap-3">
                          <span className="text-lg leading-none">
                            {integration.logo_url
                              ? <img src={integration.logo_url} alt="" className="w-5 h-5 object-contain"/>
                              : integration.emoji ?? '🔗'}
                          </span>
                          <p className="text-sm font-semibold text-text">{integration.display_name}</p>
                        </div>
                        <svg className="w-4 h-4 text-dim group-hover:text-muted group-hover:translate-x-0.5 transition-all duration-200"
                             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    ))
              }
            </div>
          </div>
        )}

        {/* ── Bottom section ─────────────────────────────────────── */}
        <div className="mt-12 pt-8 border-t border-border space-y-2.5">

          {/* Download */}
          {appVersion === undefined ? (
            <div className="h-[68px] rounded-2xl bg-card border border-border animate-pulse"/>
          ) : appVersion ? (
            <div className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text">Reiya Account Manager</p>
                <p className="text-xs text-dim mt-0.5 font-mono">v{appVersion.version} · Windows x64</p>
              </div>
              <button onClick={handleDownload} disabled={downloading}
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full
                           bg-text text-bg hover:bg-muted disabled:opacity-40
                           transition-all duration-200">
                {downloading ? 'Starting…' : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Download
                  </>
                )}
              </button>
            </div>
          ) : null}

          {/* Discord */}
          <a href="https://discord.gg/F4sAf6z8Ph" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between bg-card border border-border rounded-2xl
                       px-5 py-4 group hover:border-muted/40 hover:bg-[#1c1d25] transition-all duration-200">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <p className="text-sm font-semibold text-muted group-hover:text-text transition-colors duration-200">
                Join our Discord
              </p>
            </div>
            <svg className="w-4 h-4 text-dim group-hover:text-muted group-hover:translate-x-0.5 transition-all duration-200"
                 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </a>
        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-between">
          <a href="/key" className="text-xs text-dim hover:text-white/50 transition">
            Already have a key? <span className="underline underline-offset-2">Check status →</span>
          </a>
          {(visitCount != null || downloadCount != null) && (
            <div className="flex items-center gap-2 text-xs font-mono text-dim">
              {visitCount != null && <span>{visitCount.toLocaleString()}</span>}
              {visitCount != null && downloadCount != null && <span className="text-border">·</span>}
              {downloadCount != null && <span>{downloadCount.toLocaleString()}</span>}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
