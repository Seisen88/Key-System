/**
 * Toggle sandbox mode on the Supabase edge functions.
 * Usage:
 *   node scripts/sandbox.mjs on    → SANDBOX=true  (skip verification, for testing)
 *   node scripts/sandbox.mjs off   → SANDBOX=false (live mode)
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root      = resolve(__dirname, '..')

const envVars = {}
readFileSync(resolve(root, '.env'), 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && k.trim() && !k.trim().startsWith('#'))
    envVars[k.trim()] = v.join('=').trim()
})

const PAT = envVars['SUPABASE_PAT']
const URL = envVars['VITE_SUPABASE_URL']
const REF = new URL(URL).hostname.split('.')[0]

const mode = process.argv[2]
if (!['on', 'off'].includes(mode)) {
  console.log('Usage: node scripts/sandbox.mjs on|off')
  process.exit(1)
}

const value = mode === 'on' ? 'true' : 'false'

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
  method:  'POST',
  headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
  body:    JSON.stringify([{ name: 'SANDBOX', value }]),
})

if (res.ok) {
  console.log(`\n✅ SANDBOX=${value} — ${mode === 'on' ? 'testing mode (no verification)' : 'live mode (full verification)'}\n`)
} else {
  console.error('Failed:', await res.text())
}
