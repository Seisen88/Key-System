import { useState } from 'react'

export default function KeyDisplay({ keyValue, expiresAt }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(keyValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const expiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '30 days'

  return (
    <div className="w-full">
      {/* Key box */}
      <div
        onClick={copy}
        className="w-full bg-bg border border-accent/40 rounded-xl p-5 text-center
                   font-mono text-accent tracking-widest text-lg cursor-pointer
                   hover:border-accent transition-colors select-all mb-3"
      >
        {keyValue}
      </div>

      {/* Copy button */}
      <button
        onClick={copy}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-150
                   bg-accent text-bg hover:brightness-110"
      >
        {copied ? '✓ Copied!' : 'Copy Key'}
      </button>

      {/* Notes */}
      <div className="mt-4 space-y-1 text-center">
        <p className="text-dim text-xs">Valid until <span className="text-muted">{expiry}</span></p>
        <p className="text-dim text-xs">Locked to the first device that validates it</p>
        <p className="text-dim text-xs">Keep this key safe — it cannot be recovered</p>
      </div>
    </div>
  )
}
