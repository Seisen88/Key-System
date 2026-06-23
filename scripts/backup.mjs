/**
 * Supabase full backup script
 * Dumps all table data to backup/data/*.json
 * Run: node scripts/backup.mjs
 *
 * Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 * For full data access (roblox_accounts etc) you need the SERVICE ROLE KEY.
 * Set SUPABASE_SERVICE_ROLE_KEY in .env or pass it as an env var.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root      = resolve(__dirname, '..')

// ── Load .env manually (no dotenv dependency needed) ──────────────────────────
const envPath = resolve(root, '.env')
const envVars = {}
try {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && k.trim() && !k.trim().startsWith('#')) {
      envVars[k.trim()] = v.join('=').trim()
    }
  })
} catch {
  console.error('Could not read .env — make sure it exists at project root.')
  process.exit(1)
}

const SUPABASE_URL      = envVars['VITE_SUPABASE_URL']       || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY  = envVars['SUPABASE_SERVICE_ROLE_KEY'] || process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY          = envVars['VITE_SUPABASE_ANON_KEY']   || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  console.error('Missing VITE_SUPABASE_URL in .env')
  process.exit(1)
}

if (!SERVICE_ROLE_KEY) {
  console.warn('\n⚠  SUPABASE_SERVICE_ROLE_KEY not found in .env')
  console.warn('   Some tables (roblox_accounts, rate_limits) may be empty due to RLS.')
  console.warn('   Add it to .env as: SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n')
}

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY || ANON_KEY,
  { auth: { persistSession: false } }
)

// ── Tables to back up ─────────────────────────────────────────────────────────
// audit_log and site_visits can be very large — skip them unless --all is passed
const ALL_TABLES = [
  'keys',
  'roblox_accounts',
  'rate_limits',
  'validate_rate_limits',
  'integrations',
  'bans',
  'lootlabs_tokens',
  'releases',
  // high-volume / large tables — only included with --all flag
  'audit_log',
  'site_visits',
]

const includeAll = process.argv.includes('--all')
const TABLES = includeAll
  ? ALL_TABLES
  : ALL_TABLES.filter(t => !['audit_log', 'site_visits'].includes(t))

// ── Output directory ──────────────────────────────────────────────────────────
const outDir = resolve(root, 'backup', 'data')
mkdirSync(outDir, { recursive: true })

// ── Paginated fetch (handles tables > 1000 rows) ─────────────────────────────
async function fetchAll(table) {
  const PAGE = 1000
  let rows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows = rows.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

// ── Main ──────────────────────────────────────────────────────────────────────
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const summary   = []

const dryRun = process.argv.includes('--dry-run')

console.log(`\n🗂  Supabase backup — ${timestamp}`)
console.log(`   URL: ${SUPABASE_URL}`)
console.log(`   Key: ${SERVICE_ROLE_KEY ? 'service role ✓' : 'anon (limited)'}`)
console.log(`   Mode: ${dryRun ? 'DRY RUN (no files written)' : includeAll ? 'full (--all)' : 'standard (skips audit_log, site_visits)'}`)
console.log()

for (const table of TABLES) {
  try {
    const rows = await fetchAll(table)
    const json  = JSON.stringify(rows, null, 2)
    const kb    = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1)
    if (!dryRun) {
      const file = resolve(outDir, `${table}.json`)
      writeFileSync(file, json, 'utf8')
    }
    console.log(`   ✓ ${table.padEnd(25)} ${String(rows.length).padStart(5)} rows  ${kb.padStart(8)} KB${dryRun ? '' : `  →  backup/data/${table}.json`}`)
    summary.push({ table, rows: rows.length, status: dryRun ? 'dry-run' : 'ok' })
  } catch (err) {
    const msg = err?.message || String(err)
    // Table may not exist yet — skip gracefully
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) {
      console.log(`   –  ${table.padEnd(25)} (table does not exist — skipped)`)
      summary.push({ table, rows: 0, status: 'skipped' })
    } else {
      console.error(`   ✗  ${table.padEnd(25)} ERROR: ${msg}`)
      summary.push({ table, rows: 0, status: 'error', error: msg })
    }
  }
}

// ── Write manifest ────────────────────────────────────────────────────────────
const manifest = {
  backed_up_at:   new Date().toISOString(),
  supabase_url:   SUPABASE_URL,
  tables:         summary,
  edge_functions: [
    'generate-key',
    'get-link',
    'lookup-key',
    'lootlabs-postback',
    'reset-hwid',
    'validate-key',
  ],
  secrets_needed: [
    // ── Supabase project-level ────────────────────────────────────────────
    'SUPABASE_SERVICE_ROLE_KEY     (new project → Settings → API → service_role)',
    'SUPABASE_ANON_KEY             (new project → Settings → API → anon/public)',
    'SUPABASE_URL                  (new project → Settings → API → Project URL)',
    // ── Edge Function secrets (Dashboard → Edge Functions → Secrets) ──────
    'WORKINK_API_KEY               (Edge Function secret — copy value before deleting old project)',
    'SITE_URL                      (Edge Function secret — your public site URL)',
    'LOOTLABS_API_KEY              (Edge Function secret — copy value before deleting old project)',
    'LOCKR_API_KEY                 (Edge Function secret — copy value before deleting old project)',
    'VALIDATION_HMAC_SECRET        (Edge Function secret — copy value before deleting old project)',
    'ADMIN_LOOKUP_SECRET           (Edge Function secret — sk_lookup_r8m2x9kq4zt7nv3fw6yj)',
    // ── Frontend .env (update after creating new project) ────────────────
    'VITE_SUPABASE_URL             (.env — new project URL)',
    'VITE_SUPABASE_ANON_KEY        (.env — new anon key)',
    'VITE_ADMIN_LOOKUP_SECRET      (.env — same value as ADMIN_LOOKUP_SECRET above)',
    // ── Reiya app (requires recompile after updating) ────────────────────
    '_URL_XOR in lib.rs            (re-XOR the new Supabase URL)',
    '_ANON_XOR in lib.rs           (re-XOR the new anon key)',
  ],
  notes: [
    'Edge function source code is in supabase/functions/ — already in your repo.',
    'Migrations are in supabase/migrations/ — run them in order on the new project.',
    'Secrets must be re-added manually in the new Supabase project dashboard.',
    'After restoring, update VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
    'Also update the XOR-encoded URL/anon key in src-tauri/src/lib.rs (Reiya app).',
  ],
}

writeFileSync(
  resolve(root, 'backup', 'manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
)

console.log(`\n📋 Manifest saved → backup/manifest.json`)
console.log('\n─────────────────────────────────────────────────────────────────')
console.log('  Secrets you need to copy from the old project before deleting:')
manifest.secrets_needed.forEach(s => console.log(`  • ${s}`))
console.log('─────────────────────────────────────────────────────────────────\n')
console.log('✅ Backup complete.\n')
