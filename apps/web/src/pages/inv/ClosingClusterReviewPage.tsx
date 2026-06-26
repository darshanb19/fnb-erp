import React, { useMemo, useState } from 'react'
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
} from '@/components/shell'
import type { DataQualityAlert } from '@/components/shell'

import { useClosingSummary, useCutOffCompliance } from '@/hooks/inv/useClosingInventory'
import { useInventoryDepartments, useInventoryLocations } from '@/hooks/inv/useProductNames'
import { ApiError } from '@/lib/api-client'

/**
 * SI-INV-016 — Closing Inventory Cluster Review (production port of Arc-b mockup).
 *
 * Tier 2, Epic 4 Arc (c). Cluster Manager / Brand Owner read-only review
 * surface for submitted closing-inventory records across the full cluster,
 * for a given business date.
 *
 * Data: useClosingSummary + useCutOffCompliance (IST cut-off status).
 * Business-date control defaults to today; both hooks re-query on change.
 * Location + dept names resolved via minimal MDM list hooks (bare-array endpoints).
 * Mutations deferred: "Mark variance acceptable" + "Send reminder" are Wave-3 /
 * broadcast operations — rendered disabled with title.
 * Inert chips removed: "Scope" and "Dept type" chips not backed by the summary
 * endpoint in Wave 1 — both dropped.
 *
 * FRs: FR35 (cluster review), FR36 (cut-off compliance), FR77 (variance alerts).
 *
 * Animation: NONE. CLAUDE.md bans entrance animations on inventory tables.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Formats a number as Indian Rupee string e.g. ₹ 4,28,500. */
function formatINR(value: number): string {
  if (!Number.isFinite(value)) return '₹ 0'
  return (
    '₹ ' +
    new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(Math.abs(value))
  )
}

/** Format an ISO timestamp to a readable submission time string. */
function fmtTimestamp(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
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

// ─────────────────────────────────────────────────────────────────────────────
// Status mapping helpers — maps closing status → canonical status_* token
// ─────────────────────────────────────────────────────────────────────────────

type ClosingStatus = 'draft' | 'confirmed' | 'variance_flagged'

/** Maps closing status → a StatusPill status token from the canonical 20. */
function rowStatusToken(status: ClosingStatus): string {
  if (status === 'variance_flagged') return 'status_variance_flagged'
  if (status === 'confirmed') return 'status_completed'
  return 'status_draft'
}

/** Human label for the status pill. */
function rowStatusLabel(status: ClosingStatus): string {
  if (status === 'variance_flagged') return 'Variance flagged'
  if (status === 'confirmed') return 'Submitted'
  return 'Draft'
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter sub-component (FilterChipPicker — same pattern as sibling pages)
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
// Row shape derived from ClosingInventorySummary.records
// ─────────────────────────────────────────────────────────────────────────────

interface ClusterRow {
  readonly id: string
  readonly ciTrn: string
  readonly locationId: string
  readonly departmentId: string
  readonly status: ClosingStatus
  readonly varianceItemsCount: number | null
  readonly totalVarianceValue: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)

type StatusFilter = 'draft' | 'confirmed' | 'variance_flagged'

interface FilterState {
  readonly statuses: ReadonlySet<StatusFilter>
}

const INITIAL_FILTERS: FilterState = {
  statuses: new Set(),
}

export default function ClosingClusterReviewPage() {
  // ── All hooks FIRST — before any early returns ────────────────────────────
  const [businessDate, setBusinessDate] = useState(today)
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const {
    data: summary,
    isLoading: summaryLoading,
    error,
  } = useClosingSummary(businessDate, {})

  const { data: cutOff, isLoading: cutOffLoading } = useCutOffCompliance(businessDate, {})

  const { data: locations, isLoading: locationsLoading } = useInventoryLocations()
  const { data: departments, isLoading: deptsLoading } = useInventoryDepartments()

  // Build name-lookup maps — stable until data changes
  const locationNameOf = useMemo(() => {
    const m = new Map((locations ?? []).map((l) => [l.id, l.name]))
    return (id: string) => m.get(id) ?? id
  }, [locations])

  const deptNameOf = useMemo(() => {
    const m = new Map((departments ?? []).map((d) => [d.id, d.name]))
    return (id: string) => m.get(id) ?? id
  }, [departments])

  // Map summary records into ClusterRow shape
  const rows = useMemo<ReadonlyArray<ClusterRow>>(
    () =>
      (summary?.records ?? []).map((r) => ({
        id: r.id,
        ciTrn: r.ciTrn,
        locationId: r.locationId,
        departmentId: r.departmentId,
        status: r.status as ClosingStatus,
        varianceItemsCount: r.varianceItemsCount,
        totalVarianceValue: r.totalVarianceValue,
      })),
    [summary?.records],
  )

  // Filter — status filter is backed by the summary data
  const filtered = useMemo(() => {
    if (filters.statuses.size === 0) return rows
    return rows.filter((r) => filters.statuses.has(r.status as StatusFilter))
  }, [rows, filters.statuses])

  // Aggregate counters from summary
  const counters = useMemo(() => {
    const totalRecords = summary?.totalRecords ?? 0
    const confirmedCount = summary?.confirmedCount ?? 0
    const varianceFlaggedCount = summary?.varianceFlaggedCount ?? 0
    const draftCount = summary?.draftCount ?? 0
    const totalVarianceValue = rows.reduce(
      (sum, r) => sum + (r.totalVarianceValue ?? 0),
      0,
    )
    return { totalRecords, confirmedCount, varianceFlaggedCount, draftCount, totalVarianceValue }
  }, [summary, rows])

  // Not-submitted-by-cut-off alerts from cut-off compliance
  const notSubmittedAlerts = useMemo<ReadonlyArray<DataQualityAlert>>(() => {
    if (!cutOff || cutOff.status !== 'not_submitted') return []
    return [
      {
        id: `cutoff-${businessDate}`,
        kind: 'other' as const,
        severity: 'critical' as const,
        message: `Closing inventory has not been submitted for business date ${businessDate}.`,
        link: `/inventory/closing/entry`,
        context: `Expected cut-off: ${cutOff.cutOffTime ?? 'not configured'} IST · Status: ${cutOff.status.replace(/_/g, ' ')}`,
      },
    ]
  }, [cutOff, businessDate])

  const anyFilterActive = filters.statuses.size > 0

  const toggleSet = <V extends string>(set: ReadonlySet<V>, v: V): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const updateFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id))

  // Combined loading guard — covers all hooks
  const isLoading = summaryLoading || cutOffLoading || locationsLoading || deptsLoading

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
              locations. Per-location variance drill-down; not-submitted-by-cut-off alerts.
              Read-only.
            </p>
          </div>
        </header>

        {/* Business-date control */}
        <section aria-label="Business date selector" className="mt-4">
          <label
            htmlFor="business-date-input"
            className="block text-xs font-medium text-on-surface-variant mb-1"
          >
            Business date
          </label>
          <input
            id="business-date-input"
            type="date"
            value={businessDate}
            max={today}
            onChange={(e) => {
              setBusinessDate(e.target.value)
              setExpandedId(null)
            }}
            className={[
              'h-11 rounded-md px-3 text-sm text-on-surface',
              'bg-surface-container-low',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              'min-w-[180px]',
            ].join(' ')}
          />
        </section>

        {/* (1) Aggregate DashboardTile grid */}
        <section
          aria-label="Cluster closing-inventory counters"
          className="mt-6 grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-5 gap-3"
        >
          <DashboardTile
            label="Total records"
            value={counters.totalRecords.toString()}
            secondary="Submitted for this date"
          />
          <DashboardTile
            label="Confirmed"
            value={counters.confirmedCount.toString()}
            secondary="Fully submitted"
            severity="neutral"
          />
          <DashboardTile
            label="Variance flagged"
            value={counters.varianceFlaggedCount.toString()}
            secondary="Needs review"
            severity={counters.varianceFlaggedCount > 0 ? 'warning' : 'neutral'}
          />
          <DashboardTile
            label="Draft"
            value={counters.draftCount.toString()}
            secondary="Not yet confirmed"
            severity={counters.draftCount > 0 ? 'warning' : 'neutral'}
          />
          <DashboardTile
            label="Total cluster variance"
            value={formatINR(counters.totalVarianceValue)}
            secondary="Across submitted records"
            severity={counters.totalVarianceValue > 0 ? 'warning' : 'neutral'}
          />
        </section>

        {/* (2) Filter strip — status filter is backed by summary data */}
        <section
          aria-label="Cluster review filters"
          className="mt-6 rounded-md bg-surface-container-low p-3 tablet:p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="-mx-3 px-3 flex w-full items-center gap-2 overflow-x-auto tablet:mx-0 tablet:px-0 tablet:overflow-visible tablet:flex-wrap">
              {/* Status filter — truly narrows using summary.records[].status */}
              <FilterChipPicker<StatusFilter>
                title="Status"
                options={[
                  { value: 'confirmed', label: 'Confirmed' },
                  { value: 'variance_flagged', label: 'Variance flagged' },
                  { value: 'draft', label: 'Draft' },
                ]}
                selected={filters.statuses}
                onToggle={(v) =>
                  updateFilter('statuses', toggleSet(filters.statuses, v))
                }
                onClear={() => updateFilter('statuses', new Set())}
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

          {rows.length === 0 ? (
            /* Empty state — no records for this business date */
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <CircleOff
                className="mx-auto h-10 w-10 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-on-surface">
                No closing inventory records for {businessDate}.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Select a different business date or wait for locations to submit their
                closing counts.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            /* Filter empty state */
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <CircleOff
                className="mx-auto h-10 w-10 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-on-surface">
                No records match the current filter.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Adjust or clear the status filter to see all records.
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
              {/* Desktop table — hidden on mobile */}
              <div className="hidden tablet:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>Dept</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Variance value</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead>Actions</TableHead>
                      <TableHead aria-label="Expand row" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((ci) => {
                      const statusToken = rowStatusToken(ci.status)
                      const statusLabel = rowStatusLabel(ci.status)
                      const isExpanded = expandedId === ci.id

                      return (
                        <React.Fragment key={ci.id}>
                          <TableRow
                            className="hover:bg-surface-container transition-colors cursor-pointer"
                            onClick={() => toggleExpand(ci.id)}
                            aria-expanded={isExpanded}
                          >
                            <TableCell>
                              <span className="font-medium text-on-surface">
                                {locationNameOf(ci.locationId)}
                              </span>
                            </TableCell>
                            <TableCell className="text-on-surface-variant text-xs">
                              {deptNameOf(ci.departmentId)}
                            </TableCell>
                            <TableCell>
                              <StatusPill
                                status={statusToken as Parameters<typeof StatusPill>[0]['status']}
                                size="sm"
                                label={statusLabel}
                              />
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {(ci.totalVarianceValue ?? 0) > 0 ? (
                                <span className="text-warning font-medium">
                                  {formatINR(ci.totalVarianceValue!)}
                                </span>
                              ) : (
                                <span className="text-on-surface-variant">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-on-surface-variant">
                              {(ci.varianceItemsCount ?? 0) > 0
                                ? ci.varianceItemsCount
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <div
                                className="flex items-center gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <IssueTicketLink entityRef={ci.ciTrn} />
                                {/* "Send reminder" — Wave-3/broadcast mutation; deferred */}
                                <button
                                  type="button"
                                  disabled
                                  title="Send reminder — available in Wave 3 (broadcast)"
                                  className={[
                                    'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs',
                                    'bg-surface-container text-on-surface-variant opacity-40 cursor-not-allowed',
                                  ].join(' ')}
                                  aria-label={`Send reminder for ${locationNameOf(ci.locationId)} — available in Wave 3`}
                                >
                                  <Bell className="h-3 w-3" aria-hidden />
                                  Remind
                                </button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                aria-label={
                                  isExpanded
                                    ? 'Collapse variance detail'
                                    : 'Expand variance detail'
                                }
                                className="flex items-center justify-center h-9 w-9 rounded-sm hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpand(ci.id)
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronUp
                                    className="h-4 w-4 text-on-surface-variant"
                                    aria-hidden
                                  />
                                ) : (
                                  <ChevronDown
                                    className="h-4 w-4 text-on-surface-variant"
                                    aria-hidden
                                  />
                                )}
                              </button>
                            </TableCell>
                          </TableRow>
                          {isExpanded ? (
                            <TableRow
                              key={`${ci.id}-drill`}
                              className="bg-surface-container-lowest"
                            >
                              <TableCell colSpan={7} className="py-3 px-4">
                                <DrillInPanel ci={ci} fmtTimestamp={fmtTimestamp} />
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </React.Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card stack */}
              <div className="flex flex-col gap-3 tablet:hidden">
                {filtered.map((ci) => {
                  const statusToken = rowStatusToken(ci.status)
                  const statusLabel = rowStatusLabel(ci.status)
                  const isExpanded = expandedId === ci.id

                  return (
                    <div
                      key={ci.id}
                      className="rounded-md bg-surface-container-lowest p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-on-surface">
                            {locationNameOf(ci.locationId)}
                          </p>
                          <p className="mt-0.5 text-xs text-on-surface-variant">
                            {deptNameOf(ci.departmentId)}
                          </p>
                        </div>
                        <StatusPill
                          status={statusToken as Parameters<typeof StatusPill>[0]['status']}
                          size="sm"
                          label={statusLabel}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-on-surface-variant">
                        {(ci.totalVarianceValue ?? 0) > 0 ? (
                          <span className="text-warning font-medium">
                            {formatINR(ci.totalVarianceValue!)} variance
                          </span>
                        ) : null}
                        {(ci.varianceItemsCount ?? 0) > 0 ? (
                          <span>{ci.varianceItemsCount} variance items</span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <IssueTicketLink entityRef={ci.ciTrn} />
                        <button
                          type="button"
                          disabled
                          title="Send reminder — available in Wave 3 (broadcast)"
                          className={[
                            'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs',
                            'bg-surface-container text-on-surface-variant opacity-40 cursor-not-allowed',
                          ].join(' ')}
                          aria-label={`Send reminder for ${locationNameOf(ci.locationId)} — available in Wave 3`}
                        >
                          <Bell className="h-3 w-3" aria-hidden />
                          Remind
                        </button>
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
                              View detail
                            </>
                          )}
                        </button>
                      </div>

                      {isExpanded ? (
                        <div className="mt-3">
                          <DrillInPanel ci={ci} fmtTimestamp={fmtTimestamp} />
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>

        {/* (4) Not-Submitted-by-Cut-off pane */}
        {notSubmittedAlerts.length > 0 ? (
          <section aria-label="Not submitted by cut-off" className="mt-6">
            <header className="mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-error" aria-hidden />
              <h2 className="text-base font-semibold text-on-surface">
                Not submitted by cut-off
              </h2>
              <span className="rounded-pill bg-error px-2 py-0.5 text-[11px] font-semibold text-on-error">
                {notSubmittedAlerts.length}
              </span>
            </header>
            <DataQualityAlertPane alerts={notSubmittedAlerts} className="mt-0" />
          </section>
        ) : null}

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <CircleOff className="h-3 w-3" aria-hidden />
          <span>
            Read-only cluster review · no write operations · drill into a row for variance
            detail · raise an issue per row.
          </span>
        </footer>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Drill-in panel — inline expand per row
// ─────────────────────────────────────────────────────────────────────────────

interface DrillInPanelProps {
  readonly ci: ClusterRow
  readonly fmtTimestamp: (iso: string | null) => string
}

function DrillInPanel({ ci, fmtTimestamp: _fmtTimestamp }: DrillInPanelProps) {
  if ((ci.varianceItemsCount ?? 0) === 0) {
    return (
      <div className="px-4 py-3 rounded-md bg-surface-container-lowest">
        <p className="text-sm text-on-surface-variant">
          No variance lines — all items counted as expected.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <AuditLink entityType="closing_inventory" entityRef={ci.ciTrn} compact />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 rounded-md bg-surface-container-lowest">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        Summary ({ci.varianceItemsCount} variance item
        {ci.varianceItemsCount !== 1 ? 's' : ''})
      </p>

      <dl className="grid grid-cols-2 gap-3 text-xs tablet:grid-cols-3">
        <div>
          <dt className="text-on-surface-variant">Variance items</dt>
          <dd className="tabular-nums font-medium text-on-surface">
            {ci.varianceItemsCount ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Total variance value</dt>
          <dd className="tabular-nums font-medium text-warning">
            {ci.totalVarianceValue != null && ci.totalVarianceValue > 0
              ? formatINR(ci.totalVarianceValue)
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Record ref</dt>
          <dd className="font-mono text-[11px] text-on-surface">{ci.ciTrn}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* "Mark variance acceptable" — Wave-3 mutation; deferred */}
        <button
          type="button"
          disabled
          title="Mark variance acceptable — available in Wave 3"
          className={[
            'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium',
            'bg-surface-container text-on-surface-variant opacity-40 cursor-not-allowed',
          ].join(' ')}
          aria-label="Mark variance acceptable — available in Wave 3"
        >
          <CheckCircle className="h-3.5 w-3.5" aria-hidden />
          <span className="text-xs">Mark variance acceptable</span>
        </button>
        {/* Full audit link — real /audit route */}
        <AuditLink entityType="closing_inventory" entityRef={ci.ciTrn} />
      </div>
    </div>
  )
}
