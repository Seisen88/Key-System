/**
 * Migrates all table data from old Supabase project to new one.
 * Usage: node scripts/migrate-data.mjs
 */

const OLD_URL = 'https://lpxhbjhkfimzjnuickji.supabase.co'
const OLD_KEY = 'REMOVED_OLD_SERVICE_KEY'

const NEW_URL = 'https://hmrypwvgyapyvpmdsstu.supabase.co'
const NEW_KEY = 'REMOVED_NEW_SERVICE_KEY'

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
