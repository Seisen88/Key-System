import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import KeyDisplay from '../components/KeyDisplay'

const POLL_INTERVAL_MS = 2000
const MAX_POLLS        = 10

export default function Callback() {
  const [searchParams]          = useSearchParams()
  const navigate                = useNavigate()
  const [state, setState]       = useState('loading') // loading | waiting | success | error | cooldown
  const [keyValue, setKeyValue] = useState('')
  const [expiresAt, setExpiresAt] = useState(null)
  const [message, setMessage]   = useState('')
  const pollCount               = useRef(0)

  const provider  = searchParams.get('provider') ?? 'unknown'
  const token     = searchParams.get('token') ?? ''
  const puid      = searchParams.get('puid') ?? ''
  const key_hours = parseInt(searchParams.get('hours') ?? '6')

  useEffect(() => {
    attemptGenerate()
  }, [])

  const attemptGenerate = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-key', {
        body: { provider, token, puid, key_hours }
      })

      if (error) throw error

      // LootLabs postback not received yet — poll again
      if (data.pending) {
        pollCount.current += 1
        if (pollCount.current >= MAX_POLLS) {
          setMessage('LootLabs did not confirm your task completion. Please try again.')
          setState('error')
          return
        }
        setState('waiting')
        setTimeout(attemptGenerate, POLL_INTERVAL_MS)
        return
      }

      if (data.error) {
        setMessage(data.error)
        setState('error')
        return
      }

      if (data.cooldown) {
        setMessage(data.message ?? 'You already got a key recently. Try again later.')
        setState('cooldown')
        return
      }

      if (!data.key) throw new Error('No key returned')

      setKeyValue(data.key)
      setExpiresAt(data.expires_at)
      setState('success')
    } catch (err) {
      console.error(err)
      setMessage('Something went wrong. Please try again.')
      setState('error')
    }
  }

  const isLootlabs = provider === 'lootlabs'

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-card border border-border
                          rounded-full px-4 py-1.5 text-xs text-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"></span>
            Account Manager
          </div>
          <h1 className="text-3xl font-bold text-text mb-2">
            {state === 'success'  ? 'Your Key is Ready'     :
             state === 'loading'  ? 'Generating Key...'     :
             state === 'waiting'  ? 'Waiting for Confirmation...' :
             state === 'cooldown' ? 'Slow Down'             : 'Something Went Wrong'}
          </h1>
          {state !== 'success' && (
            <p className="text-muted text-sm">
              {state === 'loading'  ? 'Please wait a moment...'                          :
               state === 'waiting'  ? 'Confirming your task completion with LootLabs...' :
               message}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="bg-card border border-border rounded-2xl p-6">
          {(state === 'loading' || state === 'waiting') && (
            <div className="flex flex-col items-center py-8 gap-4">
              <div className="w-10 h-10 border-2 border-accent border-t-transparent
                              rounded-full animate-spin" />
              <p className="text-muted text-sm">
                {state === 'waiting'
                  ? `Checking... (${pollCount.current}/${MAX_POLLS})`
                  : 'Generating your unique key...'}
              </p>
            </div>
          )}

          {state === 'success' && (
            <div>
              <p className="text-muted text-sm text-center mb-5">
                Copy this key and paste it into the <strong className="text-text">Account Manager</strong> app.
              </p>
              <KeyDisplay keyValue={keyValue} expiresAt={expiresAt} />
            </div>
          )}

          {(state === 'error' || state === 'cooldown') && (
            <div className="flex flex-col items-center gap-4 py-4">
              <span className="text-4xl">{state === 'cooldown' ? '⏳' : '⚠️'}</span>
              <p className="text-muted text-sm text-center">{message}</p>
              {state === 'error' && (
                <button
                  onClick={() => { pollCount.current = 0; setState('loading'); attemptGenerate() }}
                  className="px-6 py-2 bg-accent text-bg rounded-lg font-semibold text-sm
                             hover:brightness-110 transition"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={() => navigate('/')}
                className="text-dim text-xs hover:text-muted transition"
              >
                ← Back to integrations
              </button>
            </div>
          )}
        </div>

        {state === 'success' && (
          <p className="text-center text-dim text-xs mt-6">
            Open Account Manager → paste the key → click Validate
          </p>
        )}
      </div>
    </div>
  )
}
