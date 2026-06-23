import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Simple in-memory rate limiter: max 5 validate attempts per IP per 60s
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT    = 5
const RATE_WINDOW   = 60_000

function isRateLimited(ip: string): boolean {
  const now    = Date.now()
  const record = rateLimitMap.get(ip)
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return false
  }
  record.count++
  return record.count > RATE_LIMIT
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })

  const fail = (message: string, status = 200) =>
    new Response(JSON.stringify({ valid: false, message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  // Rate limit by IP
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                ?? req.headers.get('x-real-ip')
                ?? 'unknown'
  if (isRateLimited(clientIp))
    return fail('Too many requests', 429)

  // IP ban check
  if (clientIp !== 'unknown') {
    const { data: ban } = await supabase
      .from('bans')
      .select('banned_until')
      .eq('ip_address', clientIp)
      .single()
    if (ban) {
      const stillBanned = !ban.banned_until || new Date(ban.banned_until) > new Date()
      if (stillBanned) return fail('Your IP has been banned from this service.', 403)
    }
  }

  try {
    const { key, hwid } = await req.json()

    if (!key || typeof key !== 'string' || key.length > 200)
      return fail('Invalid request')
    if (!hwid || typeof hwid !== 'string' || hwid.length > 500)
      return fail('Invalid request')

    if (!key || !hwid) return fail('Missing key or hwid')

    // ── Fetch key ─────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('keys')
      .select('*')
      .eq('key_value', key)
      .single()

    if (error || !data) return fail('Invalid key')

    // ── Check if key is admin-disabled ────────────────────────────
    if (data.is_disabled) {
      if (data.disabled_until) {
        if (new Date(data.disabled_until) > new Date())
          return fail('Key is temporarily disabled')
        // disabled_until has passed — auto-lift the disable
        await supabase.from('keys').update({ is_disabled: false, disabled_until: null }).eq('key_value', key)
      } else {
        return fail('Key has been disabled')
      }
    }

    // ── Check expiry ──────────────────────────────────────────────
    if (new Date(data.expires_at) < new Date())
      return fail('Key expired')

    // ── Check HWID lock ───────────────────────────────────────────
    if (data.hwid && data.hwid !== hwid)
      return fail('Key is locked to a different device')

    // ── First use: bind HWID ──────────────────────────────────────
    if (!data.hwid) {
      await supabase
        .from('keys')
        .update({ hwid })
        .eq('key_value', key)
    }

    return new Response(JSON.stringify({
      valid:      true,
      expires_at: data.expires_at,
      provider:   data.provider,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ valid: false, message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
