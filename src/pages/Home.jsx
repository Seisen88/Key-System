import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import IntegrationCard from '../components/IntegrationCard'

const TIERS = [
  {
    hours: 6,
    label: '6 Hours',
    checkpoints: 1,
    description: '1 checkpoint',
    color: 'border-accent',
    glow: 'hover:shadow-accent/20',
    badge: 'bg-accent/10 text-accent border-accent/30',
  },
  {
    hours: 12,
    label: '12 Hours',
    checkpoints: 2,
    description: '2 checkpoints',
    color: 'border-purple-500',
    glow: 'hover:shadow-purple-500/20',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  },
  {
    hours: 24,
    label: '24 Hours',
    checkpoints: 4,
    description: '4 checkpoints',
    color: 'border-yellow-500',
    glow: 'hover:shadow-yellow-500/20',
    badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  },
]

export default function Home() {
  const [step, setStep]               = useState('tier')       // 'tier' | 'integration'
  const [selectedTier, setSelectedTier] = useState(null)
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading]           = useState(false)
  const [redirecting, setRedirecting]   = useState(false)

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
        body: { provider: integration.name, key_hours: selectedTier.hours }
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
            {TIERS.map(tier => (
              <button
                key={tier.hours}
                onClick={() => selectTier(tier)}
                className={`w-full bg-card border ${tier.color} rounded-xl p-5 text-left
                           hover:bg-[#1a1b24] hover:shadow-lg ${tier.glow}
                           transition-all duration-200 group flex items-center gap-4`}
              >
                <div className={`w-12 h-12 rounded-lg border ${tier.color} flex items-center
                                 justify-center shrink-0 text-xl font-bold`}>
                  {tier.hours}h
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-text text-sm">{tier.label}</span>
                    <span className={`text-xs border rounded-full px-2 py-0.5 ${tier.badge}`}>
                      {tier.description}
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
            ))}
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

        <p className="text-center text-dim text-xs mt-8">
          Already have a key? Open the app and paste it in the key field.
        </p>
      </div>
    </div>
  )
}
