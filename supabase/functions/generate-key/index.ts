import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const COOLDOWN_MS = 24 * 60 * 60 * 1000

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
    const { provider, token } = await req.json()
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    // ── Verify work.ink token (anti-bypass) ───────────────────────
    if (provider === 'workink') {
      if (!token) return fail('Missing work.ink token. Complete the checkpoint first.')
      const valid = await verifyWorkinkToken(token)
      if (!valid) return fail('Invalid or already used checkpoint token. Please redo the checkpoint.')
    }

    // ── Rate limit (1 key per IP per 24h) ─────────────────────────
    const { data: rateData } = await supabase
      .from('rate_limits')
      .select('last_keygen')
      .eq('ip_address', ip)
      .single()

    if (rateData) {
      const elapsed = Date.now() - new Date(rateData.last_keygen).getTime()
      if (elapsed < COOLDOWN_MS) {
        const hoursLeft = Math.ceil((COOLDOWN_MS - elapsed) / 3_600_000)
        return new Response(JSON.stringify({
          cooldown: true,
          message: `You already received a key recently. Try again in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}.`
        }), { headers: { ...cors, 'Content-Type': 'application/json' } })
      }
    }

    // ── Look up integration for key duration ──────────────────────
    const { data: integration } = await supabase
      .from('integrations')
      .select('key_hours, checkpoint_count')
      .eq('name', provider)
      .single()

    const keyHours  = integration?.key_hours ?? 6
    const expiresAt = new Date(Date.now() + keyHours * 60 * 60 * 1000).toISOString()

    // ── Generate key ──────────────────────────────────────────────
    const key = generateKey()

    const { error } = await supabase.from('keys').insert({
      key_value:  key,
      provider:   provider ?? 'unknown',
      ip_address: ip,
      expires_at: expiresAt,
    })

    if (error) throw error

    // ── Update rate limit ─────────────────────────────────────────
    await supabase.from('rate_limits').upsert({
      ip_address:  ip,
      last_keygen: new Date().toISOString(),
    })

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
