import { Link } from 'react-router-dom'
import { ArrowRight, PackageX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionShift } from './SectionShift'

/**
 * PendingGRDrill — CC-PENDING-GR-DRILL canonical pane.
 *
 * Originating surface for the cross-entity Pending-GR rejection drill: lists
 * recent rejected GRs alongside their reclassification journals, with a
 * single "View thread" affordance per row that lands on SI-PRO-009 (where
 * the rejected GR + linked PO + reclassification journal are presented as
 * one audit thread).
 *
 * Per DESIGN.md §5.2 / §12.6, rows are separated by 12 px vertical
 * whitespace plus a `<SectionShift>` tonal step — never by 1-px dividers.
 */
export interface PendingGRDrillEntry {
  id: string
  /** GR transaction reference (FR87 TRN). */
  gr_trn: string
  /** Linked PO transaction reference. */
  po_trn: string
  /** Vendor name as it appeared on the PO. */
  vendor_name: string
  /** ISO date the GR was rejected. */
  rejected_at: string
  /** FR47a rejection reason. */
  reason: 'shelf_life' | 'quality' | 'quantity_mismatch' | 'damage'
  /** Reclassification journal transaction reference (auto-fired on rejection). */
  journal_trn: string
  /** Drill destination — defaults to /SI-PRO-009. */
  to?: string
}

const REASON_LABEL: Record<PendingGRDrillEntry['reason'], string> = {
  shelf_life: 'Shelf life',
  quality: 'Quality',
  quantity_mismatch: 'Quantity mismatch',
  damage: 'Damage',
}

export interface PendingGRDrillProps {
  entries: ReadonlyArray<PendingGRDrillEntry>
  /** "View all" destination. Default `/SI-PRO-009`. */
  to?: string
  className?: string
}

export function PendingGRDrill({
  entries,
  to = '/SI-PRO-009',
  className,
}: PendingGRDrillProps) {
  return (
    <section
      className={cn(
        'rounded-md bg-surface-container-lowest p-5 text-on-surface',
        className,
      )}
      aria-label="Pending-GR resolution outcomes"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-on-surface">
            Pending-GR resolution outcomes
          </h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            Recent rejections + reclassification journals. Each row lands on
            the cross-entity audit thread.
          </p>
        </div>
        <Link
          to={to}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-primary hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </header>

      <SectionShift tone="high" className="mt-4 mb-4" />

      {entries.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No rejections in the last 30 days.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry, idx) => {
            const drillTo = entry.to ?? to
            return (
              <li key={entry.id} className="flex flex-col gap-3">
                {idx > 0 ? <SectionShift tone="low" /> : null}
                <Link
                  to={drillTo}
                  className="group flex items-start gap-3 rounded-sm bg-surface-container-lowest px-2 py-2 -mx-2 hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span
                    aria-hidden
                    className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-error-container text-on-error-container"
                  >
                    <PackageX className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-on-surface">
                        {entry.vendor_name}
                      </span>
                      <span className="font-mono text-[11px] text-on-surface-variant">
                        {entry.gr_trn}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        · rejected {formatDate(entry.rejected_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      Reason: <span className="text-on-surface">{REASON_LABEL[entry.reason]}</span>
                      {' · '}
                      PO: <span className="font-mono">{entry.po_trn}</span>
                      {' · '}
                      Journal: <span className="font-mono">{entry.journal_trn}</span>
                    </p>
                  </div>
                  <ArrowRight
                    className="mt-1 h-4 w-4 shrink-0 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`
}
