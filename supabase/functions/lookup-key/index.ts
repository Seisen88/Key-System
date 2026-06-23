import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT   = 10
const RATE_WINDOW  = 60_000
const KEY_REGEX    = /^[A-Z0-9]{2,6}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

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
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (d: object, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

  // ── Admin secret gate ────────────────────────────────────────────────────
  // Set ADMIN_LOOKUP_SECRET in Supabase Edge Function secrets.
  // Your admin panel must send: x-admin-secret: <value>
  const adminSecret = Deno.env.get('ADMIN_LOOKUP_SECRET') ?? ''
  const reqSecret   = req.headers.get('x-admin-secret') ?? ''
  if (!adminSecret || reqSecret !== adminSecret)
    return json({ error: 'Unauthorized' }, 401)

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(clientIp))
    return json({ error: 'Too many requests' }, 429)

  try {
    const { key } = await req.json()
    if (!key || typeof key !== 'string' || key.length > 200)
      return json({ error: 'Invalid request' }, 400)

    const normalKey = key.trim().toUpperCase()
    if (!KEY_REGEX.test(normalKey))
      return json({ found: false }, 200)

    const { data, error } = await supabase
      .from('keys')
      .select('key_value, expires_at, is_disabled, is_premium, created_at, hwid, hwid_reset_at')
      .eq('key_value', normalKey)
      .single()

    if (error || !data) return json({ found: false }, 200)

    const now     = new Date()
    const expired = new Date(data.expires_at) <= now
    const status  = data.is_disabled ? 'disabled' : expired ? 'expired' : 'active'

    // Never expose the raw HWID — only whether it's bound
    return json({
      found:         true,
      key_value:     data.key_value,
      status,
      expires_at:    data.expires_at,
      is_premium:    data.is_premium,
      created_at:    data.created_at,
      hwid_locked:   !!data.hwid,
      hwid_reset_at: data.hwid_reset_at,
    })
  } catch {
    return json({ error: 'Invalid request' }, 400)
  }
})
