import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  // LootLabs sends a GET request with click_id, ip, unique_id
  const url       = new URL(req.url)
  const click_id  = url.searchParams.get('click_id')
  const ip        = url.searchParams.get('ip') ?? ''
  const unique_id = url.searchParams.get('unique_id') ?? ''

  if (!click_id)
    return new Response('missing click_id', { status: 400 })

  const { error } = await supabase
    .from('lootlabs_tokens')
    .update({
      status:      'verified',
      ip,
      unique_id,
      verified_at: new Date().toISOString(),
    })
    .eq('puid', click_id)
    .eq('status', 'pending')

  if (error)
    return new Response('error', { status: 500 })

  return new Response('ok', { status: 200 })
})
