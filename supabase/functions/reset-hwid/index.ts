import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const COOLDOWN_MS = 24 * 60 * 60 * 1000

// Rate limit: max 3 reset attempts per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT   = 3
const RATE_WINDOW  = 60 * 60 * 1000

const KEY_REGEX = /^[A-Z0-9]{2,6}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const ok   = (d: object) =>
    new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })
  const fail = (msg: string, s = 200) =>
    new Response(JSON.stringify({ success: false, message: msg }), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
               ?? req.headers.get('x-real-ip')
               ?? 'unknown'

  if (isRateLimited(clientIp))
    return fail('Too many requests. Try again later.', 429)

  try {
    const { key } = await req.json()
    if (!key || typeof key !== 'string' || key.length > 200) return fail('Invalid request')

    const normalKey = key.trim().toUpperCase()
    if (!KEY_REGEX.test(normalKey)) return fail('Invalid key format')

    const { data, error } = await supabase
      .from('keys')
      .select('key_value, expires_at, is_disabled, hwid, hwid_reset_at')
      .eq('key_value', normalKey)
      .single()

    if (error || !data)                          return fail('Key not found')
    if (data.is_disabled)                        return fail('Key is disabled')
    if (new Date(data.expires_at) < new Date())  return fail('Key is expired')
    if (!data.hwid)                              return fail('No HWID is locked to this key')

    if (data.hwid_reset_at) {
      const elapsed = Date.now() - new Date(data.hwid_reset_at).getTime()
      if (elapsed < COOLDOWN_MS) {
        const rem = COOLDOWN_MS - elapsed
        const h   = Math.floor(rem / 3_600_000)
        const m   = Math.floor((rem % 3_600_000) / 60_000)
        return fail(`Reset available in ${h}h ${m}m`)
      }
    }

    await supabase
      .from('keys')
      .update({ hwid: null, hwid_reset_at: new Date().toISOString() })
      .eq('key_value', normalKey)

    return ok({ success: true })
  } catch (err) {
    return fail('Invalid request', 500)
  }
})
