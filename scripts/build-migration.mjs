/**
 * Concatenates all migrations into a single SQL file ready to paste
 * into the Supabase SQL editor.
 * Run: node scripts/build-migration.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root      = resolve(__dirname, '..')
const dir       = resolve(root, 'supabase', 'migrations')

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
  '008_security.sql',              // creates roblox_accounts — must run before 007
  '007_roblox_accounts_timestamps.sql', // alters roblox_accounts
]

let combined = '-- AUTO-GENERATED: paste this entire file into Supabase SQL editor\n\n'

for (const file of MIGRATIONS) {
  const path = resolve(dir, file)
  if (!existsSync(path)) { console.warn(`  skip: ${file} (not found)`); continue }
  combined += `-- ────────────────────────────────────────────\n`
  combined += `-- ${file}\n`
  combined += `-- ────────────────────────────────────────────\n`
  combined += readFileSync(path, 'utf8').trim()
  combined += '\n\n'
  console.log(`  + ${file}`)
}

mkdirSync(resolve(root, 'backup'), { recursive: true })
const out = resolve(root, 'backup', 'all_migrations.sql')
writeFileSync(out, combined, 'utf8')
console.log(`\n✅ Written → backup/all_migrations.sql  (${(combined.length/1024).toFixed(1)} KB)`)
console.log(`\nPaste it here:`)
console.log(`  https://supabase.com/dashboard/project/hmrypwvgyapyvpmdsstu/sql/new\n`)
