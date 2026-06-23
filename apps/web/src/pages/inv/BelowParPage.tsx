import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  PackageSearch,
  Plus,
  ShoppingCart,
  X,
} from 'lucide-react'

import {
  Button,
  DashboardTile,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shell'

import { useBelowPar } from '@/hooks/inv/useParLevels'
import { useInventoryProductNames } from '@/hooks/inv/useProductNames'
import { ApiError } from '@/lib/api-client'

/**
 * SI-INV-003 — Below-PAR Flag List (production port of Arc-b mockup).
 *
 * Tier 1 Group 1, Epic 4 Arc (c). Read-only list of all items currently
 * below their PAR level, with suggested reorder quantities, to drive
 * procurement / internal requisition decisions.
 *
 * FRs: FR33 (PAR flag on stock views), FR34 (below-PAR suggested reorder),
 * FR25 (real-time stock freshness — freshness is service-side).
 *
 * Data source: useBelowPar (Arc-a /par-levels/below) + useInventoryProductNames.
 * Urgency derived client-side from onHand / adjustedPar ratio.
 * PO seam (onOpenPo) is Epic-5 — rendered as disabled affordances.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Urgency = 'approaching' | 'below' | 'critical'

type Scope = 'department' | 'location' | 'cluster' | 'brand'

type ProductType = 'raw' | 'semi' | 'final'

// ─────────────────────────────────────────────────────────────────────────────
// Constants / labels
// ─────────────────────────────────────────────────────────────────────────────

const SCOPE_LABEL: Record<Scope, string> = {
  department: 'Department',
  location: 'Location',
  cluster: 'Cluster',
  brand: 'Brand-wide',
}

const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  raw: 'Raw',
  semi: 'Semi-product',
  final: 'Final product',
}

const URGENCY_LABEL: Record<Urgency, string> = {
  approaching: 'Approaching PAR',
  below: 'Below PAR',
  critical: 'Critical (< 50 %)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Row shape (live data)
// ─────────────────────────────────────────────────────────────────────────────

interface LiveRow {
  readonly key: string
  readonly productId: string
  readonly name: string
  readonly onHand: number
  readonly basePar: number
  readonly adjustedPar: number
  readonly parsDiffer: boolean
  readonly shortfall: number
  readonly suggestedReorder: number
  readonly urgency: Urgency
}

// ─────────────────────────────────────────────────────────────────────────────
// Urgency derivation (client-side)
// ─────────────────────────────────────────────────────────────────────────────

function deriveUrgency(onHand: number, adjustedPar: number): Urgency {
  if (adjustedPar <= 0) return 'below'
  const ratio = onHand / adjustedPar
  if (ratio <= 0.5) return 'critical'
  if (ratio < 0.8) return 'below'
  return 'approaching'
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter machinery
// ─────────────────────────────────────────────────────────────────────────────

interface FilterState {
  readonly scopes: ReadonlySet<Scope>
  readonly productTypes: ReadonlySet<ProductType>
  readonly urgencies: ReadonlySet<Urgency>
}

const INITIAL_FILTERS: FilterState = {
  scopes: new Set(),
  productTypes: new Set(),
  urgencies: new Set(),
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (carried verbatim from SI-INV-003 mockup)
// ─────────────────────────────────────────────────────────────────────────────

interface FilterChipPickerProps<V extends string> {
  readonly title: string
  readonly options: ReadonlyArray<{ value: V; label: string }>
  readonly selected: ReadonlySet<V>
  readonly onToggle: (v: V) => void
  readonly onClear: () => void
}

function FilterChipPicker<V extends string>({
  title,
  options,
  selected,
  onToggle,
  onClear,
}: FilterChipPickerProps<V>) {
  const [open, setOpen] = useState(false)
  const count = selected.size
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'tonal' : 'ghost'}
          size="sm"
          className="h-11 px-3 gap-1.5 rounded-pill min-w-[44px] tablet:h-9"
          aria-label={`Filter by ${title.toLowerCase()}${count > 0 ? ` — ${count} selected` : ''}`}
        >
          <span className="text-xs font-medium">{title}</span>
          {count > 0 ? (
            <span className="inline-flex items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
              {count}
            </span>
          ) : (
            <Plus className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Filter by {title.toLowerCase()}
          </span>
          {count > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                onClear()
                setOpen(false)
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <ul className="flex flex-col">
          {options.map((opt) => {
            const active = selected.has(opt.value)
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => onToggle(opt.value)}
                  aria-pressed={active}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-on-surface">{opt.label}</span>
                  {active ? (
                    <span className="text-xs font-medium text-primary">Selected</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

// Urgency pip — status-band left pip pattern (§6.1 border-l-4 pip)
interface UrgencyPipProps {
  readonly urgency: Urgency
}

function UrgencyPip({ urgency }: UrgencyPipProps) {
  if (urgency === 'critical') {
    return (
      <span className="inline-flex items-stretch overflow-hidden rounded-sm bg-surface-container-lowest">
        <span aria-hidden className="w-1 shrink-0 bg-error" />
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium text-error">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Critical
        </span>
      </span>
    )
  }
  if (urgency === 'below') {
    return (
      <span className="inline-flex items-stretch overflow-hidden rounded-sm bg-surface-container-lowest">
        <span aria-hidden className="w-1 shrink-0 bg-warning" />
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium text-warning">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Below PAR
        </span>
      </span>
    )
  }
  // approaching
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
      Approaching
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile card
// ─────────────────────────────────────────────────────────────────────────────

interface MobileCardProps {
  readonly row: LiveRow
}

function MobileCard({ row }: MobileCardProps) {
  return (
    <div
      className={[
        'rounded-md bg-surface-container-lowest',
        row.urgency === 'critical'
          ? 'border-l-4 border-error'
          : row.urgency === 'below'
            ? 'border-l-4 border-warning'
            : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="listitem"
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              to={`/inventory/stock/detail?item=${row.productId}`}
              className="group inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              aria-label={`View stock detail for ${row.name}`}
            >
              <span className="text-base font-semibold text-on-surface">{row.name}</span>
              <ChevronRight
                className="h-4 w-4 text-on-surface-variant opacity-60 group-hover:opacity-100 transition-opacity"
                aria-hidden
              />
            </Link>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span
              className={[
                'text-2xl font-bold tabular-nums leading-none',
                row.urgency === 'critical'
                  ? 'text-error'
                  : row.urgency === 'below'
                    ? 'text-warning'
                    : 'text-on-surface',
              ].join(' ')}
            >
              {row.onHand}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-on-surface-variant mt-0.5">
              on hand
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <UrgencyPip urgency={row.urgency} />
        </div>

        {/* PAR detail */}
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-on-surface-variant">Base PAR</dt>
            <dd className="tabular-nums font-medium text-on-surface">{row.basePar}</dd>
          </div>
          {row.parsDiffer ? (
            <div>
              <dt className="text-on-surface-variant">Today's PAR</dt>
              <dd className="tabular-nums font-medium text-on-surface">{row.adjustedPar}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-on-surface-variant">Shortfall</dt>
            <dd
              className={[
                'tabular-nums font-semibold',
                row.urgency === 'critical'
                  ? 'text-error'
                  : row.urgency === 'below'
                    ? 'text-warning'
                    : 'text-on-surface',
              ].join(' ')}
            >
              {row.shortfall}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Suggested reorder</dt>
            <dd className="tabular-nums font-medium text-on-surface">{row.suggestedReorder}</dd>
          </div>
        </dl>

        {/* Action links — PO is Epic-5 seam; rendered disabled */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            title="Available in a later phase"
            className={[
              'inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-medium',
              'bg-surface-container text-on-surface-variant opacity-40 cursor-not-allowed',
            ].join(' ')}
            aria-label={`Create PO for ${row.name} — available in a later phase`}
          >
            <ShoppingCart className="h-3 w-3" aria-hidden />
            Create PO
          </button>
          <button
            type="button"
            disabled
            title="Available in a later phase"
            className={[
              'inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-medium',
              'bg-surface-container text-on-surface-variant opacity-40 cursor-not-allowed',
            ].join(' ')}
            aria-label={`Create requisition for ${row.name} — available in a later phase`}
          >
            Requisition
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop table row
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopRowProps {
  readonly row: LiveRow
}

function DesktopRow({ row }: DesktopRowProps) {
  return (
    <TableRow
      className={[
        'hover:bg-surface-container transition-colors',
        row.urgency === 'critical'
          ? 'border-l-4 border-error'
          : row.urgency === 'below'
            ? 'border-l-4 border-warning'
            : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Item */}
      <TableCell>
        <Link
          to={`/inventory/stock/detail?item=${row.productId}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm min-h-[44px]"
          aria-label={`View stock detail for ${row.name}`}
        >
          <span className="font-medium text-on-surface">{row.name}</span>
        </Link>
      </TableCell>

      {/* On hand */}
      <TableCell className="text-right">
        <span
          className={[
            'text-base font-semibold tabular-nums',
            row.urgency === 'critical'
              ? 'text-error'
              : row.urgency === 'below'
                ? 'text-warning'
                : 'text-on-surface',
          ].join(' ')}
        >
          {row.onHand}
        </span>
      </TableCell>

      {/* Base PAR / Adjusted PAR */}
      <TableCell>
        <span className="tabular-nums text-sm text-on-surface-variant">{row.basePar}</span>
        {row.parsDiffer ? (
          <p className="text-[11px] text-on-surface-variant tabular-nums">
            Today: {row.adjustedPar}
          </p>
        ) : null}
      </TableCell>

      {/* Shortfall */}
      <TableCell className="text-right">
        <span
          className={[
            'tabular-nums font-semibold text-sm',
            row.urgency === 'critical'
              ? 'text-error'
              : row.urgency === 'below'
                ? 'text-warning'
                : 'text-on-surface',
          ].join(' ')}
        >
          {row.shortfall}
        </span>
      </TableCell>

      {/* Suggested reorder */}
      <TableCell className="text-right tabular-nums text-sm text-on-surface">
        {row.suggestedReorder}
      </TableCell>

      {/* Urgency */}
      <TableCell>
        <UrgencyPip urgency={row.urgency} />
      </TableCell>

      {/* Actions — PO is Epic-5 seam; rendered disabled */}
      <TableCell>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled
            title="Available in a later phase"
            className={[
              'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium',
              'bg-surface-container text-on-surface-variant opacity-40 cursor-not-allowed',
            ].join(' ')}
            aria-label={`Create PO for ${row.name} — available in a later phase`}
          >
            <ShoppingCart className="h-3 w-3" aria-hidden />
            PO
          </button>
          <button
            type="button"
            disabled
            title="Available in a later phase"
            className={[
              'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium',
              'bg-surface-container text-on-surface-variant opacity-40 cursor-not-allowed',
            ].join(' ')}
            aria-label={`Create requisition for ${row.name} — available in a later phase`}
          >
            Req.
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function BelowParPage() {
  const { data: belowParRaw, isLoading, error } = useBelowPar({})
  const { nameOf } = useInventoryProductNames()

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)

  // Loading state
  if (isLoading) {
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

  // Error state
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

  // Build live rows from API data
  const rows: ReadonlyArray<LiveRow> = (belowParRaw ?? []).map((r) => ({
    key: r.parLevelId,
    productId: r.productId,
    name: nameOf(r.productId),
    onHand: r.onHand,
    basePar: r.basePar,
    adjustedPar: r.adjustedPar,
    parsDiffer: r.basePar !== r.adjustedPar,
    shortfall: r.shortfall,
    suggestedReorder: r.suggestedReorder,
    urgency: deriveUrgency(r.onHand, r.adjustedPar),
  }))

  // Dashboard tile counters (recomputed from live rows)
  const counters = {
    total: rows.length,
    critical: rows.filter((r) => r.urgency === 'critical').length,
    approaching: rows.filter((r) => r.urgency === 'approaching').length,
  }

  const toggleSet = <V extends string>(set: ReadonlySet<V>, v: V): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const updateFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const filtered = rows.filter((r) => {
    if (filters.productTypes.size > 0) return false // product type not in live API; skip
    if (filters.urgencies.size > 0 && !filters.urgencies.has(r.urgency)) return false
    // scope filter is informational — not filterable from this endpoint
    return true
  })

  const anyFilterActive =
    filters.scopes.size > 0 ||
    filters.productTypes.size > 0 ||
    filters.urgencies.size > 0

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · PAR monitoring
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Below-PAR Flag List
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Items currently below their PAR level. Shortfall and suggested reorder quantities
              shown for procurement or internal requisition (FR33 / FR34). Day-of-week-adjusted
              PAR shown when it differs from the base PAR.
            </p>
          </div>
        </header>

        {/* Aggregate counters */}
        <section
          aria-label="Below-PAR counters"
          className="mt-6 grid grid-cols-1 tablet:grid-cols-3 gap-3"
        >
          <DashboardTile
            label="Items below PAR"
            value={counters.total.toLocaleString('en-IN')}
            secondary="Require replenishment"
            severity={counters.total > 0 ? 'warning' : 'neutral'}
          />
          <DashboardTile
            label="Critical (< 50 % of PAR)"
            value={counters.critical.toLocaleString('en-IN')}
            secondary="Urgent action needed"
            severity={counters.critical > 0 ? 'error' : 'neutral'}
          />
          <DashboardTile
            label="Approaching PAR"
            value={counters.approaching.toLocaleString('en-IN')}
            secondary="Monitor closely"
            severity={counters.approaching > 0 ? 'warning' : 'neutral'}
          />
        </section>

        {/* Filter strip */}
        <section
          aria-label="Below-PAR filters"
          className="mt-6 rounded-md bg-surface-container-low p-3 tablet:p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="-mx-3 px-3 flex w-full items-center gap-2 overflow-x-auto tablet:mx-0 tablet:px-0 tablet:overflow-visible tablet:flex-wrap">
              <FilterChipPicker<Scope>
                title="Scope"
                options={(['department', 'location', 'cluster', 'brand'] as const).map((v) => ({
                  value: v,
                  label: SCOPE_LABEL[v],
                }))}
                selected={filters.scopes}
                onToggle={(v) => updateFilter('scopes', toggleSet(filters.scopes, v))}
                onClear={() => updateFilter('scopes', new Set())}
              />
              <FilterChipPicker<ProductType>
                title="Product type"
                options={(['raw', 'semi', 'final'] as const).map((v) => ({
                  value: v,
                  label: PRODUCT_TYPE_LABEL[v],
                }))}
                selected={filters.productTypes}
                onToggle={(v) =>
                  updateFilter('productTypes', toggleSet(filters.productTypes, v))
                }
                onClear={() => updateFilter('productTypes', new Set())}
              />
              <FilterChipPicker<Urgency>
                title="Urgency"
                options={(['approaching', 'below', 'critical'] as const).map((v) => ({
                  value: v,
                  label: URGENCY_LABEL[v],
                }))}
                selected={filters.urgencies}
                onToggle={(v) =>
                  updateFilter('urgencies', toggleSet(filters.urgencies, v))
                }
                onClear={() => updateFilter('urgencies', new Set())}
              />
            </div>

            {anyFilterActive ? (
              <div className="flex w-full items-center justify-end tablet:w-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 px-3 gap-1 tablet:h-9"
                  onClick={() => setFilters(INITIAL_FILTERS)}
                  aria-label="Reset all filters"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  <span className="text-xs">Reset</span>
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        {/* Results */}
        <section aria-label="Below-PAR items" className="mt-6">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">Items</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {filtered.length} of {rows.length}
            </span>
          </header>

          {rows.length === 0 ? (
            /* Empty state — no items below PAR at all */
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <CheckCircle2
                className="mx-auto h-10 w-10 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-on-surface">
                All items are at or above PAR.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                No replenishment action required right now. Check back after the next
                production run.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            /* Filter empty state */
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <PackageSearch
                className="mx-auto h-10 w-10 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-on-surface">
                No items match the current filter.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Adjust the chips above or clear them to see all below-PAR items.
              </p>
              {anyFilterActive ? (
                <Button
                  variant="tonal"
                  size="sm"
                  className="mt-4"
                  onClick={() => setFilters(INITIAL_FILTERS)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {/* Mobile card stack */}
              <div
                className="flex flex-col gap-3 tablet:hidden"
                role="list"
                aria-label="Below-PAR items list"
              >
                {filtered.map((row) => (
                  <MobileCard key={row.key} row={row} />
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden tablet:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead>Base PAR / Today</TableHead>
                      <TableHead className="text-right">Shortfall</TableHead>
                      <TableHead className="text-right">Suggested reorder</TableHead>
                      <TableHead>Urgency</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <DesktopRow key={row.key} row={row} />
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
            Read-only view · no draft state · urgency: approaching = 80–100 % of PAR,
            below = 50–80 %, critical = ≤ 50 %.
          </span>
          <span className="ml-auto">SI-INV-003 · Tier 1 Group 1 · Phase 4 Epic 4 Arc (c)</span>
        </footer>
      </div>
    </div>
  )
}
