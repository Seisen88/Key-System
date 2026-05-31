import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

function adminClient(serviceKey) {
  return createClient(SUPABASE_URL, serviceKey)
}

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function Admin() {
  const [serviceKey, setServiceKey] = useState(() => localStorage.getItem('seistem_admin_key') || '')
  const [authed,     setAuthed]     = useState(false)
  const [keys,       setKeys]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [filter,     setFilter]     = useState('all') // all | active | expired
  const [editKey,    setEditKey]    = useState(null)  // { id, expires_at }
  const [newExpiry,  setNewExpiry]  = useState('')
  const [error,      setError]      = useState('')

  const supabase = authed ? adminClient(serviceKey) : null

  const fetchKeys = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase
      .from('keys')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { setError(error.message); setLoading(false); return }
    setKeys(data || [])
    setLoading(false)
  }, [serviceKey, authed])

  useEffect(() => { if (authed) fetchKeys() }, [authed])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    const key = serviceKey.trim()
    if (!key) return
    // Quick test: try to read from keys table
    const client = adminClient(key)
    const { error } = await client.from('keys').select('id').limit(1)
    if (error) { setError('Invalid service role key or insufficient permissions.'); return }
    localStorage.setItem('seistem_admin_key', key)
    setAuthed(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this key?')) return
    await supabase.from('keys').delete().eq('id', id)
    setKeys(k => k.filter(x => x.id !== id))
  }

  const handleExtend = async () => {
    if (!editKey || !newExpiry) return
    const { error } = await supabase
      .from('keys')
      .update({ expires_at: new Date(newExpiry).toISOString() })
      .eq('id', editKey.id)
    if (error) { setError(error.message); return }
    setKeys(k => k.map(x => x.id === editKey.id ? { ...x, expires_at: new Date(newExpiry).toISOString() } : x))
    setEditKey(null)
    setNewExpiry('')
  }

  const handleRevokeHwid = async (id) => {
    if (!confirm('Clear HWID lock? The key can be used on a new device.')) return
    await supabase.from('keys').update({ hwid: null }).eq('id', id)
    setKeys(k => k.map(x => x.id === id ? { ...x, hwid: null } : x))
  }

  const filtered = keys.filter(k => {
    const active = new Date(k.expires_at) > new Date()
    if (filter === 'active'  && !active) return false
    if (filter === 'expired' &&  active) return false
    const q = search.toLowerCase()
    return !q || k.key_value?.toLowerCase().includes(q) || k.ip_address?.toLowerCase().includes(q) || k.provider?.toLowerCase().includes(q)
  })

  // ── Login screen ────────────────────────────────────────────────
  if (!authed) return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-card border border-border
                          rounded-full px-4 py-1.5 text-xs text-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block"/>
            Admin Dashboard
          </div>
          <h1 className="text-2xl font-bold text-text">Key Management</h1>
          <p className="text-muted text-sm mt-2">Enter your Supabase service role key</p>
        </div>
        <form onSubmit={handleLogin} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <input
            type="password"
            value={serviceKey}
            onChange={e => setServiceKey(e.target.value)}
            placeholder="service_role key..."
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm
                       text-text font-mono outline-none focus:border-accent transition"
          />
          <button type="submit"
            className="w-full py-3 rounded-xl bg-accent text-bg font-bold text-sm
                       hover:brightness-110 transition">
            Sign In
          </button>
        </form>
      </div>
    </div>
  )

  // ── Dashboard ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg text-text px-4 py-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Key Management</h1>
            <p className="text-muted text-sm mt-1">{keys.length} total keys</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchKeys}
              className="px-4 py-2 rounded-xl border border-border text-sm text-muted
                         hover:text-text hover:border-accent transition">
              ↻ Refresh
            </button>
            <button onClick={() => { localStorage.removeItem('seistem_admin_key'); setAuthed(false); setKeys([]) }}
              className="px-4 py-2 rounded-xl border border-border text-sm text-dim
                         hover:text-muted transition">
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total',   value: keys.length,                                           color: 'text-text'  },
            { label: 'Active',  value: keys.filter(k => new Date(k.expires_at) > new Date()).length, color: 'text-accent' },
            { label: 'Expired', value: keys.filter(k => new Date(k.expires_at) <= new Date()).length, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-dim text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search key, IP, provider..."
            className="flex-1 bg-card border border-border rounded-xl px-4 py-2 text-sm
                       text-text outline-none focus:border-accent transition"
          />
          {['all','active','expired'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition
                ${filter === f
                  ? 'bg-accent text-bg border-accent'
                  : 'bg-card border-border text-muted hover:text-text'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {/* Keys table */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({length:5}).map((_,i) => (
              <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse"/>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center text-dim text-sm py-12">No keys found.</div>
            )}
            {filtered.map(k => {
              const active = new Date(k.expires_at) > new Date()
              return (
                <div key={k.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start gap-4">

                    {/* Status dot */}
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0
                      ${active ? 'bg-accent' : 'bg-red-400'}`}/>

                    {/* Key info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-sm text-accent">{k.key_value}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border
                          ${active
                            ? 'bg-accent/10 text-accent border-accent/30'
                            : 'bg-red-400/10 text-red-400 border-red-400/30'}`}>
                          {active ? `Active · ${timeLeft(k.expires_at)} left` : 'Expired'}
                        </span>
                        <span className="text-xs text-dim bg-bg border border-border
                                         px-2 py-0.5 rounded-full">
                          {k.provider}
                        </span>
                      </div>
                      <div className="flex gap-4 mt-1.5 text-xs text-dim flex-wrap">
                        <span>IP: {k.ip_address ?? '—'}</span>
                        <span>Created: {new Date(k.created_at).toLocaleString()}</span>
                        <span>Expires: {new Date(k.expires_at).toLocaleString()}</span>
                        <span>HWID: {k.hwid ? `${k.hwid.slice(0,12)}…` : 'Not locked'}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => { setEditKey(k); setNewExpiry('') }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-border
                                   text-muted hover:text-text hover:border-accent transition">
                        Edit
                      </button>
                      {k.hwid && (
                        <button
                          onClick={() => handleRevokeHwid(k.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-border
                                     text-muted hover:text-text transition">
                          Reset HWID
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(k.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-400/30
                                   text-red-400 hover:bg-red-400/10 transition">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editKey && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
            <h2 className="font-bold text-lg mb-1">Edit Key Expiry</h2>
            <p className="text-dim text-xs font-mono mb-4">{editKey.key_value}</p>
            <p className="text-muted text-xs mb-2">Current expiry: {new Date(editKey.expires_at).toLocaleString()}</p>
            <input
              type="datetime-local"
              value={newExpiry}
              onChange={e => setNewExpiry(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm
                         text-text outline-none focus:border-accent transition mb-4"
            />
            <div className="flex gap-3">
              <button onClick={handleExtend}
                className="flex-1 py-2.5 rounded-xl bg-accent text-bg font-semibold text-sm
                           hover:brightness-110 transition">
                Save
              </button>
              <button onClick={() => { setEditKey(null); setNewExpiry('') }}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm
                           hover:text-text transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
