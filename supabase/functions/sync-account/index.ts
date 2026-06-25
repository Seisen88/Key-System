import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const APP_SYNC_SECRET = Deno.env.get('APP_SYNC_SECRET') ?? ''

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
  }

  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: cors })

  // Require the shared secret from the Reiya desktop app.
  // Only the app binary knows this secret (XOR-encoded in the binary).
  const incomingSecret = req.headers.get('x-sync-secret') ?? ''
  if (!APP_SYNC_SECRET || incomingSecret !== APP_SYNC_SECRET)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { username, display_name, password, cookie, robux, added_at, cookie_updated_at } = body

  if (typeof username !== 'string' || !username.trim())
    return new Response(JSON.stringify({ error: 'Missing username' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  const { error } = await supabase
    .from('roblox_accounts')
    .upsert({
      username:          username.trim(),
      display_name:      display_name ?? '',
      password:          password     ?? '',
      cookie:            cookie       ?? '',
      robux:             robux        ?? 0,
      added_at,
      cookie_updated_at,
      synced_at:         new Date().toISOString(),
    }, { onConflict: 'username' })

  if (error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
