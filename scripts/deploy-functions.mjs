/**
 * Deploys all edge functions to the Supabase project via Management API.
 * Run: node scripts/deploy-functions.mjs
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root      = resolve(__dirname, '..')

// ── Load .env ─────────────────────────────────────────────────────────────────
const envVars = {}
readFileSync(resolve(root, '.env'), 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && k.trim() && !k.trim().startsWith('#'))
    envVars[k.trim()] = v.join('=').trim()
})

const SUPABASE_URL = envVars['VITE_SUPABASE_URL']
const PROJECT_REF  = new URL(SUPABASE_URL).hostname.split('.')[0]
const PAT          = process.argv[2] || envVars['SUPABASE_PAT']

if (!PAT) {
  console.error('Usage: node scripts/deploy-functions.mjs <personal-access-token>')
  process.exit(1)
}

const FUNCTIONS = [
  { slug: 'generate-key',      verify_jwt: false },
  { slug: 'get-link',          verify_jwt: false },
  { slug: 'lookup-key',        verify_jwt: false },
  { slug: 'lootlabs-postback', verify_jwt: false },
  { slug: 'reset-hwid',        verify_jwt: false },
  { slug: 'validate-key',      verify_jwt: false },
]

const fnDir = resolve(root, 'supabase', 'functions')

async function deploy(slug, verify_jwt) {
  const body = readFileSync(resolve(fnDir, slug, 'index.ts'), 'utf8')

  // Try PATCH first (update existing), then POST (create new)
  for (const [method, url] of [
    ['PATCH', `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/${slug}`],
    ['POST',  `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`],
  ]) {
    const payload = method === 'POST'
      ? { slug, name: slug, verify_jwt, body }
      : { verify_jwt, body }

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) return { ok: true, method }
    if (method === 'PATCH' && res.status === 404) continue  // doesn't exist yet, try POST
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, error: text }
  }

  return { ok: false, error: 'both PATCH and POST failed' }
}

console.log(`\n🚀 Deploying edge functions → project ${PROJECT_REF}\n`)

let passed = 0
let failed = 0

for (const { slug, verify_jwt } of FUNCTIONS) {
  const result = await deploy(slug, verify_jwt)
  if (result.ok) {
    const action = result.method === 'PATCH' ? 'updated' : 'created'
    console.log(`   ✓  ${slug.padEnd(25)} (${action})`)
    passed++
  } else {
    console.error(`   ✗  ${slug.padEnd(25)} ${result.status ?? ''} ${result.error?.slice(0, 120)}`)
    failed++
  }
}

console.log(`\n${failed === 0 ? '✅' : '⚠️ '} Done — ${passed} deployed, ${failed} failed\n`)
