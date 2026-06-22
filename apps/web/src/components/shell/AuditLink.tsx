import { Link } from 'react-router-dom'
import { ArrowRight, History } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * AuditLink — CC-AUDIT-LINK canonical chip.
 *
 * Inline affordance dropped on every entity-detail screen across Epics 1–12
 * to drill into the cross-entity Audit Trail Viewer (SI-INF-005 / /audit),
 * pre-filtered to the current entity type + reference. Renders as a small
 * ghost-style chip with the `history` Lucide glyph + label "Audit history" +
 * a trailing arrow.
 *
 * Visual pattern follows DESIGN.md §5.2 (no-line) + §12.6 — a tonal hover on
 * `surface_container_low` rather than a 1-px outline. Hit target is ≥44 px on
 * mobile per §15.4 (the chip stretches vertically); on desktop the chip
 * compresses to a denser 32-px line height while keeping the focus ring
 * contract. Always icon + label so colour is not the only signal.
 *
 * NOT to be confused with the Audit Trail Viewer SCREEN — this is the chip
 * that POINTS to that screen. Production screen lives at `/audit`
 * (AuditTrailViewerPage) which reads `?entityType=<table>&entityRef=<id>`.
 *
 * Use:
 *   <AuditLink entityType="products" entityRef="PO-2026-AND-WST-0231" />
 *   <AuditLink entityType="users" entityRef="GR-2026-00187" label="View audit trail" />
 */
export interface AuditLinkProps {
  /** Drizzle table name (first arg to pgTable / brandScopedTable).
   *  Passed as `?entityType=` so the Audit Trail Viewer can pre-filter. */
  entityType: string
  /** Entity reference passed as `?entityRef=` query so SI-INF-005 can filter.
   *  OMIT on list / index / configuration pages that have no single subject —
   *  the chip then links to a type-only filter (all events for this entity
   *  type) instead of a per-row filter that would match nothing. */
  entityRef?: string
  /** Optional override label. Defaults to "Audit history". */
  label?: string
  /** Compact density — drops the leading "Audit history" label, keeps icon + ref.
   *  When there is no `entityRef` to show, the label is kept regardless so the
   *  chip is never icon-only (a11y: colour/icon must not be the only signal). */
  compact?: boolean
  className?: string
}

export function AuditLink({
  entityType,
  entityRef,
  label = 'Audit history',
  compact = false,
  className,
}: AuditLinkProps) {
  const href = entityRef
    ? `/audit?entityType=${encodeURIComponent(entityType)}&entityRef=${encodeURIComponent(entityRef)}`
    : `/audit?entityType=${encodeURIComponent(entityType)}`
  // Keep a visible word label whenever there is no ref to render, so the chip
  // never collapses to a bare icon.
  const showLabel = !compact || !entityRef
  return (
    <Link
      to={href}
      data-slot="audit-link"
      aria-label={entityRef ? `${label} for ${entityRef}` : label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-2.5 py-1.5',
        'text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
        'transition-colors min-h-[44px] tablet:min-h-[32px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
    >
      <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {showLabel && (
        <span className="font-medium uppercase tracking-wider text-[11px]">
          {label}
        </span>
      )}
      {entityRef && (
        <span className="font-mono text-[11px] text-on-surface">{entityRef}</span>
      )}
      <ArrowRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
    </Link>
  )
}
