import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Checkpoint() {
  const [searchParams]      = useSearchParams()
  const navigate            = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const step      = parseInt(searchParams.get('step')     ?? '1')
  const total     = parseInt(searchParams.get('total')    ?? '1')
  const hours     = parseInt(searchParams.get('hours')    ?? '6')
  const provider  = searchParams.get('provider') ?? 'workink'
  const extendKey = searchParams.get('extend_key') ?? ''

  const nextStep    = step + 1
  const isLastStep  = nextStep >= total
  const progressPct = Math.round((step / total) * 100)

  const handleContinue = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('get-link', {
        body: {
          provider,
          key_hours:  hours,
          step:       nextStep,
          total,
          ...(extendKey ? { extend_key: extendKey } : {})
        }
      })

      if (fnErr || !data?.link) throw new Error('Could not get next checkpoint link')
      window.location.href = data.link
    } catch (e) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-card border border-border
                          rounded-full px-4 py-1.5 text-xs text-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"/>
            Account Manager
          </div>
          <h1 className="text-3xl font-bold text-text mb-2">Checkpoint {step} Done!</h1>
          <p className="text-muted text-sm">
            {isLastStep
              ? 'One more checkpoint and your key is ready.'
              : `${total - step} checkpoint${total - step !== 1 ? 's' : ''} remaining for your ${hours}h key.`}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-dim mb-2">
              <span>Progress</span>
              <span>{step} / {total} checkpoints</span>
            </div>
            <div className="w-full bg-bg rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Checkpoint dots */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  transition-all ${i < step
                    ? 'bg-accent text-bg'
                    : i === step
                      ? 'bg-card border-2 border-accent text-accent animate-pulse'
                      : 'bg-bg border border-border text-dim'
                  }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                {i < total - 1 && (
                  <div className={`h-0.5 w-8 ${i < step - 1 ? 'bg-accent' : 'bg-border'}`}/>
                )}
              </div>
            ))}
          </div>

          {error && (
            <p className="text-center text-sm text-red-400 mb-4">{error}</p>
          )}

          <button
            onClick={handleContinue}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all
                       bg-accent text-bg hover:brightness-110 disabled:opacity-60
                       disabled:cursor-not-allowed"
          >
            {loading
              ? 'Loading...'
              : isLastStep
                ? `Go to Final Checkpoint →`
                : `Continue to Checkpoint ${nextStep} →`}
          </button>

        </div>

        <p className="text-center text-dim text-xs mt-6">
          Each checkpoint is a new independent task
        </p>
      </div>
    </div>
  )
}
