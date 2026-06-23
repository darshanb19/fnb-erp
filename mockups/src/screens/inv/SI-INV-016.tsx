import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Bell,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CircleOff,
  Plus,
  X,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  DashboardTile,
  DataQualityAlertPane,
  IssueTicketLink,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shell'
import type { DataQualityAlert } from '@/shell'

import {
  closingInventory,
  cutOffRegistry,
  formatINR,
} from '@/lib/inv-sample-data'

import {
  NOW,
  departments,
  locations,
} from '@/lib/sample-data'

/**
 * SI-INV-016 — Closing Inventory Cluster Review.
 *
 * Tier 2 — Phase 4 Epic 4 Arc (b) W1. Desktop-primary.
 *
 * Cluster Manager / Brand Owner read-only review surface for submitted
 * closing-inventory records across the full cluster, for a given business
 * date. Five sections:
 *   (1) Aggregate DashboardTile grid — total locations, on-time, late,
 *       not submitted, total cluster variance value.
 *   (2) Filter chips — scope, business date, dept type (copied from the
 *       SI-INV-001 §11 pattern; fixture-limited chips are visual-chrome-only
 *       with inline comments).
 *   (3) Per-location Table — one row per closingInventory entry in the
 *       cluster-spread set (ci-003 … ci-005 + ci-001/ci-002 for fuller demo),
 *       with status pill, submission timestamp, variance value, items count,
 *       top variance reasons, IssueTicketLink.
 *   (4) Not-Submitted-by-Cut-off pane via DataQualityAlertPane (ci-004:
 *       Bandra Pali, dept-bp-kitchen).
 *   (5) Per-location inline expand drill-in — variance lines, reason codes,
 *       AuditLink per line.
 *
 * Sub-affordances:
 *   - IssueTicketLink per row (entityRef = ciTrn).
 *   - "Mark variance acceptable" — visual only (no write service wired in
 *     Arc b mockups).
 *   - "Send reminder" — visual broadcast (no notification service here).
 *
 * CC-DATA-QUALITY-ALERT — DataQualityAlertPane for not-submitted rows.
 * CC-AUDIT-LINK — per-line AuditLink in the drill-in panel.
 *
 * Filter chips that the fixture cannot truly narrow are visual-chrome-only,
 * per SI-INV-001 §11 pattern — inline comments mark each such chip.
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory tables / dashboards.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NOW_DATE = new Date(`${NOW}T09:00:00+05:30`)

/** Format an ISO timestamp to a readable submission time string. */
function fmtTimestamp(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  // e.g. "05 May 2026, 23:45"
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  })
}

/** Hours overdue from cut-off, as a positive integer. Returns null if N/A. */
function hoursOverdue(businessDate: string, cutOffTime: string): number {
  // Cut-off = businessDate + cutOffTime in IST
  const [ch, cm] = cutOffTime.split(':').map(Number)
  const cutOff = new Date(`${businessDate}T${String(ch).padStart(2, '0')}:${String(cm).padStart(2, '0')}:00+05:30`)
  const diffMs = NOW_DATE.getTime() - cutOff.getTime()
  return Math.max(0, Math.round(diffMs / 3600000))
}

const locationName = (id: string): string =>
  locations.find((l) => l.id === id)?.name ?? id

const deptName = (id: string): string =>
  departments.find((d) => d.id === id)?.name ?? id

const materialName = (id: string): string => {
  // Inline lookup from a lightweight static map (avoids importing all materials
  // into a screen that doesn't need the full catalogue).
  const MAP: Record<string, string> = {
    'mat-chicken': 'Chicken',
    'mat-basmati-rice': 'Basmati Rice',
    'mat-onion': 'Onion',
    'mat-milk': 'Milk',
    'mat-sugar': 'Sugar',
    'mat-mutton': 'Mutton',
    'mat-ghee': 'Ghee',
    'mat-paneer': 'Paneer',
  }
  return MAP[id] ?? id
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived cluster view — use the cluster-spread records (ci-003 … ci-005) plus
// ci-001 / ci-002 for a richer demo set (5 entries across 4 distinct locations).
// ─────────────────────────────────────────────────────────────────────────────

const CLUSTER_REVIEW_IDS = new Set(['ci-001', 'ci-002', 'ci-003', 'ci-004', 'ci-005'])

const clusterRows = closingInventory.filter((ci) => CLUSTER_REVIEW_IDS.has(ci.id))

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate counters
// ─────────────────────────────────────────────────────────────────────────────

const counters = (() => {
  const totalLocations = new Set(clusterRows.map((ci) => ci.locationId)).size
  const submittedOnTime = clusterRows.filter((ci) => ci.cutOffStatus === 'on_time').length
  const submittedLate = clusterRows.filter((ci) => ci.cutOffStatus === 'late').length
  const notSubmitted = clusterRows.filter((ci) => ci.cutOffStatus === 'not_submitted').length
  const totalVarianceValue = clusterRows.reduce((sum, ci) => sum + ci.totalVarianceValue, 0)
  return { totalLocations, submittedOnTime, submittedLate, notSubmitted, totalVarianceValue }
})()

// ─────────────────────────────────────────────────────────────────────────────
// Not-submitted-by-cut-off alerts (DataQualityAlertPane)
// ─────────────────────────────────────────────────────────────────────────────

const notSubmittedAlerts: ReadonlyArray<DataQualityAlert> = clusterRows
  .filter((ci) => ci.cutOffStatus === 'not_submitted')
  .map((ci) => {
    const reg = cutOffRegistry.find((r) => r.locationId === ci.locationId)
    const cutOffTime = reg?.cutOffTime ?? '23:59'
    const overdue = hoursOverdue(ci.businessDate, cutOffTime)
    return {
      id: ci.id,
      kind: 'other' as const,
      severity: 'critical' as const,
      message: `${locationName(ci.locationId)} — ${deptName(ci.departmentId)} has not submitted closing inventory.`,
      link: `/SI-INV-014?location=${encodeURIComponent(ci.locationId)}`,
      context: `Expected cut-off: ${cutOffTime} IST · ${overdue > 0 ? `${overdue}h overdue` : 'cut-off passed'}`,
    }
  })

// ─────────────────────────────────────────────────────────────────────────────
// Filter sub-component (copied from SI-INV-001 FilterChipPicker pattern §11)
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

// ─────────────────────────────────────────────────────────────────────────────
// Drill-in panel (inline expand per row)
// ─────────────────────────────────────────────────────────────────────────────

interface DrillInPanelProps {
  readonly ciId: string
}

function DrillInPanel({ ciId }: DrillInPanelProps) {
  const ci = closingInventory.find((c) => c.id === ciId)
  if (!ci) return null

  const lines = ci.lines.filter((l) => l.variance !== 0)

  if (lines.length === 0) {
    return (
      <div className="px-4 py-3 rounded-md bg-surface-container-lowest">
        <p className="text-sm text-on-surface-variant">
          No variance lines — all items counted as expected.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <AuditLink entityRef={ci.ciTrn} compact />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 rounded-md bg-surface-container-lowest">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        Variance lines ({lines.length})
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead className="text-right">Expected</TableHead>
            <TableHead className="text-right">Counted</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Audit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, i) => (
            <TableRow key={`${ciId}-line-${i}`} className="hover:bg-surface-container transition-colors">
              <TableCell>
                <span className="font-medium text-on-surface">
                  {materialName(line.materialId)}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums text-on-surface-variant">
                {line.expectedQty} {line.uom}
              </TableCell>
              <TableCell className="text-right tabular-nums text-on-surface-variant">
                {line.countedQty} {line.uom}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span className={line.variance < 0 ? 'text-error font-medium' : 'text-on-surface-variant'}>
                  {line.variance > 0 ? '+' : ''}{line.variance} {line.uom}
                </span>
              </TableCell>
              <TableCell>
                {line.reasonCode ? (
                  <span className="rounded-pill bg-surface-container px-2 py-0.5 text-[11px] text-on-surface-variant">
                    {line.reasonCode.replace(/_/g, ' ')}
                  </span>
                ) : (
                  <span className="text-[11px] text-error">No reason code</span>
                )}
              </TableCell>
              <TableCell>
                <AuditLink entityRef={ci.ciTrn} compact />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* "Mark variance acceptable" — visual only; no write service in Arc b mockup */}
        <Button variant="tonal" size="sm" className="gap-1.5">
          <CheckCircle className="h-3.5 w-3.5" aria-hidden />
          <span className="text-xs">Mark variance acceptable</span>
        </Button>
        {/* Full audit link */}
        <AuditLink entityRef={ci.ciTrn} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Status mapping helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Maps cutOffStatus × closingStatus → a StatusPill status token. */
function rowStatusToken(
  cutOffStatus: string,
  closingStatus: string,
): string {
  if (cutOffStatus === 'not_submitted') return 'status_inactive'  // uses error semantic chip
  if (closingStatus === 'variance_flagged') return 'status_variance_flagged'
  if (closingStatus === 'confirmed') return 'status_completed'
  return 'status_pending_approval'
}

/** Human label for the status pill. */
function rowStatusLabel(cutOffStatus: string, closingStatus: string): string {
  if (cutOffStatus === 'not_submitted') return 'Not submitted'
  if (cutOffStatus === 'late') return 'Submitted late'
  if (closingStatus === 'variance_flagged') return 'Variance flagged'
  if (closingStatus === 'confirmed') return 'Submitted'
  return 'Pending review'
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter state
// ─────────────────────────────────────────────────────────────────────────────

type ScopeFilter = 'cluster' | 'brand'
type DeptTypeFilter = 'pos' | 'dispatch'

interface FilterState {
  readonly scopes: ReadonlySet<ScopeFilter>
  // businessDate filter: visual-chrome-only — fixture is pinned to daysBefore(1)
  readonly businessDates: ReadonlySet<string>
  readonly deptTypes: ReadonlySet<DeptTypeFilter>
}

const INITIAL_FILTERS: FilterState = {
  scopes: new Set(),
  businessDates: new Set(),
  deptTypes: new Set(),
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv016() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id))

  const toggleSet = <V extends string>(set: ReadonlySet<V>, v: V): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const updateFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  // deptType is the only filter the fixture can truly narrow (pos vs dispatch).
  // scope + businessDate are visual-chrome-only per SI-INV-001 §11 pattern.
  const filtered = useMemo(() => {
    return clusterRows.filter((ci) => {
      if (filters.deptTypes.size > 0 && !filters.deptTypes.has(ci.deptType)) return false
      // scope filter: visual-chrome-only — fixture is already cluster-scoped;
      // empty selection = "no filter applied", any chip continues to surface the
      // same set (visual chrome only per §11).
      // businessDate filter: visual-chrome-only — fixture pinned to daysBefore(1);
      // toggling has no filtering effect on the fixture rows.
      return true
    })
  }, [filters.deptTypes])

  const anyFilterActive =
    filters.scopes.size > 0 ||
    filters.businessDates.size > 0 ||
    filters.deptTypes.size > 0

  // Build the unique business date list from the cluster rows (for the visual chip picker)
  const uniqueBusinessDates = useMemo(
    () => Array.from(new Set(clusterRows.map((ci) => ci.businessDate))).sort(),
    [],
  )

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Closing inventory · Cluster review
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Closing Inventory — Cluster Review
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Cluster Manager / Brand Owner review of submitted closing inventory across all
              locations. Per-location variance drill-down; not-submitted-by-cut-off alerts
              (FR35/FR36). Read-only.
            </p>
          </div>
        </header>

        {/* (1) Aggregate DashboardTile grid */}
        <section
          aria-label="Cluster closing-inventory counters"
          className="mt-6 grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-5 gap-3"
        >
          <DashboardTile
            label="Total locations"
            value={counters.totalLocations.toString()}
            secondary="In scope this period"
          />
          <DashboardTile
            label="Submitted on time"
            value={counters.submittedOnTime.toString()}
            secondary="Within cut-off"
            severity="neutral"
          />
          <DashboardTile
            label="Submitted late"
            value={counters.submittedLate.toString()}
            secondary="After cut-off"
            severity={counters.submittedLate > 0 ? 'warning' : 'neutral'}
          />
          <DashboardTile
            label="Not submitted"
            value={counters.notSubmitted.toString()}
            secondary="Cut-off passed"
            severity={counters.notSubmitted > 0 ? 'error' : 'neutral'}
          />
          <DashboardTile
            label="Total cluster variance"
            value={formatINR(counters.totalVarianceValue)}
            secondary="Across submitted records"
            severity={counters.totalVarianceValue > 0 ? 'warning' : 'neutral'}
          />
        </section>

        {/* (2) Filter strip */}
        <section
          aria-label="Cluster review filters"
          className="mt-6 rounded-md bg-surface-container-low p-3 tablet:p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="-mx-3 px-3 flex w-full items-center gap-2 overflow-x-auto tablet:mx-0 tablet:px-0 tablet:overflow-visible tablet:flex-wrap">
              {/*
               * Scope chip — visual-chrome-only per SI-INV-001 §11 pattern.
               * The fixture is already cluster-scoped; toggling has no
               * filtering effect on the data.
               */}
              <FilterChipPicker<ScopeFilter>
                title="Scope"
                options={[
                  { value: 'cluster', label: 'This cluster' },
                  { value: 'brand', label: 'Brand-wide' },
                ]}
                selected={filters.scopes}
                onToggle={(v) => updateFilter('scopes', toggleSet(filters.scopes, v))}
                onClear={() => updateFilter('scopes', new Set())}
              />
              {/*
               * Business date chip — visual-chrome-only per SI-INV-001 §11
               * pattern. All fixture rows share the same business date
               * (daysBefore(1)); toggling has no narrowing effect.
               */}
              <FilterChipPicker<string>
                title="Business date"
                options={uniqueBusinessDates.map((d) => ({ value: d, label: d }))}
                selected={filters.businessDates}
                onToggle={(v) =>
                  updateFilter('businessDates', toggleSet(filters.businessDates, v))
                }
                onClear={() => updateFilter('businessDates', new Set())}
              />
              {/* Dept type chip — truly narrows (pos vs dispatch in the fixture). */}
              <FilterChipPicker<DeptTypeFilter>
                title="Dept type"
                options={[
                  { value: 'pos', label: 'POS' },
                  { value: 'dispatch', label: 'Dispatch' },
                ]}
                selected={filters.deptTypes}
                onToggle={(v) =>
                  updateFilter('deptTypes', toggleSet(filters.deptTypes, v))
                }
                onClear={() => updateFilter('deptTypes', new Set())}
              />
            </div>

            {anyFilterActive ? (
              <div className="flex w-full justify-end">
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

        {/* (3) Per-location Table */}
        <section aria-label="Closing inventory per location" className="mt-6">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">
              Location breakdown
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </span>
          </header>

          {/* Desktop table — hidden on mobile */}
          <div className="hidden tablet:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted at</TableHead>
                  <TableHead className="text-right">Variance value</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>Top reasons</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead aria-label="Expand row" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ci) => {
                  const statusToken = rowStatusToken(ci.cutOffStatus, ci.status)
                  const statusLabel = rowStatusLabel(ci.cutOffStatus, ci.status)
                  const isExpanded = expandedId === ci.id

                  // Collect unique reason codes from variance lines
                  const reasons = Array.from(
                    new Set(
                      ci.lines
                        .filter((l) => l.variance !== 0 && l.reasonCode)
                        .map((l) => l.reasonCode as string),
                    ),
                  ).slice(0, 2)

                  return (
                    <>
                      <TableRow
                        key={ci.id}
                        className="hover:bg-surface-container transition-colors cursor-pointer"
                        onClick={() => toggleExpand(ci.id)}
                        aria-expanded={isExpanded}
                      >
                        <TableCell>
                          <span className="font-medium text-on-surface">
                            {locationName(ci.locationId)}
                          </span>
                        </TableCell>
                        <TableCell className="text-on-surface-variant text-xs">
                          {deptName(ci.departmentId)}
                        </TableCell>
                        <TableCell>
                          <span className="rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                            {ci.deptType === 'pos' ? 'POS' : 'Dispatch'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            status={statusToken as Parameters<typeof StatusPill>[0]['status']}
                            size="sm"
                            label={statusLabel}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-on-surface-variant tabular-nums">
                          {fmtTimestamp(ci.submissionTimestamp)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {ci.totalVarianceValue > 0 ? (
                            <span className="text-warning font-medium">
                              {formatINR(ci.totalVarianceValue)}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-on-surface-variant">
                          {ci.varianceItemsCount > 0 ? ci.varianceItemsCount : '—'}
                        </TableCell>
                        <TableCell>
                          {reasons.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {reasons.map((r) => (
                                <span
                                  key={r}
                                  className="rounded-pill bg-surface-container px-2 py-0.5 text-[11px] text-on-surface-variant"
                                >
                                  {r.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-on-surface-variant">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <IssueTicketLink entityRef={ci.ciTrn} />
                            {/* "Send reminder" — visual broadcast; no notification service in Arc b */}
                            {ci.cutOffStatus === 'not_submitted' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 px-2 gap-1 text-xs rounded-pill"
                                aria-label={`Send reminder for ${locationName(ci.locationId)}`}
                              >
                                <Bell className="h-3.5 w-3.5" aria-hidden />
                                Remind
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            aria-label={isExpanded ? 'Collapse variance detail' : 'Expand variance detail'}
                            className="flex items-center justify-center h-9 w-9 rounded-sm hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpand(ci.id)
                            }}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-on-surface-variant" aria-hidden />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-on-surface-variant" aria-hidden />
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow key={`${ci.id}-drill`} className="bg-surface-container-lowest">
                          <TableCell colSpan={10} className="py-3 px-4">
                            <DrillInPanel ciId={ci.id} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card stack */}
          <div className="flex flex-col gap-3 tablet:hidden">
            {filtered.map((ci) => {
              const statusToken = rowStatusToken(ci.cutOffStatus, ci.status)
              const statusLabel = rowStatusLabel(ci.cutOffStatus, ci.status)
              const isExpanded = expandedId === ci.id
              const reasons = Array.from(
                new Set(
                  ci.lines
                    .filter((l) => l.variance !== 0 && l.reasonCode)
                    .map((l) => l.reasonCode as string),
                ),
              ).slice(0, 2)

              return (
                <div
                  key={ci.id}
                  className="rounded-md bg-surface-container-lowest p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-on-surface">
                        {locationName(ci.locationId)}
                      </p>
                      <p className="mt-0.5 text-xs text-on-surface-variant">
                        {deptName(ci.departmentId)} · {ci.deptType === 'pos' ? 'POS' : 'Dispatch'}
                      </p>
                    </div>
                    <StatusPill
                      status={statusToken as Parameters<typeof StatusPill>[0]['status']}
                      size="sm"
                      label={statusLabel}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-on-surface-variant">
                    <span>{fmtTimestamp(ci.submissionTimestamp)}</span>
                    {ci.totalVarianceValue > 0 ? (
                      <span className="text-warning font-medium">
                        {formatINR(ci.totalVarianceValue)} variance
                      </span>
                    ) : null}
                    {reasons.length > 0 ? (
                      <span>{reasons.map((r) => r.replace(/_/g, ' ')).join(', ')}</span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <IssueTicketLink entityRef={ci.ciTrn} />
                    {ci.cutOffStatus === 'not_submitted' ? (
                      <Button variant="ghost" size="sm" className="h-9 px-2 gap-1 text-xs rounded-pill">
                        <Bell className="h-3.5 w-3.5" aria-hidden />
                        Remind
                      </Button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleExpand(ci.id)}
                      aria-expanded={isExpanded}
                      className="ml-auto flex items-center gap-1 text-xs text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-2 py-1"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                          Collapse
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                          View lines
                        </>
                      )}
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="mt-3">
                      <DrillInPanel ciId={ci.id} />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        {/* (4) Not-Submitted-by-Cut-off pane */}
        {notSubmittedAlerts.length > 0 ? (
          <section aria-label="Not submitted by cut-off" className="mt-6">
            <header className="mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-error" aria-hidden />
              <h2 className="text-base font-semibold text-on-surface">
                Not submitted by cut-off
              </h2>
              <span className="rounded-pill bg-error px-2 py-0.5 text-[11px] font-semibold text-on-primary">
                {notSubmittedAlerts.length}
              </span>
            </header>
            <DataQualityAlertPane
              alerts={notSubmittedAlerts}
              className="mt-0"
            />
          </section>
        ) : null}

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <CircleOff className="h-3 w-3" aria-hidden />
          <span>
            Read-only cluster review · no write operations · drill into a row to see variance
            lines · raise an issue or send a reminder per row.
          </span>
          <span className="ml-auto">SI-INV-016 · Tier 2 · Phase 4 Epic 4 Arc (b)</span>
        </footer>
      </div>
    </div>
  )
}
