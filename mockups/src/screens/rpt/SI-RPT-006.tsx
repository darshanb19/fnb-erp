import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Lightbulb,
  Recycle,
  RefreshCcw,
  Repeat,
  Sparkles,
  Target,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'

import {
  Button,
  DashboardTile,
  ExportTrigger,
  FCCCDualSurface,
  FCCC_PERIOD_RANGE,
  type FCCCPeriod,
  SectionShift,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useFCCCSearchParams,
} from '@/shell'

import {
  formatINR,
  menuItems,
  recipes,
  type Recipe,
} from '@/lib/sample-data'

/**
 * SI-RPT-006 — Food Cost Control Centre · Operational analytics framing.
 *
 * Tier 1 Group 4, screen 2 of Phase 2c-S4. Operational half of
 * CC-FCCC-DUAL-SURFACE — partner of SI-ACC-010 (financial). Plugs into the
 * shared `<FCCCDualSurface>` shell shipped in be42f73 so the period / scope /
 * comparison filters AND the followed-item state survive a tab switch via URL
 * search params (`?period=…&scope=…&compare=…&item=…`).
 *
 * Source FRs:
 *   - FR108 — FCCC operational analytics framing: cost-per-serving with
 *             threshold alerts (default 35 %, brand-configurable), product
 *             mix Pareto, time-series trends with anomaly highlights,
 *             actionable suggestions surfaced at top, drill-down from item
 *             to recipe / ingredients / vendor / sales / batches.
 *   - FR107 — CC-EXPORT-TRIGGER (CSV / Excel / PDF).
 *   - FR109 — drill from summary to transaction detail (≤2 clicks).
 *
 * Realisation rules:
 *   - CC-FCCC-DUAL-SURFACE realised via `<FCCCDualSurface surface="operational">`.
 *   - CC-DASHBOARD-TILE on the cost-per-serving summary row (3 tiles).
 *   - CC-EXPORT-TRIGGER in the page-header actions slot.
 *   - No CC-AUDIT-LINK — read-only analytics view per inventory entry.
 *
 * Animation: NO entrance animations. CLAUDE.md §10.5 — analytics screens
 * (NOT onboarding / login / marketing) are static. Only Tailwind transitions
 * on hover / focus.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Operational item rows — derived deterministically from recipes + menuItems
// ─────────────────────────────────────────────────────────────────────────────

type OpsCategory =
  | 'Kebabs'
  | 'Mains'
  | 'Biryani'
  | 'Breads'
  | 'Desserts'
  | 'Beverages'
  | 'Other'

interface OpsItem {
  readonly id: string
  readonly recipeId: string
  readonly name: string
  readonly category: OpsCategory
  /** Per-serving selling price in ₹. */
  readonly price: number
  /** Per-serving food cost in ₹ (cost_per_yield_unit, slightly inflated to reflect actuals). */
  readonly costPerServing: number
  /** Cost-per-serving as a percentage of the selling price. */
  readonly costPctOfPrice: number
  /** Margin per serving in ₹. */
  readonly marginPerServing: number
  /** Servings sold across the period. */
  readonly servingsSold: number
  /** Volume × margin contribution (₹). Drives the Pareto. */
  readonly contribution: number
  /** 30-day daily cost-per-serving series — last 30 entries. */
  readonly costSeries: ReadonlyArray<number>
  /** 30-day daily contribution-margin series, in ₹. */
  readonly marginSeries: ReadonlyArray<number>
}

function categorise(menuCat: string): OpsCategory {
  if (menuCat === 'Kebabs') return 'Kebabs'
  if (menuCat === 'Biryani & Rice') return 'Biryani'
  if (menuCat === 'Breads') return 'Breads'
  if (menuCat === 'Desserts') return 'Desserts'
  if (menuCat.startsWith('Beverages')) return 'Beverages'
  if (menuCat.startsWith('Mains')) return 'Mains'
  return 'Other'
}

// Deterministic Lehmer pseudo-noise — no Math.random.
function pseudoNoise(seed: number, range: number): number {
  const s = ((seed * 9301 + 49297) % 233280) / 233280
  return (s - 0.5) * 2 * range
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

const FIXTURE: ReadonlyArray<OpsItem> = (() => {
  const items: OpsItem[] = []
  let seed = 1
  for (const m of menuItems) {
    if (!m.recipe_id || !m.is_active) continue
    const recipe = recipes.find((r) => r.id === m.recipe_id)
    if (!recipe) continue
    if (m.category === 'Wine & Spirits' || m.category === 'Cocktails') continue

    // Bring actuals slightly above theoretical to reflect the FR108 model.
    let actualOffsetPct = 1.4 + Math.abs(pseudoNoise(seed, 2.6))
    if (m.id === 'mi-mutton-galouti') actualOffsetPct = 9.5 // outlier — vendor price spike
    if (m.id === 'mi-rasmalai') actualOffsetPct = 8.6 // outlier — saffron + dairy
    if (m.id === 'mi-prawn-biryani') actualOffsetPct = 7.8
    if (m.id === 'mi-paneer-butter') actualOffsetPct = -0.4 // re-engineered yield-positive

    const theoreticalPct = (recipe.cost_per_yield_unit / m.price) * 100
    const costPct = theoreticalPct + actualOffsetPct
    const costInr = m.price * (costPct / 100)
    const margin = m.price - costInr
    // Servings — signature items + popular categories sell more; deterministic.
    const baseServings = 280 + ((seed * 17) % 420)
    const lift = m.is_signature ? 1.45 : 1.0
    const servings = Math.round(baseServings * lift)
    const contribution = Math.round(margin * servings)

    // 30-day cost-per-serving series — light noise around costInr, with a
    // single planted anomaly on the outlier items (~day 26 spike).
    const costSeries: number[] = []
    const marginSeries: number[] = []
    for (let d = 0; d < 30; d++) {
      const noise = pseudoNoise(seed + d, costInr * 0.06)
      let costDay = costInr + noise
      let marginDay = m.price - costDay
      // Plant anomalies for the outliers — last week spike.
      const isOutlier = m.id === 'mi-mutton-galouti' || m.id === 'mi-rasmalai' || m.id === 'mi-prawn-biryani'
      if (isOutlier && d === 26) {
        costDay = costInr * 1.18
        marginDay = m.price - costDay
      }
      costSeries.push(round1(costDay))
      marginSeries.push(round1(marginDay))
    }

    items.push({
      id: m.id,
      recipeId: recipe.id,
      name: m.name,
      category: categorise(m.category),
      price: m.price,
      costPerServing: Math.round(costInr),
      costPctOfPrice: round1(costPct),
      marginPerServing: Math.round(margin),
      servingsSold: servings,
      contribution,
      costSeries,
      marginSeries,
    })
    seed += 1
  }
  return items.slice(0, 32)
})()

// ─────────────────────────────────────────────────────────────────────────────
// Actionable suggestions — FR108 "surfaced at top"
// ─────────────────────────────────────────────────────────────────────────────

type SuggestionKind =
  | 'promote'
  | 'reengineer'
  | 'retire'
  | 'vendor_switch'
  | 'yield_variance'

interface SuggestionMeta {
  readonly label: string
  readonly tone: 'success' | 'warning' | 'error' | 'tertiary' | 'primary'
  readonly Icon: typeof Sparkles
  readonly chipClass: string
  readonly cta: string
  readonly route: string
}

const SUGGESTION_META: Record<SuggestionKind, SuggestionMeta> = {
  promote: {
    label: 'Promote',
    tone: 'success',
    Icon: Sparkles,
    // No `success_container` token — pair surface-container-high with a
    // success-tinted icon for "colour never alone" satisfaction.
    chipClass: 'bg-surface-container-high text-on-surface',
    cta: 'Open menu engineering',
    route: '/SI-RPT-007',
  },
  reengineer: {
    label: 'Re-engineer',
    tone: 'tertiary',
    Icon: Recycle,
    chipClass: 'bg-tertiary-container text-on-tertiary-container',
    cta: 'Open recipe detail',
    route: '/SI-REC-001',
  },
  retire: {
    label: 'Retire',
    tone: 'error',
    Icon: TriangleAlert,
    chipClass: 'bg-error-container text-on-error-container',
    cta: 'Open menu engineering',
    route: '/SI-RPT-007',
  },
  vendor_switch: {
    label: 'Vendor-switch',
    tone: 'warning',
    Icon: Repeat,
    // No `warning_container` token — surface tone + warning icon below.
    chipClass: 'bg-surface-container-high text-on-surface',
    cta: 'Open vendor price comparison',
    route: '/SI-PUR-005',
  },
  yield_variance: {
    label: 'Yield-variance',
    tone: 'primary',
    Icon: RefreshCcw,
    chipClass: 'bg-primary-container text-on-primary-container',
    cta: 'Open GR detail',
    route: '/SI-INV-006',
  },
}

interface Suggestion {
  readonly id: string
  readonly kind: SuggestionKind
  readonly itemId: string
  readonly itemName: string
  readonly headline: string
  readonly evidence: string
}

const SUGGESTIONS: ReadonlyArray<Suggestion> = [
  {
    id: 'sg-promote-butter-chicken',
    kind: 'promote',
    itemId: 'mi-butter-chicken',
    itemName: 'Butter Chicken',
    headline: 'Surface as a hero on the May menu redesign — margin and velocity both top-quartile.',
    evidence: 'Margin +18 % vs Mains category avg · sales velocity in top quartile · CSat 4.6/5 across 3 outlets.',
  },
  {
    id: 'sg-vendor-switch-mutton',
    kind: 'vendor_switch',
    itemId: 'mi-mutton-galouti',
    itemName: 'Mutton Galouti Kebab',
    headline: 'Switch primary mutton vendor — current vendor 12.9 % above 30-day average for 9 days.',
    evidence: 'Sunshine Meats ₹745/kg vs ₹660 avg · alt vendor Bandra Halal at ₹682/kg with same grade · cost-per-serving would drop ₹22.',
  },
  {
    id: 'sg-reengineer-rasmalai',
    kind: 'reengineer',
    itemId: 'mi-rasmalai',
    itemName: 'Saffron Rasmalai',
    headline: 'Re-engineer recipe — saffron load drives cost-per-serving 8.6 % above theoretical.',
    evidence: 'Saffron at 0.4 g/portion contributes ₹38 of the ₹146 actual cost · trial 0.25 g + cardamom-rosewater bridge to retain finish.',
  },
  {
    id: 'sg-yield-variance-prawn',
    kind: 'yield_variance',
    itemId: 'mi-prawn-biryani',
    itemName: 'Malabar Prawn Biryani',
    headline: 'Yield variance flagged — actual cost 7.8 % above theoretical for a third consecutive week.',
    evidence: 'GR-2026-04-067 shows 9 % moisture loss at peeling · investigate vendor cleaning method or shift to head-on receipt.',
  },
  {
    id: 'sg-retire-malpua',
    kind: 'retire',
    itemId: 'mi-malpua',
    itemName: 'Malpua with Rabri',
    headline: 'Retire from menu — bottom-quartile contribution and waste cost above median.',
    evidence: 'Sells 38 servings/month brand-wide · contribution ₹2,840/month · prep waste 11 % of revenue · 4-month declining trend.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — INR rendering, status mapping
// ─────────────────────────────────────────────────────────────────────────────

function INRValue({ value }: { value: number }) {
  // §7.4 ₹ rule — symbol on on_surface_variant, digits on on_surface.
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

interface CostStatus {
  band: 'over' | 'caution' | 'target'
  Icon: typeof TrendingUp
  label: string
  pip: string
  badgeClass: string
  iconClass: string
}

/**
 * Map a cost-per-serving % into the 3-band status. Band edges are driven by
 * the (configurable) brand threshold: items above threshold → `over`, items
 * within 3 pp under → `caution`, the rest → `target`.
 */
function costStatus(costPct: number, threshold: number): CostStatus {
  if (costPct > threshold) {
    return {
      band: 'over',
      Icon: TriangleAlert,
      label: `Above threshold · ${formatPctSigned(costPct - threshold)} over`,
      pip: 'bg-error',
      badgeClass: 'bg-error-container text-on-error-container',
      iconClass: 'text-error',
    }
  }
  if (costPct >= threshold - 3) {
    return {
      band: 'caution',
      Icon: CircleAlert,
      label: `Caution band · within ${(threshold - costPct).toFixed(1)} pp of threshold`,
      pip: 'bg-warning',
      // No `warning_container` token — pair surface-container-high with the
      // warning-tinted icon to satisfy "colour never alone" without inventing a token.
      badgeClass: 'bg-surface-container-high text-on-surface',
      iconClass: 'text-warning',
    }
  }
  return {
    band: 'target',
    Icon: CircleCheck,
    label: `Within target · ${(threshold - costPct).toFixed(1)} pp under threshold`,
    pip: 'bg-transparent',
    badgeClass: 'bg-surface-container-high text-on-surface',
    iconClass: 'text-success',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component — Pareto bar (top quartile + tail)
// ─────────────────────────────────────────────────────────────────────────────

function ParetoBar({
  contribution,
  maxContribution,
  isTopQuartile,
}: {
  contribution: number
  maxContribution: number
  isTopQuartile: boolean
}) {
  const widthPct = Math.max(2, (contribution / maxContribution) * 100)
  // Top quartile uses the `primary` chrome; tail uses surface_container_high.
  const fillClass = isTopQuartile ? 'bg-primary' : 'bg-surface-container-high'
  return (
    <div
      className="relative h-2 w-full overflow-hidden rounded-pill bg-surface-container-lowest"
      role="presentation"
    >
      <div
        className={['h-full rounded-pill transition-[width]', fillClass].join(' ')}
        style={{ width: `${widthPct}%` }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component — Time-series line chart (cost-per-serving + margin)
// ─────────────────────────────────────────────────────────────────────────────

function TrendLineChart({
  costSeries,
  marginSeries,
  threshold,
  itemPrice,
}: {
  costSeries: ReadonlyArray<number>
  marginSeries: ReadonlyArray<number>
  threshold: number
  itemPrice: number
}) {
  const width = 480
  const height = 120
  const padding = { top: 10, right: 12, bottom: 18, left: 36 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  // Combined min/max so both lines share the y axis (₹).
  const all = [...costSeries, ...marginSeries]
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1

  const x = (i: number) => padding.left + (i / (costSeries.length - 1)) * innerW
  const y = (v: number) => padding.top + (1 - (v - min) / range) * innerH

  const costPath = costSeries.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const marginPath = marginSeries.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

  // Anomaly detection — values where same-day cost % of itemPrice > threshold,
  // AND > rolling 7-day baseline by more than 4 %.
  const anomalies: Array<{ i: number; v: number }> = []
  costSeries.forEach((cost, i) => {
    const pct = (cost / itemPrice) * 100
    if (pct <= threshold) return
    const start = Math.max(0, i - 7)
    const window = costSeries.slice(start, i)
    if (window.length === 0) return
    const baseline = window.reduce((a, b) => a + b, 0) / window.length
    if ((cost - baseline) / baseline > 0.04) {
      anomalies.push({ i, v: cost })
    }
  })

  // Y axis ticks (3 — min, mid, max).
  const ticks = [min, min + range / 2, max]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Cost-per-serving and contribution-margin trend, last 30 days. ${anomalies.length} anomaly day${anomalies.length === 1 ? '' : 's'}.`}
    >
      {/* Axis ticks */}
      {ticks.map((t, i) => (
        <g key={i}>
          <text
            x={padding.left - 6}
            y={y(t)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-on-surface-variant"
            style={{ fontSize: '10px', fontFamily: 'Inter' }}
          >
            ₹{Math.round(t)}
          </text>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--color-outline-variant)"
            strokeWidth={0.5}
            strokeDasharray="2 4"
          />
        </g>
      ))}

      {/* Cost line — surface_tint */}
      <path
        d={costPath}
        fill="none"
        stroke="var(--color-surface-tint)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Margin line — primary */}
      <path
        d={marginPath}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="3 3"
      />

      {/* Anomaly dots */}
      {anomalies.map((a) => (
        <g key={a.i}>
          <circle cx={x(a.i)} cy={y(a.v)} r={4} fill="var(--color-error)" />
          <circle cx={x(a.i)} cy={y(a.v)} r={7} fill="none" stroke="var(--color-error)" strokeWidth={1} opacity={0.4} />
        </g>
      ))}

      {/* X axis label */}
      <text
        x={padding.left}
        y={height - 4}
        className="fill-on-surface-variant"
        style={{ fontSize: '10px', fontFamily: 'Inter' }}
      >
        D-29
      </text>
      <text
        x={width - padding.right}
        y={height - 4}
        textAnchor="end"
        className="fill-on-surface-variant"
        style={{ fontSize: '10px', fontFamily: 'Inter' }}
      >
        Today
      </text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component — Drill-pane (recipe → ingredient → sales → batches)
// ─────────────────────────────────────────────────────────────────────────────

interface DrillPaneProps {
  readonly item: OpsItem
  readonly recipe: Recipe
  readonly columns: number
}

function DrillPane({ item, recipe, columns }: DrillPaneProps) {
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
              Recipe {recipe.current_default_version} · {topIngredients.length} ingredients · {item.servingsSold} servings sold
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 desktop:grid-cols-4">
            {/* Recipe */}
            <Link
              to="/SI-REC-001"
              className="rounded-md bg-surface-container-lowest p-3 hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Recipe
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-on-surface">
                {recipe.name}
                <ArrowUpRight className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
              </p>
              <p className="mt-1 text-xs text-on-surface-variant tabular-nums">
                Cost / yield <INRValue value={recipe.cost_per_yield_unit} /> · {topIngredients.length} ingredients
              </p>
            </Link>

            {/* Ingredients (top 4) */}
            <div className="rounded-md bg-surface-container-lowest p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Top ingredients
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {topIngredients.map((ing) => (
                  <li key={ing.material_id} className="text-xs text-on-surface tabular-nums">
                    {ing.material_id.replace('mat-', '').replace(/-/g, ' ')} · {ing.qty} {ing.uom}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sales */}
            <Link
              to="/SI-RPT-005"
              className="rounded-md bg-surface-container-lowest p-3 hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Sales (30 d)
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-on-surface tabular-nums">
                {item.servingsSold} servings
                <ArrowUpRight className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
              </p>
              <p className="mt-1 text-xs text-on-surface-variant tabular-nums">
                Contribution <INRValue value={item.contribution} />
              </p>
            </Link>

            {/* Batches / GR */}
            <Link
              to="/SI-INV-006"
              className="rounded-md bg-surface-container-lowest p-3 hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Batches / GR
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-on-surface">
                Open GR detail
                <ArrowUpRight className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Yield variance investigation flows from GR confirmations.
              </p>
            </Link>
          </div>

          <div className="mt-3 rounded-md bg-surface-container-lowest px-4 py-3">
            <p className="text-xs text-on-surface-variant">
              Drill chain reachable in ≤2 clicks per FR109: row click opens this
              pane; cards jump straight to recipe / sales / GR / vendor sources.
              Switching to{' '}
              <Link
                to={`/SI-ACC-010?item=${item.id}`}
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                FCCC Financial framing
              </Link>{' '}
              keeps {item.name} in focus via the shared followed-item pill.
            </p>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component — Suggestions panel (FR108 surfaced at top)
// ─────────────────────────────────────────────────────────────────────────────

function SuggestionsPanel({
  selectedItemId,
  onFollow,
}: {
  selectedItemId: string | null
  onFollow: (id: string) => void
}) {
  return (
    <section
      aria-label="Actionable suggestions"
      className="rounded-md bg-surface-container-low p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-on-surface-variant" aria-hidden />
          <h2 className="text-base font-semibold text-on-surface">
            Actionable suggestions
          </h2>
        </div>
        <p className="text-xs text-on-surface-variant">
          {SUGGESTIONS.length} recommendations · FR108 surfaced at top · refreshes nightly with FCCC run
        </p>
      </header>

      <ul className="mt-4 grid grid-cols-1 gap-3 desktop:grid-cols-2">
        {SUGGESTIONS.map((sg) => {
          const meta = SUGGESTION_META[sg.kind]
          const Icon = meta.Icon
          const isFollowed = sg.itemId === selectedItemId
          return (
            <li
              key={sg.id}
              className={[
                'flex flex-col gap-3 rounded-md bg-surface-container-lowest p-4',
                isFollowed ? 'ring-2 ring-primary' : '',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span
                  role="status"
                  aria-label={`Suggestion type: ${meta.label}`}
                  className={[
                    'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider',
                    meta.chipClass,
                  ].join(' ')}
                >
                  <Icon className="h-3 w-3" aria-hidden />
                  {meta.label}
                </span>
                <p className="text-xs text-on-surface-variant">{sg.itemName}</p>
              </div>

              <p className="text-sm text-on-surface">{sg.headline}</p>
              <p className="text-xs text-on-surface-variant">{sg.evidence}</p>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant={isFollowed ? 'secondary' : 'tonal'}
                  size="sm"
                  onClick={() => onFollow(sg.itemId)}
                  className="rounded-pill"
                  aria-pressed={isFollowed}
                >
                  {isFollowed ? 'Following' : 'Follow item'}
                </Button>
                <Link
                  to={meta.route}
                  className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-primary hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[28px]"
                >
                  {meta.cta}
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
// Sub-component — Product mix Pareto panel
// ─────────────────────────────────────────────────────────────────────────────

function ProductMixPanel({
  items,
  selectedItemId,
  onFollow,
}: {
  items: ReadonlyArray<OpsItem>
  selectedItemId: string | null
  onFollow: (id: string) => void
}) {
  const ranked = useMemo(() => {
    return [...items].sort((a, b) => b.contribution - a.contribution).slice(0, 10)
  }, [items])

  const max = ranked[0]?.contribution ?? 1
  // Top quartile = top 25 % by count of the displayed list (3 of 10).
  const quartileBoundary = Math.ceil(ranked.length / 4)

  return (
    <section
      aria-label="Product mix Pareto"
      className="rounded-md bg-surface-container-low p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-on-surface">Product mix · Pareto</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Top 10 items ranked by contribution (volume × margin) · top quartile in primary chrome, tail in surface tone
          </p>
        </div>
        <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
          Static — no entrance animation
        </p>
      </header>

      <ul className="mt-4 flex flex-col gap-2">
        {ranked.map((it, idx) => {
          const isTopQuartile = idx < quartileBoundary
          const isFollowed = it.id === selectedItemId
          return (
            <li
              key={it.id}
              className={[
                'grid grid-cols-1 gap-3 rounded-md bg-surface-container-lowest px-4 py-3',
                'tablet:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]',
                isFollowed ? 'ring-2 ring-primary' : '',
              ].join(' ')}
            >
              <div className="flex flex-col gap-0.5">
                <p className="inline-flex items-center gap-2 text-sm font-medium text-on-surface">
                  <span className="text-on-surface-variant tabular-nums">#{idx + 1}</span>
                  {it.name}
                  {isTopQuartile ? (
                    <span className="rounded-pill bg-primary-container px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-on-primary-container">
                      Top quartile
                    </span>
                  ) : (
                    <span className="rounded-pill bg-surface-container-high px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                      Tail
                    </span>
                  )}
                </p>
                <p className="text-xs text-on-surface-variant tabular-nums">
                  {it.servingsSold} servings · margin <INRValue value={it.marginPerServing} />/serving
                </p>
              </div>

              <div className="flex items-center gap-3">
                <ParetoBar
                  contribution={it.contribution}
                  maxContribution={max}
                  isTopQuartile={isTopQuartile}
                />
                <span className="shrink-0 text-xs tabular-nums text-on-surface">
                  <INRValue value={it.contribution} />
                </span>
              </div>

              <Button
                variant={isFollowed ? 'secondary' : 'tonal'}
                size="sm"
                onClick={() => onFollow(it.id)}
                className="rounded-pill"
                aria-pressed={isFollowed}
              >
                {isFollowed ? 'Following' : 'Follow'}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component — Time-series trend panel
// ─────────────────────────────────────────────────────────────────────────────

function TrendPanel({
  item,
  threshold,
}: {
  item: OpsItem | null
  threshold: number
}) {
  // Default to the highest-contribution item with planted anomaly when none is followed.
  const focus = item ?? FIXTURE.find((it) => it.id === 'mi-mutton-galouti') ?? FIXTURE[0]
  if (!focus) return null

  const last = focus.costSeries[focus.costSeries.length - 1] ?? 0
  const first = focus.costSeries[0] ?? last
  const delta = last - first
  const up = delta > 0

  return (
    <section
      aria-label={`Time-series trend for ${focus.name}`}
      className="rounded-md bg-surface-container-low p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-on-surface">
            30-day trend · {focus.name}
          </h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Cost-per-serving (solid · surface tint) and contribution-margin (dashed · primary). Anomalies marked.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs tabular-nums text-on-surface">
          {up ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-error" aria-hidden />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-success" aria-hidden />
          )}
          {formatPctSigned(((last - first) / first) * 100)} cost over period
        </span>
      </header>

      <div className="mt-3 rounded-md bg-surface-container-lowest p-3">
        <TrendLineChart
          costSeries={focus.costSeries}
          marginSeries={focus.marginSeries}
          threshold={threshold}
          itemPrice={focus.price}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-6 bg-surface-tint" />
          Cost / serving
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-6 bg-primary" />
          Margin / serving
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-pill bg-error" />
          Anomaly (&gt;7-day baseline)
        </span>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_COLUMNS = 8 // pip + name + price + cost ₹ + cost % + delta + status + follow

export default function SiRpt006() {
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

  // Brand-configurable threshold (FR108) — default 35 %.
  const [threshold, setThreshold] = useState<number>(35)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sortedItems = useMemo(() => {
    return [...FIXTURE].sort((a, b) => b.costPctOfPrice - a.costPctOfPrice)
  }, [])

  const summary = useMemo(() => {
    const over = sortedItems.filter((it) => it.costPctOfPrice > threshold).length
    const caution = sortedItems.filter(
      (it) => it.costPctOfPrice <= threshold && it.costPctOfPrice >= threshold - 3,
    ).length
    const target = sortedItems.length - over - caution
    return { over, caution, target, total: sortedItems.length }
  }, [sortedItems, threshold])

  const selectedItem = useMemo(
    () => FIXTURE.find((it) => it.id === itemId) ?? null,
    [itemId],
  )

  const selectedRecipe = useMemo(
    () => (selectedItem ? recipes.find((r) => r.id === selectedItem.recipeId) ?? null : null),
    [selectedItem],
  )

  const handleToggleRow = (id: string) => {
    setExpandedId((cur) => (cur === id ? null : id))
  }

  const handleFollow = (id: string) => {
    if (itemId === id) {
      setItem(null)
    } else {
      setItem(id)
    }
  }

  const handleThresholdChange = (raw: string) => {
    const parsed = Number.parseFloat(raw)
    if (Number.isNaN(parsed)) return
    // Clamp 20–60 — defensive bounds for the brand-configurable threshold.
    const clamped = Math.max(20, Math.min(60, parsed))
    setThreshold(clamped)
  }

  const periodShort = FCCC_PERIOD_RANGE[period as FCCCPeriod].short

  // Tile severity logic — stop-the-line if anyone is over.
  const overSeverity: 'error' | 'warning' | 'success' =
    summary.over > 2 ? 'error' : summary.over > 0 ? 'warning' : 'success'

  return (
    <FCCCDualSurface
      surface="operational"
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
        <ExportTrigger entityLabel="FCCC operational" formats={['csv', 'excel', 'pdf']} />
      }
    >
      {/* Actionable suggestions — FR108 surfaced at top */}
      <SuggestionsPanel selectedItemId={itemId} onFollow={handleFollow} />

      {/* Cost-per-serving summary tiles */}
      <section
        aria-label="Cost-per-serving summary"
        className="mt-6 grid grid-cols-1 gap-4 tablet:grid-cols-3"
      >
        <DashboardTile
          label="Above threshold"
          value={String(summary.over)}
          secondary={`@ ${threshold} % threshold · brand-wide · ${summary.total} items tracked`}
          severity={overSeverity === 'success' ? 'neutral' : overSeverity}
          trend={summary.over > 0 ? 'up' : 'flat'}
        />
        <DashboardTile
          label="Caution band"
          value={String(summary.caution)}
          secondary={`Within 3 pp of ${threshold} % threshold · monitor weekly`}
          severity={summary.caution > 0 ? 'warning' : 'neutral'}
          trend="flat"
        />
        <DashboardTile
          label="Within target"
          value={String(summary.target)}
          secondary={`Below ${threshold - 3} % · healthy margin runway`}
          severity="success"
          trend="down"
        />
      </section>

      {/* Cost-per-serving table */}
      <section aria-label="Cost-per-serving by item" className="mt-6">
        <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-on-surface">
              Cost-per-serving · {periodShort}
            </h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Items above threshold flagged via icon + label · ranked by cost % descending
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-on-surface-variant">
            <Target className="h-3.5 w-3.5" aria-hidden />
            <span>Threshold</span>
            <input
              type="number"
              inputMode="numeric"
              min={20}
              max={60}
              step={0.5}
              value={threshold}
              onChange={(e) => handleThresholdChange(e.target.value)}
              aria-label="Cost-per-serving threshold (percent)"
              className="h-9 w-20 rounded-sm bg-surface-container-lowest px-2 text-right text-sm tabular-nums text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <span className="font-medium">%</span>
            <span className="ml-2 rounded-pill bg-surface-container-high px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
              Brand-configurable · FR108
            </span>
          </label>
        </header>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1" aria-hidden />
              <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Item
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Price ₹
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Cost / serving ₹
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Cost %
              </TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Δ vs threshold
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Status
              </TableHead>
              <TableHead className="w-12 text-right" aria-label="Follow" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((it) => {
              const status = costStatus(it.costPctOfPrice, threshold)
              const recipe = recipes.find((r) => r.id === it.recipeId)
              const isExpanded = expandedId === it.id
              const isFollowed = itemId === it.id
              const StatusIcon = status.Icon
              const delta = it.costPctOfPrice - threshold
              return (
                <Fragment key={it.id}>
                  <TableRow
                    className={[
                      'transition-colors hover:bg-surface-container',
                      // Followed-row highlight per spec — primary left pip + soft tonal lift.
                      isFollowed ? 'bg-surface-container-low border-l-4 border-l-primary' : '',
                    ].join(' ')}
                  >
                    <TableCell
                      aria-hidden
                      className={['p-0', status.pip].join(' ')}
                      title={status.label}
                    />
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
                    <TableCell className="text-right text-sm text-on-surface tabular-nums">
                      <INRValue value={it.price} />
                    </TableCell>
                    <TableCell className="text-right text-sm text-on-surface tabular-nums">
                      <INRValue value={it.costPerServing} />
                    </TableCell>
                    <TableCell className="text-right text-sm text-on-surface tabular-nums">
                      {it.costPctOfPrice.toFixed(1)} %
                    </TableCell>
                    <TableCell className="text-right text-sm text-on-surface-variant tabular-nums">
                      {formatPctSigned(delta)}
                    </TableCell>
                    <TableCell>
                      <span
                        role="status"
                        aria-label={status.label}
                        title={status.label}
                        className={[
                          'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium',
                          status.badgeClass,
                        ].join(' ')}
                      >
                        <StatusIcon className={['h-3 w-3', status.iconClass].join(' ')} aria-hidden />
                        {status.band === 'over'
                          ? 'Above threshold'
                          : status.band === 'caution'
                            ? 'Caution'
                            : 'Within target'}
                      </span>
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
          </TableBody>
        </Table>
      </section>

      {/* Product mix Pareto + time-series trend side-by-side on desktop */}
      <div className="mt-6 grid grid-cols-1 gap-6 desktop:grid-cols-2">
        <ProductMixPanel items={sortedItems} selectedItemId={itemId} onFollow={handleFollow} />
        <TrendPanel item={selectedItem} threshold={threshold} />
      </div>

      {/* Followed-item context panel (sibling of ACC-010's panel) */}
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
              to={`/SI-ACC-010?period=${period}&scope=${scope}&compare=${comparison}&item=${selectedItem.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              View on financial surface
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </header>
          <p className="mt-1 text-xs text-on-surface-variant">
            Recipe {selectedRecipe.current_default_version} ·{' '}
            {selectedRecipe.ingredients.length} ingredients · cost / serving{' '}
            {formatINR(selectedItem.costPerServing)} · margin / serving{' '}
            {formatINR(selectedItem.marginPerServing)} · servings sold{' '}
            {selectedItem.servingsSold} · contribution{' '}
            {formatINR(selectedItem.contribution)}
          </p>
        </section>
      ) : null}

      <SectionShift tone="high" className="mt-10" aria-hidden />
      <footer className="pt-4 text-xs text-on-surface-variant">
        SI-RPT-006 · Tier 1 Group 4 · Phase 2c-S4 · Source: FR108 FCCC operational analytics ·{' '}
        <Link
          to={`/SI-ACC-010?period=${period}&scope=${scope}&compare=${comparison}${itemId ? `&item=${itemId}` : ''}`}
          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        >
          ↔ SI-ACC-010 financial
        </Link>{' '}
        ·{' '}
        <Link
          to="/SI-RPT-007"
          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        >
          → SI-RPT-007 menu engineering
        </Link>
      </footer>
    </FCCCDualSurface>
  )
}
