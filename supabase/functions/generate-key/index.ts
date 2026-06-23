import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const DISCORD_WEBHOOK = Deno.env.get('DISCORD_WEBHOOK_URL') ?? ''

function generateKey(): string {
  const chars   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const segment = () => Array.from({ length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `RAM-${segment()}-${segment()}-${segment()}-${segment()}`
}

async function verifyWorkinkToken(token: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `https://work.ink/_api/v2/token/isValid/${token}?deleteToken=1`
    )
    const data = await resp.json()
    return data.valid === true
  } catch {
    return false
  }
}

async function sendDiscordWebhook(payload: {
  key: string
  provider: string
  hours: number
  ip: string
  extended?: boolean
  expiresAt: string
}) {
  if (!DISCORD_WEBHOOK) return
  const color = payload.extended ? 0x3b82f6 : 0x00adb5
  const title = payload.extended ? '🔄 Key Extended' : '🔑 Key Generated'
  const expiry = new Date(payload.expiresAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
  }) + ' UTC'

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title,
          color,
          fields: [
            { name: 'Key',      value: `\`${payload.key}\``,      inline: false },
            { name: 'Provider', value: payload.provider,          inline: true  },
            { name: 'Duration', value: `${payload.hours}h`,       inline: true  },
            { name: 'Expires',  value: expiry,                    inline: true  },
            { name: 'IP',       value: `||${payload.ip}||`,       inline: true  },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'Seistem Key System' },
        }]
      })
    })
  } catch {
    // webhook failure is non-fatal
  }
}

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: cors })

  const fail = (msg: string, status = 400) =>
    new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...cors, 'Content-Type': 'application/json' }
    })

  try {
    const body = await req.json()
    const { provider, token } = body
    const key_hours = body.key_hours
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    const SANDBOX = (Deno.env.get('SANDBOX') ?? 'false').toLowerCase() === 'true'

    if (!SANDBOX) {
      // ── Verify work.ink token ───────────────────────────────────
      if (provider === 'workink') {
        if (!token) return fail('Missing work.ink token. Complete the checkpoint first.')
        const valid = await verifyWorkinkToken(token)
        if (!valid) return fail('Invalid or already used checkpoint token. Please redo the checkpoint.')
      }

      // ── Verify LootLabs puid ────────────────────────────────────
      if (provider === 'lootlabs') {
        const puid = body.puid
        if (!puid) return fail('Missing LootLabs token. Complete the checkpoint first.')

        const { data: tokenRow } = await supabase
          .from('lootlabs_tokens')
          .select('status')
          .eq('puid', puid)
          .maybeSingle()

        if (!tokenRow) return fail('Invalid LootLabs token.')
        if (tokenRow.status === 'used') return fail('This LootLabs token has already been used.')
        if (tokenRow.status === 'pending')
          return new Response(JSON.stringify({ pending: true }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
          })

        await supabase
          .from('lootlabs_tokens')
          .update({ status: 'used' })
          .eq('puid', puid)
      }
    }

    const keyHours = [24, 48].includes(Number(key_hours)) ? Number(key_hours) : 24

    // ── Extend existing key ───────────────────────────────────────
    if (body.existing_key) {
      const { data: existing } = await supabase
        .from('keys')
        .select('*')
        .eq('key_value', body.existing_key)
        .single()

      if (!existing) return fail('Key not found.')

      const base      = new Date(existing.expires_at) > new Date()
                          ? new Date(existing.expires_at)
                          : new Date()
      const newExpiry = new Date(base.getTime() + keyHours * 60 * 60 * 1000).toISOString()

      await supabase.from('keys').update({ expires_at: newExpiry }).eq('key_value', body.existing_key)
      await supabase.from('rate_limits').upsert({ ip_address: ip, last_keygen: new Date().toISOString() })

      sendDiscordWebhook({ key: body.existing_key, provider: provider ?? 'unknown', hours: keyHours, ip, extended: true, expiresAt: newExpiry })

      return new Response(JSON.stringify({ key: body.existing_key, expires_at: newExpiry, key_hours: keyHours }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const cooldownMs = keyHours * 60 * 60 * 1000

    // ── Rate limit ────────────────────────────────────────────────
    const { data: rateData } = await supabase
      .from('rate_limits')
      .select('last_keygen')
      .eq('ip_address', ip)
      .single()

    if (rateData) {
      const elapsed = Date.now() - new Date(rateData.last_keygen).getTime()
      if (elapsed < cooldownMs) {
        const hoursLeft = Math.ceil((cooldownMs - elapsed) / 3_600_000)
        return new Response(JSON.stringify({
          cooldown: true,
          message: `You already received a key recently. Try again in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}.`
        }), { headers: { ...cors, 'Content-Type': 'application/json' } })
      }
    }

    const expiresAt = new Date(Date.now() + keyHours * 60 * 60 * 1000).toISOString()
    const key       = generateKey()

    const { error } = await supabase.from('keys').insert({
      key_value:  key,
      provider:   provider ?? 'unknown',
      ip_address: ip,
      expires_at: expiresAt,
    })

    if (error) throw error

    await supabase.from('rate_limits').upsert({
      ip_address:  ip,
      last_keygen: new Date().toISOString(),
    })

    sendDiscordWebhook({ key, provider: provider ?? 'unknown', hours: keyHours, ip, expiresAt })

    return new Response(JSON.stringify({ key, expires_at: expiresAt, key_hours: keyHours }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
