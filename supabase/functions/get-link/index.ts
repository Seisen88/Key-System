import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const SITE_URL          = Deno.env.get('SITE_URL')          ?? 'https://seistem.vercel.app'
const WORKINK_API_KEY   = Deno.env.get('WORKINK_API_KEY')   ?? ''
const LOOTLABS_API_KEY  = Deno.env.get('LOOTLABS_API_KEY')  ?? ''

async function getCheckpointCount(hours: number): Promise<number> {
  const { data } = await supabase
    .from('tiers')
    .select('checkpoints')
    .eq('hours', hours)
    .single()
  return data?.checkpoints ?? 1
}

// ── work.ink: fresh override per step ─────────────────────────────────────────
async function getWorkinkLink(persistentLink: string, destination: string): Promise<string | null> {
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

// ── LootLabs: create a fresh locker with N tasks built in ─────────────────────
async function getLootlabsLink(
  destination: string,
  tasks: number,
  puid: string,
): Promise<string | null> {
  try {
    const resp = await fetch('https://creators.lootlabs.gg/api/public/content_locker', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOOTLABS_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        title:           'Account Manager',
        url:             destination,
        tier_id:         2,
        number_of_tasks: Math.min(Math.max(tasks, 1), 5),
      }),
    })
    const data = await resp.json()
    if (data.type === 'created' && data.message?.loot_url)
      return `${data.message.loot_url}&puid=${puid}`
    return null
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
    const body     = await req.json()
    const provider = body.provider
    const hours    = Number(body.key_hours) || 6
    const step     = Number(body.step)  || 1
    const total    = Number(body.total) || await getCheckpointCount(hours)

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

    // ── work.ink ─────────────────────────────────────────────────────────────
    if (provider === 'workink' && integration.persistent_link) {
      const destination = step < total
        ? `${SITE_URL}/checkpoint?step=${step}&total=${total}&hours=${hours}&provider=${provider}`
        : `${SITE_URL}/callback?provider=${provider}&hours=${hours}&token={TOKEN}`

      const link = await getWorkinkLink(integration.persistent_link, destination)
      if (!link)
        return new Response(JSON.stringify({ error: 'work.ink override API failed' }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        })

      return new Response(JSON.stringify({ link, step, total }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ── LootLabs: one locker = all tasks, verified via postback ──────────────
    if (provider === 'lootlabs') {
      // Generate a unique puid for this session
      const puid = crypto.randomUUID()

      // Store as pending before creating the locker
      const { error: insertErr } = await supabase
        .from('lootlabs_tokens')
        .insert({ puid, hours, status: 'pending' })

      if (insertErr)
        return new Response(JSON.stringify({ error: 'Could not create token' }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        })

      const destination = `${SITE_URL}/callback?provider=lootlabs&hours=${hours}&puid=${puid}`
      const link = await getLootlabsLink(destination, total, puid)

      if (!link)
        return new Response(JSON.stringify({ error: 'LootLabs API failed' }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        })

      return new Response(JSON.stringify({ link, step: 1, total }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ── Other providers ───────────────────────────────────────────────────────
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
