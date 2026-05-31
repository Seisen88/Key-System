import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

function adminClient(k) { return createClient(SUPABASE_URL, k) }

// ── Helpers ──────────────────────────────────────────────────────────────────
function isActive(k)   { return !k.is_disabled && new Date(k.expires_at) > new Date() }
function isExpired(k)  { return new Date(k.expires_at) <= new Date() }
function isDisabled(k) { return k.is_disabled }

function timeLeft(expiresAt) {
  const d = new Date(expiresAt) - new Date()
  if (d <= 0) return 'Expired'
  const h = Math.floor(d / 3_600_000), m = Math.floor((d % 3_600_000) / 60_000)
  return h > 48 ? `${Math.floor(h/24)}d ${h%24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

function randomKey() {
  const s = () => Math.random().toString(36).substring(2,6).toUpperCase()
  return `RAM-${s()}-${s()}-${s()}-${s()}`
}

// ── Icon primitives ───────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, ...p }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} {...p}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)
const Copy    = p => <Icon d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" {...p}/>
const Trash   = p => <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" {...p}/>
const Edit    = p => <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" {...p}/>
const Clock   = p => <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" {...p}/>
const Key     = p => <Icon d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" {...p}/>
const Grid    = p => <Icon d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" {...p}/>
const List    = p => <Icon d="M4 6h16M4 10h16M4 14h16M4 18h16" {...p}/>
const Shield  = p => <Icon d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" {...p}/>
const ChevD   = p => <Icon d="M19 9l-7 7-7-7" {...p}/>
const Plus    = p => <Icon d="M12 4v16m8-8H4" {...p}/>
const Download= p => <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" {...p}/>
const Dash    = p => <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" {...p}/>
const Refresh = p => <Icon d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" {...p}/>
const X       = p => <Icon d="M6 18L18 6M6 6l12 12" {...p}/>

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ title, sub, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="font-bold text-base text-white">{title}</h2>
            {sub && <p className="text-white/40 text-xs mt-0.5 font-mono">{sub}</p>}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition p-1 rounded-lg hover:bg-white/10">
            <X size={18}/>
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function Input({ label, ...p }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-white/60 text-xs font-semibold uppercase tracking-wide">{label}</label>}
      <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white
                        outline-none focus:border-purple-500/60 transition placeholder-white/20" {...p}/>
    </div>
  )
}

function Toggle({ label, icon, checked, onChange }) {
  return (
    <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2.5">
        {icon && <span>{icon}</span>}
        <span className="text-sm text-white/80">{label}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-all relative ${checked ? 'bg-purple-600' : 'bg-white/15'}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-6' : 'left-1'}`}/>
      </button>
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [key, setKey] = useState(() => localStorage.getItem('seistem_admin_key') || '')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const k = key.trim()
    if (!k) return
    setLoading(true); setErr('')
    const { error } = await adminClient(k).from('keys').select('id').limit(1)
    setLoading(false)
    if (error) { setErr('Invalid key or insufficient permissions.'); return }
    localStorage.setItem('seistem_admin_key', k)
    onLogin(k)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-4">
            <Shield size={24} className="text-purple-400"/>
          </div>
          <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">Sign in with your service role key</p>
        </div>
        <form onSubmit={submit} className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4">
          {err && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-2.5">{err}</div>}
          <Input label="Service Role Key" type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder="eyJ..."/>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50
                       text-white font-semibold text-sm transition">
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ view, setView, onSignOut, keyCount }) {
  const nav = [
    { id:'dashboard', label:'Dashboard', icon: <Dash size={17}/> },
    { id:'keys',      label:'Keys',      icon: <Key  size={17}/>, badge: keyCount },
  ]
  return (
    <aside className="w-56 bg-[#0f0f0f] border-r border-white/8 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <Shield size={16} className="text-purple-400"/>
          </div>
          <div>
            <div className="text-sm font-bold text-white">Seistem</div>
            <div className="text-xs text-white/30">Admin Panel</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {nav.map(n => (
          <button key={n.id} onClick={() => setView(n.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left
              ${view===n.id ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
            <span className={view===n.id?'text-purple-400':''}>{n.icon}</span>
            <span className="flex-1">{n.label}</span>
            {n.badge !== undefined && (
              <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{n.badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-white/8">
        <button onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-red-400 hover:bg-red-500/10 transition">
          <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" size={17}/>
          Sign Out
        </button>
      </div>
    </aside>
  )
}

// ── Dashboard view ────────────────────────────────────────────────────────────
function Dashboard({ keys }) {
  const now    = new Date()
  const today  = new Date(now); today.setHours(0,0,0,0)
  const week   = new Date(now); week.setDate(week.getDate()-7)
  const month  = new Date(now); month.setDate(1); month.setHours(0,0,0,0)

  const stats = [
    { label:'Total Keys',     value: keys.length,                                                     color:'text-white',      bg:'bg-white/5',         icon: <Key size={20}/> },
    { label:'Active',         value: keys.filter(isActive).length,                                    color:'text-green-400',  bg:'bg-green-500/10',    icon: <Shield size={20} className="text-green-400"/> },
    { label:'Expired',        value: keys.filter(isExpired).length,                                   color:'text-red-400',    bg:'bg-red-500/10',      icon: <Clock size={20} className="text-red-400"/> },
    { label:'Premium',        value: keys.filter(k=>k.is_premium).length,                            color:'text-yellow-400', bg:'bg-yellow-500/10',   icon: <span className="text-yellow-400 text-xl">★</span> },
    { label:'Created Today',  value: keys.filter(k=>new Date(k.created_at)>=today).length,           color:'text-purple-400', bg:'bg-purple-500/10',   icon: <Plus size={20} className="text-purple-400"/> },
    { label:'This Month',     value: keys.filter(k=>new Date(k.created_at)>=month).length,           color:'text-blue-400',   bg:'bg-blue-500/10',     icon: <Dash size={20} className="text-blue-400"/> },
  ]

  // Provider breakdown
  const providers = keys.reduce((acc,k) => { acc[k.provider]=(acc[k.provider]||0)+1; return acc },{})
  const providerList = Object.entries(providers).sort((a,b)=>b[1]-a[1])

  // Recent 5 keys
  const recent = [...keys].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5)

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">Analytics overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className={`${s.bg} border border-white/8 rounded-2xl p-4`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">{s.label}</span>
              {s.icon}
            </div>
            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Provider breakdown */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <h3 className="font-semibold text-white text-sm mb-4">Provider Breakdown</h3>
          {providerList.length === 0
            ? <p className="text-white/30 text-sm text-center py-6">No data</p>
            : providerList.map(([name, count]) => (
              <div key={name} className="flex items-center gap-3 mb-3">
                <span className="text-white/60 text-sm flex-1 capitalize">{name}</span>
                <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                  <div className="bg-purple-500 h-2 rounded-full" style={{width:`${(count/keys.length*100).toFixed(0)}%`}}/>
                </div>
                <span className="text-white/40 text-xs w-8 text-right">{count}</span>
              </div>
            ))
          }
        </div>

        {/* Recent keys */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
          <h3 className="font-semibold text-white text-sm mb-4">Recently Created</h3>
          <div className="space-y-2.5">
            {recent.map(k => (
              <div key={k.id} className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive(k)?'bg-green-400':isDisabled(k)?'bg-yellow-400':'bg-red-400'}`}/>
                <span className="font-mono text-white/50 text-xs flex-1 truncate">{k.key_value}</span>
                <span className="text-white/30 text-xs">{fmtDate(k.created_at)}</span>
              </div>
            ))}
            {recent.length === 0 && <p className="text-white/30 text-sm text-center py-4">No keys yet</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Keys view ─────────────────────────────────────────────────────────────────
function Keys({ keys, setKeys, supabase, onRefresh }) {
  const [search,      setSearch]      = useState('')
  const [filterStatus,setFilterStatus]= useState('all')     // all|active|expired|disabled
  const [filterTier,  setFilterTier]  = useState('all')     // all|standard|premium
  const [layout,      setLayout]      = useState('list')
  const [expanded,    setExpanded]    = useState({})
  const [copied,      setCopied]      = useState({})

  // Modals
  const [editModal,     setEditModal]    = useState(null)
  const [hwidModal,     setHwidModal]    = useState(null)
  const [disableModal,  setDisableModal] = useState(null)
  const [createModal,   setCreateModal] = useState(false)
  const [newHwid,       setNewHwid]     = useState('')

  // Create key form
  const [createForm, setCreateForm] = useState({
    key_value: randomKey(), hours: 24, is_premium: false, key_name: '', discord_user_id: '', discord_username: ''
  })

  // Filters
  const filtered = keys.filter(k => {
    if (filterTier === 'standard' && k.is_premium)  return false
    if (filterTier === 'premium'  && !k.is_premium) return false
    if (filterStatus === 'active'   && !isActive(k))   return false
    if (filterStatus === 'expired'  && !isExpired(k))  return false
    if (filterStatus === 'disabled' && !isDisabled(k)) return false
    const q = search.toLowerCase()
    return !q || k.key_value?.toLowerCase().includes(q)
              || k.discord_username?.toLowerCase().includes(q)
              || k.discord_user_id?.toLowerCase().includes(q)
              || k.provider?.toLowerCase().includes(q)
              || k.hwid?.toLowerCase().includes(q)
  })

  const copyKey = (key, id) => {
    navigator.clipboard.writeText(key)
    setCopied(p => ({...p,[id]:true}))
    setTimeout(()=>setCopied(p=>({...p,[id]:false})),2000)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this key permanently?')) return
    await supabase.from('keys').delete().eq('id', id)
    setKeys(k => k.filter(x => x.id !== id))
  }

  const handleDeleteExpired = async () => {
    if (!confirm('Delete all expired keys?')) return
    const expired = keys.filter(isExpired).map(k=>k.id)
    if (!expired.length) return
    await supabase.from('keys').delete().in('id', expired)
    setKeys(k => k.filter(x => !expired.includes(x.id)))
  }

  const handleSaveEdit = async () => {
    const { id, ...fields } = editModal
    const { error } = await supabase.from('keys').update(fields).eq('id', id)
    if (error) return
    setKeys(k => k.map(x => x.id === id ? { ...x, ...fields } : x))
    setEditModal(null)
  }

  const handleDisable = async () => {
    const { id, until } = disableModal
    const { error } = await supabase.from('keys').update({
      is_disabled: true, disabled_until: until ? new Date(until).toISOString() : null
    }).eq('id', id)
    if (error) return
    setKeys(k => k.map(x => x.id===id ? {...x, is_disabled:true, disabled_until: until} : x))
    setDisableModal(null)
  }

  const handleEnable = async (id) => {
    await supabase.from('keys').update({ is_disabled: false, disabled_until: null }).eq('id', id)
    setKeys(k => k.map(x => x.id===id ? {...x, is_disabled:false, disabled_until:null} : x))
  }

  const handleClearHwid = async (id) => {
    await supabase.from('keys').update({ hwid: null }).eq('id', id)
    setKeys(k => k.map(x => x.id===id ? {...x, hwid:null} : x))
    setHwidModal(m => m ? {...m, hwid:null} : m)
  }

  const handleCreateKey = async () => {
    const expiresAt = new Date(Date.now() + createForm.hours * 3_600_000).toISOString()
    const row = {
      key_value: createForm.key_value, provider: 'admin', expires_at: expiresAt,
      is_premium: createForm.is_premium, key_name: createForm.key_name,
      discord_user_id: createForm.discord_user_id, discord_username: createForm.discord_username
    }
    const { data, error } = await supabase.from('keys').insert(row).select().single()
    if (error || !data) return
    setKeys(k => [data, ...k])
    setCreateModal(false)
    setCreateForm({ key_value: randomKey(), hours:24, is_premium:false, key_name:'', discord_user_id:'', discord_username:'' })
  }

  const handleExport = () => {
    const csv = ['key,status,provider,expires_at,discord_username,hwid',
      ...keys.map(k=>`${k.key_value},${isActive(k)?'active':'expired'},${k.provider},${k.expires_at},${k.discord_username||''},${k.hwid||''}`)
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = 'seistem_keys.csv'; a.click()
  }

  const statusTabs = [
    {id:'all',label:'All',count:keys.length},
    {id:'active',label:'Active',count:keys.filter(isActive).length},
    {id:'expired',label:'Expired',count:keys.filter(isExpired).length},
    {id:'disabled',label:'Disabled',count:keys.filter(isDisabled).length},
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur border-b border-white/8 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Keys</h1>
            <p className="text-white/40 text-sm">{keys.length} Keys</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white text-xs font-medium transition">
              <Refresh size={13}/> Refresh
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white text-xs font-medium transition">
              <Download size={13}/> Export
            </button>
            <button onClick={handleDeleteExpired}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium transition">
              <Trash size={13}/> Delete Expired
            </button>
            <button onClick={() => setCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition">
              <Plus size={13}/> Create Key
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search Key, HWID, Provider, Discord..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/50 transition placeholder-white/20"/>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tier filter */}
          {['all','standard','premium'].map(t => (
            <button key={t} onClick={()=>setFilterTier(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition
                ${filterTier===t
                  ? t==='premium' ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                                  : 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                  : 'border-white/10 text-white/40 hover:text-white'}`}>
              {t==='premium'?'⭐ Premium': t==='standard'?'Standard':'All Tiers'}
            </button>
          ))}

          <div className="w-px h-5 bg-white/10 mx-1"/>

          {/* Status filter */}
          {statusTabs.map(t => (
            <button key={t.id} onClick={()=>setFilterStatus(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition
                ${filterStatus===t.id
                  ? 'bg-green-500/20 border-green-500/40 text-green-400'
                  : 'border-white/10 text-white/40 hover:text-white'}`}>
              {t.label} <span className="opacity-60 ml-1">{t.count}</span>
            </button>
          ))}

          <div className="ml-auto flex gap-1.5">
            {[{id:'list',icon:<List size={14}/>},{id:'grid',icon:<Grid size={14}/>}].map(l=>(
              <button key={l.id} onClick={()=>setLayout(l.id)}
                className={`p-2 rounded-xl border transition ${layout===l.id?'border-purple-500/40 bg-purple-600/20 text-purple-300':'border-white/10 text-white/40 hover:text-white'}`}>
                {l.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key list */}
      <div className={`p-6 ${layout==='grid'?'grid grid-cols-2 gap-3':'space-y-2'}`}>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-white/30">No keys found.</div>
        )}
        {filtered.map(k => {
          const active  = isActive(k)
          const expired = isExpired(k)
          const disabled= isDisabled(k)
          const exp     = expanded[k.id]

          return (
            <div key={k.id} className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition">
              {/* Main row */}
              <div className="flex items-center gap-3 px-5 py-4">
                {/* Status dot */}
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${disabled?'bg-yellow-400':expired?'bg-red-400':'bg-green-400'}`}/>

                {/* Key value */}
                <span className="font-mono text-sm text-white/80 flex-1 truncate">{k.key_value}</span>

                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border
                    ${disabled?'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
                    :expired ?'bg-red-500/15 text-red-400 border-red-500/25'
                              :'bg-green-500/15 text-green-400 border-green-500/25'}`}>
                    {disabled?'Disabled':expired?'Expired':'Active'}
                  </span>
                  {k.is_premium && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
                      ⭐ Premium
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={()=>copyKey(k.key_value,k.id)} title="Copy Key"
                    className="p-2 rounded-xl border border-white/8 text-white/40 hover:text-white hover:border-white/20 transition">
                    {copied[k.id]?<span className="text-green-400 text-xs font-bold">✓</span>:<Copy size={14}/>}
                  </button>
                  <button onClick={()=>setHwidModal(k)} title="HWID Management"
                    className="p-2 rounded-xl border border-white/8 text-white/40 hover:text-purple-400 hover:border-purple-500/30 transition">
                    <Shield size={14}/>
                  </button>
                  <button onClick={()=>disabled?handleEnable(k.id):setDisableModal({id:k.id,key:k.key_value,until:''})} title={disabled?'Enable':'Disable temporarily'}
                    className={`p-2 rounded-xl border transition ${disabled?'border-yellow-500/30 text-yellow-400':'border-white/8 text-white/40 hover:text-yellow-400 hover:border-yellow-500/30'}`}>
                    <Clock size={14}/>
                  </button>
                  <button onClick={()=>setEditModal({...k})} title="Edit"
                    className="p-2 rounded-xl border border-white/8 text-white/40 hover:text-blue-400 hover:border-blue-500/30 transition">
                    <Edit size={14}/>
                  </button>
                  <button onClick={()=>handleDelete(k.id)} title="Delete"
                    className="p-2 rounded-xl border border-white/8 text-white/40 hover:text-red-400 hover:border-red-500/30 transition">
                    <Trash size={14}/>
                  </button>
                </div>
              </div>

              {/* Sub info */}
              <div className="px-5 pb-3 flex items-center gap-4 text-xs text-white/30">
                <span className="flex items-center gap-1"><Clock size={11}/> {active?`in ${timeLeft(k.expires_at)}`:expired?'Expired':fmtDate(k.expires_at)}</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7"/></svg>
                  {k.provider}
                </span>
                {(k.discord_username || k.discord_user_id) && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
                    {k.discord_username||''} {k.discord_user_id?`(${k.discord_user_id})`:''}
                  </span>
                )}

                {/* Show Details toggle */}
                <button onClick={()=>setExpanded(p=>({...p,[k.id]:!p[k.id]}))}
                  className="ml-auto flex items-center gap-1 text-white/30 hover:text-white/60 transition">
                  {exp?'Hide':'Show'} Details
                  <ChevD size={11} className={`transition-transform ${exp?'rotate-180':''}`}/>
                </button>
              </div>

              {/* Expanded details */}
              {exp && (
                <div className="px-5 pb-4 border-t border-white/5 pt-3 grid grid-cols-2 gap-2 text-xs text-white/40">
                  <div><span className="text-white/25">ID:</span> <span className="font-mono">{k.id}</span></div>
                  <div><span className="text-white/25">Created:</span> {fmtDate(k.created_at)}</div>
                  <div><span className="text-white/25">Expires:</span> {new Date(k.expires_at).toLocaleString()}</div>
                  <div><span className="text-white/25">HWID:</span> {k.hwid?<span className="font-mono">{k.hwid.slice(0,20)}…</span>:'Not locked'}</div>
                  <div><span className="text-white/25">IP:</span> {k.ip_address||'—'}</div>
                  <div><span className="text-white/25">Folder:</span> {k.folder||'—'}</div>
                  {k.key_name && <div><span className="text-white/25">Name:</span> {k.key_name}</div>}
                  <div><span className="text-white/25">One-time:</span> {k.is_one_time?'Yes':'No'}</div>
                  <div><span className="text-white/25">No HWID bind:</span> {k.no_hwid_binding?'Yes':'No'}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Edit modal ──────────────────────────────────────────────────── */}
      {editModal && (
        <Modal title="Edit Key" sub={editModal.key_value} onClose={()=>setEditModal(null)}>
          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <p className="text-white/40 text-xs mb-1">Key</p>
              <p className="font-mono text-white/70 text-sm">{editModal.key_value}</p>
            </div>
            <Input label="Key Name" value={editModal.key_name||''} onChange={e=>setEditModal(m=>({...m,key_name:e.target.value}))} placeholder="Key name"/>
            <Input label="Discord User ID" value={editModal.discord_user_id||''} onChange={e=>setEditModal(m=>({...m,discord_user_id:e.target.value}))} placeholder="123456789012345678"/>
            <Input label="Discord Username" value={editModal.discord_username||''} onChange={e=>setEditModal(m=>({...m,discord_username:e.target.value}))} placeholder="username"/>
            <Input label="Folder" value={editModal.folder||''} onChange={e=>setEditModal(m=>({...m,folder:e.target.value}))} placeholder="e.g. VIP"/>
            <Input label="New Expiry (optional)" type="datetime-local"
              value={editModal._newExpiry||''} onChange={e=>setEditModal(m=>({...m,_newExpiry:e.target.value,expires_at:e.target.value?new Date(e.target.value).toISOString():m.expires_at}))}/>
            <div className="space-y-2">
              <Toggle label="Premium Key" icon="⭐" checked={!!editModal.is_premium} onChange={v=>setEditModal(m=>({...m,is_premium:v}))}/>
              <Toggle label="One-time Use" icon="🔐" checked={!!editModal.is_one_time} onChange={v=>setEditModal(m=>({...m,is_one_time:v}))}/>
              <Toggle label="Expiry on First Use" icon="⏰" checked={!!editModal.expiry_on_first_use} onChange={v=>setEditModal(m=>({...m,expiry_on_first_use:v}))}/>
              <Toggle label="No HWID Binding" icon="🚫" checked={!!editModal.no_hwid_binding} onChange={v=>setEditModal(m=>({...m,no_hwid_binding:v}))}/>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setEditModal(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white transition">Cancel</button>
              <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition flex items-center justify-center gap-2"><Edit size={14}/> Save</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── HWID modal ──────────────────────────────────────────────────── */}
      {hwidModal && (
        <Modal title="HWID Management" sub={hwidModal.key_value} onClose={()=>{setHwidModal(null);setNewHwid('')}}>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white/40 text-xs mb-1">Bound HWIDs</p>
                <p className="text-2xl font-black text-white">{hwidModal.hwid?'1':'0'}<span className="text-white/30 text-base font-normal"> /1</span></p>
              </div>
              <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white/40 text-xs mb-1">HWID Limit</p>
                <p className="text-2xl font-black text-white">1</p>
              </div>
            </div>

            <div>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">Bound HWIDs</p>
              {hwidModal.hwid ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <span className="font-mono text-xs text-white/60 truncate flex-1">{hwidModal.hwid}</span>
                  <button onClick={()=>handleClearHwid(hwidModal.id)}
                    className="ml-3 text-xs px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition flex-shrink-0">
                    Remove
                  </button>
                </div>
              ) : (
                <div className="bg-white/3 border border-white/8 rounded-xl p-6 text-center text-white/30 text-sm">
                  No HWIDs bound<br/><span className="text-xs">Locks on first use</span>
                </div>
              )}
            </div>

            <button onClick={()=>setHwidModal(null)}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition">
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* ── Disable modal ───────────────────────────────────────────────── */}
      {disableModal && (
        <Modal title="Disable Temporarily" sub={disableModal.key} onClose={()=>setDisableModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wide block mb-2">Disable Until</label>
              <input type="datetime-local" value={disableModal.until}
                onChange={e=>setDisableModal(m=>({...m,until:e.target.value}))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500/60 transition"/>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setDisableModal(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white transition">Cancel</button>
              <button onClick={handleDisable} className="flex-1 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-semibold transition">Disable</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Create key modal ─────────────────────────────────────────────── */}
      {createModal && (
        <Modal title="Create Key" onClose={()=>setCreateModal(false)}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1"><Input label="Key Value" value={createForm.key_value} onChange={e=>setCreateForm(f=>({...f,key_value:e.target.value}))}/></div>
              <button onClick={()=>setCreateForm(f=>({...f,key_value:randomKey()}))}
                className="mt-5 p-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white transition">
                <Refresh size={14}/>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Duration (hours)" type="number" value={createForm.hours} onChange={e=>setCreateForm(f=>({...f,hours:Number(e.target.value)}))}/>
              <Input label="Key Name (optional)" value={createForm.key_name} onChange={e=>setCreateForm(f=>({...f,key_name:e.target.value}))}/>
            </div>
            <Input label="Discord User ID" value={createForm.discord_user_id} onChange={e=>setCreateForm(f=>({...f,discord_user_id:e.target.value}))} placeholder="optional"/>
            <Input label="Discord Username" value={createForm.discord_username} onChange={e=>setCreateForm(f=>({...f,discord_username:e.target.value}))} placeholder="optional"/>
            <Toggle label="Premium Key" icon="⭐" checked={createForm.is_premium} onChange={v=>setCreateForm(f=>({...f,is_premium:v}))}/>
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setCreateModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white transition">Cancel</button>
              <button onClick={handleCreateKey} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition flex items-center justify-center gap-2"><Plus size={14}/> Create</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [serviceKey, setServiceKey] = useState('')
  const [authed,     setAuthed]     = useState(false)
  const [view,       setView]       = useState('dashboard')
  const [keys,       setKeys]       = useState([])
  const [loading,    setLoading]    = useState(false)

  const supabase = authed ? adminClient(serviceKey) : null

  const fetchKeys = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data } = await supabase.from('keys').select('*').order('created_at', { ascending: false })
    setKeys(data || [])
    setLoading(false)
  }, [serviceKey, authed])

  useEffect(() => { if (authed) fetchKeys() }, [authed])

  const handleLogin = (k) => { setServiceKey(k); setAuthed(true) }
  const handleSignOut = () => {
    localStorage.removeItem('seistem_admin_key')
    setAuthed(false); setServiceKey(''); setKeys([])
  }

  // Try auto-login from localStorage
  useEffect(() => {
    const k = localStorage.getItem('seistem_admin_key')
    if (k) handleLogin(k)
  }, [])

  if (!authed) return <Login onLogin={handleLogin}/>

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-white">
      <Sidebar view={view} setView={setView} onSignOut={handleSignOut} keyCount={keys.length}/>
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : view === 'dashboard'
          ? <Dashboard keys={keys}/>
          : <Keys keys={keys} setKeys={setKeys} supabase={supabase} onRefresh={fetchKeys}/>
        }
      </main>
    </div>
  )
}
