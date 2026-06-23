import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const url       = new URL(req.url)
  const click_id  = url.searchParams.get('click_id') ?? ''
  const puid      = url.searchParams.get('puid') ?? click_id
  const ip        = url.searchParams.get('ip') ?? ''
  const unique_id = url.searchParams.get('unique_id') ?? ''

  console.log('postback params:', { click_id, puid, ip, unique_id, full_url: req.url })

  if (!puid)
    return new Response('missing puid', { status: 400 })

  // Get current token state
  const { data: token, error: tokenErr } = await supabase
    .from('lootlabs_tokens')
    .select('tasks_required, tasks_completed, status')
    .eq('puid', puid)
    .maybeSingle()

  if (tokenErr)
    return new Response(`db error: ${tokenErr.message}`, { status: 500 })

  if (!token || token.status !== 'pending')
    return new Response('ok', { status: 200 })

  const newCount = (token.tasks_completed ?? 0) + 1
  const allDone  = newCount >= token.tasks_required

  await supabase
    .from('lootlabs_tokens')
    .update({
      tasks_completed: newCount,
      status:      allDone ? 'verified' : 'pending',
      ip,
      unique_id,
      ...(allDone ? { verified_at: new Date().toISOString() } : {}),
    })
    .eq('puid', puid)

  return new Response('ok', { status: 200 })
})
