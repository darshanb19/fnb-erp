import { useState } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'

import {
  DashboardTile,
  OverrideWidget,
  PendingGRDrill,
  DataQualityAlertPane,
  ExportTrigger,
  StatusPill,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  SectionShift,
} from '@/shell'

import {
  BRAND,
  NOW,
  formatINR,
  clusters,
  locations,
  vendors,
  recipes,
  inventoryPositions,
  purchaseOrders,
  goodsReceipts,
  salesData,
  closingEntries,
  type GR,
} from '@/lib/sample-data'

import type { OverrideBreakdownEntry } from '@/shell/OverrideWidget'
import type { PendingGRDrillEntry } from '@/shell/PendingGRDrill'
import type { DataQualityAlert } from '@/shell/DataQualityAlert'

/**
 * SI-RPT-002 — Brand Owner Cross-Location Dashboard.
 *
 * Tier 1 Group 1, screen 1 of Phase 2c-S3. Anchors:
 *   - CC-DASHBOARD-TILE (financial + operational tiles)
 *   - CC-OVERRIDE-WIDGET / P2B-005 (override frequency)
 *   - CC-PENDING-GR-DRILL (rejection thread)
 *   - CC-DATA-QUALITY-ALERT (FR116 cross-module alerts)
 *   - CC-EXPORT-TRIGGER (FR107 PDF / CSV / Excel)
 *
 * Source FRs: FR105, FR107, FR70, FR109, FR15c, FR116. Notes paragraph in
 * `_planning/05-screen-inventory.md` calls out the realisation rules — the
 * override widget is the single aggregating instance, not per override-firing
 * screen. Pending-GR drill drops on SI-PRO-009; expiring-overrides on
 * SI-USR-007; data-quality alerts on the offending master record (MDM-003 /
 * MDM-005 / etc.).
 *
 * Animation: NO entrance animations on this screen (CLAUDE.md policy —
 * dashboards are static). Hover states use Tailwind transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixture aggregations (deterministic — derived from sample-data.ts)
// ─────────────────────────────────────────────────────────────────────────────

// Daily sales — last completed day across all POS outlets
const lastDay = salesData[salesData.length - 1]?.date ?? NOW
const lastDayEntries = salesData.filter((s) => s.date === lastDay)
const dailySalesTotal = lastDayEntries.reduce((acc, e) => acc + e.net_sales, 0)
const dailyCovers = lastDayEntries.reduce((acc, e) => acc + e.covers, 0)

// Raw material stock value — sum of inventory_positions on_hand_qty * unit_cost
const rawMaterialStockValue = inventoryPositions.reduce(
  (acc, p) => acc + p.on_hand_qty * p.unit_cost,
  0,
)

// Food cost % — back-of-the-envelope: sum recipe COGS contribution at last 7-day
// sales-weighted recipe mix vs net sales. We pull a stable round number for the
// mockup: 33.4 % current vs 32.0 % target (Wild Sugar's spec target).
const FOOD_COST_PCT = 33.4
const FOOD_COST_TARGET = 32.0

// Variance flags — closing entries with abs(variance_pct) > 2 % over the last
// 7 days, plus a flat fixture stub for production-yield variance.
const last7Days = closingEntries.filter((c) => {
  const offset = Math.floor(
    (new Date(`${NOW}T00:00:00Z`).valueOf() - new Date(`${c.date}T00:00:00Z`).valueOf()) /
      86400000,
  )
  return offset < 7
})
const closingVarianceFlags = last7Days.filter((c) => Math.abs(c.variance_pct) > 2).length
const productionYieldVariances = 4 // mock — Phase 4 production-orders fixture not built yet
const totalVarianceFlags = closingVarianceFlags + productionYieldVariances

// Pending approvals above value threshold (₹50,000) — POs in pending_approval
const PENDING_APPROVAL_THRESHOLD = 50000
const pendingApprovalsHighValue = purchaseOrders.filter(
  (po) => po.status === 'pending_approval' && po.total_value >= PENDING_APPROVAL_THRESHOLD,
).length

// Provisional cost counts — POs with is_provisional flag set
const provisionalPOs = purchaseOrders.filter((po) => po.is_provisional).length
const provisionalRecipes = recipes.filter((r) => r.is_provisional).length

// Pending-GR pane — most recent rejected GRs
const rejectedGRs: ReadonlyArray<GR> = goodsReceipts
  .filter((gr) => gr.status === 'rejected')
  .slice(-5)
  .reverse()

const pendingGRDrillEntries: ReadonlyArray<PendingGRDrillEntry> = rejectedGRs.map((gr) => {
  const po = purchaseOrders.find((p) => p.id === gr.po_id)!
  const vendor = vendors.find((v) => v.id === gr.vendor_id)!
  // Derive a deterministic reclassification journal TRN.
  const journalTrn = `TRN-RJ-2026-${gr.gr_number.split('-').pop()}`
  return {
    id: gr.id,
    gr_trn: gr.trn,
    po_trn: po.trn,
    vendor_name: vendor.name,
    rejected_at: gr.received_on,
    reason: gr.rejection_reason ?? 'quality',
    journal_trn: journalTrn,
  }
})

// Override frequency widget — synthesise a 30-day series + breakdown.
// Pending-GR overrides ≈ count of pending_gr POs × 0.7 over the window.
const overrideSeries: ReadonlyArray<number> = (() => {
  const out: number[] = []
  for (let i = 30; i >= 1; i--) {
    // Modulate around 5–14, with a recent uptick.
    const base = 7 + ((i * 13) % 6)
    const recentLift = i <= 5 ? 4 : 0
    out.push(base + recentLift)
  }
  return out
})()
const overrideRollingAvg7 =
  overrideSeries.slice(-8, -1).reduce((acc, v) => acc + v, 0) / 7
const overrideHeroRate = 4.7 // per 100 production orders — round Wild Sugar fixture
const overrideBreakdown: ReadonlyArray<OverrideBreakdownEntry> = [
  { type: 'pending_gr', count: 18 },
  { type: 'substitution', count: 11 },
  { type: 'enablement', count: 6 },
]

// Expiring permission overrides — fixture from FR15c parking lot (P2B-003).
const expiringOverridesTotal = 12
const expiringOverridesUrgent = 4

// Cross-module data-quality alerts — plausible Wild Sugar examples.
const dataQualityAlerts: ReadonlyArray<DataQualityAlert> = [
  {
    id: 'dq-001',
    kind: 'deactivated_material_in_recipe',
    severity: 'critical',
    message: 'Kashmir Saffron deactivated, still in 3 published recipes.',
    context: 'Affects: rec-mutton-galouti v3.2, rec-paneer-tikka v2.1, rec-biryani-special v1.4. Production orders will fail enablement check until reclassified.',
    link: '/SI-MDM-003',
  },
  {
    id: 'dq-002',
    kind: 'deactivated_vendor_open_po',
    severity: 'warning',
    message: 'Bharat Spice Traders deactivated with 2 open POs (₹ 1,82,400 total).',
    context: 'POs await GR; reassign vendor or close manually before GR window closes.',
    link: '/SI-MDM-005',
  },
  {
    id: 'dq-003',
    kind: 'enabled_material_orphan_dept',
    severity: 'warning',
    message: 'Bakery & Pastry department deactivated; 6 child materials still enabled.',
    context: 'Inventory will accept movements against an inactive department. Run cleanup before next closing.',
    link: '/SI-INF-007',
  },
  {
    id: 'dq-004',
    kind: 'expired_template_active',
    severity: 'info',
    message: '2 recipe templates expired but still flagged as default in menu.',
    context: 'Cluster Manager review recommended at next menu refresh.',
    link: '/SI-REC-003',
  },
]

// FR110 unusual activity feed count
const unusualActivityCount = 3

// 30-day sparklines for the financial tiles
const foodCostSparkline = [33.0, 33.6, 33.2, 33.7, 33.1, 33.4, 33.4]
const stockValueSparkline = [
  7.6, 7.8, 7.7, 7.9, 8.1, 8.0, 8.2,
] // in lakhs
const salesSparkline = [3.2, 3.0, 3.5, 3.8, 3.4, 3.7, 3.9]

// Last-refresh — NOW + a synthetic clock time
const refreshedAt = '6 May 2026, 09:42 IST'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render a ₹ amount with the §7.4 ₹ rule: symbol in `on_surface_variant`,
 * digits in the ambient text colour, hair-space separator from formatINR.
 */
function INRValue({ value }: { value: number }) {
  // formatINR returns "₹ 4,28,500" with hair space already.
  const formatted = formatINR(value)
  const isNeg = formatted.startsWith('-')
  const body = isNeg ? formatted.slice(1) : formatted
  // body = symbol char + separator (regular space or NNBSP) + digits.
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

// ─────────────────────────────────────────────────────────────────────────────
// Scope filter — persisted across sessions per FR105
// ─────────────────────────────────────────────────────────────────────────────

type ScopeOption = {
  id: string
  label: string
  level: 'brand' | 'cluster' | 'location'
}

const SCOPE_OPTIONS: ReadonlyArray<ScopeOption> = [
  { id: 'brand', label: `${BRAND.name} — Brand-wide`, level: 'brand' },
  ...clusters.map(
    (c): ScopeOption => ({ id: c.id, label: c.name, level: 'cluster' }),
  ),
  ...locations
    .filter((l) => l.type === 'pos_outlet' || l.type === 'central_kitchen')
    .map((l): ScopeOption => ({ id: l.id, label: l.name, level: 'location' })),
]

const SCOPE_STORAGE_KEY = 'si-rpt-002.scope'

function readPersistedScope(): ScopeOption {
  if (typeof window === 'undefined') return SCOPE_OPTIONS[0]!
  try {
    const stored = window.localStorage.getItem(SCOPE_STORAGE_KEY)
    if (stored) {
      const found = SCOPE_OPTIONS.find((o) => o.id === stored)
      if (found) return found
    }
  } catch {
    // ignore quota / privacy-mode failures — fall through to default
  }
  return SCOPE_OPTIONS[0]!
}

function writePersistedScope(scope: ScopeOption) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SCOPE_STORAGE_KEY, scope.id)
  } catch {
    // ignore
  }
}

function ScopePicker({
  scope,
  onChange,
}: {
  scope: ScopeOption
  onChange: (s: ScopeOption) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="tonal" className="gap-2 h-11 px-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Scope
          </span>
          <span className="text-sm font-medium text-on-surface">
            {scope.label}
          </span>
          <ChevronDown className="h-4 w-4 text-on-surface-variant" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Selection persists across sessions
        </p>
        <ul className="flex flex-col">
          {SCOPE_OPTIONS.map((opt) => {
            const active = opt.id === scope.id
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex flex-col gap-0.5 min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm font-medium text-on-surface">
                    {opt.label}
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                    {opt.level}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiRpt002() {
  const [scope, setScope] = useState<ScopeOption>(() => readPersistedScope())

  const handleScopeChange = (s: ScopeOption) => {
    setScope(s)
    writePersistedScope(s)
  }

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-6 py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Brand Owner · Cross-Location
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Wild Sugar dashboard
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Single brand-wide control surface — financial KPIs, operational
              health, override patterns, data-quality alerts. Every tile is a
              one-click drill into its source-of-truth screen.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ScopePicker scope={scope} onChange={handleScopeChange} />
            <Button
              variant="ghost"
              className="gap-2 h-11 px-3 text-on-surface-variant"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              <span className="text-sm">Refresh</span>
            </Button>
            <ExportTrigger entityLabel="dashboard snapshot" />
          </div>
        </header>

        <p className="mt-3 text-xs text-on-surface-variant">
          Last refreshed: {refreshedAt}
        </p>

        {/* Section: Financial */}
        <section
          className="mt-8 rounded-md bg-surface-container-low p-5"
          aria-labelledby="sec-financial"
        >
          <header className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2
                id="sec-financial"
                className="text-lg font-semibold text-on-surface"
              >
                Financial
              </h2>
              <p className="text-xs text-on-surface-variant">
                Brand-wide totals · {lastDayEntries.length} POS outlets
              </p>
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              FR105
            </span>
          </header>

          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
            <DashboardTile
              label="Food cost %"
              value={
                <>
                  {FOOD_COST_PCT.toFixed(1)}
                  <span className="ml-1 text-base font-medium text-on-surface-variant">
                    %
                  </span>
                </>
              }
              secondary={
                <>
                  Target {FOOD_COST_TARGET.toFixed(1)} % · 7-day rolling
                </>
              }
              trend="up"
              severity="warning"
              sparkline={foodCostSparkline}
              emphasis="above_average"
              to="/SI-RPT-006"
            />
            <DashboardTile
              label="Raw material stock value"
              value={<INRValue value={Math.round(rawMaterialStockValue)} />}
              secondary={
                <>
                  {inventoryPositions.length} positions · 5 tracking locations
                </>
              }
              trend="up"
              sparkline={stockValueSparkline}
              to="/SI-INV-001"
            />
            <DashboardTile
              label="Daily sales"
              value={<INRValue value={dailySalesTotal} />}
              secondary={
                <>
                  {dailyCovers.toLocaleString('en-IN')} covers · {lastDay}
                </>
              }
              trend="up"
              severity="success"
              sparkline={salesSparkline}
              to="/SI-RPT-005"
            />
          </div>
        </section>

        {/* Section: Operational */}
        <section
          className="mt-6 rounded-md bg-surface-container-low p-5"
          aria-labelledby="sec-operational"
        >
          <header className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2
                id="sec-operational"
                className="text-lg font-semibold text-on-surface"
              >
                Operational health
              </h2>
              <p className="text-xs text-on-surface-variant">
                Variance, approvals, provisional costs, expiring overrides — all
                tiles drill straight to the affected list.
              </p>
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              FR70 · FR15c · FR67a · FR110
            </span>
          </header>

          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
            <DashboardTile
              label="Variance flags (7d)"
              value={totalVarianceFlags}
              secondary={
                <>
                  {closingVarianceFlags} closing · {productionYieldVariances} production yield
                </>
              }
              severity="warning"
              trend="up"
              to="/SI-INV-016"
            />
            <DashboardTile
              label="Pending approvals · high value"
              value={pendingApprovalsHighValue}
              secondary={
                <>
                  Above {formatINR(PENDING_APPROVAL_THRESHOLD)} threshold
                </>
              }
              severity="warning"
              to="/SI-INF-001"
            />
            <DashboardTile
              label="Provisional cost POs"
              value={provisionalPOs}
              secondary={
                <span className="inline-flex items-center gap-1">
                  <StatusPill status="status_provisional" size="sm" />
                  <span>·</span>
                  <span>{provisionalRecipes} recipes flagged</span>
                </span>
              }
              to="/SI-PRO-009"
            />
            <DashboardTile
              label="Pending-GR resolution outcomes"
              value={rejectedGRs.length}
              secondary={<>Rejected GRs awaiting reclassification</>}
              severity="error"
              to="/SI-PRO-009"
            />
            <DashboardTile
              label="Expiring overrides"
              value={expiringOverridesTotal}
              secondary={
                <>
                  <span className="text-error">{expiringOverridesUrgent} urgent</span>
                  <span className="text-on-surface-variant"> · within 7 days</span>
                </>
              }
              severity={expiringOverridesUrgent > 0 ? 'error' : 'neutral'}
              to="/SI-USR-007"
            />
            <DashboardTile
              label="Unusual activity"
              value={unusualActivityCount}
              secondary={<>Active alerts in feed (FR110)</>}
              severity={unusualActivityCount > 0 ? 'warning' : 'neutral'}
              to="/SI-RPT-008"
            />
          </div>
        </section>

        {/* Section: Override + Pending-GR drill (P2B-005 hero pair) */}
        <section
          className="mt-6 rounded-md bg-surface-container-low p-5"
          aria-labelledby="sec-overrides"
        >
          <header className="mb-4">
            <h2
              id="sec-overrides"
              className="text-lg font-semibold text-on-surface"
            >
              Overrides &amp; Pending-GR
            </h2>
            <p className="text-xs text-on-surface-variant">
              The aggregating P2B-005 widget plus the originating surface for
              cross-entity GR-rejection threads.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-4 desktop:grid-cols-2">
            <OverrideWidget
              rate={overrideHeroRate}
              series={overrideSeries}
              rollingAvg={overrideRollingAvg7}
              breakdown={overrideBreakdown}
            />
            <PendingGRDrill entries={pendingGRDrillEntries} />
          </div>
        </section>

        {/* Section: Data quality */}
        <section
          className="mt-6 rounded-md bg-surface-container-low p-5"
          aria-labelledby="sec-data-quality"
        >
          <header className="mb-4 flex items-baseline justify-between gap-3">
            <div>
              <h2
                id="sec-data-quality"
                className="text-lg font-semibold text-on-surface"
              >
                Data quality
              </h2>
              <p className="text-xs text-on-surface-variant">
                Cross-module inconsistencies surfaced by Epic 1 detection rules.
              </p>
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              FR116
            </span>
          </header>

          <DataQualityAlertPane alerts={dataQualityAlerts} />
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          SI-RPT-002 · Tier 1 Group 1 · Phase 2c-S3
        </footer>
      </div>
    </div>
  )
}
