import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Icons ─────────────────────────────────────────────────────────────────────
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
                   outline-none focus:border-white/20 transition placeholder-white/20"
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
        className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${checked ? 'bg-emerald-500' : 'bg-white/10'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`}/>
      </button>
    </div>
  )
}

// ── Section label (portfolio style) ──────────────────────────────────────────
function SectionLabel({ index, label }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <span className="text-[10px] font-mono tracking-widest uppercase text-white/25 whitespace-nowrap">
        {index} // {label}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]"/>
    </div>
  )
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D0E12] border border-white/[0.1] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white/40 mb-1">{label}</p>
      <p className="text-white font-mono font-bold">{payload[0].value}</p>
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0D0E12] border border-white/[0.1] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white/40">{payload[0].name}</p>
      <p className="text-white font-mono font-bold">{payload[0].value}</p>
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [err,      setErr]      = useState('')
  const [loading,  setLoading]  = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) { setErr('Invalid email or password.'); return }
    onLogin()
  }

  return (
    <div className="min-h-screen bg-[#0D0E12] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-[10px] font-mono tracking-widest uppercase text-white/25">01 // ADMIN</span>
            <div className="flex-1 h-px bg-white/[0.06]"/>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-none mb-2">Sign in.</h1>
          <p className="text-white/35 text-sm">Admin access only.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {err && (
            <div className="bg-red-500/8 border border-red-500/20 text-red-400 text-xs rounded-2xl px-4 py-3">
              {err}
            </div>
          )}
          <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com"/>
          <Input label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-full bg-white text-[#0D0E12] font-bold text-sm
                       hover:bg-white/90 disabled:opacity-40 transition-all duration-200 mt-2">
            {loading ? 'Signing in…' : 'Sign In'}
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
        { id: 'dashboard', label: 'Overview',     icon: <Dash size={14}/> },
        { id: 'keys',      label: 'Keys',         icon: <Key  size={14}/>, badge: keyCount },
      ]
    },
    {
      label: 'TOOLS',
      items: [
        { id: 'hwids',  label: 'HWIDs',        icon: <Shield   size={14}/>, disabled: true },
        { id: 'bans',   label: 'Bans',         icon: <Ban      size={14}/>, disabled: true },
        { id: 'logs',   label: 'Logs',         icon: <FileText size={14}/>, disabled: true },
      ]
    },
    {
      label: 'SETTINGS',
      items: [
        { id: 'settings', label: 'Settings', icon: <Settings size={14}/>, disabled: true },
      ]
    }
  ]

  const content = (
    <aside className="w-[210px] bg-[#0A0B0F] border-r border-white/[0.05] flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/[0.05] flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono tracking-widest uppercase text-white/25 mb-1">01 // ADMIN</div>
          <div className="text-sm font-extrabold tracking-tight text-white">Seistem</div>
        </div>
        <button onClick={onClose} className="lg:hidden text-white/30 hover:text-white/60 p-1">
          <X size={15}/>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto space-y-6">
        {sections.map(section => (
          <div key={section.label}>
            <p className="text-[9px] font-mono tracking-widest uppercase text-white/20 px-2 mb-2">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const active = view === item.id
                return (
                  <button key={item.id}
                    onClick={() => { if (!item.disabled) { setView(item.id); onClose?.() } }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition text-left
                      ${active
                        ? 'bg-white/[0.06] text-white'
                        : item.disabled
                          ? 'text-white/15 cursor-not-allowed'
                          : 'text-white/35 hover:text-white/70 hover:bg-white/[0.03]'
                      }`}
                  >
                    <span className={active ? 'text-white' : 'text-white/30'}>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="text-[10px] font-mono text-white/25 tabular-nums">{item.badge}</span>
                    )}
                    {item.disabled && (
                      <span className="text-[9px] text-white/15 font-mono">soon</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-white/[0.05]">
        <button onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-white/25 hover:text-red-400 hover:bg-red-500/8 transition">
          <SignOut size={14}/>
          Sign Out
        </button>
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden lg:flex h-screen sticky top-0 flex-shrink-0">{content}</div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
          <div className="relative z-50 h-full">{content}</div>
        </div>
      )}
    </>
  )
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function TopBar({ view, onMenuClick }) {
  const crumbs = { dashboard: 'Overview', keys: 'Keys' }
  return (
    <header className="h-[52px] border-b border-white/[0.05] flex items-center justify-between px-5 sm:px-7 bg-[#0A0B0F] flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden text-white/30 hover:text-white/60 p-1 -ml-1">
          <Menu size={17}/>
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/20 font-mono text-xs hidden sm:inline">seistem</span>
          <span className="text-white/15 hidden sm:inline">›</span>
          <span className="text-white/60 font-medium text-xs">{crumbs[view] || 'Overview'}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-white/25 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"/>
        online
      </div>
    </header>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ counts }) {
  const { total, active, expired, disabled, premium, today: todayN, month: monthN, recent, providers, daily } = counts

  const providerData = Object.entries(providers)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }))

  const statusData = [
    { name: 'Active',   value: active,   color: '#10b981' },
    { name: 'Expired',  value: expired,  color: '#ef4444' },
    { name: 'Disabled', value: disabled, color: '#f59e0b' },
  ].filter(d => d.value > 0)

  const PROVIDER_COLORS = ['#00ADB5','#8b5cf6','#f59e0b','#10b981','#ef4444','#6366f1']

  const bigStats = [
    { label: 'Active Keys',  value: active,  color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', dot: 'bg-emerald-400' },
    { label: 'Total Keys',   value: total,   color: 'text-white',       border: 'border-white/[0.08]',  bg: 'bg-white/[0.02]',  dot: 'bg-white/40' },
    { label: 'Expired Keys', value: expired, color: 'text-red-400',     border: 'border-red-500/20',    bg: 'bg-red-500/5',     dot: 'bg-red-400' },
  ]

  const smallStats = [
    { label: 'Premium',     value: premium, color: 'text-amber-400' },
    { label: 'Disabled',    value: disabled, color: 'text-amber-400' },
    { label: 'Today',       value: todayN,  color: 'text-white/70' },
    { label: 'This Month',  value: monthN,  color: 'text-white/70' },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 sm:px-8 py-7 max-w-6xl mx-auto space-y-10">

        {/* ── Big stats ── */}
        <div>
          <SectionLabel index="01" label="KEY HEALTH"/>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            {bigStats.map(s => (
              <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-5`}>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot} flex-shrink-0`}/>
                  <span className="text-[10px] font-mono tracking-widest uppercase text-white/30">{s.label}</span>
                </div>
                <p className={`text-4xl font-extrabold tracking-tight ${s.color} tabular-nums`}>
                  {s.value.toLocaleString()}
                </p>
                {total > 0 && (
                  <p className="text-xs text-white/20 mt-2 font-mono">
                    {(s.value / total * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {smallStats.map(s => (
              <div key={s.label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl px-4 py-4">
                <p className="text-[10px] font-mono tracking-widest uppercase text-white/20 mb-2">{s.label}</p>
                <p className={`text-2xl font-extrabold tracking-tight ${s.color} tabular-nums`}>
                  {s.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Area chart ── */}
        <div>
          <SectionLabel index="02" label="KEYS OVER TIME (14 DAYS)"/>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
            {daily && daily.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00ADB5" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#00ADB5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Area type="monotone" dataKey="count" stroke="#00ADB5" strokeWidth={2} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: '#00ADB5', stroke: '#0D0E12', strokeWidth: 2 }}/>
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <p className="text-white/15 text-sm font-mono">No data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Donut charts ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Provider breakdown */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
            <SectionLabel index="03" label="PROVIDER BREAKDOWN"/>
            {providerData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={providerData} cx="50%" cy="50%" innerRadius={42} outerRadius={62} dataKey="value" strokeWidth={0}>
                      {providerData.map((_, i) => (
                        <Cell key={i} fill={PROVIDER_COLORS[i % PROVIDER_COLORS.length]}/>
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip/>}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2 min-w-0">
                  {providerData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PROVIDER_COLORS[i % PROVIDER_COLORS.length] }}/>
                      <span className="text-xs text-white/40 capitalize truncate flex-1">{d.name}</span>
                      <span className="text-xs font-mono text-white/60 flex-shrink-0 tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[140px] flex items-center justify-center">
                <p className="text-white/15 text-sm font-mono">No data yet</p>
              </div>
            )}
          </div>

          {/* Key status */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
            <SectionLabel index="04" label="KEY STATUS"/>
            {statusData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={42} outerRadius={62} dataKey="value" strokeWidth={0}>
                      {statusData.map((d, i) => (
                        <Cell key={i} fill={d.color}/>
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip/>}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {statusData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }}/>
                      <span className="text-xs text-white/40 flex-1">{d.name}</span>
                      <span className="text-xs font-mono text-white/60 tabular-nums">{d.value}</span>
                    </div>
                  ))}
                  {total > 0 && (
                    <div className="mt-4 h-1.5 bg-white/[0.05] rounded-full overflow-hidden flex gap-px">
                      {statusData.map(d => (
                        <div key={d.name} className="h-full rounded-full transition-all"
                             style={{ width: `${(d.value/total*100).toFixed(1)}%`, background: d.color, opacity: 0.7 }}/>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[140px] flex items-center justify-center">
                <p className="text-white/15 text-sm font-mono">No keys yet</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Recent keys ── */}
        <div>
          <SectionLabel index="05" label="RECENTLY CREATED"/>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            {recent.length === 0 ? (
              <div className="py-12 text-center text-white/15 text-sm font-mono">No keys yet</div>
            ) : (
              recent.map((k, i) => (
                <div key={k.id} className={`flex items-center gap-3 px-5 py-3.5 ${i < recent.length-1 ? 'border-b border-white/[0.04]' : ''}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive(k)?'bg-emerald-400':isDisabled(k)?'bg-amber-400':'bg-red-400'}`}/>
                  <span className="font-mono text-xs text-white/50 flex-1 truncate">{k.key_value}</span>
                  {k.is_premium && <span className="text-[10px] text-amber-400 font-mono">★</span>}
                  <span className="text-[11px] text-white/20 font-mono flex-shrink-0 hidden sm:block">{fmtDate(k.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Keys view ─────────────────────────────────────────────────────────────────
function Keys({ keys, setKeys, onRefresh, total, page, onPageChange, search, onSearch, counts, PAGE_SIZE }) {
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

  const tierTabs   = [{id:'all',label:'All Tiers'},{id:'standard',label:'Standard'},{id:'premium',label:'★ Premium'}]
  const statusTabs = [
    {id:'all',     label:'All',     count: counts.total},
    {id:'active',  label:'Active',  count: counts.active,   color:'emerald'},
    {id:'expired', label:'Expired', count: counts.expired,  color:'red'},
    {id:'disabled',label:'Disabled',count: counts.disabled, color:'amber'},
  ]
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/[0.05] bg-[#0A0B0F] sticky top-0 z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-7 pt-5 pb-3">
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/25">02 // KEYS</span>
              <div className="h-px w-8 bg-white/[0.06]"/>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">{total.toLocaleString()} Keys</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/[0.08] text-white/35 hover:text-white/70 text-xs font-medium transition">
              <Refresh size={12}/> <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/[0.08] text-white/35 hover:text-white/70 text-xs font-medium transition">
              <Download size={12}/> <span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={handleDeleteExpired}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/8 text-xs font-medium transition">
              <Trash size={12}/> <span className="hidden sm:inline">Delete expired</span>
            </button>
            <button onClick={() => setCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#0A0B0F] text-xs font-bold transition hover:bg-white/90">
              <Plus size={12}/> Create key
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 sm:px-7 pb-3">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={search} onChange={e=>onSearch(e.target.value)} placeholder="Search key, provider, Discord…"
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-2xl pl-9 pr-4 py-2.5 text-sm text-white
                         outline-none focus:border-white/15 transition placeholder-white/15"/>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 sm:px-7 pb-4 flex items-center gap-1.5 flex-wrap">
          {tierTabs.map(t => (
            <button key={t.id} onClick={()=>setFilterTier(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
                ${filterTier===t.id ? 'bg-white/[0.08] border-white/20 text-white' : 'border-white/[0.06] text-white/25 hover:text-white/50 hover:border-white/12'}`}>
              {t.label}
            </button>
          ))}
          <div className="w-px h-4 bg-white/[0.06] mx-0.5"/>
          {statusTabs.map(t => (
            <button key={t.id} onClick={()=>setFilterStatus(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
                ${filterStatus===t.id
                  ? t.color==='emerald' ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-400'
                  : t.color==='red'     ? 'bg-red-500/12 border-red-500/30 text-red-400'
                  : t.color==='amber'   ? 'bg-amber-500/12 border-amber-500/30 text-amber-400'
                                        : 'bg-white/[0.08] border-white/20 text-white'
                  : 'border-white/[0.06] text-white/25 hover:text-white/50 hover:border-white/12'}`}>
              {t.label} <span className="opacity-40 ml-1 tabular-nums">{t.count}</span>
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            {[{id:'list',icon:<ListIcon size={13}/>},{id:'grid',icon:<GridIcon size={13}/>}].map(l=>(
              <button key={l.id} onClick={()=>setLayout(l.id)}
                className={`p-2 rounded-xl border transition
                  ${layout===l.id?'border-white/15 bg-white/[0.06] text-white':'border-white/[0.06] text-white/25 hover:text-white/50'}`}>
                {l.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key list */}
      <div className={`overflow-y-auto flex-1 px-5 sm:px-7 py-4 sm:py-5
        ${layout==='grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 content-start' : 'space-y-2'}`}>
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-20 text-white/15 text-sm font-mono">No keys match your filters.</div>
        )}
        {filtered.map(k => {
          const active   = isActive(k)
          const expired  = isExpired(k)
          const disabled = isDisabled(k)
          const exp      = expanded[k.id]

          return (
            <div key={k.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.12] transition-all group">
              <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3.5">
                <span className="font-mono text-[12px] sm:text-[13px] text-white/60 flex-1 truncate min-w-0">
                  {k.key_value}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border whitespace-nowrap font-mono
                    ${disabled ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : expired  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                               : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                    {disabled ? 'disabled' : expired ? 'expired' : 'active'}
                  </span>
                  {k.is_premium && (
                    <span className="hidden sm:inline text-[10px] px-2.5 py-1 rounded-full font-semibold bg-amber-500/8 text-amber-400 border border-amber-500/15 font-mono">
                      ★ premium
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={()=>copyKey(k.key_value,k.id)}
                    className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition">
                    {copied[k.id] ? <span className="text-emerald-400 text-xs px-0.5">✓</span> : <Copy size={13}/>}
                  </button>
                  <button onClick={()=>setHwidModal(k)}
                    className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition">
                    <Shield size={13}/>
                  </button>
                  <button onClick={()=>disabled?handleEnable(k.id):setDisableModal({id:k.id,key:k.key_value,until:''})}
                    className={`p-1.5 rounded-lg transition ${disabled?'text-amber-400':'text-white/25 hover:text-amber-400 hover:bg-amber-500/8'}`}>
                    <Clock size={13}/>
                  </button>
                  <button onClick={()=>setEditModal({...k})}
                    className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition">
                    <Edit size={13}/>
                  </button>
                  <button onClick={()=>handleDelete(k.id)}
                    className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/8 transition">
                    <Trash size={13}/>
                  </button>
                </div>
              </div>

              <div className="px-4 sm:px-5 pb-3 flex flex-wrap items-center gap-3 text-[11px] text-white/25 font-mono">
                <span>{active ? `in ${timeLeft(k.expires_at)}` : expired ? 'expired' : fmtDate(k.expires_at)}</span>
                <span>·</span>
                <span>{k.key_name || k.provider}</span>
                {(k.discord_username || k.discord_user_id) && (
                  <span className="hidden sm:inline">{k.discord_username||''}{k.discord_user_id?` (${k.discord_user_id})`:''}</span>
                )}
                <button onClick={()=>setExpanded(p=>({...p,[k.id]:!p[k.id]}))}
                  className="ml-auto flex items-center gap-1 hover:text-white/50 transition">
                  {exp?'hide':'details'}
                  <ChevD size={10} className={`transition-transform ${exp?'rotate-180':''}`}/>
                </button>
              </div>

              {exp && (
                <div className="px-4 sm:px-5 pb-4 pt-3 border-t border-white/[0.04] grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-[11px] font-mono">
                  {[
                    ['id',       k.id],
                    ['created',  fmtDate(k.created_at)],
                    ['expires',  new Date(k.expires_at).toLocaleString()],
                    ['hwid',     k.hwid ? k.hwid.slice(0,24)+'…' : 'not locked'],
                    ['ip',       k.ip_address || '—'],
                    ['folder',   k.folder || '—'],
                    ['one-time', k.is_one_time ? 'yes' : 'no'],
                    ['no hwid',  k.no_hwid_binding ? 'yes' : 'no'],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-baseline gap-2 min-w-0">
                      <span className="text-white/15 flex-shrink-0">{label}:</span>
                      <span className="text-white/40 min-w-0 truncate">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 sm:px-7 py-3 border-t border-white/[0.05] flex-shrink-0">
          <span className="text-white/20 text-xs font-mono tabular-nums">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            {[['«',()=>onPageChange(0),page===0],['‹',()=>onPageChange(page-1),page===0],
              ['›',()=>onPageChange(page+1),page>=totalPages-1],['»',()=>onPageChange(totalPages-1),page>=totalPages-1]
            ].map(([label,fn,dis],i)=>(
              <button key={i} onClick={fn} disabled={dis}
                className="px-2.5 py-1.5 rounded-lg border border-white/[0.07] text-white/30 text-xs hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition font-mono">
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
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
              <Toggle label="Premium Key"         icon="⭐" checked={!!editModal.is_premium}          onChange={v=>setEditModal(m=>({...m,is_premium:v}))}/>
              <Toggle label="One-time Use"        icon="🔐" checked={!!editModal.is_one_time}         onChange={v=>setEditModal(m=>({...m,is_one_time:v}))}/>
              <Toggle label="Expiry on First Use" icon="⏰" checked={!!editModal.expiry_on_first_use} onChange={v=>setEditModal(m=>({...m,expiry_on_first_use:v}))}/>
              <Toggle label="No HWID Binding"    icon="🚫" checked={!!editModal.no_hwid_binding}     onChange={v=>setEditModal(m=>({...m,no_hwid_binding:v}))}/>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={()=>setEditModal(null)} className="flex-1 py-2.5 rounded-full border border-white/[0.08] text-white/40 text-sm hover:text-white/70 transition">Cancel</button>
              <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-full bg-white text-[#0D0E12] text-sm font-bold transition hover:bg-white/90">Save</button>
            </div>
          </div>
        </Modal>
      )}

      {hwidModal && (
        <Modal title="HWID Management" sub={hwidModal.key_value} onClose={()=>setHwidModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                <p className="text-white/30 text-xs font-mono mb-1">bound</p>
                <p className="text-2xl font-extrabold text-white tabular-nums">{hwidModal.hwid?'1':'0'}<span className="text-white/20 text-sm font-normal"> / 1</span></p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                <p className="text-white/30 text-xs font-mono mb-1">limit</p>
                <p className="text-2xl font-extrabold text-white">1</p>
              </div>
            </div>
            {hwidModal.hwid ? (
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex items-center gap-3">
                <span className="font-mono text-xs text-white/40 truncate flex-1">{hwidModal.hwid}</span>
                <button onClick={()=>handleClearHwid(hwidModal.id)}
                  className="text-xs px-3 py-1.5 bg-red-500/8 border border-red-500/20 text-red-400 rounded-full hover:bg-red-500/15 transition flex-shrink-0">
                  Remove
                </button>
              </div>
            ) : (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 text-center text-white/20 text-sm font-mono">
                not locked · locks on first use
              </div>
            )}
            <button onClick={()=>setHwidModal(null)} className="w-full py-2.5 rounded-full bg-white text-[#0D0E12] font-bold text-sm transition hover:bg-white/90">
              Close
            </button>
          </div>
        </Modal>
      )}

      {disableModal && (
        <Modal title="Disable Key" sub={disableModal.key} onClose={()=>setDisableModal(null)}>
          <div className="space-y-4">
            <Input label="Disable Until (leave blank for indefinite)" type="datetime-local"
              value={disableModal.until} onChange={e=>setDisableModal(m=>({...m,until:e.target.value}))}/>
            <div className="flex gap-3">
              <button onClick={()=>setDisableModal(null)} className="flex-1 py-2.5 rounded-full border border-white/[0.08] text-white/40 text-sm hover:text-white/70 transition">Cancel</button>
              <button onClick={handleDisable} className="flex-1 py-2.5 rounded-full bg-amber-500 text-[#0D0E12] text-sm font-bold transition hover:bg-amber-400">Disable</button>
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
              <button onClick={()=>setCreateModal(false)} className="flex-1 py-2.5 rounded-full border border-white/[0.08] text-white/40 text-sm hover:text-white/70 transition">Cancel</button>
              <button onClick={handleCreateKey} className="flex-1 py-2.5 rounded-full bg-white text-[#0D0E12] text-sm font-bold transition hover:bg-white/90">Create</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
const PAGE_SIZE    = 100
const EMPTY_COUNTS = { total:0, active:0, expired:0, disabled:0, premium:0, today:0, month:0, recent:[], providers:{}, daily:[] }

export default function Admin() {
  const [authed,      setAuthed]      = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [view,        setView]        = useState('dashboard')
  const [keys,        setKeys]        = useState([])
  const [keyTotal,    setKeyTotal]    = useState(0)
  const [keyPage,     setKeyPage]     = useState(0)
  const [keySearch,   setKeySearch]   = useState('')
  const [counts,      setCounts]      = useState(EMPTY_COUNTS)
  const [loading,     setLoading]     = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchCounts = useCallback(async () => {
    const now        = new Date().toISOString()
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)

    // Daily data: last 14 days
    const d14 = new Date(); d14.setDate(d14.getDate() - 13); d14.setHours(0,0,0,0)

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
      { data: dailyRaw },
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
      supabase.from('keys').select('created_at').gte('created_at', d14.toISOString()),
    ])

    const providers = (providerRows || []).reduce((acc, k) => {
      acc[k.provider] = (acc[k.provider] || 0) + 1; return acc
    }, {})

    // Build daily array
    const dayMap = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      dayMap[d.toISOString().split('T')[0]] = 0
    }
    ;(dailyRaw || []).forEach(k => {
      const key = k.created_at.split('T')[0]
      if (key in dayMap) dayMap[key]++
    })
    const daily = Object.entries(dayMap).map(([date, count]) => ({
      date: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    }))

    setCounts({ total:total||0, active:active||0, expired:expired||0, disabled:disabled||0,
                premium:premium||0, today:today||0, month:month||0, recent:recent||[], providers, daily })
  }, [authed])

  const fetchKeys = useCallback(async (page=0, search='') => {
    setLoading(true)
    const from = page * PAGE_SIZE, to = from + PAGE_SIZE - 1
    let q = supabase.from('keys').select('*', { count:'exact' }).order('created_at', { ascending:false }).range(from, to)
    if (search.trim()) q = q.or(`key_value.ilike.%${search.trim()}%,discord_username.ilike.%${search.trim()}%,provider.ilike.%${search.trim()}%`)
    const { data, count } = await q
    setKeys(data || [])
    setKeyTotal(count || 0)
    setLoading(false)
  }, [authed])

  useEffect(() => { if (authed) { fetchCounts(); fetchKeys(0, '') } }, [authed])

  const handleSearch     = (s) => { setKeySearch(s); setKeyPage(0); fetchKeys(0, s) }
  const handlePageChange = (p) => { setKeyPage(p); fetchKeys(p, keySearch) }
  const handleRefresh    = ()  => { fetchCounts(); fetchKeys(keyPage, keySearch) }
  const handleLogin      = ()  => setAuthed(true)
  const handleSignOut    = async () => {
    await supabase.auth.signOut()
    setAuthed(false); setKeys([]); setCounts(EMPTY_COUNTS)
  }

  if (authLoading) return (
    <div className="min-h-screen bg-[#0D0E12] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"/>
    </div>
  )

  if (!authed) return <Login onLogin={handleLogin}/>

  return (
    <div className="flex min-h-screen h-screen overflow-hidden bg-[#0D0E12] text-white">
      <Sidebar view={view} setView={setView} onSignOut={handleSignOut}
               keyCount={counts.total} open={sidebarOpen} onClose={()=>setSidebarOpen(false)}/>
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <TopBar view={view} onMenuClick={()=>setSidebarOpen(true)}/>
        <main className="flex-1 flex flex-col overflow-hidden">
          {loading && view === 'keys' ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"/>
            </div>
          ) : view === 'dashboard'
            ? <Dashboard counts={counts}/>
            : <Keys keys={keys} setKeys={setKeys} onRefresh={handleRefresh}
                    total={keyTotal} page={keyPage} onPageChange={handlePageChange}
                    search={keySearch} onSearch={handleSearch}
                    counts={counts} PAGE_SIZE={PAGE_SIZE}/>
          }
        </main>
      </div>
    </div>
  )
}
