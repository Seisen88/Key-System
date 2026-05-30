function formatDuration(hours) {
  if (!hours) return '6h'
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  const rem  = hours % 24
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`
}

export default function IntegrationCard({ integration, onSelect }) {
  return (
    <button
      onClick={() => onSelect(integration)}
      className="w-full bg-card border border-border rounded-xl p-5 text-left
                 hover:border-accent hover:bg-[#1a1b24] transition-all duration-200
                 group flex items-center gap-4"
    >
      {/* Icon / Logo */}
      <div className="w-12 h-12 rounded-lg bg-bg border border-border flex items-center
                      justify-center shrink-0 group-hover:border-accent transition-colors">
        {integration.logo_url ? (
          <img src={integration.logo_url} alt={integration.display_name}
               className="w-7 h-7 object-contain" />
        ) : (
          <span className="text-2xl">{integration.emoji ?? '🔗'}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-text text-sm">{integration.display_name}</span>
          {/* Key duration badge */}
          <span className="text-xs bg-accent/10 text-accent border border-accent/20
                           rounded-full px-2 py-0.5">
            {formatDuration(integration.key_hours)} key
          </span>
        </div>
        <p className="text-dim text-xs">
          {integration.checkpoint_count} checkpoint{integration.checkpoint_count !== 1 ? 's' : ''} · Complete to get your key
        </p>
      </div>

      {/* Arrow */}
      <svg className="w-4 h-4 text-dim group-hover:text-accent transition-colors shrink-0"
           fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
