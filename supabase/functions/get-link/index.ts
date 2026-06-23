import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const SITE_URL          = Deno.env.get('SITE_URL')          ?? 'https://seistem.vercel.app'
const WORKINK_API_KEY   = Deno.env.get('WORKINK_API_KEY')   ?? ''
const LOOTLABS_API_KEY  = Deno.env.get('LOOTLABS_API_KEY')  ?? ''
const LOCKR_API_KEY     = Deno.env.get('LOCKR_API_KEY')     ?? ''

async function getTierData(hours: number): Promise<{ checkpoints: number; lootlabs_tasks: number }> {
  const { data } = await supabase
    .from('tiers')
    .select('checkpoints, lootlabs_tasks')
    .eq('hours', hours)
    .single()
  return {
    checkpoints:    data?.checkpoints    ?? 1,
    lootlabs_tasks: data?.lootlabs_tasks ?? 1,
  }
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

// ── Lockr: create a fresh locker per step ────────────────────────────────────
async function getLockrLink(destination: string): Promise<string | null> {
  try {
    const resp = await fetch('https://lockr.so/api/v1/lockers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOCKR_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ title: 'Account Manager', target: destination }),
    })
    const data = await resp.json()
    const d = data?.data ?? {}
    return data.url ?? data.link ?? (data.id ? `https://lockr.so/${data.id}` : null)
      ?? d.url ?? d.link ?? (d.id ? `https://lockr.so/${d.id}` : null) ?? null
  } catch (e) {
    console.error('Lockr fetch error:', e)
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
    console.log('LootLabs response:', JSON.stringify(data))
    const msg = Array.isArray(data.message) ? data.message[0] : data.message
    if (data.type === 'created' && msg?.loot_url)
      return `${msg.loot_url}&puid=${puid}`
    return null
  } catch (e) {
    console.error('LootLabs fetch error:', e)
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
    const step       = Number(body.step)  || 1
    const tierData   = await getTierData(hours)
    const total      = Number(body.total) || tierData.checkpoints
    const extendKey  = body.extend_key ? `&extend_key=${encodeURIComponent(body.extend_key)}` : ''

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
        ? `${SITE_URL}/checkpoint?step=${step}&total=${total}&hours=${hours}&provider=${provider}${extendKey}`
        : `${SITE_URL}/callback?provider=${provider}&hours=${hours}&token={TOKEN}${extendKey}`

      const link = await getWorkinkLink(integration.persistent_link, destination)
      if (!link)
        return new Response(JSON.stringify({ error: 'work.ink override API failed' }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        })

      return new Response(JSON.stringify({ link, step, total }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ── LootLabs: one locker per checkpoint step, verified on final step ────────
    if (provider === 'lootlabs') {
      const puid = crypto.randomUUID()
      const isFinal = step >= total

      // Destination after completing this locker:
      // - non-final → checkpoint progress page (same as work.ink)
      // - final     → callback with puid for verification
      const destination = isFinal
        ? `${SITE_URL}/callback?provider=lootlabs&hours=${hours}&puid=${puid}${extendKey}`
        : `${SITE_URL}/checkpoint?step=${step}&total=${total}&hours=${hours}&provider=lootlabs${extendKey}`

      // Only store puid in DB for the final step — that's the one generate-key verifies
      if (isFinal) {
        const { error: insertErr } = await supabase
          .from('lootlabs_tokens')
          .insert({ puid, hours, status: 'pending', tasks_required: tierData.lootlabs_tasks, tasks_completed: 0 })

        if (insertErr)
          return new Response(JSON.stringify({ error: 'Could not create token' }), {
            status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
          })
      }

      const link = await getLootlabsLink(destination, tierData.lootlabs_tasks, puid)

      if (!link)
        return new Response(JSON.stringify({ error: 'LootLabs API failed' }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        })

      return new Response(JSON.stringify({ link, step: 1, total }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ── Lockr: fresh locker per step, no postback verification ───────────────
    if (provider === 'lockr') {
      const destination = step < total
        ? `${SITE_URL}/checkpoint?step=${step}&total=${total}&hours=${hours}&provider=lockr${extendKey}`
        : `${SITE_URL}/callback?provider=lockr&hours=${hours}${extendKey}`

      const link = await getLockrLink(destination)
      if (!link)
        return new Response(JSON.stringify({ error: 'Lockr API failed' }), {
          status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
        })

      return new Response(JSON.stringify({ link, step, total }), {
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
