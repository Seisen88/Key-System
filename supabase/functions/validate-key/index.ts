import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RATE_LIMIT  = 5
const KEY_REGEX   = /^[A-Z0-9]{2,6}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
const HWID_REGEX  = /^[a-f0-9]{64}$/

function versionIsAtLeast(version: string, minimum: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const [a1, a2, a3] = parse(version)
  const [b1, b2, b3] = parse(minimum)
  if (a1 !== b1) return a1 > b1
  if (a2 !== b2) return a2 > b2
  return a3 >= b3
}

// Persistent rate limit via DB (survives cold starts).
// Falls back to allowing the request if the DB call itself fails,
// so a DB hiccup never locks out legitimate users.
async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('increment_validate_attempts', { p_ip: ip })
    if (error) return false          // DB error → fail open
    return (data as number) > RATE_LIMIT
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-version',
  }

  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })

  const fail = (message: string, status = 200) =>
    new Response(JSON.stringify({ valid: false, message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  // Minimum version enforcement — set MIN_APP_VERSION secret to force updates
  const minVersion = Deno.env.get('MIN_APP_VERSION') ?? '1.0.0'
  const appVersion = req.headers.get('x-app-version') ?? '0.0.0'
  if (!versionIsAtLeast(appVersion, minVersion))
    return fail(`Your app is outdated (v${appVersion}). Please update Reiya Account Manager to continue.`)

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
               ?? req.headers.get('x-real-ip')
               ?? 'unknown'

  // DB-backed rate limit (replaces in-memory Map that reset on cold starts)
  if (clientIp !== 'unknown' && await isRateLimited(clientIp))
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

    if (!key  || typeof key  !== 'string' || key.length  > 200) return fail('Invalid request')
    if (!hwid || typeof hwid !== 'string' || hwid.length > 500) return fail('Invalid request')

    const normalKey = key.trim().toUpperCase()
    if (!KEY_REGEX.test(normalKey))    return fail('Invalid key')
    if (!HWID_REGEX.test(hwid.trim())) return fail('Invalid request')

    const { data, error } = await supabase
      .from('keys')
      .select('*')
      .eq('key_value', normalKey)
      .single()

    // Generic message — never reveal whether key exists, is expired, or HWID mismatched
    if (error || !data) return fail('Invalid key')

    // Admin-disabled check
    if (data.is_disabled) {
      if (data.disabled_until) {
        if (new Date(data.disabled_until) > new Date())
          return fail('Key is temporarily disabled')
        await supabase
          .from('keys')
          .update({ is_disabled: false, disabled_until: null })
          .eq('key_value', normalKey)
      } else {
        return fail('Key has been disabled')
      }
    }

    // Expiry — same generic message as "not found" to prevent enumeration
    if (new Date(data.expires_at) < new Date())
      return fail('Invalid key')

    // HWID lock — same generic message
    if (data.hwid && data.hwid !== hwid.trim())
      return fail('Invalid key')

    // First use: bind HWID
    if (!data.hwid) {
      await supabase
        .from('keys')
        .update({ hwid: hwid.trim() })
        .eq('key_value', normalKey)
    }

    // Sign response so the desktop app can verify it wasn't tampered with
    const signedData  = `${data.expires_at}|${data.provider}`
    const secretHex   = Deno.env.get('VALIDATION_HMAC_SECRET') ?? ''
    // Use raw UTF-8 bytes of the hex string — matches how the Rust desktop app derives the key
    const secretBytes = new TextEncoder().encode(secretHex)
    const hmacKey     = await crypto.subtle.importKey(
      'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sigBytes = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(signedData))
    const sig      = Array.from(new Uint8Array(sigBytes))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    return new Response(JSON.stringify({
      valid:      true,
      expires_at: data.expires_at,
      provider:   data.provider,
      sig,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch {
    return new Response(JSON.stringify({ valid: false, message: 'Invalid request' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
