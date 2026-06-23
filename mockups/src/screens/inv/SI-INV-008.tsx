import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
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
  ProvisionalFlag,
  SectionShift,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shell'

import {
  stockBatches,
  transferSuggestions,
  formatINR,
  type StockBatch,
  type TransferSuggestion,
} from '@/lib/inv-sample-data'

import {
  NOW,
  materials,
  locations,
  departments,
  type Material,
  type Location,
  type Department,
} from '@/lib/sample-data'

/**
 * SI-INV-008 — Expiry Countdown Dashboard.
 *
 * Tier 1 Group 3, Phase 4 Epic 4 Arc (b) W1. Read-only dashboard surfacing
 * every batch approaching expiry across scope, grouped into 24 h / 48 h / 72 h
 * urgency bands. Each band section contains DashboardTile aggregate counters
 * (batches / items / value-at-risk) plus a per-batch row list.
 *
 * Per-batch suggestion-type badge:
 *   - "Single-hop within-cluster" → links to SI-INV-005 (Stock Transfer Create)
 *   - "Paired Brand-Store-routed" → links to SI-INV-007 (Paired Cross-Cluster
 *     Transfer); uses a compact PairedTransferBundle visual signature (the
 *     `Layers` icon + "Brand Store hub" text echoing the component's BrandHub)
 *   - "No suggestion — write off" → static write-off badge
 *
 * FR33 / FR34 (PAR-level expiry monitoring), FR77 (expiry-risk visualisation).
 *
 * Cross-cutting:
 *   - CC-DASHBOARD-TILE — band aggregate counters surface as DashboardTile
 *   - CC-PROVISIONAL-FLAG — provisional batches rendered with ProvisionalFlag
 *
 * Read-only surface — no CC-DRAFT-PILL.
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory tables / dashboards / forms.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type ExpiryBand = '24h' | '48h' | '72h'

const BAND_HOURS: Record<ExpiryBand, number> = { '24h': 24, '48h': 48, '72h': 72 }

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

/** Tailwind classes for the section heading bar by band. */
const BAND_HEADING_CLASS: Record<ExpiryBand, string> = {
  '24h': 'text-error',
  '48h': 'text-warning',
  '72h': 'text-tertiary',
}

/** Left-border pip colour per band (§6.1 status-pip pattern). */
const BAND_PIP_CLASS: Record<ExpiryBand, string> = {
  '24h': 'border-error',
  '48h': 'border-warning',
  '72h': 'border-tertiary',
}

/** Background container tint per band. */
const BAND_BG_CLASS: Record<ExpiryBand, string> = {
  '24h': 'bg-error-container',
  '48h': 'bg-surface-container-low',
  '72h': 'bg-surface-container-lowest',
}

type SuggestionType = 'single_hop' | 'paired' | 'none'

const SUGGESTION_TYPE_LABEL: Record<SuggestionType, string> = {
  single_hop: 'Single-hop',
  paired: 'Paired bundle',
  none: 'Write off',
}

type Scope = 'department' | 'location' | 'cluster' | 'brand'
const SCOPE_LABEL: Record<Scope, string> = {
  department: 'Department',
  location: 'Location',
  cluster: 'Cluster',
  brand: 'Brand-wide',
}

type ProductType = 'raw' | 'semi' | 'final'
const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  raw: 'Raw',
  semi: 'Semi-product',
  final: 'Final product',
}

function productTypeOf(mat: Material): ProductType {
  const semiCats = ['Bakery', 'Cheese']
  const finalCats = ['Spirits', 'Wine', 'Beverages']
  if (semiCats.includes(mat.category)) return 'semi'
  if (finalCats.includes(mat.category)) return 'final'
  return 'raw'
}

// ─────────────────────────────────────────────────────────────────────────────
// Row enrichment — only batches in a 24h/48h/72h expiry band
// ─────────────────────────────────────────────────────────────────────────────

const NOW_DATE = new Date(`${NOW}T09:00:00+05:30`)

/** Derive hours-to-expiry from the batch's expiryDate vs NOW. */
function hoursToExpiry(expiryDate: string): number {
  const exp = new Date(`${expiryDate}T23:59:00+05:30`)
  return Math.max(0, Math.round((exp.getTime() - NOW_DATE.getTime()) / 3_600_000))
}

function hoursLabel(h: number): string {
  if (h <= 0) return 'Expired'
  if (h < 60) return `${h} h`
  return `${Math.round(h / 24)} d ${h % 24} h`
}

/** Look up helpers. */
const matById = (id: string): Material | undefined =>
  materials.find((m) => m.id === id)
const locById = (id: string): Location | undefined =>
  locations.find((l) => l.id === id)
const deptById = (id: string): Department | undefined =>
  departments.find((d) => d.id === id)

interface ExpiryRow {
  readonly batch: StockBatch
  readonly material: Material
  readonly locationName: string
  readonly deptName: string
  readonly hoursLeft: number
  readonly valueAtRisk: number
  readonly suggestion: TransferSuggestion | null
  readonly suggestionType: SuggestionType
  readonly band: ExpiryBand
  readonly productType: ProductType
}

const allExpiryRows: ReadonlyArray<ExpiryRow> = (() => {
  const rows: ExpiryRow[] = []
  for (const batch of stockBatches) {
    if (batch.expiryBand === 'fresh') continue // only approaching-expiry batches
    const band = batch.expiryBand as ExpiryBand
    const mat = matById(batch.materialId)
    if (!mat) continue

    // Derive location from department
    const dept = deptById(batch.departmentId)
    const loc = dept ? locById(dept.location_id) : undefined

    const hoursLeft = batch.expiryDate ? hoursToExpiry(batch.expiryDate) : BAND_HOURS[band]
    const valueAtRisk = batch.quantityRemaining * batch.costPerUnit

    const suggestion = transferSuggestions.find(
      (s) => s.batchId === batch.id && !s.dismissed,
    ) ?? null

    const suggestionType: SuggestionType = suggestion
      ? suggestion.suggestionType
      : 'none'

    rows.push({
      batch,
      material: mat,
      locationName: loc?.name ?? 'Unknown location',
      deptName: dept?.name ?? 'Unknown dept',
      hoursLeft,
      valueAtRisk,
      suggestion,
      suggestionType,
      band,
      productType: productTypeOf(mat),
    })
  }
  // Sort within each band: soonest expiry first (ascending hours)
  return rows.sort((a, b) => a.hoursLeft - b.hoursLeft)
})()

// ─────────────────────────────────────────────────────────────────────────────
// Filter machinery
// ─────────────────────────────────────────────────────────────────────────────

interface FilterState {
  readonly scopes: ReadonlySet<Scope>
  readonly productTypes: ReadonlySet<ProductType>
  readonly suggestionTypes: ReadonlySet<SuggestionType>
}

const INITIAL_FILTERS: FilterState = {
  scopes: new Set(),
  productTypes: new Set(),
  suggestionTypes: new Set(),
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
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

/**
 * SuggestionBadge — per-batch suggestion type badge.
 *
 * Paired badge: uses a compact element echoing PairedTransferBundle's BrandHub
 * visual (Building2 icon + "Brand Store hub" text with bg-primary/text-on-primary)
 * and the P2B-002 Layers icon + cluster path — rather than rendering the full
 * PairedTransferBundle component (which is a detail-form surface too heavy for
 * a table badge). This compact echo carries the same visual signature: the
 * primary-coloured hub block, Layers icon, and cross-cluster route text.
 */
interface SuggestionBadgeProps {
  readonly type: SuggestionType
  readonly suggestion: TransferSuggestion | null
}

function SuggestionBadge({ type, suggestion }: SuggestionBadgeProps) {
  if (type === 'single_hop') {
    return (
      <Link
        to="/SI-INV-005"
        className={[
          'inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-medium',
          'bg-surface-container-high text-on-surface',
          'hover:bg-surface-container transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        ].join(' ')}
        aria-label="Single-hop within-cluster transfer — create transfer"
      >
        <ArrowRight className="h-3 w-3 text-primary shrink-0" aria-hidden />
        <span>Single-hop</span>
        {suggestion ? (
          <span className="ml-0.5 text-on-surface-variant tabular-nums">
            {suggestion.destinationLabel.split(' ').slice(0, 2).join(' ')}
          </span>
        ) : null}
        <ChevronRight className="h-3 w-3 text-on-surface-variant shrink-0" aria-hidden />
      </Link>
    )
  }

  if (type === 'paired') {
    return (
      <Link
        to="/SI-INV-007"
        className={[
          'inline-flex items-center gap-1.5 rounded-sm overflow-hidden text-[11px] font-medium',
          'hover:opacity-90 transition-opacity',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        ].join(' ')}
        aria-label="Paired Brand-Store-routed cross-cluster transfer — create bundle"
      >
        {/* Compact echo of PairedTransferBundle's BrandHub element (P2B-002) */}
        <span
          role="img"
          aria-label="Brand Store hub"
          className="inline-flex items-center gap-1 rounded-sm bg-primary px-1.5 py-1 text-on-primary"
        >
          <Building2 className="h-3 w-3 shrink-0" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">
            Hub
          </span>
        </span>
        <span className="inline-flex items-center gap-1 px-1.5 py-1 rounded-sm bg-surface-container-high text-on-surface">
          <Layers className="h-3 w-3 text-primary shrink-0" aria-hidden />
          <span>Paired bundle</span>
          <ChevronRight className="h-3 w-3 text-on-surface-variant shrink-0" aria-hidden />
        </span>
      </Link>
    )
  }

  // 'none' — write off
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-highest px-2 py-1 text-[11px] font-medium text-on-surface-variant"
      aria-label="No transfer suggestion — write off recommended"
    >
      <CircleOff className="h-3 w-3 shrink-0" aria-hidden />
      Write off
    </span>
  )
}

/** ExpiryCountdownPip — coloured countdown badge per row. */
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
// Band section — DashboardTile counters + row list
// ─────────────────────────────────────────────────────────────────────────────

interface BandSectionProps {
  readonly band: ExpiryBand
  readonly rows: ReadonlyArray<ExpiryRow>
}

function BandSection({ band, rows }: BandSectionProps) {
  const totalBatches = rows.length
  const totalItems = new Set(rows.map((r) => r.material.id)).size
  const totalValue = rows.reduce((s, r) => s + r.valueAtRisk, 0)

  const severity = BAND_SEVERITY[band]

  if (rows.length === 0) {
    return (
      <section aria-label={`${BAND_LABEL[band]} — no batches`} className="mt-8">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-stretch overflow-hidden rounded-sm bg-surface-container-lowest`}
          >
            <span aria-hidden className={`w-1.5 shrink-0 border-l-4 ${BAND_PIP_CLASS[band]}`} />
            <h2
              className={`px-3 py-1 text-base font-bold ${BAND_HEADING_CLASS[band]}`}
            >
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
          <h2
            className={`px-3 py-1 text-base font-bold ${BAND_HEADING_CLASS[band]}`}
          >
            {BAND_LABEL[band]}
          </h2>
        </span>
      </header>

      {/* Aggregate counters — CC-DASHBOARD-TILE */}
      <div className="grid grid-cols-1 tablet:grid-cols-3 gap-3 mb-5">
        <DashboardTile
          label="Batches approaching expiry"
          value={totalBatches.toLocaleString('en-IN')}
          secondary={`Within ${band}`}
          severity={severity}
        />
        <DashboardTile
          label="Distinct items"
          value={totalItems.toLocaleString('en-IN')}
          secondary="Unique materials"
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
          <MobileBatchCard key={row.batch.id} row={row} band={band} />
        ))}
      </div>

      {/* Desktop table */}
      <div className={`hidden tablet:block rounded-md overflow-hidden ${BAND_BG_CLASS[band]}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Batch ref</TableHead>
              <TableHead>Location / dept</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead>Time left</TableHead>
              <TableHead className="text-right">Value at risk</TableHead>
              <TableHead>Suggestion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <DesktopBatchRow key={row.batch.id} row={row} band={band} />
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
  readonly row: ExpiryRow
  readonly band: ExpiryBand
}

function MobileBatchCard({ row, band }: MobileBatchCardProps) {
  const { batch, material, locationName, deptName, hoursLeft, valueAtRisk, suggestionType, suggestion } = row
  return (
    <article
      className={[
        'flex flex-col gap-2 rounded-md p-4',
        'border-l-4',
        BAND_PIP_CLASS[band],
        'bg-surface-container-lowest',
      ].join(' ')}
      aria-label={`${material.name} — ${batch.batchNumber} — ${hoursLabel(hoursLeft)} to expiry`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold text-on-surface truncate">
              {material.name}
            </h3>
            {batch.provisional ? <ProvisionalFlag size="sm" /> : null}
          </div>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {material.category} · {batch.uom}
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-1">
          <ExpiryCountdownPip hoursLeft={hoursLeft} band={band} />
          <span className="text-[11px] text-on-surface-variant">
            exp {batch.expiryDate ?? '—'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
        <span className="font-mono text-[11px]">{batch.batchNumber}</span>
        <span aria-hidden>·</span>
        <span>{locationName.replace('Wild Sugar ', '')}</span>
        <span aria-hidden>·</span>
        <span>{deptName}</span>
      </div>

      <div className="flex items-center justify-between gap-3 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-on-surface">
            {batch.quantityRemaining} {batch.uom}
          </span>
          <span className="text-xs text-on-surface-variant">on hand</span>
          <span className="text-sm font-medium text-on-surface">
            {formatINR(Math.round(valueAtRisk))}
          </span>
          <span className="text-xs text-on-surface-variant">at risk</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <SuggestionBadge type={suggestionType} suggestion={suggestion} />
        <Link
          to="/SI-INV-009"
          className={[
            'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px]',
            'bg-surface-container text-on-surface-variant',
            'hover:bg-surface-container-high transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          ].join(' ')}
          aria-label="View all transfer suggestions for this batch"
        >
          <span>All suggestions</span>
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      <div className="pt-0.5">
        <Link
          to={`/SI-INV-002?item=${material.id}`}
          className={[
            'inline-flex items-center gap-1 text-[11px] text-primary',
            'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm',
          ].join(' ')}
          aria-label={`Open stock detail for ${material.name}`}
        >
          Stock detail
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop row
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopBatchRowProps {
  readonly row: ExpiryRow
  readonly band: ExpiryBand
}

function DesktopBatchRow({ row, band }: DesktopBatchRowProps) {
  const { batch, material, locationName, deptName, hoursLeft, valueAtRisk, suggestionType, suggestion } = row
  return (
    <TableRow className="hover:bg-surface-container transition-colors">
      {/* Item */}
      <TableCell>
        <Link
          to={`/SI-INV-002?item=${material.id}`}
          className="block min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          aria-label={`Stock detail for ${material.name}`}
        >
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="font-medium text-on-surface">{material.name}</span>
            {batch.provisional ? <ProvisionalFlag size="sm" /> : null}
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">{material.category}</p>
        </Link>
      </TableCell>
      {/* Batch ref */}
      <TableCell>
        <span className="font-mono text-xs text-on-surface">{batch.batchNumber}</span>
        {batch.sourceRef ? (
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            via {batch.sourceRef}
          </p>
        ) : null}
      </TableCell>
      {/* Location / dept */}
      <TableCell className="text-xs text-on-surface-variant">
        <span>{locationName.replace('Wild Sugar ', '')}</span>
        <p className="mt-0.5 text-[11px]">{deptName}</p>
      </TableCell>
      {/* On hand */}
      <TableCell className="text-right">
        <span className="text-base font-semibold tabular-nums text-on-surface">
          {batch.quantityRemaining}
        </span>
        <span className="ml-1 text-xs text-on-surface-variant">{batch.uom}</span>
      </TableCell>
      {/* Time left */}
      <TableCell>
        <ExpiryCountdownPip hoursLeft={hoursLeft} band={band} />
        <p className="mt-0.5 text-[11px] text-on-surface-variant">
          exp {batch.expiryDate ?? '—'}
        </p>
      </TableCell>
      {/* Value at risk */}
      <TableCell className="text-right">
        <span className="font-medium tabular-nums text-on-surface">
          {formatINR(Math.round(valueAtRisk))}
        </span>
      </TableCell>
      {/* Suggestion */}
      <TableCell>
        <div className="flex flex-col gap-1.5 items-start">
          <SuggestionBadge type={suggestionType} suggestion={suggestion} />
          <Link
            to="/SI-INV-009"
            className={[
              'inline-flex items-center gap-1 text-[11px] text-on-surface-variant',
              'hover:text-primary transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm',
            ].join(' ')}
            aria-label="View all suggestions for this batch in transfer suggestions screen"
          >
            More suggestions
            <ChevronRight className="h-2.5 w-2.5" aria-hidden />
          </Link>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv008() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)

  const toggleSet = <V extends string>(set: ReadonlySet<V>, v: V): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const updateFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const filteredRows = useMemo(() => {
    return allExpiryRows.filter((r) => {
      if (
        filters.productTypes.size > 0 &&
        !filters.productTypes.has(r.productType)
      )
        return false
      if (
        filters.suggestionTypes.size > 0 &&
        !filters.suggestionTypes.has(r.suggestionType)
      )
        return false
      // scope filter is informational — fixture is already CK Bandra-scoped
      return true
    })
  }, [filters])

  const band24 = useMemo(() => filteredRows.filter((r) => r.band === '24h'), [filteredRows])
  const band48 = useMemo(() => filteredRows.filter((r) => r.band === '48h'), [filteredRows])
  const band72 = useMemo(() => filteredRows.filter((r) => r.band === '72h'), [filteredRows])

  // Grand totals for page header counters
  const totalBatches = allExpiryRows.length
  const totalValue = allExpiryRows.reduce((s, r) => s + r.valueAtRisk, 0)
  const critical24Count = allExpiryRows.filter((r) => r.band === '24h').length

  const anyFilterActive =
    filters.scopes.size > 0 ||
    filters.productTypes.size > 0 ||
    filters.suggestionTypes.size > 0

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
              Wild Sugar Central Kitchen — Bandra · {totalBatches} batches approaching
              expiry · {formatINR(Math.round(totalValue))} at risk. Grouped into 24 h,
              48 h, and 72 h urgency bands with per-batch transfer suggestions.
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

        {/* Filter strip */}
        <section
          aria-label="Expiry filters"
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
              <FilterChipPicker<SuggestionType>
                title="Suggestion type"
                options={(['single_hop', 'paired', 'none'] as const).map((v) => ({
                  value: v,
                  label: SUGGESTION_TYPE_LABEL[v],
                }))}
                selected={filters.suggestionTypes}
                onToggle={(v) =>
                  updateFilter('suggestionTypes', toggleSet(filters.suggestionTypes, v))
                }
                onClear={() => updateFilter('suggestionTypes', new Set())}
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

        {/* Empty state when filters remove all results */}
        {filteredRows.length === 0 ? (
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
            <BandSection band="24h" rows={band24} />
            <SectionShift tone="low" className="mt-8" aria-hidden />
            <BandSection band="48h" rows={band48} />
            <SectionShift tone="low" className="mt-8" aria-hidden />
            <BandSection band="72h" rows={band72} />
          </>
        )}

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <CircleOff className="h-3 w-3" aria-hidden />
          <span>
            Read-only view · expiry times derived from fixture expiryDate vs
            NOW anchor (2026-05-06T09:00 IST) · drill into a batch for full movement history.
          </span>
          <span className="ml-auto">SI-INV-008 · Tier 1 Group 3 · Phase 4 Epic 4 Arc (b)</span>
        </footer>
      </div>
    </div>
  )
}
