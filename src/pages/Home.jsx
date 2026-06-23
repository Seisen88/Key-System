import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [step, setStep]               = useState('tier')
  const [selectedTier, setSelectedTier] = useState(null)
  const [tiers, setTiers]             = useState([])
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading]         = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [appVersion, setAppVersion]   = useState(undefined)
  const [downloading, setDownloading] = useState(false)
  const [activeKey, setActiveKey]     = useState(null)
  const [keyCopied, setKeyCopied]     = useState(false)
  const [extending, setExtending]     = useState(false)
  const [visitCount, setVisitCount]   = useState(null)
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

    fetch('https://api.github.com/repos/Seisen88/Key-System/releases/latest', {
      headers: { 'Accept': 'application/vnd.github+json' }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setAppVersion(null); return }
        const exe = data.assets?.find(a => a.name.endsWith('.exe'))
        setAppVersion(exe ? {
          version:      data.tag_name.replace(/^v/i, ''),
          download_url: exe.browser_download_url
        } : null)
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
      if (error || !data?.link) throw new Error()
      window.location.href = data.link
    } catch {
      setRedirecting(false)
    }
  }

  const formatDuration = (hours) => {
    if (hours < 24) return `${hours}h`
    const d = Math.floor(hours / 24), r = hours % 24
    return r > 0 ? `${d}d ${r}h` : `${d}d`
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">

        {/* Active key */}
        {activeKey && (
          <div className="mb-8 rounded-2xl border border-accent/20 bg-accent/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"/>
              <span className="text-xs text-accent tracking-widest uppercase font-medium">Active Key</span>
            </div>
            <p
              onClick={() => { navigator.clipboard.writeText(activeKey.key); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000) }}
              className="font-mono text-xs text-muted bg-bg rounded-lg px-3 py-2.5 cursor-pointer hover:text-text transition mb-3 truncate"
            >
              {activeKey.key}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-dim">
                Expires {new Date(activeKey.expires_at).toLocaleDateString()}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(activeKey.key); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000) }}
                  className="text-xs px-3 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition font-medium"
                >
                  {keyCopied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => { setExtending(true); setStep('tier') }}
                  className="text-xs px-3 py-1 rounded-lg border border-border text-muted hover:text-text hover:border-muted/40 transition"
                >
                  Extend
                </button>
                <button
                  onClick={() => { localStorage.removeItem('seistem_key'); setActiveKey(null); setExtending(false) }}
                  className="text-xs px-3 py-1 rounded-lg border border-border text-dim hover:text-muted transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs text-dim tracking-widest uppercase mb-3 font-medium">
            {extending ? 'Extend Key' : 'Reiya Account Manager'}
          </p>
          <h1 className="text-2xl font-semibold text-text leading-snug">
            {extending
              ? step === 'tier' ? 'Add more time' : `+ ${selectedTier?.label}`
              : step === 'tier' ? 'Get your key' : selectedTier?.label}
          </h1>
          <p className="text-sm text-dim mt-1.5">
            {extending && step === 'tier'
              ? 'Choose how much time to add.'
              : step === 'tier'
                ? 'Select a duration to continue.'
                : 'Choose a provider to complete.'}
          </p>
        </div>

        {/* Tier step */}
        {step === 'tier' && (
          <div className="space-y-2">
            {loading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse"/>
                ))
              : tiers.map(tier => (
                  <button
                    key={tier.hours}
                    onClick={() => selectTier(tier)}
                    className="w-full flex items-center justify-between bg-card border border-border
                               rounded-xl px-4 py-3.5 hover:border-muted/30 hover:bg-[#1a1b22]
                               transition-all duration-150 group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-text">{tier.label}</span>
                      <span className="text-xs text-dim">
                        {tier.checkpoints} checkpoint{tier.checkpoints !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono text-accent">{formatDuration(tier.hours)}</span>
                      <svg className="w-3.5 h-3.5 text-dim group-hover:text-muted transition-colors"
                           fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </button>
                ))
            }
          </div>
        )}

        {/* Integration step */}
        {step === 'integration' && (
          <div>
            <button
              onClick={() => { setStep('tier'); setRedirecting(false); setExtending(false) }}
              className="flex items-center gap-1.5 text-xs text-dim hover:text-muted transition mb-6"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Back
            </button>

            {redirecting && (
              <p className="text-xs text-dim text-center mb-4 animate-pulse">Opening checkpoint…</p>
            )}

            <div className="space-y-2">
              {loading
                ? Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse"/>
                  ))
                : integrations.length === 0
                  ? <p className="text-center text-dim text-sm py-10">No providers available.</p>
                  : integrations.map(integration => (
                      <button
                        key={integration.id}
                        onClick={() => handleSelectIntegration(integration)}
                        className="w-full flex items-center justify-between bg-card border border-border
                                   rounded-xl px-4 py-3.5 hover:border-muted/30 hover:bg-[#1a1b22]
                                   transition-all duration-150 group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base leading-none">
                            {integration.logo_url
                              ? <img src={integration.logo_url} alt="" className="w-5 h-5 object-contain"/>
                              : integration.emoji ?? '🔗'}
                          </span>
                          <span className="text-sm font-medium text-text">{integration.display_name}</span>
                        </div>
                        <svg className="w-3.5 h-3.5 text-dim group-hover:text-muted transition-colors"
                             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    ))
              }
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-border/50 mt-10 pt-8 space-y-3">

          {/* Download */}
          {appVersion === undefined ? (
            <div className="h-14 rounded-xl bg-card border border-border animate-pulse"/>
          ) : appVersion ? (
            <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text">Reiya Account Manager</p>
                <p className="text-xs text-dim mt-0.5">
                  v{appVersion.version} · Windows
                </p>
              </div>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg
                           bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50
                           transition border border-accent/20"
              >
                {downloading ? 'Starting…' : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Download
                  </>
                )}
              </button>
            </div>
          ) : null}

          {/* Discord */}
          <a
            href="https://discord.gg/F4sAf6z8Ph"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between bg-card border border-border rounded-xl
                       px-4 py-3 hover:border-muted/30 hover:bg-[#1a1b22] transition group"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span className="text-sm text-muted group-hover:text-text transition">Join our Discord</span>
            </div>
            <svg className="w-3.5 h-3.5 text-dim group-hover:text-muted transition-colors"
                 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </a>
        </div>

        {/* Stats + footer */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-dim">
            Already have a key? Paste it in the app.
          </p>
          {(visitCount != null || downloadCount != null) && (
            <div className="flex items-center gap-3 text-xs text-dim">
              {visitCount != null && <span>{visitCount.toLocaleString()} visits</span>}
              {visitCount != null && downloadCount != null && <span className="text-border">·</span>}
              {downloadCount != null && <span>{downloadCount.toLocaleString()} downloads</span>}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
