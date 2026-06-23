/**
 * Runs all SQL migrations against a Supabase project via the management API.
 * Requires SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in .env
 *
 * Run: node scripts/migrate.mjs
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname, basename } from 'path'
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

const SUPABASE_URL      = envVars['VITE_SUPABASE_URL']
const SERVICE_ROLE_KEY  = envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

// Extract project ref from URL: https://<ref>.supabase.co
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]

// ── Migration order ───────────────────────────────────────────────────────────
// Explicit order to avoid dependency issues with the duplicate-numbered files
const MIGRATIONS = [
  '001_init.sql',
  '002_tiers.sql',
  '002_admin_columns.sql',
  '003_lootlabs_tokens.sql',
  '003_site_visits.sql',
  '004_download_count.sql',
  '005_update_tiers.sql',
  '006_releases.sql',
  'audit_bans_hwid_resets.sql',
  'security_hardening.sql',
  '008_security.sql',
  '007_roblox_accounts_timestamps.sql',
]

const migrationsDir = resolve(root, 'supabase', 'migrations')

// ── Execute SQL via Supabase management API ───────────────────────────────────
async function runSQL(sql, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )

  if (res.ok) return { ok: true }

  // Try the direct REST SQL endpoint as fallback
  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method:  'POST',
    headers: {
      'apikey':          SERVICE_ROLE_KEY,
      'Authorization':   `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type':    'application/json',
    },
    body: JSON.stringify({ sql }),
  })

  if (res2.ok) return { ok: true }

  const text = await res.text().catch(() => '(no body)')
  return { ok: false, error: text }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n🚀 Running migrations → ${SUPABASE_URL}`)
console.log(`   Project: ${PROJECT_REF}\n`)

let passed = 0
let failed = 0

for (const file of MIGRATIONS) {
  const filePath = resolve(migrationsDir, file)
  if (!existsSync(filePath)) {
    console.log(`   –  ${file.padEnd(40)} (file not found — skipped)`)
    continue
  }

  const sql = readFileSync(filePath, 'utf8')
  const { ok, error } = await runSQL(sql, file)

  if (ok) {
    console.log(`   ✓  ${file}`)
    passed++
  } else {
    console.error(`   ✗  ${file}`)
    console.error(`      ${error?.slice(0, 200)}`)
    failed++
  }
}

console.log(`\n${failed === 0 ? '✅' : '⚠️ '} Done — ${passed} passed, ${failed} failed`)

if (failed > 0) {
  console.log('\nFor failed migrations, paste the SQL manually in:')
  console.log(`  ${SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`)
}

console.log()
