import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRightLeft,
  CircleOff,
  ClipboardPen,
  PackageSearch,
} from 'lucide-react'

import {
  AuditLink,
  DashboardTile,
  ProvisionalFlag,
  SectionShift,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shell'

import {
  NOW,
  materials,
  departments,
  locations,
  inventoryPositions,
} from '@/lib/sample-data'

import {
  stockBatches,
  stockMovements,
  parLevels,
  type StockBatch,
  type StockMovement,
} from '@/lib/inv-sample-data'

/**
 * SI-INV-002 — Department Stock Detail.
 *
 * Tier 2 Group 1, Epic 4 Arc (b). Drill-in detail for a single material at a
 * single CK Bandra department, entered via `?item=<materialId>` query param
 * (same linking pattern as SI-INV-001 row chevrons).
 *
 * Sections:
 *   1. Item header — name, category, UOM, default yield factor, shelf-life
 *      policy (derived from batch), dept + location context.
 *   2. Aggregate row — total on-hand, PAR level; StatusPill below-PAR flag.
 *   3. FEFO batch table (sorted by expiry asc, nulls last) — batch ref,
 *      received date, expiry date + ExpiryPip, on-hand qty, source ref,
 *      ProvisionalFlag per provisional batch.
 *   4. 30-day movement history — timestamp, type, signed delta (tabular-nums),
 *      reference TRN; rows where varianceFlagged carry status_variance_flagged.
 *
 * FR25 (real-time stock view), FR33/FR34 (PAR flag), FR27 (yield factor).
 *
 * Cross-cutting:
 *   - CC-AUDIT-LINK — AuditLink with entityRef `${materialId}:${departmentId}`.
 *   - CC-PROVISIONAL-FLAG — per-batch provisional badge.
 *
 * Sub-affordances (links, not forms):
 *   "Transfer from here" → /SI-INV-005
 *   "Adjust batch"       → /SI-INV-013
 *
 * Read-only — no DraftPill, no data-entry forms.
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory tables / dashboards.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants / helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOW_DATE = new Date(`${NOW}T09:00:00+05:30`)

/** Default materialId when no ?item= query param is present. */
const DEFAULT_MATERIAL_ID = 'mat-chicken'

/** Default departmentId — Hot Kitchen at CK Bandra. */
const DEFAULT_DEPT_ID = 'dept-ck-hot'

// ─── Expiry pip (copied from SI-INV-001 canonical idiom) ────────────────────

type ExpiryBand = '24h' | '48h' | '72h' | 'fresh'

const EXPIRY_BAND_LABEL: Record<ExpiryBand, string> = {
  '24h': 'Within 24 h',
  '48h': 'Within 48 h',
  '72h': 'Within 72 h',
  fresh: '> 72 h',
}

interface ExpiryPipProps {
  readonly band: ExpiryBand
}

/** Expiry-band visual — §6.1 status palette: 24h → error pip; 48h/72h →
 *  tertiary; fresh → neutral surface. Copied from SI-INV-001. */
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

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatDate(iso: string): string {
  // YYYY-MM-DD → DD MMM YYYY (e.g. "03 May 2026")
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

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

function lastUpdatedLabel(iso: string): string {
  const then = new Date(`${iso}T09:00:00+05:30`).getTime()
  const diffMs = NOW_DATE.getTime() - then
  const mins = Math.max(0, Math.round(diffMs / 60000))
  if (mins < 60) return `Updated ${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `Updated ${hrs} h ago`
  const days = Math.round(hrs / 24)
  return `Updated ${days} d ago`
}

const MOVEMENT_TYPE_LABEL: Record<StockMovement['movementType'], string> = {
  receipt: 'Goods Receipt',
  consumption: 'Production Consumption',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  adjustment: 'Adjustment',
  closing_variance: 'Closing Variance',
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch sort: expiry asc, nulls last (FEFO)
// ─────────────────────────────────────────────────────────────────────────────

function sortBatchesFefo(batches: ReadonlyArray<StockBatch>): StockBatch[] {
  return [...batches].sort((a, b) => {
    if (a.expiryDate === null && b.expiryDate === null) return 0
    if (a.expiryDate === null) return 1
    if (b.expiryDate === null) return -1
    return a.expiryDate.localeCompare(b.expiryDate)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 30-day window filter
// ─────────────────────────────────────────────────────────────────────────────

const THIRTY_DAYS_AGO = (() => {
  const d = new Date(`${NOW}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 30)
  return d.toISOString().slice(0, 10)
})()

function isWithin30Days(iso: string): boolean {
  return iso.slice(0, 10) >= THIRTY_DAYS_AGO
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv002() {
  const [searchParams] = useSearchParams()
  const rawItemParam = searchParams.get('item') ?? DEFAULT_MATERIAL_ID

  // Resolve material
  const material = useMemo(
    () => materials.find((m) => m.id === rawItemParam) ?? materials.find((m) => m.id === DEFAULT_MATERIAL_ID)!,
    [rawItemParam],
  )
  const materialId = material.id

  // Resolve department: find a CK Bandra department that has batches for this
  // material, else fall back to DEFAULT_DEPT_ID.
  const departmentId = useMemo(() => {
    const matchingBatch = stockBatches.find((b) => b.materialId === materialId)
    if (matchingBatch) return matchingBatch.departmentId
    return DEFAULT_DEPT_ID
  }, [materialId])

  const department = useMemo(
    () => departments.find((d) => d.id === departmentId),
    [departmentId],
  )

  const location = useMemo(
    () => (department ? locations.find((l) => l.id === department.location_id) : null),
    [department],
  )

  // Inventory position for this material at the location
  const position = useMemo(
    () =>
      inventoryPositions.find(
        (p) => p.material_id === materialId && p.location_id === (location?.id ?? 'loc-ck-bandra'),
      ),
    [materialId, location],
  )

  // PAR level
  const parEntry = useMemo(
    () =>
      parLevels.find(
        (p) =>
          p.materialId === materialId &&
          p.departmentId === departmentId,
      ) ??
      parLevels.find(
        (p) => p.materialId === materialId && !p.departmentId,
      ),
    [materialId, departmentId],
  )

  const onHandQty = position?.on_hand_qty ?? 0
  const parQty = parEntry?.basePar ?? position?.par_level ?? 0
  const belowPar = parQty > 0 && onHandQty < parQty
  const uom = material.uom

  // Batches for this material × department (FEFO sorted)
  const batches = useMemo(
    () =>
      sortBatchesFefo(
        stockBatches.filter(
          (b) => b.materialId === materialId && b.departmentId === departmentId,
        ),
      ),
    [materialId, departmentId],
  )

  // Default to all material batches if no dept-specific ones exist (fallback for fixture gaps)
  const displayBatches = useMemo(
    () =>
      batches.length > 0
        ? batches
        : sortBatchesFefo(stockBatches.filter((b) => b.materialId === materialId)),
    [batches, materialId],
  )

  // 30-day movement history for this material × department
  const movements = useMemo(
    () =>
      stockMovements
        .filter(
          (m) =>
            m.materialId === materialId &&
            m.departmentId === departmentId &&
            isWithin30Days(m.occurredOn.slice(0, 10)),
        )
        .slice() // make mutable
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)), // newest first
    [materialId, departmentId],
  )

  // Default to all material movements if no dept-specific ones (fallback for fixture gaps)
  const displayMovements = useMemo(
    () =>
      movements.length > 0
        ? movements
        : stockMovements
            .filter(
              (m) =>
                m.materialId === materialId &&
                isWithin30Days(m.occurredOn.slice(0, 10)),
            )
            .slice()
            .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
    [movements, materialId],
  )

  // Aggregate stats for DashboardTile row
  const totalOnHand = displayBatches.reduce((sum, b) => sum + b.quantityRemaining, 0)
  const expiringCount = displayBatches.filter((b) => b.expiryBand === '24h' || b.expiryBand === '48h').length
  const provisionalCount = displayBatches.filter((b) => b.provisional).length

  // Default yield factor from first batch (if any)
  const representativeYield = displayBatches[0]?.yieldFactor ?? 1.0

  const auditEntityRef = `${materialId}:${departmentId}`

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
              {material.name}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {department?.name ?? departmentId}
              {location ? ` · ${location.name}` : ''}
              {' '}· {material.category} · per {uom}
              {position ? ` · ${lastUpdatedLabel(position.last_movement_on)}` : ''}
            </p>
          </div>

          {/* Audit link */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <AuditLink entityRef={auditEntityRef} />
          </div>
        </header>

        {/* ── Item detail card ────────────────────────────────────────────── */}
        <section
          aria-label="Item details"
          className="mt-6 rounded-md bg-surface-container-lowest p-4 tablet:p-5"
        >
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-3">
            Item information
          </h2>
          <dl className="grid grid-cols-2 tablet:grid-cols-4 gap-x-6 gap-y-4">
            <div>
              <dt className="text-[11px] text-on-surface-variant uppercase tracking-wider">HSN code</dt>
              <dd className="mt-0.5 text-sm font-medium text-on-surface tabular-nums">{material.hsn_code}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-on-surface-variant uppercase tracking-wider">Category</dt>
              <dd className="mt-0.5 text-sm font-medium text-on-surface">{material.category}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-on-surface-variant uppercase tracking-wider">Unit of Measure</dt>
              <dd className="mt-0.5 text-sm font-medium text-on-surface uppercase">{uom}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-on-surface-variant uppercase tracking-wider">Default yield factor</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-on-surface">
                {(representativeYield * 100).toFixed(0)} %
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-on-surface-variant uppercase tracking-wider">Location</dt>
              <dd className="mt-0.5 text-sm font-medium text-on-surface">
                {location?.name ?? 'CK Bandra'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-on-surface-variant uppercase tracking-wider">Department</dt>
              <dd className="mt-0.5 text-sm font-medium text-on-surface">
                {department?.name ?? departmentId}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-on-surface-variant uppercase tracking-wider">LKP / {uom}</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-on-surface">
                ₹ {material.lkp_per_uom.toLocaleString('en-IN')}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-on-surface-variant uppercase tracking-wider">Shelf-life policy</dt>
              <dd className="mt-0.5 text-sm font-medium text-on-surface">
                {displayBatches[0]?.expiryDate ? 'Tracked (FEFO)' : 'No expiry tracked'}
              </dd>
            </div>
          </dl>
        </section>

        {/* ── Aggregate counters ───────────────────────────────────────────── */}
        <section
          aria-label="Stock aggregate"
          className="mt-6 grid grid-cols-1 tablet:grid-cols-3 gap-3"
        >
          <DashboardTile
            label="On hand"
            value={`${totalOnHand.toLocaleString('en-IN')} ${uom}`}
            secondary={belowPar ? 'Below PAR' : `PAR is ${parQty} ${uom}`}
            severity={belowPar ? 'warning' : 'neutral'}
          />
          <DashboardTile
            label="PAR level"
            value={parQty > 0 ? `${parQty.toLocaleString('en-IN')} ${uom}` : '—'}
            secondary={parEntry ? `Base PAR · last set by ${parEntry.lastModifiedBy}` : 'No PAR configured'}
          />
          <DashboardTile
            label="Batches expiring ≤ 48 h"
            value={expiringCount.toLocaleString('en-IN')}
            secondary={provisionalCount > 0 ? `${provisionalCount} provisional batch${provisionalCount > 1 ? 'es' : ''}` : 'No provisional batches'}
            severity={expiringCount > 0 ? 'error' : 'neutral'}
          />
        </section>

        {/* Below-PAR alert strip */}
        {belowPar ? (
          <div
            role="alert"
            className="mt-4 flex items-center gap-3 rounded-md bg-surface-container-low px-4 py-3"
          >
            <span className="inline-flex shrink-0">
              <StatusPill
                status="status_variance_flagged"
                size="sm"
                label="Below PAR"
              />
            </span>
            <p className="text-sm text-on-surface">
              On hand ({totalOnHand} {uom}) is below the PAR level of {parQty} {uom}.{' '}
              Shortfall: <span className="font-semibold tabular-nums">{(parQty - totalOnHand).toFixed(1)} {uom}</span>.
              Consider a transfer or purchase order.
            </p>
          </div>
        ) : null}

        {/* ── Sub-affordances ──────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to={`/SI-INV-005?sourceDept=${departmentId}&item=${materialId}`}
            className={[
              'inline-flex items-center gap-2 rounded-sm bg-surface-container-low px-3 py-2',
              'text-sm font-medium text-on-surface hover:bg-surface-container-high',
              'transition-colors min-h-[44px] tablet:min-h-[36px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            ].join(' ')}
            aria-label={`Transfer ${material.name} from ${department?.name ?? departmentId}`}
          >
            <ArrowRightLeft className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span>Transfer from here</span>
          </Link>
          <Link
            to={`/SI-INV-013?dept=${departmentId}&item=${materialId}`}
            className={[
              'inline-flex items-center gap-2 rounded-sm bg-surface-container-low px-3 py-2',
              'text-sm font-medium text-on-surface hover:bg-surface-container-high',
              'transition-colors min-h-[44px] tablet:min-h-[36px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            ].join(' ')}
            aria-label={`Adjust a batch of ${material.name}`}
          >
            <ClipboardPen className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span>Adjust batch</span>
          </Link>
        </div>

        {/* ── FEFO batch table ─────────────────────────────────────────────── */}
        <section aria-label="FEFO batches" className="mt-8">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">Batches on hand</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {displayBatches.length} batch{displayBatches.length !== 1 ? 'es' : ''} · sorted earliest-expiry first (FEFO)
            </span>
          </header>

          {displayBatches.length === 0 ? (
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
                {displayBatches.map((batch) => (
                  <BatchMobileCard key={batch.id} batch={batch} />
                ))}
              </div>

              {/* Desktop — table */}
              <div className="hidden tablet:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch ref</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayBatches.map((batch) => (
                      <BatchDesktopRow key={batch.id} batch={batch} uom={uom} />
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
              {displayMovements.length} movement{displayMovements.length !== 1 ? 's' : ''}
            </span>
          </header>

          {displayMovements.length === 0 ? (
            <div className="rounded-md bg-surface-container-lowest p-8 text-center">
              <p className="text-sm text-on-surface-variant">
                No movements recorded in the last 30 days for this item and department.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile — compact movement list */}
              <div className="flex flex-col gap-2 tablet:hidden">
                {displayMovements.map((mv) => (
                  <MovementMobileCard key={mv.id} movement={mv} uom={uom} />
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
                    {displayMovements.map((mv) => (
                      <MovementDesktopRow key={mv.id} movement={mv} uom={uom} />
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
          <span>Read-only view · no draft state · FEFO batch order · 30-day movement window.</span>
          <span className="ml-auto">SI-INV-002 · Tier 2 Group 1 · Phase 4 Epic 4 Arc (b)</span>
        </footer>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — Batch
// ─────────────────────────────────────────────────────────────────────────────

interface BatchMobileCardProps {
  readonly batch: StockBatch
}

function BatchMobileCard({ batch }: BatchMobileCardProps) {
  return (
    <div className="rounded-md bg-surface-container-lowest p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-on-surface font-mono">
              {batch.batchNumber}
            </span>
            {batch.provisional ? <ProvisionalFlag size="sm" /> : null}
          </div>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Received {formatDate(batch.receivedDate)}
            {batch.sourceRef ? ` · ${batch.sourceRef}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-xl font-bold tabular-nums text-on-surface leading-none">
            {batch.quantityRemaining}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-on-surface-variant mt-0.5">
            {batch.uom}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ExpiryPip band={batch.expiryBand} />
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
  readonly batch: StockBatch
  readonly uom: string
}

function BatchDesktopRow({ batch, uom }: BatchDesktopRowProps) {
  return (
    <TableRow className="hover:bg-surface-container transition-colors">
      <TableCell>
        <span className="font-mono text-sm font-medium text-on-surface">
          {batch.batchNumber}
        </span>
      </TableCell>
      <TableCell className="text-xs text-on-surface-variant tabular-nums">
        {formatDate(batch.receivedDate)}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <ExpiryPip band={batch.expiryBand} />
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
        {batch.sourceRef ?? '—'}
        {batch.sourceType === 'opening' ? (
          <span className="ml-1 text-[10px] text-on-surface-variant">(opening)</span>
        ) : null}
      </TableCell>
      <TableCell>
        {batch.provisional ? <ProvisionalFlag size="sm" /> : (
          <span className="text-[11px] text-on-surface-variant">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — Movement
// ─────────────────────────────────────────────────────────────────────────────

interface MovementMobileCardProps {
  readonly movement: StockMovement
  readonly uom: string
}

function MovementMobileCard({ movement, uom }: MovementMobileCardProps) {
  const isPositive = movement.quantityDelta >= 0
  const deltaClass = isPositive ? 'text-on-surface' : 'text-error'
  const deltaSign = isPositive ? '+' : ''

  return (
    <div className="flex items-start gap-3 rounded-sm bg-surface-container-lowest px-3 py-2.5 min-h-[52px]">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-on-surface">
            {MOVEMENT_TYPE_LABEL[movement.movementType]}
          </span>
          {movement.varianceFlagged ? (
            <StatusPill
              status="status_variance_flagged"
              size="sm"
              label="Variance"
            />
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] text-on-surface-variant font-mono">
          {movement.trn}
        </p>
        <p className="mt-0.5 text-[11px] text-on-surface-variant">
          {formatDatetime(movement.occurredOn)}
        </p>
      </div>
      <span className={`text-base font-semibold tabular-nums shrink-0 ${deltaClass}`}>
        {deltaSign}{movement.quantityDelta} {uom}
      </span>
    </div>
  )
}

interface MovementDesktopRowProps {
  readonly movement: StockMovement
  readonly uom: string
}

function MovementDesktopRow({ movement, uom }: MovementDesktopRowProps) {
  const isPositive = movement.quantityDelta >= 0
  const deltaClass = isPositive ? 'text-on-surface' : 'text-error'
  const deltaSign = isPositive ? '+' : ''

  return (
    <TableRow className="hover:bg-surface-container transition-colors">
      <TableCell className="text-xs text-on-surface-variant tabular-nums whitespace-nowrap">
        {formatDatetime(movement.occurredOn)}
      </TableCell>
      <TableCell className="text-sm text-on-surface">
        {MOVEMENT_TYPE_LABEL[movement.movementType]}
      </TableCell>
      <TableCell className="text-right">
        <span className={`text-base font-semibold tabular-nums ${deltaClass}`}>
          {deltaSign}{movement.quantityDelta}
        </span>
        <span className="ml-1 text-xs text-on-surface-variant uppercase">{uom}</span>
      </TableCell>
      <TableCell className="text-xs font-mono text-on-surface-variant">
        {movement.trn}
      </TableCell>
      <TableCell>
        {movement.varianceFlagged ? (
          <StatusPill
            status="status_variance_flagged"
            size="sm"
            label="Variance flagged"
          />
        ) : (
          <span className="text-[11px] text-on-surface-variant">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}
