import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowUpAZ,
  ArrowUpRight,
  Bookmark,
  CalendarRange,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Send,
  X,
} from 'lucide-react'

import {
  Button,
  DashboardTile,
  ExportTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type StatusToken,
} from '@/shell'

import {
  NOW,
  formatINR,
  b2bCustomers,
  locations,
  materials,
  purchaseOrders,
  recipes,
  vendors,
  type Material,
  type PO,
  type POStatus,
  type Vendor,
  type B2BCustomer,
} from '@/lib/sample-data'

/**
 * SI-RPT-005 — Report Detail Runner.
 *
 * Tier 1 Group 1, screen 4 of Phase 2c-S3. Anchors the canonical FR106
 * report-runner chrome — ONE parametrised screen rendering shared filter
 * bar, scope selector, summary tiles (CC-DASHBOARD-TILE), per-row
 * drill-through, and CC-EXPORT-TRIGGER (CSV / Excel / PDF per FR107).
 *
 * Per inventory line 5832 — this is one screen with parametrised behaviour
 * because the chrome (filter set, scope, export, drill-through pattern) is
 * identical across the FR106 reports. The result-table column shape varies.
 *
 * Three concrete reports ship in the Tier 1 mockup:
 *   - Purchase Register
 *   - Inventory Movement
 *   - Production-vs-Yield Variance
 * The remaining six FR106 reports are stubbed with a Phase-4 empty-state
 * placeholder — building all 9 result tables here is out of scope; the
 * chrome IS the canonical contract.
 *
 * NO CC-AUDIT-LINK — inventory line 5832 is explicit. This is a read-only
 * runner; audit affordances appear on the drilled-into source records.
 *
 * Animation policy — NO entrance animations on tables / filter strips per
 * CLAUDE.md. Tailwind hover transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Report taxonomy — discriminated union by `report` key
// ─────────────────────────────────────────────────────────────────────────────

type ReportKey =
  | 'purchase_register'
  | 'inventory_movement'
  | 'production_yield_variance'
  | 'food_cost'
  | 'wastage_by_reason'
  | 'closing_inventory_variance'
  | 'dispatch_volume'
  | 'b2b_sales_register'
  | 'pos_sales_pivot'

interface ReportMeta {
  readonly key: ReportKey
  readonly name: string
  readonly subtitle: string
  /** Drill-through target for row clicks. */
  readonly drillRoute: string
  /** Concrete-shipped vs Phase-4 stub. */
  readonly status: 'ready' | 'phase4_stub'
  /** Originating epic label for the empty state. */
  readonly originatingEpic: string
  /** Pickers visible for this report. */
  readonly pickers: ReadonlySet<PickerKind>
  /** Group-by dimension labels offered for this report. */
  readonly groupByOptions: ReadonlyArray<string>
}

type PickerKind = 'item' | 'vendor' | 'customer' | 'category'

const REPORTS: ReadonlyArray<ReportMeta> = [
  {
    key: 'purchase_register',
    name: 'Purchase Register',
    subtitle: 'POs raised across locations with vendor and value.',
    drillRoute: '/SI-PUR-003',
    status: 'ready',
    originatingEpic: 'Epic 5 — Procurement',
    pickers: new Set<PickerKind>(['item', 'vendor', 'category']),
    groupByOptions: ['Vendor', 'Status', 'Month', 'Location'],
  },
  {
    key: 'inventory_movement',
    name: 'Inventory Movement',
    subtitle: 'Per-item in / out across the period — opening to closing.',
    drillRoute: '/SI-INV-001',
    status: 'ready',
    originatingEpic: 'Epic 4 — Inventory',
    pickers: new Set<PickerKind>(['item', 'category']),
    groupByOptions: ['Category', 'Location', 'UOM'],
  },
  {
    key: 'production_yield_variance',
    name: 'Production-vs-Yield Variance',
    subtitle: 'Production orders flagged where actual yield deviates from expected.',
    drillRoute: '/SI-PRO-003',
    status: 'ready',
    originatingEpic: 'Epic 6 — Production',
    pickers: new Set<PickerKind>(['item', 'category']),
    groupByOptions: ['Recipe', 'Variance band', 'Location'],
  },
  {
    key: 'food_cost',
    name: 'Food Cost',
    subtitle: 'Theoretical vs actual cost per menu item — Epic 6 ships the resolver.',
    drillRoute: '/SI-REC-003',
    status: 'phase4_stub',
    originatingEpic: 'Epic 6 — Production',
    pickers: new Set<PickerKind>(['item', 'category']),
    groupByOptions: ['Category', 'Daypart'],
  },
  {
    key: 'wastage_by_reason',
    name: 'Wastage by Reason / Item',
    subtitle: 'Wastage volume grouped by reason code and item.',
    drillRoute: '/SI-INV-013',
    status: 'phase4_stub',
    originatingEpic: 'Epic 4 — Inventory',
    pickers: new Set<PickerKind>(['item', 'category']),
    groupByOptions: ['Reason', 'Item', 'Location'],
  },
  {
    key: 'closing_inventory_variance',
    name: 'Closing Inventory Variance',
    subtitle: 'Per-item variance per closing event — Epic 4 ships the detail.',
    drillRoute: '/SI-INV-016',
    status: 'phase4_stub',
    originatingEpic: 'Epic 4 — Inventory',
    pickers: new Set<PickerKind>(['item', 'category']),
    groupByOptions: ['Reason', 'Item', 'Location'],
  },
  {
    key: 'dispatch_volume',
    name: 'Dispatch Volume',
    subtitle: 'Dispatches per location and period — Epic 7 ships the detail.',
    drillRoute: '/SI-DSP-007',
    status: 'phase4_stub',
    originatingEpic: 'Epic 7 — Dispatch',
    pickers: new Set<PickerKind>(['item', 'customer']),
    groupByOptions: ['Location', 'Customer', 'Day'],
  },
  {
    key: 'b2b_sales_register',
    name: 'B2B Sales Register',
    subtitle: 'B2B challans with GST status — Epic 7 ships the detail.',
    drillRoute: '/SI-DSP-007',
    status: 'phase4_stub',
    originatingEpic: 'Epic 7 — Dispatch',
    pickers: new Set<PickerKind>(['customer', 'category']),
    groupByOptions: ['Customer', 'GST type', 'Month'],
  },
  {
    key: 'pos_sales_pivot',
    name: 'POS Sales by Item / Location / Day-Part',
    subtitle: 'Pivoted sales table — Epic 8 ships the resolver.',
    drillRoute: '/SI-POS-003',
    status: 'phase4_stub',
    originatingEpic: 'Epic 8 — POS Integration',
    pickers: new Set<PickerKind>(['item', 'category']),
    groupByOptions: ['Item', 'Location', 'Day-part'],
  },
]

const REPORTS_BY_KEY: Record<ReportKey, ReportMeta> = REPORTS.reduce(
  (acc, r) => {
    acc[r.key] = r
    return acc
  },
  {} as Record<ReportKey, ReportMeta>,
)

// ─────────────────────────────────────────────────────────────────────────────
// Period selector
// ─────────────────────────────────────────────────────────────────────────────

type PeriodKey = 'last7' | 'last30' | 'this_month' | 'custom'

const PERIOD_LABEL: Record<PeriodKey, string> = {
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  this_month: 'This month',
  custom: 'Custom range',
}

const PERIOD_DAYS: Record<PeriodKey, number> = {
  last7: 7,
  last30: 30,
  this_month: 31,
  custom: 30,
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope selector
// ─────────────────────────────────────────────────────────────────────────────

type ScopeLevel = 'brand' | 'cluster' | 'location' | 'department'

const SCOPE_LEVEL_LABEL: Record<ScopeLevel, string> = {
  brand: 'Brand-wide',
  cluster: 'Cluster',
  location: 'Location',
  department: 'Department',
}

// ─────────────────────────────────────────────────────────────────────────────
// Saved filters (Wild Sugar plausible examples)
// ─────────────────────────────────────────────────────────────────────────────

interface SavedFilter {
  readonly id: string
  readonly name: string
  readonly report: ReportKey
  readonly description: string
}

const SAVED_FILTERS: ReadonlyArray<SavedFilter> = [
  {
    id: 'sf-and-march',
    name: 'AND March vendor spend',
    report: 'purchase_register',
    description: 'Andheri-East cluster · last 30 days · vendor breakdown',
  },
  {
    id: 'sf-mum-q1',
    name: 'MUM closing variance Q1',
    report: 'closing_inventory_variance',
    description: 'Mumbai locations · variance > 2 % · grouped by reason',
  },
  {
    id: 'sf-pos-dinner',
    name: 'POS day-part dinner',
    report: 'pos_sales_pivot',
    description: 'Dinner day-part · all outlets · last 30 days',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Sort state
// ─────────────────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'

interface SortState {
  readonly column: string
  readonly direction: SortDir
}

// ─────────────────────────────────────────────────────────────────────────────
// Concrete report rows — typed per report
// ─────────────────────────────────────────────────────────────────────────────

interface PurchaseRegisterRow {
  readonly trn: string
  readonly poNumber: string
  readonly vendorName: string
  readonly locationName: string
  readonly orderDate: string
  readonly value: number
  readonly status: POStatus
}

interface InventoryMovementRow {
  readonly itemId: string
  readonly itemName: string
  readonly category: string
  readonly uom: string
  readonly opening: number
  readonly received: number
  readonly dispatched: number
  readonly adjusted: number
  readonly closing: number
  readonly netDelta: number
}

interface ProductionYieldRow {
  readonly orderId: string
  readonly recipeName: string
  readonly expectedOutput: number
  readonly actualOutput: number
  readonly variancePct: number
  readonly yieldUnit: string
  readonly locationName: string
  readonly producedOn: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture builders — deterministic
// ─────────────────────────────────────────────────────────────────────────────

const PO_STATUS_TOKEN: Record<POStatus, StatusToken> = {
  draft: 'status_draft',
  pending_approval: 'status_pending_approval',
  confirmed: 'status_confirmed',
  pending_gr: 'status_pending_gr',
  closed: 'status_closed',
  cancelled: 'status_cancelled',
  gr_rejected: 'status_gr_rejected',
}

function buildPurchaseRegisterRows(): ReadonlyArray<PurchaseRegisterRow> {
  // Last 60 POs — deterministic slice. Plenty of variety for chrome demo.
  return purchaseOrders.slice(-60).reverse().map((po: PO): PurchaseRegisterRow => {
    const vendor = vendors.find((v: Vendor) => v.id === po.vendor_id)!
    const loc = locations.find((l) => l.id === po.location_id)!
    return {
      trn: po.trn,
      poNumber: po.po_number,
      vendorName: vendor.name,
      locationName: loc.name,
      orderDate: po.raised_on,
      value: po.total_value,
      status: po.status,
    }
  })
}

function buildInventoryMovementRows(): ReadonlyArray<InventoryMovementRow> {
  // Aggregate inventoryPositions × goodsReceipts by material across the
  // active scope. 30 distinct materials is plenty for chrome.
  const sample = materials.slice(0, 30)
  return sample.map((m: Material, idx): InventoryMovementRow => {
    // Synthesise plausible movement numbers from the seed.
    const seed = idx + 1
    const opening = ((seed * 13) % 60) + 20
    const received = ((seed * 7) % 50) + 10
    const dispatched = ((seed * 11) % 45) + 8
    const adjusted = (seed % 4) - 2 // -2..+1 small adjustments
    const closing = opening + received - dispatched + adjusted
    const netDelta = closing - opening
    return {
      itemId: m.id,
      itemName: m.name,
      category: m.category,
      uom: m.uom,
      opening,
      received,
      dispatched,
      adjusted,
      closing,
      netDelta,
    }
  })
}

function buildProductionYieldRows(): ReadonlyArray<ProductionYieldRow> {
  // Production-orders fixture is out of sample-data scope (per its comment);
  // we synthesise plausible rows pinned to recipes + tracking locations.
  const trackingLocations = locations.filter(
    (l) => l.type === 'central_kitchen' || l.type === 'pos_outlet',
  )
  const sampleRecipes = recipes.slice(0, 24)
  const out: ProductionYieldRow[] = []
  let seq = 1
  for (const r of sampleRecipes) {
    const loc = trackingLocations[seq % trackingLocations.length]!
    const expected = r.yield_qty * (5 + (seq % 6))
    // Variance: -10% .. +12%
    const variancePct = ((seq * 17) % 22) - 10
    const actual = Math.round(expected * (1 + variancePct / 100))
    const date = new Date(`${NOW}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - (seq % 14))
    out.push({
      orderId: `PO-PRD-2026-${String(seq).padStart(4, '0')}`,
      recipeName: r.name,
      expectedOutput: expected,
      actualOutput: actual,
      variancePct,
      yieldUnit: r.yield_unit,
      locationName: loc.name,
      producedOn: date.toISOString().slice(0, 10),
    })
    seq++
  }
  return out
}

const purchaseRegisterRows = buildPurchaseRegisterRows()
const inventoryMovementRows = buildInventoryMovementRows()
const productionYieldRows = buildProductionYieldRows()

// ─────────────────────────────────────────────────────────────────────────────
// Filter state
// ─────────────────────────────────────────────────────────────────────────────

interface FilterState {
  readonly itemIds: ReadonlySet<string>
  readonly vendorIds: ReadonlySet<string>
  readonly customerIds: ReadonlySet<string>
  readonly categories: ReadonlySet<string>
}

const INITIAL_FILTERS: FilterState = {
  itemIds: new Set(),
  vendorIds: new Set(),
  customerIds: new Set(),
  categories: new Set(),
}

const ITEM_OPTIONS = materials.slice(0, 30).map((m) => ({
  value: m.id,
  label: m.name,
}))

const VENDOR_OPTIONS = vendors.filter((v) => v.is_active).slice(0, 15).map((v) => ({
  value: v.id,
  label: v.name,
}))

const CUSTOMER_OPTIONS = b2bCustomers.map((c: B2BCustomer) => ({
  value: c.id,
  label: c.name,
}))

const CATEGORY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = (() => {
  const set = new Set<string>()
  for (const m of materials) set.add(m.category)
  return Array.from(set)
    .sort()
    .map((c) => ({ value: c, label: c }))
})()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function INRValue({ value }: { value: number }) {
  const formatted = formatINR(value)
  const isNeg = formatted.startsWith('-')
  const body = isNeg ? formatted.slice(1) : formatted
  const symbolPart = body.slice(0, 2)
  const digitsPart = body.slice(2)
  return (
    <>
      <span className="text-on-surface-variant">
        {isNeg ? '-' : ''}
        {symbolPart}
      </span>
      <span>{digitsPart}</span>
    </>
  )
}

function formatPct(pct: number, digits = 1): string {
  // Use ASCII minus + uppercase percent; tabular-nums applied at cell.
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)} %`
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function toggleSet<V>(set: ReadonlySet<V>, v: V): ReadonlySet<V> {
  const next = new Set(set)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  return next
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — local to this screen (per task §2 default).
// `<ReportFilterBar>` lives here as a local sub-component; if a future report
// screen (SI-ACC-003 / SI-ACC-013) clearly reuses the abstraction, lift it to
// `mockups/src/shell/ReportFilterBar.tsx`.
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
          className="h-9 px-3 gap-1.5 rounded-pill"
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
        <ul className="flex flex-col max-h-72 overflow-y-auto">
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

function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodKey
  onChange: (v: PeriodKey) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="tonal" size="sm" className="h-9 px-3 gap-1.5 rounded-pill">
          <CalendarRange className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Period
          </span>
          <span className="text-xs font-medium text-on-surface">
            {PERIOD_LABEL[value]}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Quick presets
        </p>
        <ul className="flex flex-col">
          {(Object.keys(PERIOD_LABEL) as ReadonlyArray<PeriodKey>).map((opt) => {
            const active = opt === value
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-on-surface">{PERIOD_LABEL[opt]}</span>
                  {active ? (
                    <span className="text-xs font-medium text-primary">Active</span>
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

function ScopePicker({
  value,
  onChange,
}: {
  value: ScopeLevel
  onChange: (v: ScopeLevel) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="tonal" size="sm" className="h-9 px-3 gap-1.5 rounded-pill">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Scope
          </span>
          <span className="text-xs font-medium text-on-surface">
            {SCOPE_LEVEL_LABEL[value]}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <ul className="flex flex-col">
          {(Object.keys(SCOPE_LEVEL_LABEL) as ReadonlyArray<ScopeLevel>).map((opt) => {
            const active = opt === value
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-on-surface">{SCOPE_LEVEL_LABEL[opt]}</span>
                  {active ? (
                    <span className="text-xs font-medium text-primary">Active</span>
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

function ReportPicker({
  value,
  onChange,
}: {
  value: ReportKey
  onChange: (v: ReportKey) => void
}) {
  const [open, setOpen] = useState(false)
  const meta = REPORTS_BY_KEY[value]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="tonal" className="h-11 px-4 gap-2">
          <Layers className="h-4 w-4 text-on-surface-variant" aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Report
          </span>
          <span className="text-sm font-medium text-on-surface">{meta.name}</span>
          <ChevronDown className="h-4 w-4 text-on-surface-variant" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-1">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          FR106 operational reports — pick one
        </p>
        <ul className="flex flex-col max-h-96 overflow-y-auto">
          {REPORTS.map((r) => {
            const active = r.key === value
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(r.key)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex flex-col gap-0.5 min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-on-surface">{r.name}</span>
                    {r.status === 'phase4_stub' ? (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Phase 4
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                        Ready
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-on-surface-variant">{r.subtitle}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function GroupByPicker({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<string>
  value: string | null
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={value ? 'tonal' : 'ghost'}
          size="sm"
          className="h-9 px-3 gap-1.5 rounded-pill"
        >
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Group by
          </span>
          <span className="text-xs font-medium text-on-surface">
            {value ?? 'None'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <ul className="flex flex-col">
          <li>
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              className={[
                'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between min-h-[44px]',
                'hover:bg-surface-container-high transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                value === null ? 'bg-surface-container' : '',
              ].join(' ')}
            >
              <span className="text-sm text-on-surface">No grouping</span>
              {value === null ? (
                <span className="text-xs font-medium text-primary">Active</span>
              ) : null}
            </button>
          </li>
          {options.map((opt) => {
            const active = opt === value
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-on-surface">{opt}</span>
                  {active ? (
                    <span className="text-xs font-medium text-primary">Active</span>
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

function SavedFiltersPicker({
  current,
  onPick,
  onSave,
}: {
  current: ReportKey
  onPick: (s: SavedFilter) => void
  onSave: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 px-3 gap-1.5 rounded-pill">
          <Bookmark className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
          <span className="text-xs">Saved filters</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Saved filter sets
        </p>
        <ul className="flex flex-col">
          {SAVED_FILTERS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(s)
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 rounded-sm flex flex-col gap-0.5 min-h-[44px] hover:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="text-sm font-medium text-on-surface">{s.name}</span>
                <span className="text-xs text-on-surface-variant">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
        <SectionShift tone="high" className="my-1" aria-hidden />
        <div className="px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Save current filter
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Saves the active {REPORTS_BY_KEY[current].name} filter set under your name.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Input
              aria-label="Saved filter name"
              placeholder="e.g. AND March vendor spend"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 flex-1"
            />
            <Button
              size="sm"
              disabled={name.trim().length === 0}
              onClick={() => {
                onSave(name.trim())
                setName('')
                setOpen(false)
              }}
            >
              <Save className="h-3.5 w-3.5" aria-hidden />
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SchedulePopover() {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-11 px-3 gap-2 text-on-surface-variant">
          <CalendarClock className="h-4 w-4" aria-hidden />
          <span className="text-sm">Schedule</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="flex items-start gap-3">
          <Send className="mt-0.5 h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
          <div>
            <p className="text-sm font-medium text-on-surface">
              Schedule emailed delivery
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Queue this report on a recurring cadence (daily / weekly / month-end)
              with PDF + Excel attachments to a distribution list.
            </p>
            <p className="mt-3 rounded-sm bg-surface-container px-3 py-2 text-[11px] uppercase tracking-wider text-on-surface-variant">
              Interaction lands in Phase 3a
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface SortableHeadProps {
  readonly column: string
  readonly label: string
  readonly sort: SortState | null
  readonly onSort: (column: string) => void
  readonly align?: 'left' | 'right'
  readonly className?: string
}

function SortableHead({
  column,
  label,
  sort,
  onSort,
  align = 'left',
  className,
}: SortableHeadProps) {
  const active = sort?.column === column
  const direction: SortDir | null = active ? sort.direction : null
  const ariaSort: 'ascending' | 'descending' | 'none' =
    direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'
  const ArrowIcon = !active ? ArrowDownUp : direction === 'asc' ? ArrowUpAZ : ArrowDownAZ
  const isRight = align === 'right'
  return (
    <TableHead aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={[
          'inline-flex items-center gap-1.5 rounded-sm px-1 -mx-1 min-h-[28px]',
          'text-[11px] font-medium uppercase tracking-wider',
          active ? 'text-on-surface' : 'text-on-surface-variant',
          'hover:bg-surface-container-high transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isRight ? 'flex-row-reverse' : '',
        ].join(' ')}
        aria-label={`Sort by ${label}${
          direction === 'asc' ? ', ascending' : direction === 'desc' ? ', descending' : ''
        }`}
      >
        <span>{label}</span>
        <ArrowIcon className="h-3 w-3" aria-hidden />
      </button>
    </TableHead>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Result tables — one renderer per concrete report
// ─────────────────────────────────────────────────────────────────────────────

function PurchaseRegisterTable({
  rows,
  drillRoute,
  sort,
  onSort,
}: {
  rows: ReadonlyArray<PurchaseRegisterRow>
  drillRoute: string
  sort: SortState | null
  onSort: (column: string) => void
}) {
  const total = rows.reduce((acc, r) => acc + r.value, 0)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead column="trn" label="TRN" sort={sort} onSort={onSort} />
          <SortableHead column="poNumber" label="PO number" sort={sort} onSort={onSort} />
          <SortableHead column="vendorName" label="Vendor" sort={sort} onSort={onSort} />
          <SortableHead column="locationName" label="Location" sort={sort} onSort={onSort} />
          <SortableHead column="orderDate" label="Order date" sort={sort} onSort={onSort} />
          <SortableHead column="status" label="Status" sort={sort} onSort={onSort} />
          <SortableHead column="value" label="Value" sort={sort} onSort={onSort} align="right" className="text-right" />
          <TableHead className="w-12 text-right" aria-label="Drill" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.trn}
            className="cursor-pointer transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <TableCell className="font-mono text-xs text-on-surface-variant">
              <Link
                to={`${drillRoute}?trn=${r.trn}`}
                className="block focus-visible:outline-none"
                aria-label={`Open ${r.poNumber} — ${r.vendorName}`}
              >
                {r.trn}
              </Link>
            </TableCell>
            <TableCell className="font-mono text-xs text-on-surface">
              {r.poNumber}
            </TableCell>
            <TableCell className="text-sm text-on-surface">{r.vendorName}</TableCell>
            <TableCell className="text-sm text-on-surface-variant">
              {r.locationName}
            </TableCell>
            <TableCell className="text-sm text-on-surface-variant tabular-nums">
              {formatDateShort(r.orderDate)}
            </TableCell>
            <TableCell>
              <StatusPill status={PO_STATUS_TOKEN[r.status]} size="sm" />
            </TableCell>
            <TableCell className="text-right text-sm text-on-surface tabular-nums">
              <INRValue value={r.value} />
            </TableCell>
            <TableCell className="text-right">
              <Link
                to={`${drillRoute}?trn=${r.trn}`}
                aria-label={`Drill into ${r.poNumber}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Total
          </TableCell>
          <TableCell className="text-xs text-on-surface-variant" colSpan={5}>
            {rows.length} POs in window
          </TableCell>
          <TableCell className="text-right text-sm font-semibold text-on-surface tabular-nums">
            <INRValue value={total} />
          </TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  )
}

function InventoryMovementTable({
  rows,
  drillRoute,
  sort,
  onSort,
}: {
  rows: ReadonlyArray<InventoryMovementRow>
  drillRoute: string
  sort: SortState | null
  onSort: (column: string) => void
}) {
  const totals = rows.reduce(
    (acc, r) => ({
      received: acc.received + r.received,
      dispatched: acc.dispatched + r.dispatched,
      adjusted: acc.adjusted + r.adjusted,
      netDelta: acc.netDelta + r.netDelta,
    }),
    { received: 0, dispatched: 0, adjusted: 0, netDelta: 0 },
  )
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead column="itemName" label="Item" sort={sort} onSort={onSort} />
          <SortableHead column="category" label="Category" sort={sort} onSort={onSort} />
          <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            UOM
          </TableHead>
          <SortableHead column="opening" label="Opening" sort={sort} onSort={onSort} align="right" className="text-right" />
          <SortableHead column="received" label="Received" sort={sort} onSort={onSort} align="right" className="text-right" />
          <SortableHead column="dispatched" label="Dispatched" sort={sort} onSort={onSort} align="right" className="text-right" />
          <SortableHead column="adjusted" label="Adjusted" sort={sort} onSort={onSort} align="right" className="text-right" />
          <SortableHead column="closing" label="Closing" sort={sort} onSort={onSort} align="right" className="text-right" />
          <SortableHead column="netDelta" label="Net Δ" sort={sort} onSort={onSort} align="right" className="text-right" />
          <TableHead className="w-12 text-right" aria-label="Drill" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.itemId}
            className="cursor-pointer transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <TableCell className="text-sm text-on-surface">
              <Link
                to={`${drillRoute}?item=${r.itemId}`}
                className="block focus-visible:outline-none"
                aria-label={`Open ${r.itemName} movement`}
              >
                {r.itemName}
              </Link>
            </TableCell>
            <TableCell className="text-sm text-on-surface-variant">
              {r.category}
            </TableCell>
            <TableCell className="text-xs uppercase tracking-wider text-on-surface-variant">
              {r.uom}
            </TableCell>
            <TableCell className="text-right text-sm text-on-surface tabular-nums">
              {r.opening}
            </TableCell>
            <TableCell className="text-right text-sm text-on-surface tabular-nums">
              +{r.received}
            </TableCell>
            <TableCell className="text-right text-sm text-on-surface tabular-nums">
              -{r.dispatched}
            </TableCell>
            <TableCell className="text-right text-sm text-on-surface-variant tabular-nums">
              {r.adjusted >= 0 ? `+${r.adjusted}` : r.adjusted}
            </TableCell>
            <TableCell className="text-right text-sm font-medium text-on-surface tabular-nums">
              {r.closing}
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              <span
                className={
                  r.netDelta < 0
                    ? 'text-error'
                    : r.netDelta > 0
                      ? 'text-success'
                      : 'text-on-surface-variant'
                }
              >
                {r.netDelta >= 0 ? `+${r.netDelta}` : r.netDelta}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <Link
                to={`${drillRoute}?item=${r.itemId}`}
                aria-label={`Drill into ${r.itemName}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Total
          </TableCell>
          <TableCell className="text-xs text-on-surface-variant" colSpan={2}>
            {rows.length} items
          </TableCell>
          <TableCell />
          <TableCell className="text-right text-sm font-semibold text-on-surface tabular-nums">
            +{totals.received}
          </TableCell>
          <TableCell className="text-right text-sm font-semibold text-on-surface tabular-nums">
            -{totals.dispatched}
          </TableCell>
          <TableCell className="text-right text-sm font-semibold text-on-surface-variant tabular-nums">
            {totals.adjusted >= 0 ? `+${totals.adjusted}` : totals.adjusted}
          </TableCell>
          <TableCell />
          <TableCell className="text-right text-sm font-semibold tabular-nums">
            <span className={totals.netDelta < 0 ? 'text-error' : 'text-success'}>
              {totals.netDelta >= 0 ? `+${totals.netDelta}` : totals.netDelta}
            </span>
          </TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  )
}

function ProductionYieldTable({
  rows,
  drillRoute,
  sort,
  onSort,
}: {
  rows: ReadonlyArray<ProductionYieldRow>
  drillRoute: string
  sort: SortState | null
  onSort: (column: string) => void
}) {
  const flagged = rows.filter((r) => Math.abs(r.variancePct) > 5).length
  const meanVariance = rows.reduce((acc, r) => acc + r.variancePct, 0) / rows.length
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead column="orderId" label="Production order" sort={sort} onSort={onSort} />
          <SortableHead column="recipeName" label="Recipe" sort={sort} onSort={onSort} />
          <SortableHead column="locationName" label="Location" sort={sort} onSort={onSort} />
          <SortableHead column="producedOn" label="Date" sort={sort} onSort={onSort} />
          <SortableHead column="expectedOutput" label="Expected" sort={sort} onSort={onSort} align="right" className="text-right" />
          <SortableHead column="actualOutput" label="Actual" sort={sort} onSort={onSort} align="right" className="text-right" />
          <SortableHead column="variancePct" label="Variance" sort={sort} onSort={onSort} align="right" className="text-right" />
          <TableHead className="w-12 text-right" aria-label="Drill" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const isFlagged = Math.abs(r.variancePct) > 5
          return (
            <TableRow
              key={r.orderId}
              className="cursor-pointer transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <TableCell className="font-mono text-xs text-on-surface-variant">
                <Link
                  to={`${drillRoute}?order=${r.orderId}`}
                  className="block focus-visible:outline-none"
                  aria-label={`Open ${r.orderId}`}
                >
                  {r.orderId}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-on-surface">{r.recipeName}</TableCell>
              <TableCell className="text-sm text-on-surface-variant">
                {r.locationName}
              </TableCell>
              <TableCell className="text-sm text-on-surface-variant tabular-nums">
                {formatDateShort(r.producedOn)}
              </TableCell>
              <TableCell className="text-right text-sm text-on-surface tabular-nums">
                {r.expectedOutput} {r.yieldUnit}
              </TableCell>
              <TableCell className="text-right text-sm text-on-surface tabular-nums">
                {r.actualOutput} {r.yieldUnit}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {isFlagged ? (
                  <StatusPill
                    status="status_variance_flagged"
                    label={formatPct(r.variancePct)}
                    size="sm"
                  />
                ) : (
                  <span
                    className={
                      r.variancePct < 0 ? 'text-on-surface-variant' : 'text-on-surface'
                    }
                  >
                    {formatPct(r.variancePct)}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  to={`${drillRoute}?order=${r.orderId}`}
                  aria-label={`Drill into ${r.orderId}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Summary
          </TableCell>
          <TableCell className="text-xs text-on-surface-variant" colSpan={5}>
            {rows.length} orders · {flagged} flagged (variance &gt; 5 %)
          </TableCell>
          <TableCell className="text-right text-sm font-semibold text-on-surface tabular-nums">
            mean {formatPct(meanVariance)}
          </TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub renderer (Phase 4 reports)
// ─────────────────────────────────────────────────────────────────────────────

function StubResultPlaceholder({ meta }: { meta: ReportMeta }) {
  return (
    <div className="rounded-md bg-surface-container-lowest p-10 text-center">
      <Inbox className="mx-auto h-10 w-10 text-on-surface-variant" aria-hidden />
      <p className="mt-3 text-base font-semibold text-on-surface">
        {meta.name}
      </p>
      <p className="mt-1 text-sm text-on-surface-variant">
        Result preview ships in Phase 4 with {meta.originatingEpic}. The runner
        chrome above is the canonical contract — filter set, scope, summary
        tiles, drill-through pattern, export are shared across all reports.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiles per report
// ─────────────────────────────────────────────────────────────────────────────

interface SummaryTile {
  readonly label: string
  readonly value: React.ReactNode
  readonly secondary: React.ReactNode
  readonly severity?: 'neutral' | 'warning' | 'error' | 'success'
}

function purchaseRegisterTiles(
  rows: ReadonlyArray<PurchaseRegisterRow>,
  periodLabel: string,
): ReadonlyArray<SummaryTile> {
  const total = rows.reduce((acc, r) => acc + r.value, 0)
  const distinctVendors = new Set(rows.map((r) => r.vendorName)).size
  const flagged = rows.filter((r) => r.status === 'gr_rejected' || r.status === 'cancelled').length
  return [
    {
      label: 'Total PO value',
      value: <INRValue value={total} />,
      secondary: <>{periodLabel} · {rows.length} POs</>,
    },
    {
      label: 'Distinct vendors',
      value: distinctVendors,
      secondary: <>across active POs</>,
    },
    {
      label: 'Rejected / cancelled',
      value: flagged,
      secondary: <>POs requiring follow-up</>,
      severity: flagged > 0 ? 'warning' : 'neutral',
    },
  ]
}

function inventoryMovementTiles(
  rows: ReadonlyArray<InventoryMovementRow>,
  periodLabel: string,
): ReadonlyArray<SummaryTile> {
  const totalReceived = rows.reduce((acc, r) => acc + r.received, 0)
  const totalDispatched = rows.reduce((acc, r) => acc + r.dispatched, 0)
  const netDelta = rows.reduce((acc, r) => acc + r.netDelta, 0)
  return [
    {
      label: 'Total received',
      value: <span>+{totalReceived}</span>,
      secondary: <>{periodLabel} · {rows.length} items</>,
      severity: 'success',
    },
    {
      label: 'Total dispatched',
      value: <span>-{totalDispatched}</span>,
      secondary: <>across the active scope</>,
    },
    {
      label: 'Net Δ',
      value: <span>{netDelta >= 0 ? `+${netDelta}` : netDelta}</span>,
      secondary: <>opening to closing</>,
      severity: netDelta < 0 ? 'error' : 'neutral',
    },
  ]
}

function productionYieldTiles(
  rows: ReadonlyArray<ProductionYieldRow>,
  periodLabel: string,
): ReadonlyArray<SummaryTile> {
  const flagged = rows.filter((r) => Math.abs(r.variancePct) > 5).length
  const mean = rows.reduce((acc, r) => acc + r.variancePct, 0) / rows.length
  const worst = rows.reduce(
    (acc, r) => (Math.abs(r.variancePct) > Math.abs(acc) ? r.variancePct : acc),
    0,
  )
  return [
    {
      label: 'Production orders',
      value: rows.length,
      secondary: <>{periodLabel} · across recipes</>,
    },
    {
      label: 'Variance flagged',
      value: flagged,
      secondary: <>variance &gt; 5 %</>,
      severity: flagged > 0 ? 'warning' : 'neutral',
    },
    {
      label: 'Mean variance',
      value: <span>{formatPct(mean)}</span>,
      secondary: <>worst {formatPct(worst)}</>,
      severity: Math.abs(mean) > 3 ? 'warning' : 'neutral',
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiRpt005() {
  const [reportKey, setReportKey] = useState<ReportKey>('purchase_register')
  const [period, setPeriod] = useState<PeriodKey>('last30')
  const [pendingPeriod, setPendingPeriod] = useState<PeriodKey | null>(null)
  const [scope, setScope] = useState<ScopeLevel>('brand')
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const meta = REPORTS_BY_KEY[reportKey]

  const handleReportChange = (k: ReportKey) => {
    setReportKey(k)
    setSort(null)
    setGroupBy(null)
    setPage(1)
  }

  const handlePeriodPending = (k: PeriodKey) => {
    setPendingPeriod(k)
  }

  const handleRerun = () => {
    if (pendingPeriod) {
      setPeriod(pendingPeriod)
      setPendingPeriod(null)
      setPage(1)
    }
  }

  const updateFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const handleSort = (column: string) => {
    setSort((current) => {
      if (current?.column === column) {
        return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { column, direction: 'asc' }
    })
  }

  const handleSavedFilterPick = (s: SavedFilter) => {
    handleReportChange(s.report)
  }

  const handleSavedFilterSave = (_name: string) => {
    // Visual contract only — Phase 4 wires real persistence.
  }

  // Tiles per active report
  const tiles: ReadonlyArray<SummaryTile> = useMemo(() => {
    const periodLabel = PERIOD_LABEL[period]
    if (reportKey === 'purchase_register') {
      return purchaseRegisterTiles(purchaseRegisterRows, periodLabel)
    }
    if (reportKey === 'inventory_movement') {
      return inventoryMovementTiles(inventoryMovementRows, periodLabel)
    }
    if (reportKey === 'production_yield_variance') {
      return productionYieldTiles(productionYieldRows, periodLabel)
    }
    return [
      {
        label: 'Result rows',
        value: '—',
        secondary: <>Resolver lands in Phase 4</>,
      },
      {
        label: 'Period',
        value: <span className="text-on-surface">{periodLabel}</span>,
        secondary: <>{SCOPE_LEVEL_LABEL[scope]}</>,
      },
    ]
  }, [reportKey, period, scope])

  // Total rows count for pagination footer (visual only)
  const totalRows = useMemo(() => {
    if (reportKey === 'purchase_register') return purchaseRegisterRows.length
    if (reportKey === 'inventory_movement') return inventoryMovementRows.length
    if (reportKey === 'production_yield_variance') return productionYieldRows.length
    return 0
  }, [reportKey])

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  const anyFilterActive =
    filters.itemIds.size > 0 ||
    filters.vendorIds.size > 0 ||
    filters.customerIds.size > 0 ||
    filters.categories.size > 0

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-6 py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Analytics &amp; Reporting · Operational
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              {meta.name}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Run any FR106 operational report against parametrised filters with
              shared chrome — period, scope, item, vendor, customer, category.
              Every row drills to its source TRN in the originating epic.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SchedulePopover />
            <ExportTrigger entityLabel="report result" formats={['csv', 'excel', 'pdf']} />
          </div>
        </header>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
          <span>
            Last run: 6 May 2026, 09:42 IST
          </span>
          <span aria-hidden>·</span>
          <span>Rendered in 1.4 s</span>
          <span aria-hidden>·</span>
          <span>FR106 target &lt; 3 s</span>
          {meta.status === 'phase4_stub' ? (
            <>
              <span aria-hidden>·</span>
              <span className="rounded-pill bg-surface-container px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                Phase 4 — {meta.originatingEpic}
              </span>
            </>
          ) : null}
        </div>

        {/* Report-picker + group-by + saved-filters strip */}
        <section
          aria-label="Report picker"
          className="mt-6 rounded-md bg-surface-container-low p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <ReportPicker value={reportKey} onChange={handleReportChange} />
            <GroupByPicker
              options={meta.groupByOptions}
              value={groupBy}
              onChange={setGroupBy}
            />
            <SavedFiltersPicker
              current={reportKey}
              onPick={handleSavedFilterPick}
              onSave={handleSavedFilterSave}
            />
            <span className="ml-auto text-xs text-on-surface-variant">
              {meta.subtitle}
            </span>
          </div>
        </section>

        {/* Shared filter chrome */}
        <section
          aria-label="Report filters"
          className="mt-4 rounded-md bg-surface-container-low p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker
              value={pendingPeriod ?? period}
              onChange={handlePeriodPending}
            />
            <ScopePicker value={scope} onChange={setScope} />

            {meta.pickers.has('item') ? (
              <FilterChipPicker
                title="Item"
                options={ITEM_OPTIONS}
                selected={filters.itemIds}
                onToggle={(v) => updateFilter('itemIds', toggleSet(filters.itemIds, v))}
                onClear={() => updateFilter('itemIds', new Set())}
              />
            ) : null}
            {meta.pickers.has('vendor') ? (
              <FilterChipPicker
                title="Vendor"
                options={VENDOR_OPTIONS}
                selected={filters.vendorIds}
                onToggle={(v) =>
                  updateFilter('vendorIds', toggleSet(filters.vendorIds, v))
                }
                onClear={() => updateFilter('vendorIds', new Set())}
              />
            ) : null}
            {meta.pickers.has('customer') ? (
              <FilterChipPicker
                title="Customer"
                options={CUSTOMER_OPTIONS}
                selected={filters.customerIds}
                onToggle={(v) =>
                  updateFilter('customerIds', toggleSet(filters.customerIds, v))
                }
                onClear={() => updateFilter('customerIds', new Set())}
              />
            ) : null}
            {meta.pickers.has('category') ? (
              <FilterChipPicker
                title="Category"
                options={CATEGORY_OPTIONS}
                selected={filters.categories}
                onToggle={(v) =>
                  updateFilter('categories', toggleSet(filters.categories, v))
                }
                onClear={() => updateFilter('categories', new Set())}
              />
            ) : null}

            <div className="ml-auto flex items-center gap-2">
              {pendingPeriod && pendingPeriod !== period ? (
                <Button
                  size="sm"
                  className="h-9 px-3 gap-1.5"
                  onClick={handleRerun}
                  aria-label="Re-run report with the updated period"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  <span className="text-xs">Re-run</span>
                </Button>
              ) : null}
              {anyFilterActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 gap-1"
                  onClick={() => setFilters(INITIAL_FILTERS)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  <span className="text-xs">Reset filters</span>
                </Button>
              ) : null}
            </div>
          </div>

          {/* Active parameter chips strip */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            <span className="text-[11px] font-medium uppercase tracking-wider">
              Active parameters
            </span>
            <span className="rounded-pill bg-surface-container px-2 py-0.5 text-[11px] text-on-surface">
              {PERIOD_LABEL[period]} ({PERIOD_DAYS[period]} d)
            </span>
            <span className="rounded-pill bg-surface-container px-2 py-0.5 text-[11px] text-on-surface">
              {SCOPE_LEVEL_LABEL[scope]}
            </span>
            {filters.itemIds.size > 0 ? (
              <span className="rounded-pill bg-surface-container px-2 py-0.5 text-[11px] text-on-surface">
                {filters.itemIds.size} items
              </span>
            ) : null}
            {filters.vendorIds.size > 0 ? (
              <span className="rounded-pill bg-surface-container px-2 py-0.5 text-[11px] text-on-surface">
                {filters.vendorIds.size} vendors
              </span>
            ) : null}
            {filters.customerIds.size > 0 ? (
              <span className="rounded-pill bg-surface-container px-2 py-0.5 text-[11px] text-on-surface">
                {filters.customerIds.size} customers
              </span>
            ) : null}
            {filters.categories.size > 0 ? (
              <span className="rounded-pill bg-surface-container px-2 py-0.5 text-[11px] text-on-surface">
                {filters.categories.size} categories
              </span>
            ) : null}
            {groupBy ? (
              <span className="rounded-pill bg-surface-container px-2 py-0.5 text-[11px] text-on-surface">
                Group by · {groupBy}
              </span>
            ) : null}
          </div>
        </section>

        {/* Aggregate summary tiles — CC-DASHBOARD-TILE per inventory line 5817 */}
        <section
          aria-label="Aggregate summary"
          className="mt-6 grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3"
        >
          {tiles.map((t, i) => (
            <DashboardTile
              key={`${reportKey}-tile-${i}`}
              label={t.label}
              value={t.value}
              secondary={t.secondary}
              severity={t.severity}
            />
          ))}
        </section>

        {/* Result region */}
        <section
          aria-label="Report result"
          className="mt-6"
        >
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">Result</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {totalRows > 0
                ? `${totalRows.toLocaleString('en-IN')} rows in window`
                : 'Result resolves in originating epic'}
            </span>
          </header>

          {meta.status === 'phase4_stub' ? (
            <StubResultPlaceholder meta={meta} />
          ) : reportKey === 'purchase_register' ? (
            <PurchaseRegisterTable
              rows={purchaseRegisterRows}
              drillRoute={meta.drillRoute}
              sort={sort}
              onSort={handleSort}
            />
          ) : reportKey === 'inventory_movement' ? (
            <InventoryMovementTable
              rows={inventoryMovementRows}
              drillRoute={meta.drillRoute}
              sort={sort}
              onSort={handleSort}
            />
          ) : (
            <ProductionYieldTable
              rows={productionYieldRows}
              drillRoute={meta.drillRoute}
              sort={sort}
              onSort={handleSort}
            />
          )}

          {/* Pagination footer (visual only — totalRows / pageSize) */}
          {meta.status === 'ready' ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-container-low px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span className="text-[11px] font-medium uppercase tracking-wider">
                  Page size
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="tonal"
                      size="sm"
                      className="h-8 px-2.5 gap-1 rounded-pill"
                    >
                      <span className="text-xs tabular-nums">{pageSize}</span>
                      <ChevronDown className="h-3 w-3" aria-hidden />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-32 p-1">
                    <ul>
                      {[10, 20, 50, 100].map((s) => (
                        <li key={s}>
                          <button
                            type="button"
                            onClick={() => {
                              setPageSize(s)
                              setPage(1)
                            }}
                            className={[
                              'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between min-h-[36px]',
                              'hover:bg-surface-container-high transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                              s === pageSize ? 'bg-surface-container' : '',
                            ].join(' ')}
                          >
                            <span className="text-sm tabular-nums">{s}</span>
                            {s === pageSize ? (
                              <span className="text-xs text-primary">Active</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="First page"
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                >
                  <ChevronsLeft className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <span className="px-3 text-xs text-on-surface tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Next page"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Last page"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  <ChevronsRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          SI-RPT-005 · Tier 1 Group 1 · Phase 2c-S3 ·
          {' '}
          <Link to="/SI-RPT-002" className="text-primary hover:underline">
            Brand Owner Cross-Location Dashboard
          </Link>
        </footer>
      </div>
    </div>
  )
}
