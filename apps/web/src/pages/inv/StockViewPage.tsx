import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  CircleOff,
  PackageSearch,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

import {
  Button,
  DashboardTile,
  Input,
  SectionShift,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shell'

import { useDepartmentStock } from '@/hooks/inv/useStock'
import { useInventoryDepartments } from '@/hooks/inv/useProductNames'
import { ApiError } from '@/lib/api-client'

/**
 * SI-INV-001 — Real-Time Stock View (production port of Arc-b mockup).
 *
 * Tier 1 Group 1, Epic 4 Arc (c). Flagship read-only stock grid fed by the
 * new department stock-list endpoint (Task 1: GET /api/v1/stock/department/:id).
 *
 * Columns scoped to what the endpoint returns (item / unit / on-hand /
 * last-updated). Expiry-band, PAR, and provisional columns are not in this
 * endpoint — they live on their own backed screens (SI-INV-008 / SI-INV-003).
 * All unbacked filter chips (Scope, Product-type, Category, Expiry) are
 * dropped. Only the name search box is retained (client-side filter on
 * real row data).
 *
 * FR25 (real-time stock view within 30 s — freshness is service-side;
 * a per-row last-updated timestamp surfaces the freshness on the grid row).
 *
 * Animation: NONE. CLAUDE.md bans entrance animations on inventory tables.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Last-updated rendered as a human label, consuming the real ISO timestamp. */
function lastUpdatedLabel(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Updated —'
  const then = date.getTime()
  const nowMs = Date.now()
  const diffMs = Math.max(0, nowMs - then)
  const mins = Math.round(diffMs / 60_000)
  if (mins < 60) return `Updated ${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `Updated ${hrs} h ago`
  const days = Math.round(hrs / 24)
  return `Updated ${days} d ago`
}

// ─────────────────────────────────────────────────────────────────────────────
// Row shape (live data — scoped to what the endpoint returns)
// ─────────────────────────────────────────────────────────────────────────────

interface StockRow {
  readonly id: string
  readonly name: string
  readonly unit: string
  readonly onHand: number
  readonly lastUpdatedAt: string // ISO timestamp from server
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface MobileStockCardProps {
  readonly row: StockRow
  readonly effectiveDept: string | undefined
}

function MobileStockCard({ row, effectiveDept }: MobileStockCardProps) {
  return (
    <Link
      to={`/inventory/stock/detail?item=${row.id}&dept=${effectiveDept ?? ''}`}
      className={[
        'group flex flex-col gap-2 rounded-md bg-surface-container-lowest p-4 min-h-[112px]',
        'hover:bg-surface-container transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      ].join(' ')}
      aria-label={`${row.name} — ${row.onHand} ${row.unit} on hand`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-on-surface truncate">
            {row.name}
          </h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            per {row.unit}
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="text-2xl font-bold tabular-nums text-on-surface leading-none">
            {row.onHand}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-on-surface-variant mt-0.5">
            {row.unit}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[11px] text-on-surface-variant">
          {lastUpdatedLabel(row.lastUpdatedAt)}
        </span>
        <ChevronRight
          className="h-4 w-4 text-on-surface-variant opacity-60 group-hover:opacity-100 transition-opacity"
          aria-hidden
        />
      </div>
    </Link>
  )
}

interface DesktopStockRowProps {
  readonly row: StockRow
  readonly effectiveDept: string | undefined
}

function DesktopStockRow({ row, effectiveDept }: DesktopStockRowProps) {
  return (
    <TableRow className="hover:bg-surface-container transition-colors">
      <TableCell>
        <Link
          to={`/inventory/stock/detail?item=${row.id}&dept=${effectiveDept ?? ''}`}
          className="block min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        >
          <span className="font-medium text-on-surface">{row.name}</span>
        </Link>
      </TableCell>
      <TableCell className="text-on-surface-variant text-xs">
        {row.unit}
      </TableCell>
      <TableCell className="text-right">
        <span className="text-base font-semibold tabular-nums text-on-surface">
          {row.onHand}
        </span>
      </TableCell>
      <TableCell className="text-xs text-on-surface-variant">
        {lastUpdatedLabel(row.lastUpdatedAt)}
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function StockViewPage() {
  const { data: depts, isLoading: deptsLoading } = useInventoryDepartments()
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined)

  const effectiveDept = departmentId ?? depts?.[0]?.id

  const { data: stock, isLoading: stockLoading, error } = useDepartmentStock(effectiveDept)

  const [search, setSearch] = useState('')

  // Combined loading guard — wait for dept list AND stock data
  const isLoading = deptsLoading || stockLoading

  // ── Build live rows from API data — stable memo so `filtered` cache holds ──
  const stockRows = useMemo<ReadonlyArray<StockRow>>(
    () =>
      (stock?.items ?? []).map((it) => ({
        id: it.productId,
        name: it.productName,
        onHand: it.quantity,
        unit: it.unit,
        lastUpdatedAt: it.lastUpdatedAt,
      })),
    [stock?.items],
  )

  // ── Client-side search filter (name only — unbacked chips dropped) ──
  const filtered = useMemo(() => {
    if (!search.trim()) return stockRows
    const q = search.trim().toLowerCase()
    return stockRows.filter((r) => r.name.toLowerCase().includes(q))
  }, [stockRows, search])

  // ── Selected department label ──
  const selectedDeptName = useMemo(
    () => depts?.find((d) => d.id === effectiveDept)?.name ?? effectiveDept ?? '—',
    [depts, effectiveDept],
  )

  // ── Newest lastUpdatedAt for the pull-to-refresh hint ──
  const lastRefreshed = useMemo<string | undefined>(
    () =>
      stockRows.length > 0
        ? [...stockRows].sort(
            (a, b) =>
              new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime(),
          )[0]?.lastUpdatedAt
        : undefined,
    [stockRows],
  )

  const anyFilterActive = search.trim().length > 0

  // ── Dashboard tile counters from live data ──
  const counters = {
    inScope: stockRows.length,
  }

  // ── Loading state ──
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

  // ── Error state ──
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

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Pull-to-refresh hint — mobile only */}
        {lastRefreshed ? (
          <div
            role="status"
            className="flex tablet:hidden items-center justify-center gap-1.5 mb-3 rounded-pill bg-surface-container-low px-3 py-2 text-[11px] text-on-surface-variant"
            aria-label={`Pull to refresh — last updated ${lastUpdatedLabel(lastRefreshed)}`}
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            <span>Pull to refresh — {lastUpdatedLabel(lastRefreshed)}</span>
          </div>
        ) : null}

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
              {selectedDeptName} · {counters.inScope} tracked items. Updated within
              30 seconds of the underlying movement. Pull to refresh on mobile
              to re-query.
            </p>
          </div>
        </header>

        {/* Department selector */}
        <section aria-label="Department selector" className="mt-4">
          <label
            htmlFor="department-select"
            className="block text-xs font-medium text-on-surface-variant mb-1"
          >
            Department
          </label>
          <select
            id="department-select"
            value={effectiveDept ?? ''}
            onChange={(e) => setDepartmentId(e.target.value || undefined)}
            className={[
              'h-11 rounded-md px-3 text-sm text-on-surface',
              'bg-surface-container-low',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              'min-w-[240px] max-w-xs',
            ].join(' ')}
          >
            {(depts ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            {(!depts || depts.length === 0) ? (
              <option value="">No departments available</option>
            ) : null}
          </select>
        </section>

        {/* Aggregate counters — DashboardTile grid */}
        <section
          aria-label="Stock counters"
          className="mt-6 grid grid-cols-1 tablet:grid-cols-3 gap-3"
        >
          <DashboardTile
            label="Items in scope"
            value={counters.inScope.toLocaleString('en-IN')}
            secondary={`Tracked in ${selectedDeptName}`}
          />
        </section>

        {/* Filter strip — search only (expiry/PAR/scope/product-type chips are unbacked and dropped) */}
        <section
          aria-label="Stock filters"
          className="mt-6 rounded-md bg-surface-container-low p-3 tablet:p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex w-full items-center gap-2 tablet:w-auto">
              <div className="relative w-full tablet:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden
                />
                <Input
                  aria-label="Search items by name"
                  placeholder="Search by item name"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {anyFilterActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 px-3 gap-1 tablet:h-9"
                  onClick={() => setSearch('')}
                  aria-label="Reset search"
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

          {stockRows.length === 0 ? (
            /* Empty state — no items in this department */
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <PackageSearch
                className="mx-auto h-10 w-10 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-on-surface">
                No stock recorded for this department.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Select a different department or record a goods receipt to populate
                this view.
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
                No items match the current search.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Adjust or clear the search to see every tracked item.
              </p>
              {anyFilterActive ? (
                <Button
                  variant="tonal"
                  size="sm"
                  className="mt-4"
                  onClick={() => setSearch('')}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Clear search
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {/* Mobile — compact card stack */}
              <div className="flex flex-col gap-3 tablet:hidden">
                {filtered.map((row) => (
                  <MobileStockCard key={row.id} row={row} effectiveDept={effectiveDept} />
                ))}
              </div>

              {/* Desktop — data grid (columns: item / unit / on-hand / last-updated) */}
              <div className="hidden tablet:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead>Last updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <DesktopStockRow
                        key={row.id}
                        row={row}
                        effectiveDept={effectiveDept}
                      />
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
            Read-only view · columns shown: item / unit / on-hand / last-updated.
          </span>
        </footer>
      </div>
    </div>
  )
}
