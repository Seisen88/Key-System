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
  return `SEISEN-${s()}-${s()}-${s()}-${s()}`
}

// ── Icon primitives ───────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, className = '', ...p }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className={className} {...p}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)
const Copy     = p => <Icon d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" {...p}/>
const Trash    = p => <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" {...p}/>
const Edit     = p => <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" {...p}/>
const Clock    = p => <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" {...p}/>
const Key      = p => <Icon d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" {...p}/>
const GridIcon = p => <Icon d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" {...p}/>
const ListIcon = p => <Icon d="M4 6h16M4 10h16M4 14h16M4 18h16" {...p}/>
const Shield   = p => <Icon d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" {...p}/>
const ChevD    = p => <Icon d="M19 9l-7 7-7-7" {...p}/>
const Plus     = p => <Icon d="M12 4v16m8-8H4" {...p}/>
const Download = p => <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" {...p}/>
const Dash     = p => <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" {...p}/>
const Refresh  = p => <Icon d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" {...p}/>
const X        = p => <Icon d="M6 18L18 6M6 6l12 12" {...p}/>
const Settings = p => <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" {...p}/>
const Layers   = p => <Icon d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" {...p}/>
const Ban      = p => <Icon d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" {...p}/>
const FileText = p => <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" {...p}/>
const Globe    = p => <Icon d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" {...p}/>
const Menu     = p => <Icon d="M4 6h16M4 12h16M4 18h16" {...p}/>
const SignOut  = p => <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" {...p}/>

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Modal({ title, sub, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-[#13141A] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/[0.06]">
          <div className="min-w-0 flex-1 mr-4">
            <h2 className="font-semibold text-sm text-white">{title}</h2>
            {sub && <p className="text-white/30 text-xs mt-0.5 font-mono truncate">{sub}</p>}
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition p-1.5 rounded-lg hover:bg-white/[0.06] flex-shrink-0">
            <X size={16}/>
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function Input({ label, ...p }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-white/40 text-xs font-medium">{label}</label>}
      <input
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white
                   outline-none focus:border-purple-500/50 focus:bg-white/[0.06] transition placeholder-white/20"
        {...p}
      />
    </div>
  )
}

function Toggle({ label, icon, checked, onChange }) {
  return (
    <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-base leading-none">{icon}</span>}
        <span className="text-sm text-white/70">{label}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${checked ? 'bg-purple-600' : 'bg-white/10'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`}/>
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
    <div className="min-h-screen bg-[#0D0E12] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/25 flex items-center justify-center mb-5">
            <Shield size={20} className="text-purple-400"/>
          </div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Seistem Admin</h1>
          <p className="text-white/35 text-sm mt-1">Sign in with your service role key</p>
        </div>
        <form onSubmit={submit} className="bg-[#13141A] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          {err && (
            <div className="bg-red-500/8 border border-red-500/20 text-red-400 text-xs rounded-xl px-4 py-3">
              {err}
            </div>
          )}
          <Input label="Service Role Key" type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder="eyJ…"/>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-sm transition">
            {loading ? 'Verifying…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ view, setView, onSignOut, keyCount, open, onClose }) {
  const sections = [
    {
      label: 'MAIN',
      items: [
        { id: 'dashboard', label: 'Overview', icon: <Dash size={15}/> },
        { id: 'keys',      label: 'Keys',     icon: <Key  size={15}/>, badge: keyCount },
      ]
    },
    {
      label: 'TOOLS',
      items: [
        { id: 'hwids',    label: 'HWIDs',        icon: <Shield   size={15}/>, disabled: true },
        { id: 'bans',     label: 'Discord Bans',  icon: <Ban      size={15}/>, disabled: true },
        { id: 'logs',     label: 'Discord Logs',  icon: <FileText size={15}/>, disabled: true },
      ]
    },
    {
      label: 'SETTINGS',
      items: [
        { id: 'settings', label: 'Settings', icon: <Settings size={15}/>, disabled: true },
      ]
    }
  ]

  const content = (
    <aside className="w-[200px] bg-[#0D0E12] border-r border-white/[0.06] flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-600/25 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
            <Shield size={14} className="text-purple-400"/>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-white leading-none">Seistem</div>
            <div className="text-[10px] text-white/30 mt-0.5 leading-none">Admin Panel</div>
          </div>
        </div>
        {/* Close button visible only on mobile */}
        <button onClick={onClose} className="lg:hidden text-white/30 hover:text-white/60 p-1">
          <X size={16}/>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {sections.map(section => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold text-white/20 tracking-widest px-2 mb-1.5">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const active = view === item.id
                return (
                  <button key={item.id}
                    onClick={() => { if (!item.disabled) { setView(item.id); onClose?.() } }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition text-left
                      ${active
                        ? 'bg-purple-600/15 text-purple-300'
                        : item.disabled
                          ? 'text-white/18 cursor-not-allowed'
                          : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'
                      }`}
                  >
                    <span className={active ? 'text-purple-400' : ''}>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="text-[10px] bg-white/8 text-white/30 px-1.5 py-0.5 rounded-full font-medium tabular-nums">
                        {item.badge}
                      </span>
                    )}
                    {item.disabled && (
                      <span className="text-[9px] text-white/15 font-normal">soon</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-3 border-t border-white/[0.06]">
        <button onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-white/30 hover:text-red-400 hover:bg-red-500/8 transition">
          <SignOut size={14}/>
          Sign Out
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-screen sticky top-0 flex-shrink-0">
        {content}
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
          <div className="relative z-50 h-full">
            {content}
          </div>
        </div>
      )}
    </>
  )
}

// ── Top header bar ────────────────────────────────────────────────────────────
function TopBar({ view, onMenuClick }) {
  const crumbs = { dashboard: 'Overview', keys: 'Keys' }
  return (
    <header className="h-[52px] border-b border-white/[0.06] flex items-center justify-between px-4 sm:px-7 bg-[#0D0E12] flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger - mobile only */}
        <button onClick={onMenuClick} className="lg:hidden text-white/40 hover:text-white/70 p-1 -ml-1">
          <Menu size={18}/>
        </button>
        <div className="flex items-center gap-2 text-sm text-white/30">
          <span className="hidden sm:inline">Dashboard</span>
          <span className="hidden sm:inline text-white/15">›</span>
          <span className="text-white/60 font-medium">{crumbs[view] || 'Overview'}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-white/35 hover:text-white/60 hover:bg-white/[0.04] transition">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
          Dark
        </button>
        <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-white/35 hover:text-white/60 hover:bg-white/[0.04] transition">
          <Globe size={13}/> Docs
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/8 transition border border-amber-500/20 ml-1">
          <span className="hidden sm:inline">★ </span>Premium
        </button>
      </div>
    </header>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent, color, pct }) {
  return (
    <div className={`${accent} border border-white/[0.07] rounded-2xl p-4 sm:p-5`}>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <span className="text-white/40 text-xs font-medium truncate pr-2">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl sm:text-3xl font-bold ${color} mb-2 tabular-nums`}>
        {value.toLocaleString()}
      </div>
      {pct !== undefined && (
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-1 ${color.replace('text-','bg-').replace('-400','-500')} rounded-full opacity-50`}
               style={{width:`${Math.min(pct,100).toFixed(1)}%`}}/>
        </div>
      )}
    </div>
  )
}

// ── Dashboard view ────────────────────────────────────────────────────────────
function Dashboard({ counts }) {
  const { total, active, expired, disabled, premium, today: todayN, month: monthN, recent, providers } = counts

  const stats = [
    { label:'Total Keys',    value:total,    color:'text-white',       accent:'bg-white/5',         icon:<Key  size={17} className="text-white/30"/> },
    { label:'Active',        value:active,   color:'text-emerald-400', accent:'bg-emerald-500/8',   icon:<Shield size={17} className="text-emerald-500"/>,   pct: total ? active/total*100   : 0 },
    { label:'Expired',       value:expired,  color:'text-red-400',     accent:'bg-red-500/8',       icon:<Clock  size={17} className="text-red-500"/>,        pct: total ? expired/total*100  : 0 },
    { label:'Premium',       value:premium,  color:'text-amber-400',   accent:'bg-amber-500/8',     icon:<span className="text-amber-400 text-base leading-none">★</span>, pct: total ? premium/total*100  : 0 },
    { label:'Created Today', value:todayN,   color:'text-purple-400',  accent:'bg-purple-500/8',    icon:<Plus   size={17} className="text-purple-500"/> },
    { label:'This Month',    value:monthN,   color:'text-sky-400',     accent:'bg-sky-500/8',       icon:<Dash   size={17} className="text-sky-500"/> },
  ]

  const providerList = Object.entries(providers).sort((a,b)=>b[1]-a[1])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 sm:px-7 py-5 sm:py-6 border-b border-white/[0.05]">
        <h1 className="text-lg font-semibold text-white">Overview</h1>
        <p className="text-white/35 text-sm mt-0.5">Your key system analytics at a glance</p>
      </div>

      <div className="px-4 sm:px-7 py-5 sm:py-6 space-y-5 sm:space-y-6">
        {/* Stats grid — 1 col → 2 col → 3 col */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stats.map(s => (
            <StatCard key={s.label} {...s}/>
          ))}
        </div>

        {/* Provider + Recent — stack on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#13141A] border border-white/[0.07] rounded-2xl p-5">
            <h3 className="font-medium text-white text-sm mb-4">Provider Breakdown</h3>
            {providerList.length === 0
              ? <p className="text-white/25 text-sm text-center py-8">No data yet</p>
              : <div className="space-y-3">
                  {providerList.map(([name, count]) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-white/45 text-xs w-20 truncate capitalize">{name}</span>
                      <div className="flex-1 bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                        <div className="bg-purple-500 h-1.5 rounded-full opacity-70"
                             style={{width:`${total ? (count/total*100).toFixed(0) : 0}%`}}/>
                      </div>
                      <span className="text-white/35 text-xs w-6 text-right tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
            }
          </div>

          <div className="bg-[#13141A] border border-white/[0.07] rounded-2xl p-5">
            <h3 className="font-medium text-white text-sm mb-4">Recently Created</h3>
            <div className="space-y-2.5">
              {recent.map(k => (
                <div key={k.id} className="flex items-center gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive(k)?'bg-emerald-400':isDisabled(k)?'bg-amber-400':'bg-red-400'}`}/>
                  <span className="font-mono text-white/40 text-xs flex-1 truncate">{k.key_value}</span>
                  <span className="text-white/25 text-xs flex-shrink-0 hidden sm:block">{fmtDate(k.created_at)}</span>
                </div>
              ))}
              {recent.length === 0 && <p className="text-white/25 text-sm text-center py-6">No keys yet</p>}
            </div>
          </div>
        </div>

        {/* Health bar */}
        {total > 0 && (
          <div className="bg-[#13141A] border border-white/[0.07] rounded-2xl p-5">
            <h3 className="font-medium text-white text-sm mb-4">Key Health</h3>
            <div className="flex gap-1 h-2.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 opacity-70 transition-all" style={{width:`${(active/total*100).toFixed(1)}%`}}/>
              <div className="bg-red-500 opacity-70 transition-all"     style={{width:`${(expired/total*100).toFixed(1)}%`}}/>
              <div className="bg-amber-500 opacity-70 transition-all"   style={{width:`${(disabled/total*100).toFixed(1)}%`}}/>
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {[['Active',active,'bg-emerald-500'],['Expired',expired,'bg-red-500'],['Disabled',disabled,'bg-amber-500']].map(([lbl,cnt,clr])=>(
                <div key={lbl} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${clr} opacity-70 flex-shrink-0`}/>
                  <span className="text-white/40 text-xs">{lbl}</span>
                  <span className="text-white/60 text-xs font-medium tabular-nums">{cnt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Keys view ─────────────────────────────────────────────────────────────────
function Keys({ keys, setKeys, supabase, onRefresh, total, page, onPageChange, search, onSearch, counts, PAGE_SIZE }) {
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTier,   setFilterTier]   = useState('all')
  const [layout,       setLayout]       = useState('list')
  const [expanded,     setExpanded]     = useState({})
  const [copied,       setCopied]       = useState({})
  const [editModal,    setEditModal]    = useState(null)
  const [hwidModal,    setHwidModal]    = useState(null)
  const [disableModal, setDisableModal] = useState(null)
  const [createModal,  setCreateModal]  = useState(false)

  const [createForm, setCreateForm] = useState({
    key_value: randomKey(), hours: 24, is_premium: false, key_name: '', discord_user_id: '', discord_username: ''
  })

  // Search is server-side; status/tier filter applied client-side within the current page
  const filtered = keys.filter(k => {
    if (filterTier === 'standard' && k.is_premium)  return false
    if (filterTier === 'premium'  && !k.is_premium) return false
    if (filterStatus === 'active'   && !isActive(k))   return false
    if (filterStatus === 'expired'  && !isExpired(k))  return false
    if (filterStatus === 'disabled' && !isDisabled(k)) return false
    return true
  })

  const copyKey = (val, id) => {
    navigator.clipboard.writeText(val)
    setCopied(p => ({...p,[id]:true}))
    setTimeout(() => setCopied(p => ({...p,[id]:false})), 2000)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this key permanently?')) return
    await supabase.from('keys').delete().eq('id', id)
    setKeys(k => k.filter(x => x.id !== id))
  }

  const handleDeleteExpired = async () => {
    if (!confirm('Delete all expired keys?')) return
    const ids = keys.filter(isExpired).map(k=>k.id)
    if (!ids.length) return
    await supabase.from('keys').delete().in('id', ids)
    setKeys(k => k.filter(x => !ids.includes(x.id)))
  }

  const handleSaveEdit = async () => {
    const { id, ...fields } = editModal
    const { error } = await supabase.from('keys').update(fields).eq('id', id)
    if (error) return
    setKeys(k => k.map(x => x.id===id ? {...x,...fields} : x))
    setEditModal(null)
  }

  const handleDisable = async () => {
    const { id, until } = disableModal
    const { error } = await supabase.from('keys').update({
      is_disabled: true, disabled_until: until ? new Date(until).toISOString() : null
    }).eq('id', id)
    if (error) return
    setKeys(k => k.map(x => x.id===id ? {...x,is_disabled:true,disabled_until:until} : x))
    setDisableModal(null)
  }

  const handleEnable = async (id) => {
    await supabase.from('keys').update({ is_disabled:false, disabled_until:null }).eq('id', id)
    setKeys(k => k.map(x => x.id===id ? {...x,is_disabled:false,disabled_until:null} : x))
  }

  const handleClearHwid = async (id) => {
    await supabase.from('keys').update({ hwid:null }).eq('id', id)
    setKeys(k => k.map(x => x.id===id ? {...x,hwid:null} : x))
    setHwidModal(m => m ? {...m,hwid:null} : m)
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
    setKeys(k => [data,...k])
    setCreateModal(false)
    setCreateForm({ key_value:randomKey(), hours:24, is_premium:false, key_name:'', discord_user_id:'', discord_username:'' })
  }

  const handleExport = () => {
    const csv = ['key,status,provider,expires_at,discord_username,hwid',
      ...keys.map(k=>`${k.key_value},${isActive(k)?'active':'expired'},${k.provider},${k.expires_at},${k.discord_username||''},${k.hwid||''}`)
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download = 'seistem_keys.csv'; a.click()
  }

  const tierTabs   = [{id:'all',label:'All'},{id:'standard',label:'Standard'},{id:'premium',label:'Premium'}]
  const statusTabs = [
    {id:'all',     label:'All',     count: counts.total},
    {id:'active',  label:'Active',  count: counts.active},
    {id:'expired', label:'Expired', count: counts.expired},
    {id:'disabled',label:'Disabled',count: counts.disabled},
  ]
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="border-b border-white/[0.05] bg-[#0D0E12] sticky top-0 z-10">
        {/* Title row */}
        <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 px-4 sm:px-7 pt-5 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Keys</h1>
            <p className="text-white/35 text-sm mt-0.5">{total.toLocaleString()} Keys</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/70 text-xs font-medium transition hover:border-white/15">
              <Refresh size={13}/> <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/70 text-xs font-medium transition hover:border-white/15">
              <Download size={13}/> <span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={handleDeleteExpired}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/25 text-red-400/70 hover:text-red-400 hover:bg-red-500/8 text-xs font-medium transition">
              <Trash size={13}/> <span className="hidden sm:inline">Delete expired</span>
            </button>
            <button onClick={() => setCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition shadow-lg shadow-purple-600/20">
              <Plus size={13}/> <span>Create key</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 sm:px-7 pb-3">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={search} onChange={e=>onSearch(e.target.value)}
              placeholder="Search key, provider, Discord…"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-12 py-2.5 text-sm text-white
                         outline-none focus:border-purple-500/40 transition placeholder-white/20"/>
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-white/20 border border-white/[0.08] rounded px-1.5 py-0.5 font-mono hidden sm:block">
              /
            </span>
          </div>
        </div>

        {/* Filter pills */}
        <div className="px-4 sm:px-7 pb-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Tier */}
            {tierTabs.map(t => (
              <button key={t.id} onClick={()=>setFilterTier(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap
                  ${filterTier===t.id
                    ? t.id==='premium'  ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                    : t.id==='standard' ? 'bg-purple-600/15 border-purple-500/35 text-purple-300'
                                        : 'bg-white/8 border-white/15 text-white/70'
                    : 'border-white/[0.07] text-white/30 hover:text-white/55 hover:border-white/15'
                  }`}>
                {t.id==='premium'?'⭐ Premium':t.id==='standard'?'✦ Standard':'All Tiers'}
              </button>
            ))}

            <div className="w-px h-4 bg-white/[0.08] mx-0.5 self-center"/>

            {/* Status */}
            {statusTabs.map(t => (
              <button key={t.id} onClick={()=>setFilterStatus(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition whitespace-nowrap
                  ${filterStatus===t.id
                    ? t.id==='active'   ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                    : t.id==='expired'  ? 'bg-red-500/15 border-red-500/35 text-red-400'
                    : t.id==='disabled' ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                                        : 'bg-white/8 border-white/15 text-white/70'
                    : 'border-white/[0.07] text-white/30 hover:text-white/55 hover:border-white/15'
                  }`}>
                {t.label}
                <span className="ml-1.5 opacity-50 tabular-nums">{t.count}</span>
              </button>
            ))}

            {/* Layout toggle */}
            <div className="ml-auto flex gap-1">
              {[{id:'list',icon:<ListIcon size={13}/>},{id:'grid',icon:<GridIcon size={13}/>}].map(l=>(
                <button key={l.id} onClick={()=>setLayout(l.id)}
                  className={`p-2 rounded-xl border transition
                    ${layout===l.id?'border-purple-500/35 bg-purple-600/12 text-purple-300':'border-white/[0.07] text-white/30 hover:text-white/60'}`}>
                  {l.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Key list */}
      <div className={`overflow-y-auto flex-1 px-4 sm:px-7 py-4 sm:py-5
        ${layout==='grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 content-start' : 'space-y-2'}`}>
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-20 text-white/20 text-sm">No keys match your filters.</div>
        )}
        {filtered.map(k => {
          const active   = isActive(k)
          const expired  = isExpired(k)
          const disabled = isDisabled(k)
          const exp      = expanded[k.id]

          return (
            <div key={k.id} className="bg-[#13141A] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/[0.13] transition-all group">
              {/* Main row */}
              <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3.5 sm:py-4">
                <span className="font-mono text-[12px] sm:text-[13px] text-white/75 flex-1 truncate min-w-0">
                  {k.key_value}
                </span>

                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-[11px] px-2 sm:px-2.5 py-1 rounded-full font-semibold border whitespace-nowrap
                    ${disabled ? 'bg-amber-500/12 text-amber-400 border-amber-500/25'
                    : expired  ? 'bg-red-500/12 text-red-400 border-red-500/25'
                               : 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25'}`}>
                    {disabled ? 'Disabled' : expired ? 'Expired' : 'Active'}
                  </span>
                  {k.is_premium && (
                    <span className="hidden sm:inline text-[11px] px-2.5 py-1 rounded-full font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      ★ Premium
                    </span>
                  )}
                </div>

                {/* Actions — always visible on mobile, hover on desktop */}
                <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={()=>copyKey(k.key_value,k.id)} title="Copy"
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition">
                    {copied[k.id] ? <span className="text-emerald-400 text-xs font-bold px-0.5">✓</span> : <Copy size={13}/>}
                  </button>
                  <button onClick={()=>setHwidModal(k)} title="HWID"
                    className="p-1.5 rounded-lg text-white/30 hover:text-purple-400 hover:bg-purple-500/8 transition">
                    <Shield size={13}/>
                  </button>
                  <button onClick={()=>disabled?handleEnable(k.id):setDisableModal({id:k.id,key:k.key_value,until:''})}
                    className={`p-1.5 rounded-lg transition ${disabled?'text-amber-400 bg-amber-500/8':'text-white/30 hover:text-amber-400 hover:bg-amber-500/8'}`}>
                    <Clock size={13}/>
                  </button>
                  <button onClick={()=>setEditModal({...k})}
                    className="p-1.5 rounded-lg text-white/30 hover:text-sky-400 hover:bg-sky-500/8 transition">
                    <Edit size={13}/>
                  </button>
                  <button onClick={()=>handleDelete(k.id)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/8 transition">
                    <Trash size={13}/>
                  </button>
                </div>
              </div>

              {/* Sub-info row */}
              <div className="px-4 sm:px-5 pb-3 flex flex-wrap items-center gap-3 text-[11px] sm:text-[12px] text-white/30">
                <span className="flex items-center gap-1.5">
                  <Clock size={11}/>
                  {active ? `in ${timeLeft(k.expires_at)}` : expired ? 'Expired' : fmtDate(k.expires_at)}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  {k.key_name || k.provider}
                </span>
                {k.key_name && (
                  <span className="hidden sm:flex items-center gap-1.5">
                    <Layers size={11}/>{k.provider}
                  </span>
                )}
                {(k.discord_username || k.discord_user_id) && (
                  <span className="hidden sm:flex items-center gap-1.5">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/>
                    </svg>
                    {k.discord_username||''}{k.discord_user_id?` (${k.discord_user_id})`:''}
                  </span>
                )}
                <button onClick={()=>setExpanded(p=>({...p,[k.id]:!p[k.id]}))}
                  className="ml-auto flex items-center gap-1 text-white/25 hover:text-white/50 transition">
                  {exp?'Hide':'Show'} Details
                  <ChevD size={10} className={`transition-transform ${exp?'rotate-180':''}`}/>
                </button>
              </div>

              {/* Expanded details */}
              {exp && (
                <div className="px-4 sm:px-5 pb-4 pt-3 border-t border-white/[0.05] grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-[12px]">
                  {[
                    ['ID',       <span className="font-mono text-white/40 truncate">{k.id}</span>],
                    ['Created',  <span className="text-white/40">{fmtDate(k.created_at)}</span>],
                    ['Expires',  <span className="text-white/40">{new Date(k.expires_at).toLocaleString()}</span>],
                    ['HWID',     <span className={k.hwid?'font-mono text-white/40':'text-white/20'}>{k.hwid?k.hwid.slice(0,24)+'…':'Not locked'}</span>],
                    ['IP',       <span className="text-white/40">{k.ip_address||'—'}</span>],
                    ['Folder',   <span className="text-white/40">{k.folder||'—'}</span>],
                    ['One-time', <span className="text-white/40">{k.is_one_time?'Yes':'No'}</span>],
                    ['No HWID',  <span className="text-white/40">{k.no_hwid_binding?'Yes':'No'}</span>],
                  ].map(([label,val])=>(
                    <div key={label} className="flex items-baseline gap-2 min-w-0">
                      <span className="text-white/20 flex-shrink-0">{label}:</span>
                      <span className="min-w-0 truncate">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 sm:px-7 py-3 border-t border-white/[0.05] flex-shrink-0">
          <span className="text-white/30 text-xs tabular-nums">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(0)} disabled={page === 0}
              className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] text-white/35 text-xs hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition">
              «
            </button>
            <button onClick={() => onPageChange(page - 1)} disabled={page === 0}
              className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] text-white/35 text-xs hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition">
              ‹
            </button>
            <span className="px-3 py-1.5 text-white/50 text-xs tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}
              className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] text-white/35 text-xs hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition">
              ›
            </button>
            <button onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1}
              className="px-2.5 py-1.5 rounded-lg border border-white/[0.08] text-white/35 text-xs hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition">
              »
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {editModal && (
        <Modal title="Edit Key" sub={editModal.key_value} onClose={()=>setEditModal(null)}>
          <div className="space-y-3">
            <Input label="Key Name" value={editModal.key_name||''} onChange={e=>setEditModal(m=>({...m,key_name:e.target.value}))} placeholder="Key name"/>
            <Input label="Discord User ID" value={editModal.discord_user_id||''} onChange={e=>setEditModal(m=>({...m,discord_user_id:e.target.value}))} placeholder="123456789012345678"/>
            <Input label="Discord Username" value={editModal.discord_username||''} onChange={e=>setEditModal(m=>({...m,discord_username:e.target.value}))} placeholder="username"/>
            <Input label="Folder" value={editModal.folder||''} onChange={e=>setEditModal(m=>({...m,folder:e.target.value}))} placeholder="e.g. VIP"/>
            <Input label="New Expiry" type="datetime-local"
              value={editModal._newExpiry||''} onChange={e=>setEditModal(m=>({...m,_newExpiry:e.target.value,expires_at:e.target.value?new Date(e.target.value).toISOString():m.expires_at}))}/>
            <div className="space-y-2 pt-1">
              <Toggle label="Premium Key"         icon="⭐" checked={!!editModal.is_premium}           onChange={v=>setEditModal(m=>({...m,is_premium:v}))}/>
              <Toggle label="One-time Use"        icon="🔐" checked={!!editModal.is_one_time}          onChange={v=>setEditModal(m=>({...m,is_one_time:v}))}/>
              <Toggle label="Expiry on First Use" icon="⏰" checked={!!editModal.expiry_on_first_use}  onChange={v=>setEditModal(m=>({...m,expiry_on_first_use:v}))}/>
              <Toggle label="No HWID Binding"    icon="🚫" checked={!!editModal.no_hwid_binding}      onChange={v=>setEditModal(m=>({...m,no_hwid_binding:v}))}/>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setEditModal(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-white/40 text-sm hover:text-white/70 transition">Cancel</button>
              <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition">Save Changes</button>
            </div>
          </div>
        </Modal>
      )}

      {hwidModal && (
        <Modal title="HWID Management" sub={hwidModal.key_value} onClose={()=>setHwidModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                <p className="text-white/35 text-xs mb-1">Bound HWIDs</p>
                <p className="text-2xl font-bold text-white tabular-nums">{hwidModal.hwid?'1':'0'}<span className="text-white/25 text-sm font-normal"> / 1</span></p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                <p className="text-white/35 text-xs mb-1">HWID Limit</p>
                <p className="text-2xl font-bold text-white">1</p>
              </div>
            </div>
            <div>
              <p className="text-white/35 text-xs font-medium mb-2">Bound HWID</p>
              {hwidModal.hwid ? (
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 flex items-center gap-3">
                  <span className="font-mono text-xs text-white/50 truncate flex-1">{hwidModal.hwid}</span>
                  <button onClick={()=>handleClearHwid(hwidModal.id)}
                    className="text-xs px-3 py-1.5 bg-red-500/8 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/15 transition flex-shrink-0">
                    Remove
                  </button>
                </div>
              ) : (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center text-white/25 text-sm">
                  No HWID bound<br/><span className="text-xs text-white/15">Locks on first use</span>
                </div>
              )}
            </div>
            <button onClick={()=>setHwidModal(null)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition">
              Close
            </button>
          </div>
        </Modal>
      )}

      {disableModal && (
        <Modal title="Disable Temporarily" sub={disableModal.key} onClose={()=>setDisableModal(null)}>
          <div className="space-y-4">
            <Input label="Disable Until (leave blank for indefinite)" type="datetime-local"
              value={disableModal.until} onChange={e=>setDisableModal(m=>({...m,until:e.target.value}))}/>
            <div className="flex gap-3">
              <button onClick={()=>setDisableModal(null)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-white/40 text-sm hover:text-white/70 transition">Cancel</button>
              <button onClick={handleDisable} className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition">Disable</button>
            </div>
          </div>
        </Modal>
      )}

      {createModal && (
        <Modal title="Create Key" onClose={()=>setCreateModal(false)}>
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label="Key Value" value={createForm.key_value} onChange={e=>setCreateForm(f=>({...f,key_value:e.target.value}))}/>
              </div>
              <button onClick={()=>setCreateForm(f=>({...f,key_value:randomKey()}))}
                className="p-2.5 rounded-xl border border-white/[0.08] text-white/35 hover:text-white/70 transition flex-shrink-0">
                <Refresh size={14}/>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Duration (hours)" type="number" value={createForm.hours} onChange={e=>setCreateForm(f=>({...f,hours:Number(e.target.value)}))}/>
              <Input label="Key Name" value={createForm.key_name} onChange={e=>setCreateForm(f=>({...f,key_name:e.target.value}))} placeholder="optional"/>
            </div>
            <Input label="Discord User ID" value={createForm.discord_user_id} onChange={e=>setCreateForm(f=>({...f,discord_user_id:e.target.value}))} placeholder="optional"/>
            <Input label="Discord Username" value={createForm.discord_username} onChange={e=>setCreateForm(f=>({...f,discord_username:e.target.value}))} placeholder="optional"/>
            <div className="pt-1">
              <Toggle label="Premium Key" icon="⭐" checked={createForm.is_premium} onChange={v=>setCreateForm(f=>({...f,is_premium:v}))}/>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setCreateModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-white/40 text-sm hover:text-white/70 transition">Cancel</button>
              <button onClick={handleCreateKey} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition">Create Key</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
const PAGE_SIZE    = 100
const EMPTY_COUNTS = { total:0, active:0, expired:0, disabled:0, premium:0, today:0, month:0, recent:[], providers:{} }

export default function Admin() {
  const [serviceKey,  setServiceKey]  = useState('')
  const [authed,      setAuthed]      = useState(false)
  const [view,        setView]        = useState('dashboard')
  const [keys,        setKeys]        = useState([])
  const [keyTotal,    setKeyTotal]    = useState(0)
  const [keyPage,     setKeyPage]     = useState(0)
  const [keySearch,   setKeySearch]   = useState('')
  const [counts,      setCounts]      = useState(EMPTY_COUNTS)
  const [loading,     setLoading]     = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const supabase = authed ? adminClient(serviceKey) : null

  // Fetch server-side counts for the Dashboard — no full row data transferred
  const fetchCounts = useCallback(async () => {
    if (!supabase) return
    const now        = new Date().toISOString()
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)

    const [
      { count: total },
      { count: active },
      { count: expired },
      { count: disabled },
      { count: premium },
      { count: today },
      { count: month },
      { data: recent },
      { data: providerRows },
    ] = await Promise.all([
      supabase.from('keys').select('*', { count:'exact', head:true }),
      supabase.from('keys').select('*', { count:'exact', head:true }).gt('expires_at', now).eq('is_disabled', false),
      supabase.from('keys').select('*', { count:'exact', head:true }).lte('expires_at', now),
      supabase.from('keys').select('*', { count:'exact', head:true }).eq('is_disabled', true),
      supabase.from('keys').select('*', { count:'exact', head:true }).eq('is_premium', true),
      supabase.from('keys').select('*', { count:'exact', head:true }).gte('created_at', todayStart.toISOString()),
      supabase.from('keys').select('*', { count:'exact', head:true }).gte('created_at', monthStart.toISOString()),
      supabase.from('keys').select('key_value,created_at,expires_at,is_disabled,is_premium').order('created_at', { ascending:false }).limit(6),
      supabase.from('keys').select('provider').limit(5000),
    ])

    const providers = (providerRows || []).reduce((acc, k) => {
      acc[k.provider] = (acc[k.provider] || 0) + 1; return acc
    }, {})

    setCounts({ total:total||0, active:active||0, expired:expired||0, disabled:disabled||0,
                premium:premium||0, today:today||0, month:month||0, recent:recent||[], providers })
  }, [serviceKey, authed])

  // Paginated key fetch — 100 rows at a time, with optional server-side search
  const fetchKeys = useCallback(async (page=0, search='') => {
    if (!supabase) return
    setLoading(true)
    const from = page * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    let q = supabase.from('keys').select('*', { count:'exact' }).order('created_at', { ascending:false }).range(from, to)
    if (search.trim()) {
      q = q.or(`key_value.ilike.%${search.trim()}%,discord_username.ilike.%${search.trim()}%,provider.ilike.%${search.trim()}%`)
    }
    const { data, count } = await q
    setKeys(data || [])
    setKeyTotal(count || 0)
    setLoading(false)
  }, [serviceKey, authed])

  useEffect(() => { if (authed) { fetchCounts(); fetchKeys(0, '') } }, [authed])

  const handleSearch     = (s) => { setKeySearch(s); setKeyPage(0); fetchKeys(0, s) }
  const handlePageChange = (p) => { setKeyPage(p); fetchKeys(p, keySearch) }
  const handleRefresh    = ()  => { fetchCounts(); fetchKeys(keyPage, keySearch) }

  const handleLogin   = (k) => { setServiceKey(k); setAuthed(true) }
  const handleSignOut = () => {
    localStorage.removeItem('seistem_admin_key')
    setAuthed(false); setServiceKey(''); setKeys([]); setCounts(EMPTY_COUNTS)
  }

  useEffect(() => {
    const k = localStorage.getItem('seistem_admin_key')
    if (k) handleLogin(k)
  }, [])

  if (!authed) return <Login onLogin={handleLogin}/>

  return (
    <div className="flex min-h-screen h-screen overflow-hidden bg-[#0D0E12] text-white">
      <Sidebar
        view={view}
        setView={setView}
        onSignOut={handleSignOut}
        keyCount={counts.total}
        open={sidebarOpen}
        onClose={()=>setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <TopBar view={view} onMenuClick={()=>setSidebarOpen(true)}/>
        <main className="flex-1 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-purple-500/60 border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : view==='dashboard'
            ? <Dashboard counts={counts}/>
            : <Keys keys={keys} setKeys={setKeys} supabase={supabase} onRefresh={handleRefresh}
                    total={keyTotal} page={keyPage} onPageChange={handlePageChange}
                    search={keySearch} onSearch={handleSearch}
                    counts={counts} PAGE_SIZE={PAGE_SIZE}/>
          }
        </main>
      </div>
    </div>
  )
}
