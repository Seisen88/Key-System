import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const SITE_URL        = Deno.env.get('SITE_URL') ?? 'https://seistem.vercel.app'
const WORKINK_API_KEY = Deno.env.get('WORKINK_API_KEY') ?? ''

async function getCheckpointCount(hours: number): Promise<number> {
  const { data } = await supabase
    .from('tiers')
    .select('checkpoints')
    .eq('hours', hours)
    .single()
  return data?.checkpoints ?? 1
}

// Fresh override token for a single checkpoint — never reused
async function getFreshOverrideLink(persistentLink: string, destination: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(destination)
    const resp = await fetch(
      `https://work.ink/_api/v2/override?destination=${encoded}`,
      { headers: WORKINK_API_KEY ? { Authorization: `Bearer ${WORKINK_API_KEY}` } : {} }
    )
    const data = await resp.json()
    if (!data.sr) return null
    return `${persistentLink}?sr=${data.sr}`
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: cors })

  try {
    const body       = await req.json()
    const provider   = body.provider
    const hours      = Number(body.key_hours) || 6
    const step       = Number(body.step)  || 1    // which checkpoint we're generating (1-indexed)
    const total      = Number(body.total) || await getCheckpointCount(hours)

    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('name', provider)
      .eq('enabled', true)
      .single()

    if (error || !integration)
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
      })

    if (provider === 'workink' && integration.persistent_link) {

      // Destination after THIS checkpoint completes:
      // - If more checkpoints remain → go back to our /checkpoint page
      // - If this is the last → go to /callback with {TOKEN}
      let destination: string

      if (step < total) {
        // After this checkpoint, show the progress page before the next one
        destination = `${SITE_URL}/checkpoint?step=${step}&total=${total}&hours=${hours}&provider=${provider}`
      } else {
        // Final checkpoint — destination has {TOKEN} placeholder filled by work.ink
        destination = `${SITE_URL}/callback?provider=${provider}&hours=${hours}&token={TOKEN}`
      }

      // Always generate a FRESH override — never reuse a previous sr
      const link = await getFreshOverrideLink(integration.persistent_link, destination)

      if (!link)
        return new Response(JSON.stringify({ error: 'work.ink override API failed' }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        })

      return new Response(JSON.stringify({ link, step, total }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // Other providers — direct link
    return new Response(JSON.stringify({ link: integration.redirect_url }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
