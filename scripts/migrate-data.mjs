/**
 * Migrates all table data from old Supabase project to new one.
 * Usage: node scripts/migrate-data.mjs
 *
 * Requires env vars (or .env file):
 *   OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envVars = {}
try {
  readFileSync(resolve(__dirname, '../.env'), 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && k.trim() && !k.trim().startsWith('#')) envVars[k.trim()] = v.join('=').trim()
  })
} catch {}

const OLD_URL = process.env.OLD_SUPABASE_URL        || envVars['OLD_SUPABASE_URL']
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY || envVars['OLD_SUPABASE_SERVICE_ROLE_KEY']
const NEW_URL = process.env.VITE_SUPABASE_URL        || envVars['VITE_SUPABASE_URL']
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error('Missing required env vars. Add to .env:\n  OLD_SUPABASE_URL\n  OLD_SUPABASE_SERVICE_ROLE_KEY\n  VITE_SUPABASE_URL\n  SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const PAGE = 1000

async function fetchAll(table) {
  const rows = []
  let offset = 0
  while (true) {
    const res = await fetch(
      `${OLD_URL}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${OLD_KEY}`, apikey: OLD_KEY } }
    )
    if (!res.ok) { console.error(`  fetch error ${res.status}:`, await res.text()); break }
    const batch = await res.json()
    if (!batch.length) break
    rows.push(...batch)
    if (batch.length < PAGE) break
    offset += PAGE
  }
  return rows
}

async function upsert(table, rows, conflict) {
  if (!rows.length) return { inserted: 0, skipped: 0 }
  const CHUNK = 200
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const res = await fetch(
      `${NEW_URL}/rest/v1/${table}?on_conflict=${conflict}`,
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${NEW_KEY}`,
          apikey:         NEW_KEY,
          'Content-Type': 'application/json',
          Prefer:         'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify(chunk),
      }
    )
    if (!res.ok) {
      const body = await res.text()
      console.error(`  upsert error on ${table} chunk ${i}: ${res.status} ${body}`)
    } else {
      inserted += chunk.length
    }
  }
  return { inserted }
}

const tables = [
  { name: 'keys',            conflict: 'id' },
  { name: 'rate_limits',     conflict: 'ip_address' },
  { name: 'lootlabs_tokens', conflict: 'puid' },
  { name: 'roblox_accounts', conflict: 'username' },
  { name: 'audit_log',       conflict: 'id' },
  { name: 'bans',            conflict: 'id' },
  { name: 'hwid_resets',     conflict: 'id' },
]

console.log('\n── Migrating data from old → new project ─────────────────\n')
for (const { name, conflict } of tables) {
  process.stdout.write(`${name.padEnd(20)} fetching...`)
  const rows = await fetchAll(name)
  process.stdout.write(`\r${name.padEnd(20)} ${rows.length} rows → upserting...`)
  const { inserted } = await upsert(name, rows, conflict)
  console.log(`\r${name.padEnd(20)} ${rows.length} rows → done (${inserted} sent)`)
}

console.log('\n✅ Migration complete.\n')
