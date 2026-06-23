import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Simple in-memory rate limiter: max 5 validate attempts per IP per 60s
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT    = 5
const RATE_WINDOW   = 60_000

// Key must match RAM-XXXX-XXXX-XXXX-XXXX (alphanumeric segments, any prefix)
const KEY_REGEX  = /^[A-Z0-9]{2,6}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
// HWID is a 64-char hex string (SHA-256)
const HWID_REGEX = /^[a-f0-9]{64}$/

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
    const body = await req.json()
    const { key, hwid } = body

    // Validate input format before touching the DB
    if (!key  || typeof key  !== 'string' || key.length  > 200) return fail('Invalid request')
    if (!hwid || typeof hwid !== 'string' || hwid.length > 500) return fail('Invalid request')

    const normalKey = key.trim().toUpperCase()
    if (!KEY_REGEX.test(normalKey))   return fail('Invalid key')
    if (!HWID_REGEX.test(hwid.trim())) return fail('Invalid request')

    // ── Fetch key ─────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('keys')
      .select('*')
      .eq('key_value', normalKey)
      .single()

    // Generic response — don't reveal whether key exists or is expired
    // to prevent enumeration attacks
    if (error || !data) return fail('Invalid key')

    // ── Check if key is admin-disabled ────────────────────────────
    if (data.is_disabled) {
      if (data.disabled_until) {
        if (new Date(data.disabled_until) > new Date())
          return fail('Key is temporarily disabled')
        await supabase.from('keys').update({ is_disabled: false, disabled_until: null }).eq('key_value', normalKey)
      } else {
        return fail('Key has been disabled')
      }
    }

    // ── Check expiry — same generic message as "not found" ────────
    if (new Date(data.expires_at) < new Date())
      return fail('Invalid key')

    // ── Check HWID lock ───────────────────────────────────────────
    if (data.hwid && data.hwid !== hwid.trim())
      return fail('Invalid key')

    // ── First use: bind HWID ──────────────────────────────────────
    if (!data.hwid) {
      await supabase
        .from('keys')
        .update({ hwid: hwid.trim() })
        .eq('key_value', normalKey)
    }

    // Sign the response so the desktop app can verify it wasn't tampered with
    const signedData  = `${data.expires_at}|${data.provider}`
    const secretHex   = Deno.env.get('VALIDATION_HMAC_SECRET') ?? ''
    const secretBytes = new Uint8Array(secretHex.match(/.{2}/g)!.map((h: string) => parseInt(h, 16)))
    const hmacKey     = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sigBytes    = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(signedData))
    const sig         = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('')

    return new Response(JSON.stringify({
      valid:      true,
      expires_at: data.expires_at,
      provider:   data.provider,
      sig,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ valid: false, message: 'Invalid request' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
