import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import IntegrationCard from '../components/IntegrationCard'

export default function Home() {
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    supabase
      .from('integrations')
      .select('*')
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setIntegrations(data ?? [])
        setLoading(false)
      })
  }, [])

  const [redirecting, setRedirecting] = useState(false)

  const handleSelect = async (integration) => {
    setRedirecting(true)
    try {
      const { data, error } = await supabase.functions.invoke('get-link', {
        body: { provider: integration.name }
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
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"></span>
            Account Manager
          </div>
          <h1 className="text-3xl font-bold text-text mb-3">Get Your Key</h1>
          <p className="text-muted text-sm leading-relaxed">
            Choose a checkpoint provider below.<br />
            Complete the checkpoint to receive your license key.
          </p>
        </div>

        {redirecting && (
          <div className="text-center text-muted text-sm mb-4 animate-pulse">
            Opening checkpoint...
          </div>
        )}

        {/* Integration list */}
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
            ))
          ) : integrations.length === 0 ? (
            <div className="text-center text-dim text-sm py-10">
              No integrations available right now. Check back later.
            </div>
          ) : (
            integrations.map(i => (
              <IntegrationCard key={i.id} integration={i} onSelect={handleSelect} />
            ))
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-dim text-xs mt-8">
          Already have a key? Open the app and paste it in the key field.
        </p>
      </div>
    </div>
  )
}
