import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  CircleOff,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

import {
  Button,
  DashboardTile,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
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
  inventoryPositions,
  materials,
  locations,
  departments,
  type InventoryPosition,
  type Material,
} from '@/lib/sample-data'

/**
 * SI-INV-001 — Real-Time Stock View.
 *
 * Tier 1 Group 1, screen 7 of Phase 2c-S3. Anchors the stock-grid chrome
 * reused by SI-INV-002 (department stock detail) and SI-INV-003 (below-PAR
 * filter view). Mobile-first: phones on the production floor / store
 * receiving area are the primary device. The desktop variant is a wider
 * data grid with sortable columns rendered in the same component.
 *
 * FR25 (real-time stock view for any item × any location/department within
 * 30 seconds — the freshness rule is service-side; this screen surfaces a
 * per-row last-updated timestamp + a pull-to-refresh trust gesture) and
 * FR113 (filter pre-fill from last session — visual only here; chip strip
 * is controlled state).
 *
 * Cross-cutting:
 *   - CC-DASHBOARD-TILE — three aggregate counters (total in scope, below
 *     PAR, in 72h expiry band) surface as <DashboardTile />s.
 *   - CC-DATA-QUALITY-ALERT — deactivated-material rows render an inline
 *     `status_inactive` pill ("Material deactivated") next to the item
 *     name. The pane-level <DataQualityAlertPane /> is for cross-module
 *     inconsistency lists; in-row deactivation is the canonical chip pattern.
 *   - CC-PROVISIONAL-FLAG — every row whose stock is derived from a
 *     Pending-GR PO renders a <ProvisionalFlag /> badge.
 *
 * Read-only surface — no CC-DRAFT-PILL (no data entry), no CC-AUDIT-LINK
 * (no entity to audit; SI-INV-002 carries the per-item audit drill).
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory tables / dashboards / forms.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NOW_DATE = new Date(`${NOW}T09:00:00+05:30`)

/** Last-updated rendered as a human label e.g. "Updated 7 min ago". */
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

/** Deterministic expiry-band assignment based on inventory id sequence —
 *  yields a believable mix of 24h / 48h / 72h / >72h batches. */
type ExpiryBand = '24h' | '48h' | '72h' | 'fresh'

function expiryBandOfSeq(seq: number): ExpiryBand {
  const m = seq % 17
  if (m === 0 || m === 7) return '24h'
  if (m === 3 || m === 11) return '48h'
  if (m === 5 || m === 13) return '72h'
  return 'fresh'
}

const EXPIRY_BAND_DAYS: Record<ExpiryBand, number> = {
  '24h': 1,
  '48h': 2,
  '72h': 3,
  fresh: 6,
}

const EXPIRY_BAND_LABEL: Record<ExpiryBand, string> = {
  '24h': 'Within 24 h',
  '48h': 'Within 48 h',
  '72h': 'Within 72 h',
  fresh: '> 72 h',
}

/** Format an expiry-soonest date relative to NOW. */
function expirySoonestLabel(band: ExpiryBand): string {
  const d = new Date(NOW_DATE)
  d.setUTCDate(d.getUTCDate() + EXPIRY_BAND_DAYS[band])
  return d.toISOString().slice(0, 10)
}

/** Product-type assignment derived deterministically from material id. */
type ProductType = 'raw' | 'semi' | 'final'

function productTypeOf(mat: Material): ProductType {
  // Heuristic — bakery + dairy mid-products lean semi; spirits / wines + ready
  // beverages lean final; everything else raw. Deterministic + plausible.
  const semiCats = ['Bakery', 'Cheese']
  const finalCats = ['Spirits', 'Wine', 'Beverages']
  if (semiCats.includes(mat.category)) return 'semi'
  if (finalCats.includes(mat.category)) return 'final'
  return 'raw'
}

const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  raw: 'Raw',
  semi: 'Semi-product',
  final: 'Final product',
}

type Scope = 'department' | 'location' | 'cluster' | 'brand'

const SCOPE_LABEL: Record<Scope, string> = {
  department: 'Department',
  location: 'Location',
  cluster: 'Cluster',
  brand: 'Brand-wide',
}

// ─────────────────────────────────────────────────────────────────────────────
// Row enrichment
// ─────────────────────────────────────────────────────────────────────────────

/** Internal row shape — augments InventoryPosition with derived UI fields. */
interface StockRow {
  readonly id: string
  readonly material: Material
  readonly position: InventoryPosition
  readonly expiryBand: ExpiryBand
  readonly expirySoonest: string
  readonly productType: ProductType
  readonly belowPar: boolean
  readonly isProvisional: boolean
  readonly isDeactivatedMaterial: boolean
  readonly locationName: string
}

const locationName = (id: string): string =>
  locations.find((l) => l.id === id)?.name ?? id

/** Build the rendered row set — first 50 positions across the central kitchen
 *  to keep the visual grid digestible for store-floor / phone use, with
 *  fixture-driven flags applied so every state surfaces. */
const stockRows: ReadonlyArray<StockRow> = (() => {
  // Pick CK Bandra positions — that's the kitchen-manager / store-manager
  // primary scope and gives us all 50 materials.
  const ckPositions = inventoryPositions.filter(
    (p) => p.location_id === 'loc-ck-bandra',
  )

  // Material ids deactivated for the deactivation chip (CC-DATA-QUALITY-ALERT)
  const deactivatedMaterialIds = new Set([
    'mat-pork', // pork supply paused
    'mat-wine-red', // restaurant licence under review
  ])

  return ckPositions
    .map((pos, idx) => {
      const mat = materials.find((m) => m.id === pos.material_id)
      if (!mat) return null
      const seq = idx + 1
      const band = expiryBandOfSeq(seq)
      return {
        id: pos.id,
        material: mat,
        position: pos,
        expiryBand: band,
        expirySoonest: expirySoonestLabel(band),
        productType: productTypeOf(mat),
        belowPar: pos.on_hand_qty < pos.par_level,
        isProvisional: pos.cost_basis_provisional,
        isDeactivatedMaterial: deactivatedMaterialIds.has(mat.id),
        locationName: locationName(pos.location_id),
      } satisfies StockRow
    })
    .filter((r): r is StockRow => r !== null)
})()

// ─────────────────────────────────────────────────────────────────────────────
// Filter machinery
// ─────────────────────────────────────────────────────────────────────────────

interface FilterState {
  readonly scopes: ReadonlySet<Scope>
  readonly productTypes: ReadonlySet<ProductType>
  readonly categories: ReadonlySet<string>
  readonly expiryBands: ReadonlySet<ExpiryBand>
  readonly search: string
}

const INITIAL_FILTERS: FilterState = {
  scopes: new Set(),
  productTypes: new Set(),
  categories: new Set(),
  expiryBands: new Set(),
  search: '',
}

const ALL_CATEGORIES: ReadonlyArray<string> = Array.from(
  new Set(materials.map((m) => m.category)),
).sort()

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

interface ExpiryPipProps {
  readonly band: ExpiryBand
}

/** Expiry-band visual — leverages §6.1 status palette: 24h band uses an error
 *  pip (status_variance_flagged-style); 48h / 72h use the warning tertiary;
 *  fresh stays neutral. */
function ExpiryPip({ band }: ExpiryPipProps) {
  if (band === 'fresh') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
        <span>{EXPIRY_BAND_LABEL[band]}</span>
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

interface MobileStockCardProps {
  readonly row: StockRow
}

function MobileStockCard({ row }: MobileStockCardProps) {
  const { material, position, expiryBand, expirySoonest, belowPar, isProvisional, isDeactivatedMaterial } = row
  return (
    <Link
      to={`/SI-INV-002?item=${material.id}`}
      className={[
        'group flex flex-col gap-2 rounded-md bg-surface-container-lowest p-4 min-h-[112px]',
        'hover:bg-surface-container transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      ].join(' ')}
      aria-label={`${material.name} — ${position.on_hand_qty} ${position.uom} on hand`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-1.5">
            <h3 className="text-base font-semibold text-on-surface truncate">
              {material.name}
            </h3>
            {isProvisional ? <ProvisionalFlag size="sm" /> : null}
          </div>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {material.category} · per {position.uom}
          </p>
          {isDeactivatedMaterial ? (
            <div className="mt-1.5">
              <StatusPill
                status="status_inactive"
                size="sm"
                label="Material deactivated"
              />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-2xl font-bold tabular-nums text-on-surface leading-none">
            {position.on_hand_qty}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-on-surface-variant mt-0.5">
            {position.uom}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <ExpiryPip band={expiryBand} />
        {belowPar ? (
          <StatusPill
            status="status_variance_flagged"
            size="sm"
            label={`Below PAR · ${position.par_level} ${position.uom}`}
          />
        ) : (
          <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
            PAR {position.par_level} {position.uom}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[11px] text-on-surface-variant">
          {lastUpdatedLabel(position.last_movement_on)} · expires {expirySoonest}
        </span>
        <ChevronRight
          className="h-4 w-4 text-on-surface-variant opacity-60 group-hover:opacity-100 transition-opacity"
          aria-hidden
        />
      </div>

      {belowPar ? (
        <p className="text-[11px] text-tertiary">
          Below PAR — replenishment recommended.
        </p>
      ) : null}
    </Link>
  )
}

interface DesktopStockRowProps {
  readonly row: StockRow
}

function DesktopStockRow({ row }: DesktopStockRowProps) {
  const { material, position, expiryBand, expirySoonest, belowPar, isProvisional, isDeactivatedMaterial } = row
  return (
    <TableRow className="hover:bg-surface-container transition-colors">
      <TableCell>
        <Link
          to={`/SI-INV-002?item=${material.id}`}
          className="block min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        >
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="font-medium text-on-surface">{material.name}</span>
            {isProvisional ? <ProvisionalFlag size="sm" /> : null}
            {isDeactivatedMaterial ? (
              <StatusPill
                status="status_inactive"
                size="sm"
                label="Material deactivated"
              />
            ) : null}
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {material.category}
          </p>
        </Link>
      </TableCell>
      <TableCell className="text-on-surface-variant text-xs">
        {position.uom}
      </TableCell>
      <TableCell className="text-right">
        <span className="text-base font-semibold tabular-nums text-on-surface">
          {position.on_hand_qty}
        </span>
      </TableCell>
      <TableCell>
        <ExpiryPip band={expiryBand} />
        <p className="mt-0.5 text-[11px] text-on-surface-variant tabular-nums">
          {expirySoonest}
        </p>
      </TableCell>
      <TableCell className="text-right tabular-nums text-on-surface-variant">
        {position.par_level}
      </TableCell>
      <TableCell className="text-xs text-on-surface-variant">
        {lastUpdatedLabel(position.last_movement_on)}
      </TableCell>
      <TableCell>
        {belowPar ? (
          <StatusPill
            status="status_variance_flagged"
            size="sm"
            label="Below PAR"
          />
        ) : (
          <span className="text-[11px] text-on-surface-variant">On PAR</span>
        )}
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv001() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)

  const filtered = useMemo(() => {
    return stockRows.filter((r) => {
      if (filters.productTypes.size > 0 && !filters.productTypes.has(r.productType))
        return false
      if (filters.categories.size > 0 && !filters.categories.has(r.material.category))
        return false
      if (filters.expiryBands.size > 0 && !filters.expiryBands.has(r.expiryBand))
        return false
      // scope filter is informational — the fixture is already CK Bandra-scoped;
      // empty selection = "no filter applied", any chip selected continues to
      // surface the same set (visual chrome only per Tier 1 acceptance §11).
      if (filters.search.trim().length > 0) {
        const q = filters.search.trim().toLowerCase()
        const hay = `${r.material.name} ${r.material.category}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [filters])

  const counters = useMemo(() => {
    const inScope = stockRows.length
    const belowPar = stockRows.filter((r) => r.belowPar).length
    const expiring72h = stockRows.filter(
      (r) => r.expiryBand === '24h' || r.expiryBand === '48h' || r.expiryBand === '72h',
    ).length
    return { inScope, belowPar, expiring72h }
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
    filters.expiryBands.size > 0 ||
    filters.search.trim().length > 0

  // Newest movement across the in-scope rows — drives the "last refreshed"
  // timestamp shown on the pull-to-refresh hint.
  const lastRefreshed = useMemo(() => {
    const isos = stockRows.map((r) => r.position.last_movement_on)
    return isos.sort().slice(-1)[0] ?? NOW
  }, [])

  // Department label for the page eyebrow — fixture-scoped to CK Bandra.
  const ckDepartments = departments.filter((d) => d.location_id === 'loc-ck-bandra')

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Pull-to-refresh hint — mobile only */}
        <div
          role="status"
          className="flex tablet:hidden items-center justify-center gap-1.5 mb-3 rounded-pill bg-surface-container-low px-3 py-2 text-[11px] text-on-surface-variant"
          aria-label={`Pull to refresh — last updated ${lastUpdatedLabel(lastRefreshed)}`}
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          <span>Pull to refresh — {lastUpdatedLabel(lastRefreshed)}</span>
        </div>

        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Real-time stock
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Stock on hand
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Wild Sugar Central Kitchen — Bandra · {ckDepartments.length} departments ·
              {' '}{stockRows.length} tracked items. Updated within 30 seconds of the
              underlying movement (FR25). Pull to refresh on mobile to re-query.
            </p>
          </div>
        </header>

        {/* Aggregate counters — DashboardTile grid */}
        <section
          aria-label="Stock counters"
          className="mt-6 grid grid-cols-1 tablet:grid-cols-3 gap-3"
        >
          <DashboardTile
            label="Items in scope"
            value={counters.inScope.toLocaleString('en-IN')}
            secondary="Tracked across CK Bandra"
          />
          <DashboardTile
            label="Below PAR"
            value={counters.belowPar.toLocaleString('en-IN')}
            secondary="Replenishment recommended"
            severity={counters.belowPar > 0 ? 'warning' : 'neutral'}
          />
          <DashboardTile
            label="Expiring within 72 h"
            value={counters.expiring72h.toLocaleString('en-IN')}
            secondary="Plan menu rotation"
            severity={counters.expiring72h > 0 ? 'error' : 'neutral'}
          />
        </section>

        {/* Filter strip */}
        <section
          aria-label="Stock filters"
          className="mt-6 rounded-md bg-surface-container-low p-3 tablet:p-4"
        >
          <div className="flex flex-wrap items-center gap-2 tablet:gap-2">
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
              <FilterChipPicker<ExpiryBand>
                title="Expiry"
                options={(['24h', '48h', '72h', 'fresh'] as const).map((v) => ({
                  value: v,
                  label: EXPIRY_BAND_LABEL[v],
                }))}
                selected={filters.expiryBands}
                onToggle={(v) =>
                  updateFilter('expiryBands', toggleSet(filters.expiryBands, v))
                }
                onClear={() => updateFilter('expiryBands', new Set())}
              />
            </div>

            <div className="flex w-full items-center gap-2 tablet:ml-auto tablet:w-auto">
              <div className="relative w-full tablet:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden
                />
                <Input
                  aria-label="Search items by name or category"
                  placeholder="Search by item or category"
                  className="pl-9"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
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
          </div>
        </section>

        {/* Result list */}
        <section aria-label="Stock items" className="mt-6">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">Items</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {filtered.length} of {stockRows.length}
            </span>
          </header>

          {filtered.length === 0 ? (
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <PackageSearch
                className="mx-auto h-10 w-10 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-on-surface">
                No items match the current filter.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Adjust the chips above or clear them to see every tracked item.
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
              {/* Mobile — compact card stack */}
              <div className="flex flex-col gap-3 tablet:hidden">
                {filtered.map((row) => (
                  <MobileStockCard key={row.id} row={row} />
                ))}
              </div>

              {/* Desktop — wider data grid */}
              <div className="hidden tablet:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead>Expiry-soonest</TableHead>
                      <TableHead className="text-right">PAR</TableHead>
                      <TableHead>Last updated</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <DesktopStockRow key={row.id} row={row} />
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
          <span>Read-only view · no draft state · drill into an item for movement history.</span>
          <span className="ml-auto">SI-INV-001 · Tier 1 Group 1 · Phase 2c-S3</span>
        </footer>
      </div>
    </div>
  )
}
