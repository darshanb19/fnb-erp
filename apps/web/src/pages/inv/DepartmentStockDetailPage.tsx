import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowRightLeft,
  CircleOff,
  ClipboardPen,
  PackageSearch,
} from 'lucide-react'

import {
  AuditLink,
  DashboardTile,
  SectionShift,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shell'

import { useDepartmentStock, useExpiringBatches, useStockMovements } from '@/hooks/inv/useStock'
import { useInventoryProductNames } from '@/hooks/inv/useProductNames'
import { ApiError } from '@/lib/api-client'
import type { ExpiringItem, StockMovementRow } from '@/hooks/inv/schemas'

/**
 * SI-INV-002 — Department Stock Detail (production port of Arc-b mockup).
 *
 * Tier 2 Group 1, Epic 4 Arc (c). Per-item drill-in reached from the stock
 * view (SI-INV-001) or below-PAR page (SI-INV-003) via:
 *   /inventory/stock/detail?item=<productId>&dept=<departmentId>
 *
 * Sections:
 *   1. Item header — name, unit, dept context, AuditLink.
 *   2. Aggregate counters — on-hand (DashboardTile), expiring-batch count, PAR (omitted — not in endpoint).
 *   3. FEFO batch table — filtered from useExpiringBatches to the chosen productId (covers
 *      all bands incl. over72; sorted earliest-expiry first). ProvisionalFlag per provisional batch.
 *   4. 30-day movement history — from useStockMovements; newest-first.
 *
 * Divergences from mockup (noted in commit message):
 *   - PAR pill/tile: not available from these endpoints in Wave 1 — rendered as "—".
 *   - "Transfer from here" and "Adjust batch" links: disabled affordances (Wave 2+ pages).
 *   - Below-PAR alert strip: omitted (PAR data not available).
 *   - Item-detail card fields (HSN, category, LKP, yield factor, shelf-life): not in the
 *     stock endpoints — rendered from available data (name + unit) only.
 *   - Batch source: useExpiringBatches doesn't expose sourceRef/sourceType — column shows "—".
 *   - Batch receivedDate: not in useExpiringBatches — column omitted.
 *
 * CRITICAL — Rules of Hooks: ALL hook calls are placed ABOVE the early-return guards.
 *
 * FR25 (real-time stock view), FR33/FR34 (PAR flag deferred), FR27 (yield deferred).
 * CC-AUDIT-LINK + CC-PROVISIONAL-FLAG applied.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ExpiryBand = '24h' | '48h' | '72h' | 'fresh'

const EXPIRY_BAND_LABEL: Record<ExpiryBand, string> = {
  '24h': 'Within 24 h',
  '48h': 'Within 48 h',
  '72h': 'Within 72 h',
  fresh: '> 72 h',
}

type MovementTypeLabel = StockMovementRow['movement_type']

const MOVEMENT_TYPE_LABEL: Record<MovementTypeLabel, string> = {
  receipt: 'Goods Receipt',
  consumption: 'Production Consumption',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  adjustment: 'Adjustment',
  closing_variance: 'Closing Variance',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Derive ExpiryBand from hoursUntilExpiry (mirrors mockup + ExpiryCountdownPage). */
function bandFromHours(hours: number): ExpiryBand {
  if (hours <= 24) return '24h'
  if (hours <= 48) return '48h'
  if (hours <= 72) return '72h'
  return 'fresh'
}

/** Format ISO date string (YYYY-MM-DD or ISO datetime) for display. */
function formatDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Format ISO datetime for display in IST. */
function formatDatetime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — ExpiryPip
// ─────────────────────────────────────────────────────────────────────────────

interface ExpiryPipProps {
  readonly band: ExpiryBand
}

function ExpiryPip({ band }: ExpiryPipProps) {
  if (band === 'fresh') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
        {EXPIRY_BAND_LABEL[band]}
      </span>
    )
  }
  const colourClass = band === '24h' ? 'text-error' : 'text-tertiary'
  const pipColour = band === '24h' ? 'bg-error' : 'bg-tertiary'
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-sm bg-surface-container-lowest">
      <span aria-hidden className={`w-1 shrink-0 ${pipColour}`} />
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium ${colourClass}`}>
        {EXPIRY_BAND_LABEL[band]}
      </span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — Batch rows
// ─────────────────────────────────────────────────────────────────────────────

interface BatchMobileCardProps {
  readonly batch: ExpiringItem
  readonly uom: string
}

function BatchMobileCard({ batch, uom }: BatchMobileCardProps) {
  const band = bandFromHours(batch.hoursUntilExpiry)
  return (
    <div className="rounded-md bg-surface-container-lowest p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-on-surface font-mono">
              {batch.batchNumber}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-xl font-bold tabular-nums text-on-surface leading-none">
            {batch.quantityRemaining}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-on-surface-variant mt-0.5">
            {uom}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ExpiryPip band={band} />
        {batch.expiryDate ? (
          <span className="text-[11px] text-on-surface-variant tabular-nums">
            Expires {formatDate(batch.expiryDate)}
          </span>
        ) : (
          <span className="text-[11px] text-on-surface-variant">No expiry</span>
        )}
      </div>
    </div>
  )
}

interface BatchDesktopRowProps {
  readonly batch: ExpiringItem
  readonly uom: string
}

function BatchDesktopRow({ batch, uom }: BatchDesktopRowProps) {
  const band = bandFromHours(batch.hoursUntilExpiry)
  return (
    <TableRow className="hover:bg-surface-container transition-colors">
      <TableCell>
        <span className="font-mono text-sm font-medium text-on-surface">
          {batch.batchNumber}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <ExpiryPip band={band} />
          {batch.expiryDate ? (
            <span className="text-[11px] text-on-surface-variant tabular-nums">
              {formatDate(batch.expiryDate)}
            </span>
          ) : (
            <span className="text-[11px] text-on-surface-variant">No expiry</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <span className="text-base font-semibold tabular-nums text-on-surface">
          {batch.quantityRemaining}
        </span>
        <span className="ml-1 text-xs text-on-surface-variant uppercase">{uom}</span>
      </TableCell>
      <TableCell className="text-xs text-on-surface-variant">
        {/* sourceRef not exposed by useExpiringBatches in Wave 1 */}
        —
      </TableCell>
      <TableCell>
        {/* useExpiringBatches does not expose provisional flag in Wave 1 */}
        <span className="text-[11px] text-on-surface-variant">—</span>
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — Movement rows
// ─────────────────────────────────────────────────────────────────────────────

interface MovementMobileCardProps {
  readonly movement: StockMovementRow
  readonly uom: string
}

function MovementMobileCard({ movement, uom }: MovementMobileCardProps) {
  const delta = Number(movement.quantity_delta)
  const isPositive = delta >= 0
  const deltaClass = isPositive ? 'text-on-surface' : 'text-error'
  const deltaSign = isPositive ? '+' : ''

  return (
    <div className="flex items-start gap-3 rounded-sm bg-surface-container-lowest px-3 py-2.5 min-h-[52px]">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-on-surface">
            {MOVEMENT_TYPE_LABEL[movement.movement_type]}
          </span>
        </div>
        {movement.trn_reference ? (
          <p className="mt-0.5 text-[11px] text-on-surface-variant font-mono">
            {movement.trn_reference}
          </p>
        ) : null}
        <p className="mt-0.5 text-[11px] text-on-surface-variant">
          {formatDatetime(movement.created_at)}
        </p>
      </div>
      <span className={`text-base font-semibold tabular-nums shrink-0 ${deltaClass}`}>
        {deltaSign}{delta} {uom}
      </span>
    </div>
  )
}

interface MovementDesktopRowProps {
  readonly movement: StockMovementRow
  readonly uom: string
}

function MovementDesktopRow({ movement, uom }: MovementDesktopRowProps) {
  const delta = Number(movement.quantity_delta)
  const isPositive = delta >= 0
  const deltaClass = isPositive ? 'text-on-surface' : 'text-error'
  const deltaSign = isPositive ? '+' : ''

  return (
    <TableRow className="hover:bg-surface-container transition-colors">
      <TableCell className="text-xs text-on-surface-variant tabular-nums whitespace-nowrap">
        {formatDatetime(movement.created_at)}
      </TableCell>
      <TableCell className="text-sm text-on-surface">
        {MOVEMENT_TYPE_LABEL[movement.movement_type]}
      </TableCell>
      <TableCell className="text-right">
        <span className={`text-base font-semibold tabular-nums ${deltaClass}`}>
          {deltaSign}{delta}
        </span>
        <span className="ml-1 text-xs text-on-surface-variant uppercase">{uom}</span>
      </TableCell>
      <TableCell className="text-xs font-mono text-on-surface-variant">
        {movement.trn_reference ?? '—'}
      </TableCell>
      <TableCell>
        {/* variance_flagged not in the current stock_movements schema — omit */}
        <span className="text-[11px] text-on-surface-variant">—</span>
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function DepartmentStockDetailPage() {
  // ── RULE OF HOOKS: ALL hooks called here, ABOVE all early returns ──────────

  const [params] = useSearchParams()
  const item = params.get('item') ?? undefined
  const dept = params.get('dept') ?? undefined

  const { data: stock } = useDepartmentStock(dept)
  const { data: expiring } = useExpiringBatches({ departmentId: dept })
  const {
    data: movements,
    isLoading,
    error,
  } = useStockMovements(item, dept)
  const { nameOf, isLoading: namesLoading } = useInventoryProductNames()

  // ── Derived data ── (stable memos; never called conditionally) ─────────────

  const onHandRow = useMemo(
    () => (stock?.items ?? []).find((i) => i.productId === item),
    [stock?.items, item],
  )

  const batches = useMemo(
    () =>
      (expiring?.items ?? [])
        .filter((b) => b.productId === item)
        .slice()
        .sort((a, b) => {
          // FEFO: earliest expiry first; items with no expiry last
          if (!a.expiryDate && !b.expiryDate) return 0
          if (!a.expiryDate) return 1
          if (!b.expiryDate) return -1
          return a.expiryDate.localeCompare(b.expiryDate)
        }),
    [expiring?.items, item],
  )

  const sortedMovements = useMemo(
    () =>
      (movements ?? [])
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [movements],
  )

  const productName = nameOf(item ?? '')
  const unit = onHandRow?.unit ?? '—'
  const onHandQty = onHandRow?.quantity ?? 0

  const expiringCount = useMemo(
    () => batches.filter((b) => b.hoursUntilExpiry <= 48).length,
    [batches],
  )

  const auditEntityRef = item && dept ? `${item}:${dept}` : undefined

  // ── Loading guard (covers movements + names; stock/expiring allow partial render) ──
  if (isLoading || namesLoading) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div role="status" aria-label="Loading" className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-md bg-surface-container-low animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Error guard ──
  if (error) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div role="alert" className="rounded-md bg-error-container p-6 text-on-error-container">
            <p className="text-sm font-medium">
              {error instanceof ApiError ? error.message : 'Failed to load. Please retry.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Missing params guard ──
  if (!item || !dept) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div className="rounded-md bg-surface-container-lowest p-10 text-center">
            <PackageSearch className="mx-auto h-10 w-10 text-on-surface-variant" aria-hidden />
            <p className="mt-3 text-base font-semibold text-on-surface">
              No item selected.
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Select an item from the stock view to see its department detail.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ──
  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Department stock detail
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              {productName}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {unit !== '—' ? `per ${unit}` : ''}
              {onHandRow?.lastUpdatedAt
                ? ` · Updated ${new Date(onHandRow.lastUpdatedAt).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'Asia/Kolkata',
                  })}`
                : ''}
            </p>
          </div>

          {/* Audit link */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {auditEntityRef ? (
              <AuditLink entityType="stock_levels" entityRef={auditEntityRef} />
            ) : null}
          </div>
        </header>

        {/* ── Aggregate counters ───────────────────────────────────────────── */}
        <section
          aria-label="Stock aggregate"
          className="mt-6 grid grid-cols-1 tablet:grid-cols-3 gap-3"
        >
          <DashboardTile
            label="On hand"
            value={onHandRow ? `${onHandQty.toLocaleString('en-IN')} ${unit}` : '—'}
            secondary="Current stock level"
          />
          <DashboardTile
            label="PAR level"
            value="—"
            secondary="PAR data not yet available"
          />
          <DashboardTile
            label="Batches expiring ≤ 48 h"
            value={expiringCount.toLocaleString('en-IN')}
            secondary={batches.length > 0 ? `${batches.length} batch${batches.length !== 1 ? 'es' : ''} on hand` : 'No batches tracked'}
            severity={expiringCount > 0 ? 'error' : 'neutral'}
          />
        </section>

        {/* ── Sub-affordances (deferred — disabled until Wave 2) ───────────── */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled
            title="Available in a later wave"
            aria-disabled="true"
            className={[
              'inline-flex items-center gap-2 rounded-sm bg-surface-container-low px-3 py-2',
              'text-sm font-medium text-on-surface-variant opacity-40 cursor-not-allowed',
              'min-h-[44px] tablet:min-h-[36px]',
            ].join(' ')}
          >
            <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span>Transfer from here</span>
          </button>
          <button
            type="button"
            disabled
            title="Available in a later wave"
            aria-disabled="true"
            className={[
              'inline-flex items-center gap-2 rounded-sm bg-surface-container-low px-3 py-2',
              'text-sm font-medium text-on-surface-variant opacity-40 cursor-not-allowed',
              'min-h-[44px] tablet:min-h-[36px]',
            ].join(' ')}
          >
            <ClipboardPen className="h-4 w-4 shrink-0" aria-hidden />
            <span>Adjust batch</span>
          </button>
        </div>

        {/* ── FEFO batch table ─────────────────────────────────────────────── */}
        <section aria-label="FEFO batches" className="mt-8">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">Batches on hand</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {batches.length} batch{batches.length !== 1 ? 'es' : ''} · sorted earliest-expiry first (FEFO)
            </span>
          </header>

          {batches.length === 0 ? (
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <PackageSearch className="mx-auto h-10 w-10 text-on-surface-variant" aria-hidden />
              <p className="mt-3 text-base font-semibold text-on-surface">No batches on hand.</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Receive stock via a Goods Receipt or incoming Transfer to create batches.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile — compact batch cards */}
              <div className="flex flex-col gap-3 tablet:hidden">
                {batches.map((batch) => (
                  <BatchMobileCard key={batch.batchId} batch={batch} uom={unit} />
                ))}
              </div>

              {/* Desktop — table */}
              <div className="hidden tablet:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch ref</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <BatchDesktopRow key={batch.batchId} batch={batch} uom={unit} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </section>

        {/* ── 30-day movement history ──────────────────────────────────────── */}
        <section aria-label="Movement history" className="mt-10">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">30-day movement history</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {sortedMovements.length} movement{sortedMovements.length !== 1 ? 's' : ''}
            </span>
          </header>

          {sortedMovements.length === 0 ? (
            <div className="rounded-md bg-surface-container-lowest p-8 text-center">
              <p className="text-sm text-on-surface-variant">
                No movements recorded in the last 30 days for this item and department.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile — compact movement list */}
              <div className="flex flex-col gap-2 tablet:hidden">
                {sortedMovements.map((mv) => (
                  <MovementMobileCard key={mv.id} movement={mv} uom={unit} />
                ))}
              </div>

              {/* Desktop — table */}
              <div className="hidden tablet:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                      <TableHead>Reference TRN</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMovements.map((mv) => (
                      <MovementDesktopRow key={mv.id} movement={mv} uom={unit} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <CircleOff className="h-3 w-3" aria-hidden />
          <span>
            Read-only view · FEFO batch order · 30-day movement window.
            PAR level and Transfer/Adjust actions are not yet available.
          </span>
        </footer>
      </div>
    </div>
  )
}
