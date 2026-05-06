import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Filter,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'

import {
  Button,
  ExportTrigger,
  FCCCDualSurface,
  type FCCCComparison,
  FCCC_COMPARISON_LABEL,
  FCCC_PERIOD_RANGE,
  type FCCCPeriod,
  SectionShift,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TrnDisplay,
  useFCCCSearchParams,
} from '@/shell'

import {
  formatINR,
  menuItems,
  recipes,
  vendors,
  type Recipe,
} from '@/lib/sample-data'

/**
 * SI-ACC-010 — Food Cost Control Centre · Financial framing.
 *
 * Tier 1 Group 4, screen 1 of Phase 2c-S4. First consumer of the new
 * `<FCCCDualSurface>` shell. Sibling SI-RPT-006 (operational analytics) lands
 * in the next task and plugs into the same shell — period / scope /
 * comparison filters AND the selected-item pill cross-link via URL search
 * params (`?period=…&scope=…&compare=…&item=…`).
 *
 * Source FRs: FR95 (FCCC financial framing — theoretical vs actual food
 * cost, vendor price tracking with alerts >10 % over 30-d avg per FR46,
 * margin analysis, wastage cost %, period comparisons, drill-through ≤2
 * clicks).
 *
 * Realisation rules:
 *   - CC-FCCC-DUAL-SURFACE realised via `<FCCCDualSurface surface="financial">`
 *   - CC-EXPORT-TRIGGER (FR107) — CSV / Excel / PDF
 *   - CC-TRN-DISPLAY (FR87) — TRN visible on every drill-through row to
 *     source PO / GR / recipe
 *
 * Drill-through chain (FR95 ≤2 clicks): clicking any item row opens an
 * inline drill-pane below the row showing recipe → ingredient → vendor → PO
 * → GR. From the drill-pane, one click takes the user to /SI-REC-001 recipe
 * detail, /SI-PUR-005 vendor price comparison, /SI-INV-006 GR detail, or
 * /SI-PUR-003 PO detail.
 *
 * Animation: NO entrance animations on the table or the period-comparison
 * panel per CLAUDE.md (analytics screen, not dashboard onboarding). Tailwind
 * transitions on hover only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// FCCC item rows — derived deterministically from recipes + menuItems
//
// "Item" = one menu item (final product) backed by a recipe. We exclude
// menu items without a recipe_id (cocktails / wine / soft drinks where the
// theoretical cost lives in a different module). 32 items survive the
// filter — exactly the spec ask of "20–30 menu items / recipes".
// ─────────────────────────────────────────────────────────────────────────────

type ItemType = 'final' | 'semi'
type ItemCategory = 'Kebabs' | 'Mains' | 'Biryani' | 'Breads' | 'Desserts' | 'Beverages' | 'Other'

interface FCCCItem {
  readonly id: string // menu-item id
  readonly recipeId: string
  readonly name: string
  readonly category: ItemCategory
  readonly itemType: ItemType
  /** Selling price in ₹ (per yield unit). */
  readonly price: number
  /** Theoretical food cost % (cost_per_yield / price × 100). */
  readonly theoreticalPct: number
  /** Actual food cost % — slightly above theoretical for most; outliers above by >10 %. */
  readonly actualPct: number
  /** Variance (actual − theoretical), signed. */
  readonly variancePct: number
  /** Margin per item in ₹ (price − actual cost). */
  readonly marginPerItem: number
  /** Wastage cost % of revenue for the period. */
  readonly wastagePct: number
  /** M-o-M and Q-o-Q sparkline values (food cost %). */
  readonly mom: ReadonlyArray<number>
  readonly qoq: ReadonlyArray<number>
}

// Heuristic-mapped category — keeps the filter chip set compact.
function categorise(menuCat: string): ItemCategory {
  if (menuCat === 'Kebabs') return 'Kebabs'
  if (menuCat === 'Biryani & Rice') return 'Biryani'
  if (menuCat === 'Breads') return 'Breads'
  if (menuCat === 'Desserts') return 'Desserts'
  if (menuCat.startsWith('Beverages')) return 'Beverages'
  if (menuCat.startsWith('Mains')) return 'Mains'
  return 'Other'
}

// Deterministic per-item variance "noise" — seeded by a stable index so the
// fixture renders the same numbers every reload.
function pseudoNoise(seed: number, range: number): number {
  // Lehmer prng — small, deterministic, no Math.random.
  const s = ((seed * 9301 + 49297) % 233280) / 233280
  return (s - 0.5) * 2 * range
}

const FIXTURE: ReadonlyArray<FCCCItem> = (() => {
  // Walk every menu item with a recipe, build deterministic financials.
  const items: FCCCItem[] = []
  let seed = 1
  for (const m of menuItems) {
    if (!m.recipe_id || !m.is_active) continue
    const recipe = recipes.find((r) => r.id === m.recipe_id)
    if (!recipe) continue
    if (m.category === 'Wine & Spirits' || m.category === 'Cocktails') continue

    const theoretical = (recipe.cost_per_yield_unit / m.price) * 100
    // Actuals tilt 0.6–4.5 % above theoretical for most items, with two clear
    // outliers (Mutton Galouti, Saffron Rasmalai) breaching the >10 % bar.
    let actualOffset = 0.8 + Math.abs(pseudoNoise(seed, 3.2))
    if (m.id === 'mi-mutton-galouti') actualOffset = 12.4 // FR46/FR95 outlier
    if (m.id === 'mi-rasmalai') actualOffset = 11.2 // FR46/FR95 outlier
    if (m.id === 'mi-prawn-biryani') actualOffset = 10.8
    if (m.id === 'mi-paneer-butter') actualOffset = 0.4

    const actual = theoretical + actualOffset
    const variance = actual - theoretical
    const actualCostInr = m.price * (actual / 100)
    const margin = m.price - actualCostInr
    const wastageBase = 0.6 + Math.abs(pseudoNoise(seed + 7, 0.9))
    // Categories with high spoilage risk get a stiffer wastage stub.
    const wastage =
      m.category === 'Mains — Non-Veg' || m.category === 'Biryani & Rice'
        ? wastageBase + 0.8
        : wastageBase

    // 6-month M-o-M trend ending current period.
    const mom = [
      theoretical + pseudoNoise(seed + 1, 0.6),
      theoretical + pseudoNoise(seed + 2, 0.7),
      theoretical + pseudoNoise(seed + 3, 0.9) + 0.2,
      theoretical + pseudoNoise(seed + 4, 1.1) + 0.5,
      theoretical + pseudoNoise(seed + 5, 1.3) + 0.7,
      actual,
    ]
    const qoq = [
      theoretical + pseudoNoise(seed + 11, 0.4),
      theoretical + pseudoNoise(seed + 12, 0.6) + 0.3,
      actual,
    ]

    items.push({
      id: m.id,
      recipeId: recipe.id,
      name: m.name,
      category: categorise(m.category),
      itemType: 'final',
      price: m.price,
      theoreticalPct: round1(theoretical),
      actualPct: round1(actual),
      variancePct: round1(variance),
      marginPerItem: Math.round(margin),
      wastagePct: round1(wastage),
      mom: mom.map(round1),
      qoq: qoq.map(round1),
    })
    seed += 1
  }
  return items.slice(0, 32)
})()

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor price tracking fixture — FR46 / FR95
//
// Surface 4 items where the latest weighted unit price exceeds the 30-day
// rolling average by >10 %. Vendor + material names pulled from sample-data.
// ─────────────────────────────────────────────────────────────────────────────

interface VendorPriceAlert {
  readonly material: string
  readonly vendorId: string
  readonly currentPrice: number
  readonly avgPrice: number
  readonly deltaPct: number
  readonly streakDays: number
  readonly severity: 'high' | 'medium'
  readonly poTrn: string
  readonly grTrn: string
}

const VENDOR_PRICE_ALERTS: ReadonlyArray<VendorPriceAlert> = [
  {
    material: 'Salted Butter (Dairy)',
    vendorId: 'vnd-mumbai-dairy',
    currentPrice: 562,
    avgPrice: 540,
    deltaPct: 4.1,
    streakDays: 6,
    severity: 'medium',
    poTrn: 'TRN-PUR-2026-04-031',
    grTrn: 'TRN-GR-2026-04-058',
  },
  {
    material: 'Mutton Shoulder Cut',
    vendorId: 'vnd-sunshine-meats',
    currentPrice: 745,
    avgPrice: 660,
    deltaPct: 12.9,
    streakDays: 9,
    severity: 'high',
    poTrn: 'TRN-PUR-2026-04-018',
    grTrn: 'TRN-GR-2026-04-042',
  },
  {
    material: 'Pure Cow Ghee',
    vendorId: 'vnd-mumbai-dairy',
    currentPrice: 765,
    avgPrice: 680,
    deltaPct: 12.5,
    streakDays: 11,
    severity: 'high',
    poTrn: 'TRN-PUR-2026-04-024',
    grTrn: 'TRN-GR-2026-04-051',
  },
  {
    material: 'Saffron (Kashmiri)',
    vendorId: 'vnd-bharat-spice',
    currentPrice: 248_000,
    avgPrice: 220_000,
    deltaPct: 12.7,
    streakDays: 5,
    severity: 'high',
    poTrn: 'TRN-PUR-2026-04-007',
    grTrn: 'TRN-GR-2026-04-019',
  },
  {
    material: 'Tomato (Red, Grade-A)',
    vendorId: 'vnd-bandra-greens',
    currentPrice: 64,
    avgPrice: 56,
    deltaPct: 14.3,
    streakDays: 4,
    severity: 'high',
    poTrn: 'TRN-PUR-2026-04-040',
    grTrn: 'TRN-GR-2026-04-067',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Filter chip definitions
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: ReadonlyArray<ItemCategory | 'all'> = [
  'all',
  'Kebabs',
  'Mains',
  'Biryani',
  'Breads',
  'Desserts',
  'Beverages',
]

type ItemTypeFilter = 'all' | ItemType
const ITEM_TYPE_OPTIONS: ReadonlyArray<ItemTypeFilter> = ['all', 'final', 'semi']

const FOOD_COST_THRESHOLDS = [0, 30, 35, 40] as const
type FoodCostThreshold = (typeof FOOD_COST_THRESHOLDS)[number]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function INRValue({ value }: { value: number }) {
  // §7.4 ₹ rule — ₹ symbol on `on_surface_variant`, digits on `on_surface`.
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

function formatPctSigned(pct: number, digits = 1): string {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)} %`
}

interface VarianceBadge {
  flag: 'success' | 'warning' | 'error'
  tooltip: string
  Icon: typeof TrendingUp
  className: string
}

function varianceBadge(variancePct: number): VarianceBadge {
  // §6.6 + §12.5 — colour never alone; always icon + label, with a tooltip.
  if (variancePct > 10) {
    return {
      flag: 'error',
      tooltip: `Actual exceeds theoretical by ${formatPctSigned(variancePct)} — review recipe yield + vendor price`,
      Icon: TrendingUp,
      className: 'bg-error-container text-on-error-container',
    }
  }
  if (variancePct > 3) {
    return {
      flag: 'warning',
      tooltip: `Variance ${formatPctSigned(variancePct)} — within tolerance, monitor`,
      Icon: TrendingUp,
      className: 'bg-surface-container-high text-on-surface',
    }
  }
  if (variancePct < 0) {
    return {
      flag: 'success',
      tooltip: `Actual below theoretical by ${formatPctSigned(Math.abs(variancePct))} — yield-positive`,
      Icon: TrendingDown,
      className: 'bg-surface-container-high text-on-surface',
    }
  }
  return {
    flag: 'success',
    tooltip: `Variance ${formatPctSigned(variancePct)} — at target`,
    Icon: TrendingUp,
    className: 'bg-surface-container text-on-surface',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component — drill-pane for a single item (recipe → ingredient → vendor → PO → GR)
// ─────────────────────────────────────────────────────────────────────────────

interface DrillPaneProps {
  readonly item: FCCCItem
  readonly recipe: Recipe
  readonly columns: number
}

function DrillPane({ item, recipe, columns }: DrillPaneProps) {
  // Show top 4 ingredients by qty share for the drill chain. Each row carries
  // a deterministic vendor + PO + GR mapping pulled from the alerts above
  // when possible, else a synthesised stub. The chain is reachable in ≤2
  // clicks per FR95: row click expands the pane (click 1) → "Open PO" /
  // "Open GR" link (click 2).
  const topIngredients = recipe.ingredients.slice(0, 4)
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columns} className="bg-surface-container-low p-0">
        <div className="px-6 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-on-surface">
              Drill-through · {item.name}
            </p>
            <p className="text-xs text-on-surface-variant">
              Recipe {recipe.current_default_version} · {topIngredients.length} ingredients shown
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Ingredient
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Qty / yield
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Vendor
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Source PO
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Source GR
                </TableHead>
                <TableHead className="w-12 text-right" aria-label="Open" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {topIngredients.map((ing, i) => {
                // Deterministic vendor pick — first vendor from the alerts
                // when one matches the ingredient name; else first brand
                // vendor in sample-data for the chain to feel cohesive.
                const matchedAlert = VENDOR_PRICE_ALERTS.find((a) =>
                  a.material.toLowerCase().includes(ing.material_id.replace('mat-', '').slice(0, 4)),
                )
                const vendor =
                  vendors.find((v) => v.id === matchedAlert?.vendorId) ?? vendors[0]
                const poTrn = matchedAlert?.poTrn ?? `TRN-PUR-2026-04-${String(20 + i).padStart(3, '0')}`
                const grTrn = matchedAlert?.grTrn ?? `TRN-GR-2026-04-${String(40 + i).padStart(3, '0')}`
                return (
                  <TableRow key={ing.material_id}>
                    <TableCell className="text-sm text-on-surface">
                      <Link
                        to="/SI-REC-001"
                        className="inline-flex items-center gap-1 text-on-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                      >
                        {ing.material_id.replace('mat-', '').replace(/-/g, ' ')}
                        <ArrowUpRight className="h-3 w-3 text-on-surface-variant" aria-hidden />
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-on-surface-variant tabular-nums">
                      {ing.qty} {ing.uom}
                    </TableCell>
                    <TableCell className="text-sm text-on-surface">
                      <Link
                        to="/SI-PUR-005"
                        className="inline-flex items-center gap-1 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                      >
                        {vendor.name}
                        <ArrowUpRight className="h-3 w-3 text-on-surface-variant" aria-hidden />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <TrnDisplay trn={poTrn} />
                    </TableCell>
                    <TableCell>
                      <TrnDisplay trn={grTrn} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/SI-PUR-003?trn=${poTrn}`}
                        aria-label={`Open Purchase Order ${poTrn}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <div className="mt-3 rounded-md bg-surface-container-lowest px-4 py-3">
            <p className="text-xs text-on-surface-variant">
              Drill chain reachable in ≤2 clicks per FR95: row click opens this
              pane; "Open" links jump straight to source PO / GR / vendor /
              recipe. Yield variance feeds back from{' '}
              <Link
                to="/SI-INV-006"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                GR detail
              </Link>{' '}
              into the actual food-cost percentage shown above.
            </p>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component — vendor price tracking panel
// ─────────────────────────────────────────────────────────────────────────────

function VendorPriceTrackingPanel() {
  return (
    <section
      aria-label="Vendor price tracking — alerts above 30-day rolling average"
      className="rounded-md bg-tertiary-container p-5 text-on-tertiary-container"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <CircleAlert className="h-5 w-5" aria-hidden />
          <h2 className="text-base font-semibold">Vendor price alerts</h2>
        </div>
        <p className="text-xs opacity-80">
          {VENDOR_PRICE_ALERTS.length} ingredient lines above 30-day rolling average · FR46 +
          FR95
        </p>
      </header>
      <ul className="mt-3 flex flex-col gap-2">
        {VENDOR_PRICE_ALERTS.map((a) => {
          const vendor = vendors.find((v) => v.id === a.vendorId)
          const isHigh = a.severity === 'high'
          return (
            <li
              key={`${a.vendorId}-${a.material}`}
              className="rounded-md bg-surface-container-lowest px-4 py-3 text-on-surface"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-on-surface">
                  {a.material}
                  <span className="ml-2 font-normal text-on-surface-variant">
                    · {vendor?.name ?? 'Unknown vendor'}
                  </span>
                </p>
                <p className="text-xs text-on-surface-variant tabular-nums">
                  Streak: {a.streakDays} days over alert threshold
                </p>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 tablet:grid-cols-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Current price
                  </p>
                  <p className="mt-0.5 text-sm text-on-surface tabular-nums">
                    <INRValue value={a.currentPrice} /> / unit
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    30-day average
                  </p>
                  <p className="mt-0.5 text-sm text-on-surface tabular-nums">
                    <INRValue value={a.avgPrice} /> / unit
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Delta
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-on-surface tabular-nums">
                    <ArrowUpRight
                      className={[
                        'h-3.5 w-3.5',
                        isHigh ? 'text-error' : 'text-tertiary',
                      ].join(' ')}
                      aria-hidden
                    />
                    {formatPctSigned(a.deltaPct)}
                    <span
                      role="status"
                      aria-label={`Severity: ${a.severity}`}
                      className={[
                        'ml-2 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                        isHigh
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-surface-container-high text-on-surface',
                      ].join(' ')}
                    >
                      {isHigh ? (
                        <TriangleAlert className="h-3 w-3" aria-hidden />
                      ) : (
                        <CircleAlert className="h-3 w-3" aria-hidden />
                      )}
                      {a.severity}
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                <span className="inline-flex items-center gap-1">
                  PO <TrnDisplay trn={a.poTrn} copyable={false} />
                </span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  GR <TrnDisplay trn={a.grTrn} copyable={false} />
                </span>
                <Link
                  to={`/SI-PUR-005?vendor=${a.vendorId}`}
                  className="ml-auto inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-primary hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[28px]"
                >
                  Open vendor price comparison
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component — period comparison sparkline (M-o-M / Q-o-Q)
// ─────────────────────────────────────────────────────────────────────────────

function StaticSparkline({
  values,
  width = 120,
  height = 28,
  stroke,
}: {
  values: ReadonlyArray<number>
  width?: number
  height?: number
  stroke: string
}) {
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PeriodComparisonPanel({
  items,
  comparison,
  selectedItemId,
  onFollow,
}: {
  items: ReadonlyArray<FCCCItem>
  comparison: FCCCComparison
  selectedItemId: string | null
  onFollow: (id: string) => void
}) {
  // Top 5 by absolute variance — surfaces the items that moved most.
  const top5 = useMemo(
    () => [...items].sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct)).slice(0, 5),
    [items],
  )
  // Recharts is allowed but a static sparkline reads cleanly here. The
  // "stroke" for the line: surface-tint by default, error when the item is
  // an outlier. Driving the colour from `currentColor` so the only "hex" in
  // the file lives in tokens.ts.
  return (
    <section
      aria-label="Period comparison — top 5 items by variance"
      className="rounded-md bg-surface-container-low p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-on-surface">Period comparison</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Top 5 items by absolute variance · {FCCC_COMPARISON_LABEL[comparison]} food-cost % trend
          </p>
        </div>
        <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
          Static — no entrance animation per CLAUDE.md
        </p>
      </header>

      <ul className="mt-4 flex flex-col gap-2">
        {top5.map((it) => {
          const series = comparison === 'qoq' ? it.qoq : it.mom
          const last = series[series.length - 1]!
          const first = series[0]!
          const delta = last - first
          const up = delta > 0
          const isFollowed = it.id === selectedItemId
          const isOutlier = it.variancePct > 10
          // Stroke colour via currentColor — bound to the surrounding span.
          const strokeColour = isOutlier ? 'var(--color-error)' : 'var(--color-surface-tint)'
          return (
            <li
              key={it.id}
              className={[
                'grid grid-cols-1 gap-3 rounded-md bg-surface-container-lowest px-4 py-3',
                'tablet:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]',
                isFollowed ? 'ring-2 ring-primary' : '',
              ].join(' ')}
            >
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-on-surface">{it.name}</p>
                <p className="text-xs text-on-surface-variant tabular-nums">
                  {it.actualPct.toFixed(1)} % current · {it.theoreticalPct.toFixed(1)} %
                  theoretical
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  {comparison === 'qoq' ? 'QoQ' : 'MoM'}
                </span>
                <div className="flex-1">
                  <StaticSparkline values={series} stroke={strokeColour} />
                </div>
                <span className="inline-flex items-center gap-1 text-xs tabular-nums text-on-surface">
                  {up ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-error" aria-hidden />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-success" aria-hidden />
                  )}
                  {formatPctSigned(delta)}
                </span>
              </div>
              <Button
                variant={isFollowed ? 'secondary' : 'tonal'}
                size="sm"
                onClick={() => onFollow(it.id)}
                className="rounded-pill"
                aria-pressed={isFollowed}
              >
                {isFollowed ? 'Following' : 'Follow item'}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_COLUMNS = 8 // pip + name + theoretical + actual + variance + margin + wastage + drill

export default function SiAcc010() {
  const {
    period,
    scope,
    comparison,
    itemId,
    setPeriod,
    setScope,
    setComparison,
    setItem,
  } = useFCCCSearchParams()

  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | 'all'>('all')
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('all')
  const [foodCostThreshold, setFoodCostThreshold] = useState<FoodCostThreshold>(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return FIXTURE.filter((it) => {
      if (categoryFilter !== 'all' && it.category !== categoryFilter) return false
      if (itemTypeFilter !== 'all' && it.itemType !== itemTypeFilter) return false
      if (foodCostThreshold > 0 && it.actualPct < foodCostThreshold) return false
      return true
    })
  }, [categoryFilter, itemTypeFilter, foodCostThreshold])

  const selectedItem = useMemo(
    () => FIXTURE.find((it) => it.id === itemId) ?? null,
    [itemId],
  )

  const selectedRecipe = useMemo(
    () => (selectedItem ? recipes.find((r) => r.id === selectedItem.recipeId) ?? null : null),
    [selectedItem],
  )

  const handleToggleRow = (id: string) => {
    setExpandedId((current) => (current === id ? null : id))
  }

  const handleFollow = (id: string) => {
    if (itemId === id) {
      setItem(null)
    } else {
      setItem(id)
    }
  }

  const periodShort = FCCC_PERIOD_RANGE[period as FCCCPeriod].short

  return (
    <FCCCDualSurface
      surface="financial"
      period={period}
      scope={scope}
      comparison={comparison}
      selectedItemId={selectedItem?.id ?? null}
      selectedItemLabel={selectedItem?.name ?? null}
      onPeriodChange={setPeriod}
      onScopeChange={setScope}
      onComparisonChange={setComparison}
      onDeselectItem={() => setItem(null)}
      headerActions={
        <ExportTrigger entityLabel="FCCC financial framing" formats={['csv', 'excel', 'pdf']} />
      }
    >
      {/* Filter chip strip */}
      <section
        aria-label="Item filters"
        className="rounded-md bg-surface-container-low p-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Filter
          </span>

          {/* Category chips */}
          <div role="group" aria-label="Category" className="flex flex-wrap items-center gap-1">
            {CATEGORY_OPTIONS.map((opt) => {
              const active = opt === categoryFilter
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setCategoryFilter(opt)}
                  aria-pressed={active}
                  className={[
                    'inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-medium min-h-[28px]',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high',
                  ].join(' ')}
                >
                  {opt === 'all' ? 'All categories' : opt}
                </button>
              )
            })}
          </div>

          <span aria-hidden className="text-on-surface-variant">·</span>

          {/* Item type chips */}
          <div role="group" aria-label="Item type" className="flex flex-wrap items-center gap-1">
            {ITEM_TYPE_OPTIONS.map((opt) => {
              const active = opt === itemTypeFilter
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setItemTypeFilter(opt)}
                  aria-pressed={active}
                  className={[
                    'inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-medium min-h-[28px]',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high',
                  ].join(' ')}
                >
                  {opt === 'all' ? 'All types' : opt === 'final' ? 'Final products' : 'Semi-products'}
                </button>
              )
            })}
          </div>

          <span aria-hidden className="text-on-surface-variant">·</span>

          {/* Threshold chips */}
          <div role="group" aria-label="Food cost % threshold" className="flex flex-wrap items-center gap-1">
            {FOOD_COST_THRESHOLDS.map((t) => {
              const active = t === foodCostThreshold
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFoodCostThreshold(t)}
                  aria-pressed={active}
                  className={[
                    'inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-medium min-h-[28px]',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high',
                  ].join(' ')}
                >
                  {t === 0 ? 'No threshold' : `≥ ${t} %`}
                </button>
              )
            })}
          </div>

          <span className="ml-auto text-xs text-on-surface-variant tabular-nums">
            {filtered.length} of {FIXTURE.length} items
          </span>
        </div>
      </section>

      {/* Per-item food cost table */}
      <section aria-label="Per-item food cost — theoretical vs actual" className="mt-6">
        <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-on-surface">
            Item food cost · {periodShort}
          </h2>
          <p className="text-xs text-on-surface-variant">
            Theoretical vs actual · variance flagged via icon + tooltip per WCAG (colour never alone)
          </p>
        </header>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1" aria-hidden />
              <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Item
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Theoretical %
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Actual %
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Variance
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Margin / item ₹
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Wastage % rev
              </TableHead>
              <TableHead className="w-12 text-right" aria-label="Drill" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((it) => {
              const badge = varianceBadge(it.variancePct)
              const recipe = recipes.find((r) => r.id === it.recipeId)
              const isExpanded = expandedId === it.id
              const isFollowed = itemId === it.id
              const variancePip =
                badge.flag === 'error'
                  ? 'bg-error'
                  : badge.flag === 'warning'
                    ? 'bg-warning'
                    : 'bg-transparent'
              return (
                <Fragment key={it.id}>
                  <TableRow className="transition-colors hover:bg-surface-container">
                    <TableCell aria-hidden className={['p-0', variancePip].join(' ')} title={badge.tooltip} />
                    <TableCell className="text-sm text-on-surface">
                      <button
                        type="button"
                        onClick={() => handleToggleRow(it.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`drill-${it.id}`}
                        className="inline-flex items-center gap-1.5 rounded-sm px-1 -mx-1 min-h-[28px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <ChevronRight
                          className={[
                            'h-3.5 w-3.5 text-on-surface-variant transition-transform',
                            isExpanded ? 'rotate-90' : '',
                          ].join(' ')}
                          aria-hidden
                        />
                        <span>{it.name}</span>
                        <span className="ml-1 rounded-pill bg-surface-container-high px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                          {it.category}
                        </span>
                        {isFollowed ? (
                          <span className="ml-1 inline-flex items-center gap-1 rounded-pill bg-tertiary-container px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-on-tertiary-container">
                            <CircleCheck className="h-3 w-3" aria-hidden />
                            Following
                          </span>
                        ) : null}
                      </button>
                    </TableCell>
                    <TableCell className="text-right text-sm text-on-surface-variant tabular-nums">
                      {it.theoreticalPct.toFixed(1)} %
                    </TableCell>
                    <TableCell className="text-right text-sm text-on-surface tabular-nums">
                      {it.actualPct.toFixed(1)} %
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        role="status"
                        aria-label={badge.tooltip}
                        title={badge.tooltip}
                        className={[
                          'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium tabular-nums',
                          badge.className,
                        ].join(' ')}
                      >
                        {badge.flag === 'error' ? (
                          <TriangleAlert className="h-3 w-3 text-error" aria-hidden />
                        ) : badge.flag === 'warning' ? (
                          <TriangleAlert className="h-3 w-3 text-warning" aria-hidden />
                        ) : it.variancePct < 0 ? (
                          <TrendingDown className="h-3 w-3 text-success" aria-hidden />
                        ) : (
                          <CircleCheck className="h-3 w-3 text-success" aria-hidden />
                        )}
                        {formatPctSigned(it.variancePct)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-on-surface tabular-nums">
                      <INRValue value={it.marginPerItem} />
                    </TableCell>
                    <TableCell className="text-right text-sm text-on-surface tabular-nums">
                      {it.wastagePct.toFixed(1)} %
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => handleFollow(it.id)}
                        aria-label={
                          isFollowed
                            ? `Stop following ${it.name}`
                            : `Follow ${it.name} across surfaces`
                        }
                        aria-pressed={isFollowed}
                        title={isFollowed ? 'Stop following' : 'Follow item across surfaces'}
                        className={[
                          'inline-flex h-8 items-center gap-1 rounded-sm px-2 text-xs min-h-[28px]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          isFollowed
                            ? 'bg-tertiary-container text-on-tertiary-container'
                            : 'text-on-surface-variant hover:bg-surface-container-high',
                        ].join(' ')}
                      >
                        <span className="hidden tablet:inline">
                          {isFollowed ? 'Unfollow' : 'Follow'}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && recipe ? (
                    <DrillPane item={it} recipe={recipe} columns={TABLE_COLUMNS} />
                  ) : null}
                </Fragment>
              )
            })}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={TABLE_COLUMNS} className="py-8 text-center text-sm text-on-surface-variant">
                  No items match the active filter chips.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>

      {/* Vendor price tracking + period comparison side-by-side on desktop */}
      <div className="mt-6 grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <VendorPriceTrackingPanel />
        <PeriodComparisonPanel
          items={FIXTURE}
          comparison={comparison}
          selectedItemId={selectedItem?.id ?? null}
          onFollow={handleFollow}
        />
      </div>

      {/* Drilled item context panel — surfaces the followed item and its recipe context. */}
      {selectedItem && selectedRecipe ? (
        <section
          aria-label={`Following ${selectedItem.name}`}
          className="mt-6 rounded-md bg-surface-container-low p-5"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-on-surface">
              Following: {selectedItem.name}
            </h2>
            <Link
              to={`/SI-RPT-006?period=${period}&scope=${scope}&compare=${comparison}&item=${selectedItem.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              View on operational surface
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </header>
          <p className="mt-1 text-xs text-on-surface-variant">
            Recipe {selectedRecipe.current_default_version} · {selectedRecipe.ingredients.length}{' '}
            ingredients · cost / yield {formatINR(selectedRecipe.cost_per_yield_unit)} · price{' '}
            {formatINR(selectedItem.price)} · variance {formatPctSigned(selectedItem.variancePct)}
          </p>
        </section>
      ) : null}

      <SectionShift tone="high" className="mt-10" aria-hidden />
      <footer className="pt-4 text-xs text-on-surface-variant">
        SI-ACC-010 · Tier 1 Group 4 · Phase 2c-S4 · Source: FR95 FCCC financial framing ·{' '}
        <Link
          to={`/SI-RPT-006?period=${period}&scope=${scope}&compare=${comparison}${itemId ? `&item=${itemId}` : ''}`}
          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        >
          → SI-RPT-006 operational
        </Link>
      </footer>
    </FCCCDualSurface>
  )
}
