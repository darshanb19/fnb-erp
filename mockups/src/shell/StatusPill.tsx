import {
  Archive,
  BookMarked,
  CalendarX,
  Check,
  CheckCheck,
  CircleHelp,
  CircleOff,
  CircleX,
  Clock,
  CornerUpLeft,
  FlaskConical,
  OctagonX,
  PackageX,
  PencilLine,
  Play,
  Repeat,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { tokens, isStatusPipToken, type StatusKey } from '@/tokens'

/**
 * StatusPill — DESIGN.md §6.1 + §12.3, canonical first build.
 *
 * Renders any of the 20 lifecycle status tokens. Two visual patterns:
 *
 *   - Row-pattern (17 of 20): filled chip with bg + fg colour pair, icon at
 *     ~14 px, label in Label-M (12 px / 500 / +0.05 em tracking).
 *   - Pip-pattern (3 of 20 — `provisional`, `overridden`, `variance_flagged`):
 *     row stays `surface_container_lowest`; the colour rides on a 4-px left
 *     pip rendered as a leading element (NOT a CSS border per §5.2 no-line).
 *
 * Token data comes from `mockups/src/tokens.ts`, the canonical TypeScript
 * mirror of `globals.css` — driving styles inline from the same source-of-
 * truth that the Tailwind variables resolve to. Per §21.9, this is the
 * approved pattern when callers don't statically know the status name.
 */

const ICONS: Record<string, LucideIcon> = {
  archive: Archive,
  'book-marked': BookMarked,
  'calendar-x': CalendarX,
  check: Check,
  'check-check': CheckCheck,
  'circle-help': CircleHelp,
  'circle-off': CircleOff,
  'circle-x': CircleX,
  clock: Clock,
  'corner-up-left': CornerUpLeft,
  'flask-conical': FlaskConical,
  'octagon-x': OctagonX,
  'package-x': PackageX,
  'pencil-line': PencilLine,
  play: Play,
  repeat: Repeat,
  'triangle-alert': TriangleAlert,
  truck: Truck,
}

export type StatusToken = StatusKey

export interface StatusPillProps {
  /** Any of the 20 canonical `status_*` tokens. */
  status: StatusToken
  /** `'sm'` 11 px / `'md'` 12 px label. Default `'md'`. */
  size?: 'sm' | 'md'
  /** Hide the text label and render just the icon + accent. Default `true`. */
  showLabel?: boolean
  /** Optional override label — defaults to humanised token name. */
  label?: string
  className?: string
}

const labelFromToken = (status: StatusToken): string => {
  const stripped = status.replace(/^status_/, '').replace(/_/g, ' ')
  // Title-case for readability. e.g. "pending gr" → "Pending GR" handled by raw caps below.
  return stripped.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function StatusPill({
  status,
  size = 'md',
  showLabel = true,
  label,
  className,
}: StatusPillProps) {
  const token = tokens[status]
  const Icon = ICONS[token.icon]
  const text = label ?? labelFromToken(status)

  const labelClass = size === 'sm' ? 'text-[11px]' : 'text-xs'
  const iconClass = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const padClass = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1'

  if (isStatusPipToken(token)) {
    // Pip-pattern: row stays surface_container_lowest, accent rides on the pip.
    // Strikethrough is added at component level for status_cancelled (row-pattern below).
    return (
      <span
        role="status"
        aria-label={text}
        className={cn(
          'inline-flex items-stretch rounded-sm overflow-hidden bg-surface-container-lowest',
          className,
        )}
      >
        <span
          aria-hidden
          className="w-1 shrink-0"
          style={{ backgroundColor: token.pip }}
        />
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium',
            padClass,
            labelClass,
          )}
          style={{ color: token.fg }}
        >
          {Icon ? <Icon className={iconClass} aria-hidden /> : null}
          {showLabel ? <span>{text}</span> : null}
        </span>
      </span>
    )
  }

  // Row-pattern.
  const isCancelled = status === 'status_cancelled'
  return (
    <span
      role="status"
      aria-label={text}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill font-medium',
        padClass,
        labelClass,
        isCancelled ? 'line-through' : '',
        className,
      )}
      style={{ backgroundColor: token.bg, color: token.fg }}
    >
      {Icon ? <Icon className={iconClass} aria-hidden /> : null}
      {showLabel ? <span>{text}</span> : null}
    </span>
  )
}
