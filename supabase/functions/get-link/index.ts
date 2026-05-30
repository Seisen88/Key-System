import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const SITE_URL        = Deno.env.get('SITE_URL') ?? 'https://seistem.vercel.app'
const WORKINK_API_KEY = Deno.env.get('WORKINK_API_KEY') ?? ''

// How many checkpoints per key duration
const CHECKPOINT_MAP: Record<number, number> = {
  6:  1,
  12: 2,
  24: 4,
}

async function getOverrideSr(destination: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(destination)
    const resp = await fetch(
      `https://work.ink/_api/v2/override?destination=${encoded}`,
      { headers: WORKINK_API_KEY ? { Authorization: `Bearer ${WORKINK_API_KEY}` } : {} }
    )
    const data = await resp.json()
    return data.sr ?? null
  } catch {
    return null
  }
}

// Build a chained work.ink link for N checkpoints
// Last checkpoint → our callback, each earlier one → the next work.ink link
async function buildChainedLink(
  persistentLink: string,
  finalDestination: string,
  checkpoints: number
): Promise<string | null> {
  // Start from the final destination and work backwards
  let currentDest = finalDestination

  for (let i = 0; i < checkpoints; i++) {
    const sr = await getOverrideSr(currentDest)
    if (!sr) return null
    currentDest = `${persistentLink}?sr=${sr}`
  }

  // currentDest is now the first link the user visits
  return currentDest
}

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: cors })

  try {
    const { provider, key_hours } = await req.json()
    const hours = Number(key_hours) || 6

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

    // ── work.ink: build chained checkpoint link ───────────────────
    if (provider === 'workink' && integration.persistent_link) {
      const checkpoints  = CHECKPOINT_MAP[hours] ?? 1
      const finalDest    = `${SITE_URL}/callback?provider=workink&hours=${hours}&token={TOKEN}`
      const link         = await buildChainedLink(integration.persistent_link, finalDest, checkpoints)

      if (!link)
        return new Response(JSON.stringify({ error: 'Failed to build link from work.ink' }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        })

      return new Response(JSON.stringify({ link, checkpoints }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ── Other providers ───────────────────────────────────────────
    const link = `${integration.redirect_url}?hours=${hours}`
    return new Response(JSON.stringify({ link }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
