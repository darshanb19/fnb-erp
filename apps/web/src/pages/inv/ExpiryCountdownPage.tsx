import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronRight,
  CircleOff,
  Layers,
  PackageSearch,
  Plus,
  Timer,
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

import { useExpiringBatches } from '@/hooks/inv/useStock'
import { useInventoryProductNames } from '@/hooks/inv/useProductNames'
import { ApiError } from '@/lib/api-client'
import { formatINR } from '@/lib/sample-data'

/**
 * SI-INV-008 — Expiry Countdown Dashboard (production port of Arc-b mockup).
 *
 * Tier 1 Group 3, Epic 4 Arc (c). Read-only dashboard surfacing every batch
 * approaching expiry brand-wide, grouped into 24 h / 48 h / 72 h urgency bands.
 * Each band section has DashboardTile aggregate counters (batches / items /
 * value-at-risk) plus a per-batch row list with a "Review for transfer" neutral
 * affordance (suggestion-type — single-hop / paired / write-off — is NOT
 * derivable from the /stock/expiring endpoint in Wave 1; divergence noted).
 *
 * Divergences from Arc-(b) mockup (intentional):
 *   1. Suggestion-type badge (single_hop / paired / write-off) replaced with a
 *      neutral "Review for transfer" affordance → link to /inventory/suggestions.
 *   2. "Scope" filter chip REMOVED — the live endpoint has no scope param in
 *      Wave 1 (call is brand-wide); an inert chip would be a defect.
 *   3. "Suggestion type" filter chip REMOVED — suggestion type is not in
 *      ExpiringItem; filtering on it would silently hide all rows.
 *      Only the "Product type" chip is retained (derivable from productId — but
 *      since the endpoint doesn't return product type and we only have a name,
 *      that chip too is removed). Result: filter strip is hidden; if a future
 *      endpoint version exposes filterable fields, add chips then.
 *   4. Band tile "Distinct items" count derived from unique productIds in items
 *      (not a separate endpoint field).
 *   5. Links to not-yet-built Wave-2 screens (SI-INV-005, SI-INV-007) are
 *      rendered as disabled buttons with title="Available in Wave 2".
 *
 * FRs: FR33/FR34 (PAR-level expiry monitoring), FR77 (expiry-risk visualisation).
 * Data source: useExpiringBatches({}) + useInventoryProductNames.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type ExpiryBand = '24h' | '48h' | '72h'

const BAND_LABEL: Record<ExpiryBand, string> = {
  '24h': 'Expires within 24 h',
  '48h': 'Expires within 48 h',
  '72h': 'Expires within 72 h',
}

const BAND_SEVERITY: Record<ExpiryBand, 'error' | 'warning' | 'neutral'> = {
  '24h': 'error',
  '48h': 'warning',
  '72h': 'neutral',
}

const BAND_HEADING_CLASS: Record<ExpiryBand, string> = {
  '24h': 'text-error',
  '48h': 'text-warning',
  '72h': 'text-tertiary',
}

const BAND_PIP_CLASS: Record<ExpiryBand, string> = {
  '24h': 'border-error',
  '48h': 'border-warning',
  '72h': 'border-tertiary',
}

const BAND_BG_CLASS: Record<ExpiryBand, string> = {
  '24h': 'bg-error-container',
  '48h': 'bg-surface-container-low',
  '72h': 'bg-surface-container-lowest',
}

// ─────────────────────────────────────────────────────────────────────────────
// Row shape (live data)
// ─────────────────────────────────────────────────────────────────────────────

interface LiveRow {
  readonly batchId: string
  readonly productId: string
  readonly name: string
  readonly batchNumber: string
  readonly quantityRemaining: number
  readonly hoursUntilExpiry: number
  readonly valueAtRisk: number
  readonly expiryDate: string
  readonly band: ExpiryBand
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function hoursLabel(h: number): string {
  if (h <= 0) return 'Expired'
  if (h < 60) return `${h} h`
  return `${Math.round(h / 24)} d ${h % 24} h`
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (carried from SI-INV-008 mockup — shell import already swapped)
// ─────────────────────────────────────────────────────────────────────────────

/** FilterChipPicker — generic Popover-based multi-select chip (identical to BelowParPage). */
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

/**
 * NeutralReviewBadge — Wave 1 replacement for the mockup's per-batch
 * SuggestionBadge. The single-hop / paired / write-off classification is NOT
 * derivable from ExpiringItem in Wave 1, so every row shows a neutral
 * "Review for transfer" link to /inventory/suggestions (SI-INV-009, Task 7).
 */
function NeutralReviewBadge() {
  return (
    <Link
      to="/inventory/suggestions"
      className={[
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-medium',
        'bg-surface-container-high text-on-surface',
        'hover:bg-surface-container transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      ].join(' ')}
      aria-label="Review for transfer — open transfer suggestions"
    >
      <ArrowRight className="h-3 w-3 text-primary shrink-0" aria-hidden />
      <span>Review for transfer</span>
      <ChevronRight className="h-3 w-3 text-on-surface-variant shrink-0" aria-hidden />
    </Link>
  )
}

/** Wave-2 disabled link affordance. */
function Wave2DisabledButton({ label, ariaLabel }: { label: string; ariaLabel: string }) {
  return (
    <button
      type="button"
      disabled
      title="Available in Wave 2"
      className={[
        'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] font-medium',
        'bg-surface-container text-on-surface-variant opacity-40 cursor-not-allowed',
      ].join(' ')}
      aria-label={ariaLabel}
    >
      <Layers className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </button>
  )
}

/** ExpiryCountdownPip — coloured countdown badge per row (verbatim from mockup). */
interface ExpiryCountdownPipProps {
  readonly hoursLeft: number
  readonly band: ExpiryBand
}

function ExpiryCountdownPip({ hoursLeft, band }: ExpiryCountdownPipProps) {
  const colourClass =
    band === '24h'
      ? 'text-error'
      : band === '48h'
        ? 'text-warning'
        : 'text-tertiary'
  const pipColour =
    band === '24h' ? 'bg-error' : band === '48h' ? 'bg-warning' : 'bg-tertiary'

  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-sm bg-surface-container-lowest">
      <span aria-hidden className={`w-1 shrink-0 ${pipColour}`} />
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium tabular-nums ${colourClass}`}
      >
        <Timer className="h-3 w-3 shrink-0" aria-hidden />
        {hoursLabel(hoursLeft)}
      </span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Band section
// ─────────────────────────────────────────────────────────────────────────────

interface BandSectionProps {
  readonly band: ExpiryBand
  readonly rows: ReadonlyArray<LiveRow>
  /** Server-computed band count (h24/h48/h72 from bands object) */
  readonly serverCount: number
}

function BandSection({ band, rows, serverCount }: BandSectionProps) {
  const distinctItems = useMemo(
    () => new Set(rows.map((r) => r.productId)).size,
    [rows],
  )
  const totalValue = useMemo(
    () => rows.reduce((s, r) => s + r.valueAtRisk, 0),
    [rows],
  )
  const severity = BAND_SEVERITY[band]

  if (rows.length === 0) {
    return (
      <section aria-label={`${BAND_LABEL[band]} — no batches`} className="mt-8">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-stretch overflow-hidden rounded-sm bg-surface-container-lowest">
            <span aria-hidden className={`w-1.5 shrink-0 border-l-4 ${BAND_PIP_CLASS[band]}`} />
            <h2 className={`px-3 py-1 text-base font-bold ${BAND_HEADING_CLASS[band]}`}>
              {BAND_LABEL[band]}
            </h2>
          </span>
        </header>
        <div className="rounded-md bg-surface-container-lowest p-6 text-center">
          <p className="text-sm text-on-surface-variant">
            No batches expiring in this window.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section aria-label={BAND_LABEL[band]} className="mt-8">
      {/* Band heading */}
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-stretch overflow-hidden rounded-sm bg-surface-container-lowest">
          <span aria-hidden className={`w-1.5 shrink-0 border-l-4 ${BAND_PIP_CLASS[band]}`} />
          <h2 className={`px-3 py-1 text-base font-bold ${BAND_HEADING_CLASS[band]}`}>
            {BAND_LABEL[band]}
          </h2>
        </span>
      </header>

      {/* Aggregate counters — CC-DASHBOARD-TILE */}
      <div className="grid grid-cols-1 tablet:grid-cols-3 gap-3 mb-5">
        <DashboardTile
          label="Batches approaching expiry"
          value={serverCount.toLocaleString('en-IN')}
          secondary={`Within ${band}`}
          severity={severity}
        />
        <DashboardTile
          label="Distinct items"
          value={distinctItems.toLocaleString('en-IN')}
          secondary="Unique products"
          severity={severity}
        />
        <DashboardTile
          label="Value at risk"
          value={formatINR(Math.round(totalValue))}
          secondary="Total batch cost"
          severity={severity}
        />
      </div>

      {/* Mobile card stack */}
      <div className="flex flex-col gap-3 tablet:hidden">
        {rows.map((row) => (
          <MobileBatchCard key={row.batchId} row={row} band={band} />
        ))}
      </div>

      {/* Desktop table */}
      <div className={`hidden tablet:block rounded-md overflow-hidden ${BAND_BG_CLASS[band]}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Batch ref</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead>Time left</TableHead>
              <TableHead className="text-right">Value at risk</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <DesktopBatchRow key={row.batchId} row={row} band={band} />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile card
// ─────────────────────────────────────────────────────────────────────────────

interface MobileBatchCardProps {
  readonly row: LiveRow
  readonly band: ExpiryBand
}

function MobileBatchCard({ row, band }: MobileBatchCardProps) {
  return (
    <article
      className={[
        'flex flex-col gap-2 rounded-md p-4',
        'border-l-4',
        BAND_PIP_CLASS[band],
        'bg-surface-container-lowest',
      ].join(' ')}
      aria-label={`${row.name} — ${row.batchNumber} — ${hoursLabel(row.hoursUntilExpiry)} to expiry`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold text-on-surface truncate">
              {row.name}
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            <span className="font-mono text-[11px]">{row.batchNumber}</span>
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-1">
          <ExpiryCountdownPip hoursLeft={row.hoursUntilExpiry} band={band} />
          <span className="text-[11px] text-on-surface-variant">
            exp {row.expiryDate}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-on-surface">
            {row.quantityRemaining}
          </span>
          <span className="text-xs text-on-surface-variant">on hand</span>
          <span className="text-sm font-medium text-on-surface">
            {formatINR(Math.round(row.valueAtRisk))}
          </span>
          <span className="text-xs text-on-surface-variant">at risk</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <NeutralReviewBadge />
        {/* SI-INV-005 and SI-INV-007 are Wave-2 screens — rendered disabled */}
        <Wave2DisabledButton
          label="Single-hop transfer"
          ariaLabel="Single-hop transfer — Available in Wave 2"
        />
        <Wave2DisabledButton
          label="Paired bundle"
          ariaLabel="Paired bundle transfer — Available in Wave 2"
        />
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop row
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopBatchRowProps {
  readonly row: LiveRow
  readonly band: ExpiryBand
}

function DesktopBatchRow({ row, band }: DesktopBatchRowProps) {
  return (
    <TableRow className="hover:bg-surface-container transition-colors">
      {/* Item */}
      <TableCell>
        <div className="flex items-center flex-wrap gap-1.5 min-h-[44px]">
          <span className="font-medium text-on-surface">{row.name}</span>
        </div>
      </TableCell>
      {/* Batch ref */}
      <TableCell>
        <span className="font-mono text-xs text-on-surface">{row.batchNumber}</span>
      </TableCell>
      {/* On hand */}
      <TableCell className="text-right">
        <span className="text-base font-semibold tabular-nums text-on-surface">
          {row.quantityRemaining}
        </span>
      </TableCell>
      {/* Time left */}
      <TableCell>
        <ExpiryCountdownPip hoursLeft={row.hoursUntilExpiry} band={band} />
        <p className="mt-0.5 text-[11px] text-on-surface-variant">
          exp {row.expiryDate}
        </p>
      </TableCell>
      {/* Value at risk */}
      <TableCell className="text-right">
        <span className="font-medium tabular-nums text-on-surface">
          {formatINR(Math.round(row.valueAtRisk))}
        </span>
      </TableCell>
      {/* Action */}
      <TableCell>
        <div className="flex flex-col gap-1.5 items-start">
          <NeutralReviewBadge />
          {/* SI-INV-005 / SI-INV-007 Wave-2 screens — disabled */}
          <Wave2DisabledButton
            label="Single-hop"
            ariaLabel="Single-hop transfer — Available in Wave 2"
          />
          <Wave2DisabledButton
            label="Paired"
            ariaLabel="Paired bundle transfer — Available in Wave 2"
          />
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

// Urgency band type for the filter
type UrgencyFilter = '24h' | '48h' | '72h'

const URGENCY_FILTER_LABEL: Record<UrgencyFilter, string> = {
  '24h': 'Within 24 h (Critical)',
  '48h': 'Within 48 h',
  '72h': 'Within 72 h',
}

interface FilterState {
  readonly urgencies: ReadonlySet<UrgencyFilter>
}

const INITIAL_FILTERS: FilterState = {
  urgencies: new Set(),
}

export default function ExpiryCountdownPage() {
  const { data: expiring, isLoading, error } = useExpiringBatches({})
  const { nameOf, isLoading: namesLoading } = useInventoryProductNames()

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)

  // Loading state — guard on both data + name resolution
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

  // Map API items to row shape, resolving names, splitting into bands
  const allItems: ReadonlyArray<LiveRow> = (expiring?.items ?? []).map((it) => {
    const band: ExpiryBand =
      it.hoursUntilExpiry <= 24
        ? '24h'
        : it.hoursUntilExpiry <= 48
          ? '48h'
          : '72h'
    return {
      batchId: it.batchId,
      productId: it.productId,
      name: nameOf(it.productId),
      batchNumber: it.batchNumber,
      quantityRemaining: it.quantityRemaining,
      hoursUntilExpiry: it.hoursUntilExpiry,
      valueAtRisk: it.valueAtRisk,
      expiryDate: it.expiryDate,
      band,
    }
  }).sort((a, b) => a.hoursUntilExpiry - b.hoursUntilExpiry)

  // Per-band counts from server (bands.h24 / h48 / h72)
  const serverBands = expiring?.bands ?? { h24: 0, h48: 0, h72: 0, over72: 0 }

  // Grand totals for page header
  const totalBatches = allItems.length
  const totalValue = allItems.reduce((s, r) => s + r.valueAtRisk, 0)
  const critical24Count = serverBands.h24

  const toggleSet = <V extends string>(set: ReadonlySet<V>, v: V): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const updateFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const filteredItems = allItems.filter((r) => {
    if (filters.urgencies.size > 0 && !filters.urgencies.has(r.band as UrgencyFilter)) {
      return false
    }
    return true
  })

  const band24 = filteredItems.filter((r) => r.band === '24h')
  const band48 = filteredItems.filter((r) => r.band === '48h')
  const band72 = filteredItems.filter((r) => r.band === '72h')

  const anyFilterActive = filters.urgencies.size > 0

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Expiry management
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Expiry Countdown Dashboard
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Brand-wide · {totalBatches} {totalBatches === 1 ? 'batch' : 'batches'} approaching
              expiry · {formatINR(Math.round(totalValue))} at risk. Grouped into 24 h, 48 h, and
              72 h urgency bands with per-batch transfer review links.
            </p>
          </div>
        </header>

        {/* Grand aggregate counters */}
        <section aria-label="Overall expiry risk counters" className="mt-6 grid grid-cols-1 tablet:grid-cols-3 gap-3">
          <DashboardTile
            label="Total batches expiring"
            value={totalBatches.toLocaleString('en-IN')}
            secondary="Across all urgency bands"
            severity={totalBatches > 0 ? 'error' : 'neutral'}
          />
          <DashboardTile
            label="Critical — within 24 h"
            value={critical24Count.toLocaleString('en-IN')}
            secondary="Immediate action required"
            severity={critical24Count > 0 ? 'error' : 'neutral'}
          />
          <DashboardTile
            label="Total value at risk"
            value={formatINR(Math.round(totalValue))}
            secondary="Combined batch cost"
            severity={totalValue > 0 ? 'warning' : 'neutral'}
          />
        </section>

        {/* Filter strip — urgency band filter only (the only field backed by ExpiringItem.band) */}
        <section
          aria-label="Expiry filters"
          className="mt-6 rounded-md bg-surface-container-low p-3 tablet:p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="-mx-3 px-3 flex w-full items-center gap-2 overflow-x-auto tablet:mx-0 tablet:px-0 tablet:overflow-visible tablet:flex-wrap">
              <FilterChipPicker<UrgencyFilter>
                title="Urgency band"
                options={(['24h', '48h', '72h'] as const).map((v) => ({
                  value: v,
                  label: URGENCY_FILTER_LABEL[v],
                }))}
                selected={filters.urgencies}
                onToggle={(v) =>
                  updateFilter('urgencies', toggleSet(filters.urgencies, v))
                }
                onClear={() => updateFilter('urgencies', new Set())}
              />
            </div>

            {anyFilterActive ? (
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
            ) : null}
          </div>
        </section>

        {/* Empty state — no items at all */}
        {allItems.length === 0 ? (
          <div className="mt-6 rounded-md bg-surface-container-lowest p-10 text-center">
            <PackageSearch
              className="mx-auto h-10 w-10 text-on-surface-variant"
              aria-hidden
            />
            <p className="mt-3 text-base font-semibold text-on-surface">
              No batches approaching expiry.
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              All stock is fresh or no perishable batches are tracked yet.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          /* Filter empty state */
          <div className="mt-6 rounded-md bg-surface-container-lowest p-10 text-center">
            <PackageSearch
              className="mx-auto h-10 w-10 text-on-surface-variant"
              aria-hidden
            />
            <p className="mt-3 text-base font-semibold text-on-surface">
              No batches match the current filter.
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Adjust the chips above or clear them to see all approaching-expiry batches.
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
            <BandSection band="24h" rows={band24} serverCount={serverBands.h24} />
            <SectionShift tone="low" className="mt-8" aria-hidden />
            <BandSection band="48h" rows={band48} serverCount={serverBands.h48} />
            <SectionShift tone="low" className="mt-8" aria-hidden />
            <BandSection band="72h" rows={band72} serverCount={serverBands.h72} />
          </>
        )}

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <CircleOff className="h-3 w-3" aria-hidden />
          <span>
            Read-only view · expiry times from live Arc-(a) stock/expiring endpoint ·
            suggestion-type (single-hop / paired / write-off) available in Wave 2 ·
            scope filter and suggestion-type filter removed (unbacked in Wave 1).
          </span>
          <span className="ml-auto">SI-INV-008 · Tier 1 Group 3 · Phase 4 Epic 4 Arc (c)</span>
        </footer>
      </div>
    </div>
  )
}
