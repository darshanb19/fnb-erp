import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarRange,
  ChevronDown,
  ChartLine,
  Coins,
  GitCompare,
  X,
} from 'lucide-react'

import { Button } from './Button'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'

/**
 * FCCCDualSurface — CC-FCCC-DUAL-SURFACE canonical (FR95 + FR108).
 *
 * Shared chrome wrapper for the two halves of the Food Cost Control Centre:
 *   - Financial framing  → SI-ACC-010 (`surface="financial"`)
 *   - Operational analytics → SI-RPT-006 (`surface="operational"`)
 *
 * Both surfaces share period + scope filters AND a drill-down state contract:
 * navigating between the two surfaces preserves the selected item context
 * (recipe / menu item). State lives in URL search params so the route change
 * keeps it intact:
 *
 *   ?period=apr_2026 &scope=brand &compare=mom &item=rec-mutton-galouti
 *
 * The shell does NOT own data — both screens query their own fixtures off the
 * same `recipes` / `menuItems` from sample-data. The cross-link is purely the
 * URL.
 *
 * Layout — page header with eyebrow + title + helper subtitle, tab pair with
 * `aria-current="page"` on the active link, shared filter strip (period /
 * scope / comparison-period popovers in SI-ACC-003 idiom), optional
 * "Following: {item}" pill, then the children body slot. No 1-px borders
 * anywhere — section depth comes from tonal `surface_container_*` shifts.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types — closed unions; values match URL search-params encoding
// ─────────────────────────────────────────────────────────────────────────────

export type FCCCSurface = 'financial' | 'operational'

export type FCCCPeriod = 'apr_2026' | 'mar_2026' | 'q4_fy26' | 'fy26'

export type FCCCScope =
  | 'brand'
  | 'cluster_bandra'
  | 'cluster_andheri'
  | 'cluster_powai'
  | 'loc_linking'
  | 'loc_phoenix'

export type FCCCComparison = 'prior_month' | 'qoq' | 'yoy'

// ─────────────────────────────────────────────────────────────────────────────
// Display labels
// ─────────────────────────────────────────────────────────────────────────────

export const FCCC_PERIOD_LABEL: Record<FCCCPeriod, string> = {
  apr_2026: 'April 2026 (current)',
  mar_2026: 'March 2026',
  q4_fy26: 'Q4 FY 25-26',
  fy26: 'FY 25-26 to date',
}

export const FCCC_PERIOD_RANGE: Record<FCCCPeriod, { from: string; to: string; short: string }> = {
  apr_2026: { from: '2026-04-01', to: '2026-04-30', short: 'Apr 2026' },
  mar_2026: { from: '2026-03-01', to: '2026-03-31', short: 'Mar 2026' },
  q4_fy26: { from: '2026-01-01', to: '2026-03-31', short: 'Q4 FY 25-26' },
  fy26: { from: '2025-04-01', to: '2026-03-31', short: 'FY 25-26' },
}

export const FCCC_SCOPE_LABEL: Record<FCCCScope, string> = {
  brand: 'Brand-wide',
  cluster_bandra: 'Cluster · Bandra-West',
  cluster_andheri: 'Cluster · Andheri-East',
  cluster_powai: 'Cluster · Powai',
  loc_linking: 'Wild Sugar Linking Road',
  loc_phoenix: 'Wild Sugar Phoenix Marketcity',
}

export const FCCC_COMPARISON_LABEL: Record<FCCCComparison, string> = {
  prior_month: 'M-o-M (prior month)',
  qoq: 'Q-o-Q (prior quarter)',
  yoy: 'Y-o-Y (prior year)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults + closed-union guards (used by the URL hook)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PERIOD: FCCCPeriod = 'apr_2026'
const DEFAULT_SCOPE: FCCCScope = 'brand'
const DEFAULT_COMPARISON: FCCCComparison = 'prior_month'

function isFCCCPeriod(v: string | null): v is FCCCPeriod {
  return v != null && v in FCCC_PERIOD_LABEL
}
function isFCCCScope(v: string | null): v is FCCCScope {
  return v != null && v in FCCC_SCOPE_LABEL
}
function isFCCCComparison(v: string | null): v is FCCCComparison {
  return v != null && v in FCCC_COMPARISON_LABEL
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — read/write FCCC state from URL search params
// ─────────────────────────────────────────────────────────────────────────────

export interface FCCCState {
  period: FCCCPeriod
  scope: FCCCScope
  comparison: FCCCComparison
  /** Selected item id (recipe id or menu-item id). Null if no item is followed. */
  itemId: string | null
}

export interface FCCCStateWithSetters extends FCCCState {
  setPeriod: (next: FCCCPeriod) => void
  setScope: (next: FCCCScope) => void
  setComparison: (next: FCCCComparison) => void
  setItem: (next: string | null) => void
}

/**
 * Read/write the FCCC URL contract. Both halves of the Dual Surface use
 * this — keeping the contract centralised guarantees they stay in sync.
 */
export function useFCCCSearchParams(): FCCCStateWithSetters {
  const [params, setParams] = useSearchParams()

  const periodParam = params.get('period')
  const scopeParam = params.get('scope')
  const compareParam = params.get('compare')
  const itemParam = params.get('item')

  const period = isFCCCPeriod(periodParam) ? periodParam : DEFAULT_PERIOD
  const scope = isFCCCScope(scopeParam) ? scopeParam : DEFAULT_SCOPE
  const comparison = isFCCCComparison(compareParam) ? compareParam : DEFAULT_COMPARISON
  const itemId = itemParam && itemParam.length > 0 ? itemParam : null

  const update = useCallback(
    (key: 'period' | 'scope' | 'compare' | 'item', value: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value == null || value === '') {
            next.delete(key)
          } else {
            next.set(key, value)
          }
          return next
        },
        { replace: false },
      )
    },
    [setParams],
  )

  return {
    period,
    scope,
    comparison,
    itemId,
    setPeriod: (next) => update('period', next),
    setScope: (next) => update('scope', next),
    setComparison: (next) => update('compare', next),
    setItem: (next) => update('item', next),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pickers — period / scope / comparison
// ─────────────────────────────────────────────────────────────────────────────

function PickerButton({
  eyebrow,
  value,
  icon,
}: {
  eyebrow: string
  value: string
  icon?: ReactNode
}) {
  return (
    <Button variant="tonal" size="sm" className="h-9 px-3 gap-1.5 rounded-pill">
      {icon}
      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        {eyebrow}
      </span>
      <span className="text-xs font-medium text-on-surface">{value}</span>
      <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
    </Button>
  )
}

interface PickerOptionListProps<K extends string> {
  options: ReadonlyArray<K>
  value: K
  labels: Record<K, string>
  helper?: (key: K) => string | undefined
  onSelect: (next: K) => void
}

function PickerOptionList<K extends string>({
  options,
  value,
  labels,
  helper,
  onSelect,
}: PickerOptionListProps<K>) {
  return (
    <ul className="flex flex-col">
      {options.map((opt) => {
        const active = opt === value
        const help = helper?.(opt)
        return (
          <li key={opt}>
            <button
              type="button"
              onClick={() => onSelect(opt)}
              className={[
                'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-3 min-h-[44px]',
                'hover:bg-surface-container-high transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                active ? 'bg-surface-container' : '',
              ].join(' ')}
            >
              <span className="flex flex-col">
                <span className="text-sm text-on-surface">{labels[opt]}</span>
                {help ? (
                  <span className="text-[11px] text-on-surface-variant tabular-nums">{help}</span>
                ) : null}
              </span>
              {active ? <span className="text-xs font-medium text-primary">Active</span> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function PeriodPicker({
  value,
  onChange,
}: {
  value: FCCCPeriod
  onChange: (next: FCCCPeriod) => void
}) {
  const [open, setOpen] = useState(false)
  const options = Object.keys(FCCC_PERIOD_LABEL) as ReadonlyArray<FCCCPeriod>
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span>
          <PickerButton
            eyebrow="Period"
            value={FCCC_PERIOD_LABEL[value]}
            icon={
              <CalendarRange
                className="h-3.5 w-3.5 text-on-surface-variant"
                aria-hidden
              />
            }
          />
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Reporting period
        </p>
        <PickerOptionList
          options={options}
          value={value}
          labels={FCCC_PERIOD_LABEL}
          helper={(k) => `${FCCC_PERIOD_RANGE[k].from} → ${FCCC_PERIOD_RANGE[k].to}`}
          onSelect={(next) => {
            onChange(next)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function ScopePicker({
  value,
  onChange,
}: {
  value: FCCCScope
  onChange: (next: FCCCScope) => void
}) {
  const [open, setOpen] = useState(false)
  const options = Object.keys(FCCC_SCOPE_LABEL) as ReadonlyArray<FCCCScope>
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span>
          <PickerButton
            eyebrow="Scope"
            value={FCCC_SCOPE_LABEL[value]}
            icon={<Coins className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />}
          />
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Brand · cluster · location
        </p>
        <PickerOptionList
          options={options}
          value={value}
          labels={FCCC_SCOPE_LABEL}
          onSelect={(next) => {
            onChange(next)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function ComparisonPicker({
  value,
  onChange,
}: {
  value: FCCCComparison
  onChange: (next: FCCCComparison) => void
}) {
  const [open, setOpen] = useState(false)
  const options = Object.keys(FCCC_COMPARISON_LABEL) as ReadonlyArray<FCCCComparison>
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span>
          <PickerButton
            eyebrow="Compare"
            value={FCCC_COMPARISON_LABEL[value]}
            icon={
              <GitCompare className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
            }
          />
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Comparison period (FR95)
        </p>
        <PickerOptionList
          options={options}
          value={value}
          labels={FCCC_COMPARISON_LABEL}
          onSelect={(next) => {
            onChange(next)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab pair — Financial ↔ Operational
// ─────────────────────────────────────────────────────────────────────────────

const SURFACE_ROUTE: Record<FCCCSurface, string> = {
  financial: '/SI-ACC-010',
  operational: '/SI-RPT-006',
}

const SURFACE_LABEL: Record<FCCCSurface, string> = {
  financial: 'Financial framing',
  operational: 'Operational analytics',
}

const SURFACE_HELP: Record<FCCCSurface, string> = {
  financial:
    'Theoretical vs actual food cost · vendor price alerts · margin · wastage cost % · drill-through ≤2 clicks (FR95).',
  operational:
    'Cost-per-serving · product-mix Pareto · trend lines with anomaly highlights · suggested actions (FR108).',
}

function SurfaceTabs({
  active,
  searchString,
}: {
  active: FCCCSurface
  searchString: string
}) {
  const surfaces: ReadonlyArray<FCCCSurface> = ['financial', 'operational']
  return (
    <nav
      role="tablist"
      aria-label="Food Cost Control Centre surface"
      className="mt-6 inline-flex flex-wrap gap-1 rounded-pill bg-surface-container-high p-1"
    >
      {surfaces.map((s) => {
        const isActive = s === active
        const to = `${SURFACE_ROUTE[s]}${searchString ? `?${searchString}` : ''}`
        return (
          <Link
            key={s}
            to={to}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-sm font-medium min-h-[36px]',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              isActive
                ? 'bg-primary text-on-primary'
                : 'text-on-surface hover:bg-surface-container',
            ].join(' ')}
          >
            {s === 'financial' ? (
              <Coins className="h-4 w-4" aria-hidden />
            ) : (
              <ChartLine className="h-4 w-4" aria-hidden />
            )}
            <span>{SURFACE_LABEL[s]}</span>
          </Link>
        )
      })}
    </nav>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Selected-item pill — "Following: {item}" with deselect X
// ─────────────────────────────────────────────────────────────────────────────

function SelectedItemPill({
  itemLabel,
  onDeselect,
}: {
  itemLabel: string
  onDeselect: () => void
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-pill bg-tertiary-container px-3 py-1.5 text-on-tertiary-container"
    >
      <span className="text-[11px] font-medium uppercase tracking-wider opacity-80">
        Following
      </span>
      <span className="text-xs font-medium">{itemLabel}</span>
      <button
        type="button"
        onClick={onDeselect}
        aria-label={`Stop following ${itemLabel}`}
        title="Clear selection"
        className="inline-flex h-6 w-6 items-center justify-center rounded-pill hover:bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FCCCDualSurface — the wrapper consumed by SI-ACC-010 + SI-RPT-006
// ─────────────────────────────────────────────────────────────────────────────

export interface FCCCDualSurfaceProps {
  /** Which half of the dual surface this page renders. */
  surface: FCCCSurface
  /** Current period — drives the period picker label and the URL `period=`. */
  period: FCCCPeriod
  /** Current scope — drives the scope picker label and the URL `scope=`. */
  scope: FCCCScope
  /** Comparison period for the FR95 M-o-M / Q-o-Q / Y-o-Y toggle. */
  comparison: FCCCComparison
  /** Optional id of the followed item — appears in the pill. */
  selectedItemId?: string | null
  /** Friendly label of the followed item (used as the pill caption). */
  selectedItemLabel?: string | null
  onPeriodChange: (next: FCCCPeriod) => void
  onScopeChange: (next: FCCCScope) => void
  onComparisonChange: (next: FCCCComparison) => void
  onDeselectItem?: () => void
  /** Optional extras rendered on the right of the page header (e.g. ExportTrigger). */
  headerActions?: ReactNode
  /** Body slot — financial table or operational panels. */
  children: ReactNode
}

export function FCCCDualSurface({
  surface,
  period,
  scope,
  comparison,
  selectedItemId,
  selectedItemLabel,
  onPeriodChange,
  onScopeChange,
  onComparisonChange,
  onDeselectItem,
  headerActions,
  children,
}: FCCCDualSurfaceProps) {
  // Build the search-string we pass through when clicking the inactive tab,
  // so the sister surface lands with the same period / scope / compare / item.
  const searchString = useMemo(() => {
    const sp = new URLSearchParams()
    sp.set('period', period)
    sp.set('scope', scope)
    sp.set('compare', comparison)
    if (selectedItemId) sp.set('item', selectedItemId)
    return sp.toString()
  }, [period, scope, comparison, selectedItemId])

  const periodRange = FCCC_PERIOD_RANGE[period]
  const eyebrow = `Food Cost Control Centre · ${SURFACE_LABEL[surface]}`
  const title =
    surface === 'financial'
      ? 'FCCC — Financial framing'
      : 'FCCC — Operational analytics'

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-6 py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              {title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {SURFACE_HELP[surface]}
            </p>
          </div>
          {headerActions ? (
            <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
          ) : null}
        </header>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
          <span>Last refreshed: 7 May 2026, 09:18 IST</span>
          <span aria-hidden>·</span>
          <span>FR95 FCCC · {periodRange.short}</span>
          <span aria-hidden>·</span>
          <span>{FCCC_SCOPE_LABEL[scope]}</span>
        </div>

        {/* Tab pair — Financial ↔ Operational */}
        <SurfaceTabs active={surface} searchString={searchString} />

        {/* Filter strip — period + scope + compare + selected-item pill */}
        <section
          aria-label="Food Cost Control Centre filters"
          className="mt-4 rounded-md bg-surface-container-low p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker value={period} onChange={onPeriodChange} />
            <ScopePicker value={scope} onChange={onScopeChange} />
            <ComparisonPicker value={comparison} onChange={onComparisonChange} />
            <span className="ml-auto text-xs text-on-surface-variant">
              Period: {periodRange.from} → {periodRange.to}
            </span>
          </div>

          {selectedItemId && selectedItemLabel ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <SelectedItemPill
                itemLabel={selectedItemLabel}
                onDeselect={onDeselectItem ?? (() => {})}
              />
              <span className="text-xs text-on-surface-variant">
                Cross-link active — switching surface keeps this item in focus.
              </span>
            </div>
          ) : null}
        </section>

        {/* Body slot */}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
