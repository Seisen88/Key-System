import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const SITE_URL        = Deno.env.get('SITE_URL') ?? 'https://seistem.vercel.app'
const WORKINK_API_KEY = Deno.env.get('WORKINK_API_KEY') ?? ''

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: cors })

  try {
    const { provider } = await req.json()

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

    // ── work.ink: use Link Override API ───────────────────────────
    if (provider === 'workink' && integration.persistent_link) {
      const destination = encodeURIComponent(
        `${SITE_URL}/callback?provider=workink&token={TOKEN}`
      )

      const overrideUrl = `https://work.ink/_api/v2/override?destination=${destination}`

      const headers: Record<string, string> = {}
      if (WORKINK_API_KEY) headers['Authorization'] = `Bearer ${WORKINK_API_KEY}`

      const resp = await fetch(overrideUrl, { headers })
      const overrideData = await resp.json()

      if (!overrideData.sr)
        return new Response(JSON.stringify({ error: 'Failed to get override token from work.ink' }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        })

      const link = `${integration.persistent_link}?sr=${overrideData.sr}`
      return new Response(JSON.stringify({ link }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ── Other providers: direct redirect_url ─────────────────────
    return new Response(JSON.stringify({ link: integration.redirect_url }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
