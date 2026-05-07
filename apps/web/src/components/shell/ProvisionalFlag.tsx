import { FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * ProvisionalFlag — CC-PROVISIONAL-FLAG (FR67a) canonical badge.
 *
 * Surfaces the "PROVISIONAL" marker on rows / hero values whose underlying
 * cost or stock figure is derived from a Pending-GR PO (FR66 / FR67a) rather
 * than a confirmed actual. The flag is the user-facing trust signal that the
 * displayed number is an LKP-backed provisional that GR confirmation will
 * replace.
 *
 * Visual contract — DESIGN.md §6.5 + §6.1 `status_provisional` palette:
 *   - 14 px `flask-conical` Lucide glyph in `tertiary` (rich-brown).
 *   - "PROVISIONAL" label in Label-S typography (uppercase + +0.05em
 *     tracking) on a `surface_container_high` chip.
 *
 * Two placements:
 *   - `'inline'` (default) — pill-shaped chip suitable for in-row / inline
 *     badge use next to an item label or hero value.
 *   - `'badge'` — slightly heavier chip with a 4-px left pip in `tertiary`,
 *     matching the §12.5 margin-accent pattern when the provisional flag
 *     IS the row's status indicator (e.g. SI-RPT-002 morning-briefing tiles).
 *
 * Reused by SI-INV-001 / SI-INV-002 / SI-PRO-003 / SI-RPT-002 / SI-ACC-010
 * (FCCC).
 *
 * No animation — DESIGN.md §6.5 explicitly forbids motion on the flag.
 */

export interface ProvisionalFlagProps {
  /** `'sm'` (default — 14 px icon, 11 px label) or `'md'` (16 px / 12 px). */
  size?: 'sm' | 'md'
  /** `'inline'` (default) for in-row / next-to-value use; `'badge'` adds a
   *  4-px tertiary pip on the left for status-indicator placement. */
  placement?: 'inline' | 'badge'
  className?: string
}

export function ProvisionalFlag({
  size = 'sm',
  placement = 'inline',
  className,
}: ProvisionalFlagProps) {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const labelSize = size === 'sm' ? 'text-[11px]' : 'text-xs'
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1'

  const inner = (
    <span
      role="status"
      aria-label="Provisional — stock derived from Pending-GR PO; actuals replace this on GR confirmation"
      title="Stock derived from Pending-GR PO — actuals replace this on GR confirmation"
      className={cn(
        'inline-flex items-center gap-1 font-medium uppercase tracking-wider text-tertiary',
        'bg-surface-container-high rounded-pill',
        padding,
        labelSize,
      )}
    >
      <FlaskConical className={cn(iconSize, 'shrink-0')} aria-hidden />
      <span>Provisional</span>
    </span>
  )

  if (placement === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-stretch overflow-hidden rounded-pill bg-surface-container-high',
          className,
        )}
      >
        <span
          aria-hidden
          className="w-1 shrink-0 bg-tertiary"
        />
        <span
          role="status"
          aria-label="Provisional — stock derived from Pending-GR PO; actuals replace this on GR confirmation"
          title="Stock derived from Pending-GR PO — actuals replace this on GR confirmation"
          className={cn(
            'inline-flex items-center gap-1 font-medium uppercase tracking-wider text-tertiary',
            padding,
            labelSize,
          )}
        >
          <FlaskConical className={cn(iconSize, 'shrink-0')} aria-hidden />
          <span>Provisional</span>
        </span>
      </span>
    )
  }

  return <span className={className}>{inner}</span>
}
