import { useMemo, useState } from 'react'
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
} from '@/shell'

import { materials, departments } from '@/lib/sample-data'

import { belowParRows } from '@/lib/inv-sample-data'

/**
 * SI-INV-003 — Below-PAR Flag List.
 *
 * Tier 1 Group 1 (deferred), Epic 4 Arc (b). Read-only list of all items
 * currently below their PAR level, with suggested reorder quantities, to
 * drive procurement / internal requisition decisions.
 *
 * FRs: FR33 (PAR flag on stock views), FR34 (below-PAR suggested reorder),
 * FR25 (real-time stock freshness constraint — freshness is service-side).
 *
 * Cross-cutting patterns consumed:
 *   - CC-DASHBOARD-TILE — three aggregate counters (total below PAR, items
 *     below 50 % of PAR aka "critical", items already on open PO).
 *   - FilterChipPicker — four filter dimensions (scope, product type,
 *     category, urgency) copied from SI-INV-001's frozen pattern.
 *
 * Colour semantics (semantic tokens, not new status names):
 *   approaching (80–100 % of PAR)   → neutral / on-surface-variant
 *   below (50–80 % of PAR)          → text-warning / border-l-4 border-warning
 *   critical (≤ 50 % of PAR)        → text-error  / border-l-4 border-error
 *   onOpenPo indicator              → text-on-surface (checkmark + "On PO" label)
 *
 * Sub-affordances:
 *   Row chevron → /SI-INV-002 (department stock detail)
 *   "Create PO" CTA → /SI-PUR-001 (stub link)
 *   "Requisition" CTA → /SI-INV-005 (stub link)
 *
 * Read-only surface — no CC-DRAFT-PILL, no CC-AUDIT-LINK (no single entity
 * to audit; per-item detail is in SI-INV-002).
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory tables / dashboards / forms.
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
// Row enrichment
// ─────────────────────────────────────────────────────────────────────────────

interface EnrichedRow {
  readonly key: string
  readonly materialId: string
  readonly materialName: string
  readonly category: string
  readonly uom: string
  readonly departmentId: string
  readonly departmentName: string
  readonly onHand: number
  readonly basePar: number
  readonly adjustedPar: number
  readonly parsDiffer: boolean
  readonly shortfall: number
  readonly suggestedReorder: number
  readonly urgency: Urgency
  readonly onOpenPo: boolean
  readonly productType: ProductType
}

function productTypeOf(category: string): ProductType {
  const semiCats = ['Bakery', 'Cheese']
  const finalCats = ['Spirits', 'Wine', 'Beverages']
  if (semiCats.includes(category)) return 'semi'
  if (finalCats.includes(category)) return 'final'
  return 'raw'
}

const enrichedRows: ReadonlyArray<EnrichedRow> = belowParRows.map((row) => {
  const mat = materials.find((m) => m.id === row.materialId)
  const dept = departments.find((d) => d.id === row.departmentId)
  return {
    key: `${row.materialId}:${row.departmentId}`,
    materialId: row.materialId,
    materialName: mat?.name ?? row.materialId,
    category: mat?.category ?? '—',
    uom: mat?.uom ?? '—',
    departmentId: row.departmentId,
    departmentName: dept?.name ?? row.departmentId,
    onHand: row.onHand,
    basePar: row.basePar,
    adjustedPar: row.adjustedPar,
    parsDiffer: row.basePar !== row.adjustedPar,
    shortfall: row.shortfall,
    suggestedReorder: row.suggestedReorder,
    urgency: row.urgency,
    onOpenPo: row.onOpenPo,
    productType: productTypeOf(mat?.category ?? ''),
  }
})

const ALL_CATEGORIES: ReadonlyArray<string> = Array.from(
  new Set(enrichedRows.map((r) => r.category)),
).sort()

// ─────────────────────────────────────────────────────────────────────────────
// Filter machinery
// ─────────────────────────────────────────────────────────────────────────────

interface FilterState {
  readonly scopes: ReadonlySet<Scope>
  readonly productTypes: ReadonlySet<ProductType>
  readonly categories: ReadonlySet<string>
  readonly urgencies: ReadonlySet<Urgency>
}

const INITIAL_FILTERS: FilterState = {
  scopes: new Set(),
  productTypes: new Set(),
  categories: new Set(),
  urgencies: new Set(),
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

// On-open-PO badge
function OpenPoBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
      <CheckCircle2 className="h-3 w-3 text-success" aria-hidden />
      On open PO
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile card
// ─────────────────────────────────────────────────────────────────────────────

interface MobileCardProps {
  readonly row: EnrichedRow
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
              to={`/SI-INV-002?item=${row.materialId}`}
              className="group inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              aria-label={`View stock detail for ${row.materialName}`}
            >
              <span className="text-base font-semibold text-on-surface">{row.materialName}</span>
              <ChevronRight
                className="h-4 w-4 text-on-surface-variant opacity-60 group-hover:opacity-100 transition-opacity"
                aria-hidden
              />
            </Link>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              {row.category} · {row.departmentName}
            </p>
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
              {row.uom} on hand
            </span>
          </div>
        </div>

        {/* Status badges */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <UrgencyPip urgency={row.urgency} />
          {row.onOpenPo ? <OpenPoBadge /> : null}
        </div>

        {/* PAR detail */}
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-on-surface-variant">Base PAR</dt>
            <dd className="tabular-nums font-medium text-on-surface">
              {row.basePar} {row.uom}
            </dd>
          </div>
          {row.parsDiffer ? (
            <div>
              <dt className="text-on-surface-variant">Today's PAR</dt>
              <dd className="tabular-nums font-medium text-on-surface">
                {row.adjustedPar} {row.uom}
              </dd>
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
              {row.shortfall} {row.uom}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant">Suggested reorder</dt>
            <dd className="tabular-nums font-medium text-on-surface">
              {row.suggestedReorder} {row.uom}
            </dd>
          </div>
        </dl>

        {/* Action links */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/SI-PUR-001"
            className={[
              'inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-medium',
              'bg-surface-container hover:bg-surface-container-high transition-colors',
              'text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            ].join(' ')}
            aria-label={`Create PO for ${row.materialName}`}
          >
            <ShoppingCart className="h-3 w-3" aria-hidden />
            Create PO
          </Link>
          <Link
            to="/SI-INV-005"
            className={[
              'inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-xs font-medium',
              'bg-surface-container hover:bg-surface-container-high transition-colors',
              'text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            ].join(' ')}
            aria-label={`Create requisition for ${row.materialName}`}
          >
            Requisition
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop table row
// ─────────────────────────────────────────────────────────────────────────────

interface DesktopRowProps {
  readonly row: EnrichedRow
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
          to={`/SI-INV-002?item=${row.materialId}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm min-h-[44px]"
          aria-label={`View stock detail for ${row.materialName}`}
        >
          <span className="font-medium text-on-surface">{row.materialName}</span>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {row.category} · {row.departmentName}
          </p>
        </Link>
      </TableCell>

      {/* UOM */}
      <TableCell className="text-xs text-on-surface-variant">{row.uom}</TableCell>

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

      {/* Urgency + PO badge */}
      <TableCell>
        <div className="flex flex-col gap-1.5 items-start">
          <UrgencyPip urgency={row.urgency} />
          {row.onOpenPo ? <OpenPoBadge /> : null}
        </div>
      </TableCell>

      {/* Actions */}
      <TableCell>
        <div className="flex flex-wrap gap-1.5">
          <Link
            to="/SI-PUR-001"
            className={[
              'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium',
              'bg-surface-container hover:bg-surface-container-high transition-colors',
              'text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            ].join(' ')}
            aria-label={`Create PO for ${row.materialName}`}
          >
            <ShoppingCart className="h-3 w-3" aria-hidden />
            PO
          </Link>
          <Link
            to="/SI-INV-005"
            className={[
              'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium',
              'bg-surface-container hover:bg-surface-container-high transition-colors',
              'text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            ].join(' ')}
            aria-label={`Create requisition for ${row.materialName}`}
          >
            Req.
          </Link>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv003() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)

  const filtered = useMemo(() => {
    return enrichedRows.filter((r) => {
      if (filters.productTypes.size > 0 && !filters.productTypes.has(r.productType))
        return false
      if (filters.categories.size > 0 && !filters.categories.has(r.category))
        return false
      if (filters.urgencies.size > 0 && !filters.urgencies.has(r.urgency))
        return false
      // scope filter is informational — fixture is already CK Bandra-scoped
      return true
    })
  }, [filters])

  const counters = useMemo(() => {
    const total = enrichedRows.length
    const critical = enrichedRows.filter((r) => r.urgency === 'critical').length
    const onOpenPo = enrichedRows.filter((r) => r.onOpenPo).length
    return { total, critical, onOpenPo }
  }, [])

  const toggleSet = <V extends string>(set: ReadonlySet<V>, v: V): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const updateFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const anyFilterActive =
    filters.scopes.size > 0 ||
    filters.productTypes.size > 0 ||
    filters.categories.size > 0 ||
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
              Wild Sugar Central Kitchen — Bandra · Items currently below their PAR level.
              Shortfall and suggested reorder quantities shown for procurement or internal
              requisition (FR33 / FR34). Day-of-week-adjusted PAR shown when it differs from
              the base PAR.
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
            label="Already on open PO"
            value={counters.onOpenPo.toLocaleString('en-IN')}
            secondary="PO pending or confirmed"
            severity="success"
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
              <FilterChipPicker<string>
                title="Category"
                options={ALL_CATEGORIES.map((c) => ({ value: c, label: c }))}
                selected={filters.categories}
                onToggle={(v) =>
                  updateFilter('categories', toggleSet(filters.categories, v))
                }
                onClear={() => updateFilter('categories', new Set())}
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
              {filtered.length} of {enrichedRows.length}
            </span>
          </header>

          {enrichedRows.length === 0 ? (
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
                      <TableHead>UOM</TableHead>
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
          <span className="ml-auto">SI-INV-003 · Tier 1 Group 1 · Phase 4 Epic 4 Arc (b)</span>
        </footer>
      </div>
    </div>
  )
}
