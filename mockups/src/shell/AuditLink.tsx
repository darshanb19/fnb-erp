import { Link } from 'react-router-dom'
import { ArrowRight, History } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * AuditLink — CC-AUDIT-LINK canonical chip.
 *
 * Inline affordance dropped on every entity-detail screen across Epics 1–12
 * to drill into the cross-entity Audit Trail Viewer (SI-INF-005), pre-filtered
 * to the current entity reference. Renders as a small ghost-style chip with
 * the `history` Lucide glyph + label "Audit history" + a trailing arrow.
 *
 * Visual pattern follows DESIGN.md §5.2 (no-line) + §12.6 — a tonal hover on
 * `surface_container_low` rather than a 1-px outline. Hit target is ≥44 px on
 * mobile per §15.4 (the chip stretches vertically); on desktop the chip
 * compresses to a denser 32-px line height while keeping the focus ring
 * contract. Always icon + label so colour is not the only signal.
 *
 * NOT to be confused with the Audit Trail Viewer SCREEN — this is the chip
 * that POINTS to that screen. Screen lives at `mockups/src/screens/inf/SI-INF-005.tsx`.
 *
 * Use:
 *   <AuditLink entityRef="PO-2026-AND-WST-0231" />
 *   <AuditLink entityRef="GR-2026-00187" label="View audit trail" />
 */
export interface AuditLinkProps {
  /** Entity reference passed as `?entity=` query so SI-INF-005 can filter. */
  entityRef: string
  /** Optional override label. Defaults to "Audit history". */
  label?: string
  /** Compact density — drops the leading "Audit history" label, keeps icon + ref. */
  compact?: boolean
  className?: string
}

export function AuditLink({
  entityRef,
  label = 'Audit history',
  compact = false,
  className,
}: AuditLinkProps) {
  const href = `/SI-INF-005?entity=${encodeURIComponent(entityRef)}`
  return (
    <Link
      to={href}
      data-slot="audit-link"
      aria-label={`${label} for ${entityRef}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-2.5 py-1.5',
        'text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
        'transition-colors min-h-[44px] tablet:min-h-[32px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
    >
      <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {compact ? null : (
        <span className="font-medium uppercase tracking-wider text-[11px]">
          {label}
        </span>
      )}
      <span className="font-mono text-[11px] text-on-surface">{entityRef}</span>
      <ArrowRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
    </Link>
  )
}
