import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from './Button'

/**
 * TrnDisplay — CC-TRN-DISPLAY canonical (FR87).
 *
 * Visible TRN + copy-to-clipboard affordance. Promoted from the inline
 * definition in SI-ACC-003 to a shared shell component for reuse on
 * SI-ACC-013 (Integration Status Dashboard) and any later screen that
 * surfaces a TRN.
 *
 * Visual contract:
 *   - Monospace TRN string, `on_surface_variant` colour, 11 px label-M scale.
 *   - Trailing 28 × 28 px ghost icon button — `Copy` ➜ `Check` (success
 *     colour) for 1.6 s after a successful copy.
 *   - aria-live announcement is implicit via the button's `aria-label`
 *     swap; screen readers re-read the label on focus.
 *
 * The clipboard call is wrapped in try/catch so that the mockup harness
 * gracefully degrades on browsers without `navigator.clipboard` (no UI
 * exception path).
 */
export interface TrnDisplayProps {
  /** The TRN string. Rendered verbatim. */
  trn: string
  /** Whether to render the copy-to-clipboard affordance. Default `true`. */
  copyable?: boolean
  /** Optional class for the outer wrapper. */
  className?: string
}

export function TrnDisplay({ trn, copyable = true, className }: TrnDisplayProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(trn)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Mockup fallback — never throws into the UI.
      console.info(`[TrnDisplay] copy fallback for ${trn}`)
    }
  }

  return (
    <span className={['inline-flex items-center gap-1', className ?? ''].join(' ')}>
      <span className="font-mono text-[11px] text-on-surface-variant">{trn}</span>
      {copyable ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleCopy}
          aria-label={copied ? `${trn} copied to clipboard` : `Copy ${trn} to clipboard`}
          title={copied ? 'Copied' : 'Copy TRN'}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
        </Button>
      ) : null}
    </span>
  )
}
