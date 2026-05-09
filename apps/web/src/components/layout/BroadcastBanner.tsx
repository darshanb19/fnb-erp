/**
 * BroadcastBanner — AppShell-level targeted broadcast banner.
 *
 * Reads the current user's targeted broadcasts via useTargetedBroadcasts.
 * Shows the most recent unacknowledged broadcast as a top-of-content banner.
 *
 * Urgency coding (DESIGN.md §6.4 — no `bg-info`/`bg-warning`/`bg-error`
 * utilities; these are §6.4 semantic functional tokens without matching
 * Tailwind classes in this project):
 *   info       → bg-surface-container-high text-on-surface (neutral tint)
 *   important  → bg-tertiary-container text-on-tertiary-container
 *   critical   → bg-error-container text-on-error-container
 *
 * ack-required blocks dismissal: clicking close calls useAcknowledgeBroadcast
 * which writes the ack row, then on success the banner is dismissed.
 * Non-ack-required broadcasts can be dismissed by the X button with no
 * API call.
 *
 * Token discipline: ZERO hex, Lucide-only, no banned border classes.
 */

import { useState } from 'react'
import { X, CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useTargetedBroadcasts,
  useAcknowledgeBroadcast,
  type BroadcastUrgency,
} from '@/hooks/useBroadcasts'

// ---------------------------------------------------------------------------
// Urgency → Tailwind token classes
// Verified against tokens.ts: no `bg-info`, `bg-warning`, `bg-error` utilities.
// Using the correct DESIGN.md §5.1.x + §6.4 surface classes instead.
// ---------------------------------------------------------------------------

interface UrgencyStyle {
  readonly wrapperClass: string
  readonly icon: typeof Info
}

const URGENCY_STYLES: Record<BroadcastUrgency, UrgencyStyle> = {
  info: {
    wrapperClass: 'bg-surface-container-high text-on-surface',
    icon: Info,
  },
  important: {
    wrapperClass: 'bg-tertiary-container text-on-tertiary-container',
    icon: AlertTriangle,
  },
  critical: {
    wrapperClass: 'bg-error-container text-on-error-container',
    icon: AlertTriangle,
  },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BroadcastBanner() {
  const { data: broadcasts } = useTargetedBroadcasts()
  const ack = useAcknowledgeBroadcast()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  // Show only the topmost unacknowledged broadcast (MVP = top 1).
  const pending = (broadcasts ?? []).filter((b) => !dismissed.has(b.id))
  if (pending.length === 0) return null
  const top = pending[0]
  if (!top) return null

  const style = URGENCY_STYLES[top.urgency]
  const Icon = style.icon

  const handleClose = () => {
    if (top.ackRequired) {
      ack.mutate(
        { broadcastId: top.id },
        { onSuccess: () => setDismissed((s) => new Set(s).add(top.id)) },
      )
    } else {
      setDismissed((s) => new Set(s).add(top.id))
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start justify-between gap-4 px-4 py-2.5',
        style.wrapperClass,
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <span className="text-sm font-semibold">{top.title}</span>
          {top.body ? (
            <span className="ml-2 text-sm opacity-90">
              {top.body.slice(0, 200)}
              {top.body.length > 200 ? '…' : ''}
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={handleClose}
        disabled={ack.isPending}
        className={cn(
          'shrink-0 inline-flex items-center gap-1.5 rounded-pill px-2 py-1',
          'text-xs font-medium',
          'hover:bg-on-surface/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          'disabled:opacity-60',
        )}
        aria-label={top.ackRequired ? 'Acknowledge broadcast' : 'Dismiss broadcast'}
      >
        {top.ackRequired ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Acknowledge
          </>
        ) : (
          <X className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  )
}
