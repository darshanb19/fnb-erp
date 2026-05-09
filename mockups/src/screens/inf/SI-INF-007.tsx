import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Filter,
  History,
  Inbox,
  Plus,
  Search,
  X,
} from 'lucide-react'

import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
  type StatusToken,
} from '@/shell'

import {
  NOW,
  purchaseOrders,
  b2bCustomers,
} from '@/lib/sample-data'
import { personas } from '@/lib/personas'

/**
 * SI-INF-007 — Issue Ticket List (Tier 2).
 *
 * Phase 4 Epic 3 INF Arc (b) Task B3 — list-page surface for the issue
 * tracker (DL-039 full scope; FR22). Tier 2 acceptance per Phase 4
 * invariants. Sister page to SI-INF-008 (the form, Tier 1 hero).
 *
 * Rendering shape (mockup):
 *   - Page header strip with title + "+ New ticket" CTA → `/SI-INF-008`.
 *   - Counter strip: open / overdue (>24h) / critical-priority-open.
 *   - Filter chips: status, priority, assignee, originator, scope,
 *     linked-module — collectively the inventory `data_displayed` chips.
 *   - Selection summary band when ≥1 row checked.
 *   - Ticket grid: responsive — card stack on mobile, data-grid rows
 *     ≥ tablet. Reference + title + status + priority + assignee +
 *     originator + age + last-updated + linked-entity chip per row.
 *
 * Tokens used: surface, surface_container_lowest, surface_container_low,
 * surface_container, surface_container_high, on_surface, on_surface_variant,
 * status_pending_approval (Open), status_in_progress, status_waiting_info
 * (Pending Info), status_completed (Resolved), status_closed, error
 * (Critical priority), warning (High priority), tertiary, primary,
 * outline_variant, on_primary.
 *
 * Animation: NONE per CLAUDE.md (data list).
 *
 * Bulk-action checkboxes are rendered but the bulk-assign / bulk-close /
 * bulk-priority menus are tooltipped "coming in Arc (c)" — the actual
 * service-layer wiring lands at C8a alongside the production pages.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Canonical enum values from `apps/api/src/db/schema/issue-tickets.ts`
// ─────────────────────────────────────────────────────────────────────────────

type IssueStatus = 'open' | 'in_progress' | 'pending_info' | 'resolved' | 'closed'
type IssuePriority = 'low' | 'medium' | 'high' | 'critical'

const STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  pending_info: 'Pending Info',
  resolved: 'Resolved',
  closed: 'Closed',
}

const STATUS_TOKEN: Record<IssueStatus, StatusToken> = {
  open: 'status_pending_approval',
  in_progress: 'status_in_progress',
  pending_info: 'status_waiting_info',
  resolved: 'status_completed',
  closed: 'status_closed',
}

const PRIORITY_LABEL: Record<IssuePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

type LinkedModule =
  | 'inventory'
  | 'procurement'
  | 'production'
  | 'dispatch'
  | 'pos'
  | 'finance'
  | 'other'

const LINKED_MODULE_LABEL: Record<LinkedModule, string> = {
  inventory: 'Inventory',
  procurement: 'Procurement',
  production: 'Production',
  dispatch: 'Dispatch',
  pos: 'POS',
  finance: 'Finance',
  other: 'Other',
}

type Scope = 'brand' | 'cluster' | 'location'

const SCOPE_LABEL: Record<Scope, string> = {
  brand: 'Brand-wide',
  cluster: 'Cluster',
  location: 'Location',
}

// ─────────────────────────────────────────────────────────────────────────────
// Types + fixtures
// ─────────────────────────────────────────────────────────────────────────────

const NOW_ISO = `${NOW}T11:14:00+05:30`

export interface TicketRow {
  readonly id: string
  /** Auto-generated ISS-YYYY-SEQ — see schema. */
  readonly reference: string
  readonly title: string
  readonly status: IssueStatus
  readonly priority: IssuePriority
  readonly assigneeLabel: string
  readonly assigneeRole: string
  readonly originatorLabel: string
  readonly originatorRole: string
  /** ISO of ticket creation. */
  readonly createdAt: string
  /** ISO of most recent mutation. */
  readonly updatedAt: string
  readonly linkedModule: LinkedModule
  /** TRN/ID of the linked entity, when present. */
  readonly linkedEntityRef?: string
  /** e.g. "PO" / "GR" / "Challan". */
  readonly linkedEntityType?: string
  readonly scope: Scope
}

function hoursAgo(h: number): string {
  const t = new Date(NOW_ISO).getTime() - h * 3600000
  return new Date(t).toISOString()
}

function ageHours(iso: string): number {
  return Math.max(
    0,
    (new Date(NOW_ISO).getTime() - new Date(iso).getTime()) / 3600000,
  )
}

function ageLabel(hrs: number): string {
  if (hrs < 1) return `${Math.round(hrs * 60)}m`
  if (hrs < 48) return `${Math.round(hrs)}h`
  return `${Math.round(hrs / 24)}d`
}

const owner = personas.find((p) => p.id === 'brand-owner')!
const cluster = personas.find((p) => p.id === 'cluster-mgr')!
const finance = personas.find((p) => p.id === 'finance-mgr')!
const procurement = personas.find((p) => p.id === 'procurement-mgr')!
const kitchen = personas.find((p) => p.id === 'kitchen-mgr')!
const store = personas.find((p) => p.id === 'store-mgr')!
const pos = personas.find((p) => p.id === 'pos-staff')!
const dispatch = personas.find((p) => p.id === 'dispatch-staff')!

const samplePO = purchaseOrders[0]
const sampleB2B = b2bCustomers[0]

const TICKETS: ReadonlyArray<TicketRow> = [
  {
    id: 'tk-001',
    reference: 'ISS-2026-001',
    title: 'Curd batch arrived 18h short of shelf-life target',
    status: 'open',
    priority: 'high',
    assigneeLabel: cluster.name,
    assigneeRole: cluster.role,
    originatorLabel: store.name,
    originatorRole: store.role,
    createdAt: hoursAgo(2.5),
    updatedAt: hoursAgo(0.5),
    linkedModule: 'inventory',
    linkedEntityRef: 'GR-2026-WST-BAND-0418',
    linkedEntityType: 'GR',
    scope: 'location',
  },
  {
    id: 'tk-002',
    reference: 'ISS-2026-002',
    title: 'Vendor short-delivery — 18 kg of mutton vs 22 kg ordered',
    status: 'in_progress',
    priority: 'high',
    assigneeLabel: cluster.name,
    assigneeRole: cluster.role,
    originatorLabel: store.name,
    originatorRole: store.role,
    createdAt: hoursAgo(28),
    updatedAt: hoursAgo(1),
    linkedModule: 'procurement',
    linkedEntityRef: samplePO?.po_number ?? 'PUR-2026-CKA-000287',
    linkedEntityType: 'PO',
    scope: 'cluster',
  },
  {
    id: 'tk-003',
    reference: 'ISS-2026-003',
    title: 'POS discount above 15% on banquet bill — needs sign-off review',
    status: 'pending_info',
    priority: 'medium',
    assigneeLabel: cluster.name,
    assigneeRole: cluster.role,
    originatorLabel: pos.name,
    originatorRole: pos.role,
    createdAt: hoursAgo(20),
    updatedAt: hoursAgo(6),
    linkedModule: 'pos',
    linkedEntityRef: 'BILL-2026-WST-BAND-001841',
    linkedEntityType: 'Bill',
    scope: 'location',
  },
  {
    id: 'tk-004',
    reference: 'ISS-2026-004',
    title: 'B2B challan price exception — Sky Lounge negotiated -4% vs catalogue',
    status: 'open',
    priority: 'low',
    assigneeLabel: cluster.name,
    assigneeRole: cluster.role,
    originatorLabel: dispatch.name,
    originatorRole: dispatch.role,
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(3),
    linkedModule: 'dispatch',
    linkedEntityRef: 'CHL-2026-WST-0118',
    linkedEntityType: 'Challan',
    scope: 'cluster',
  },
  {
    id: 'tk-005',
    reference: 'ISS-2026-005',
    title: 'Critical — production order halted; pending GR linkage unresolved 4h',
    status: 'open',
    priority: 'critical',
    assigneeLabel: owner.name,
    assigneeRole: owner.role,
    originatorLabel: kitchen.name,
    originatorRole: kitchen.role,
    createdAt: hoursAgo(4.2),
    updatedAt: hoursAgo(0.2),
    linkedModule: 'production',
    linkedEntityRef: 'PRO-2026-WST-CKB-0214',
    linkedEntityType: 'Production Order',
    scope: 'location',
  },
  {
    id: 'tk-006',
    reference: 'ISS-2026-006',
    title: 'Variance investigation — Q2 actual vs budget overshoot at Powai',
    status: 'in_progress',
    priority: 'medium',
    assigneeLabel: finance.name,
    assigneeRole: finance.role,
    originatorLabel: owner.name,
    originatorRole: owner.role,
    createdAt: hoursAgo(74),
    updatedAt: hoursAgo(12),
    linkedModule: 'finance',
    scope: 'brand',
  },
  {
    id: 'tk-007',
    reference: 'ISS-2026-007',
    title: 'Vendor flagged for repeated short-delivery — preferred-flag review',
    status: 'pending_info',
    priority: 'medium',
    assigneeLabel: procurement.name,
    assigneeRole: procurement.role,
    originatorLabel: cluster.name,
    originatorRole: cluster.role,
    createdAt: hoursAgo(50),
    updatedAt: hoursAgo(18),
    linkedModule: 'procurement',
    linkedEntityRef: 'V-AIRY-DAIRY',
    linkedEntityType: 'Vendor',
    scope: 'brand',
  },
  {
    id: 'tk-008',
    reference: 'ISS-2026-008',
    title: 'Closing inventory variance — toor dal 1.4 kg short on Andheri count',
    status: 'resolved',
    priority: 'low',
    assigneeLabel: store.name,
    assigneeRole: store.role,
    originatorLabel: pos.name,
    originatorRole: pos.role,
    createdAt: hoursAgo(96),
    updatedAt: hoursAgo(72),
    linkedModule: 'inventory',
    linkedEntityRef: 'ADJ-2026-WST-AND-0091',
    linkedEntityType: 'Adjustment',
    scope: 'location',
  },
  {
    id: 'tk-009',
    reference: 'ISS-2026-009',
    title: 'B2B credit-limit raise request — ITC Grand Central',
    status: 'closed',
    priority: 'medium',
    assigneeLabel: owner.name,
    assigneeRole: owner.role,
    originatorLabel: finance.name,
    originatorRole: finance.role,
    createdAt: hoursAgo(168),
    updatedAt: hoursAgo(120),
    linkedModule: 'dispatch',
    linkedEntityRef: sampleB2B?.id ?? 'b2b-itc-grand',
    linkedEntityType: 'B2B Customer',
    scope: 'brand',
  },
  {
    id: 'tk-010',
    reference: 'ISS-2026-010',
    title: 'Goods receipt rejection at QC — packaging damage on biodegradable boxes',
    status: 'in_progress',
    priority: 'high',
    assigneeLabel: cluster.name,
    assigneeRole: cluster.role,
    originatorLabel: dispatch.name,
    originatorRole: dispatch.role,
    createdAt: hoursAgo(80),
    updatedAt: hoursAgo(32),
    linkedModule: 'procurement',
    linkedEntityRef: 'GR-2026-WST-BAND-0420',
    linkedEntityType: 'GR',
    scope: 'cluster',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Filter machinery
// ─────────────────────────────────────────────────────────────────────────────

interface FilterState {
  readonly statuses: ReadonlySet<IssueStatus>
  readonly priorities: ReadonlySet<IssuePriority>
  readonly assigneeIds: ReadonlySet<string>
  readonly originatorIds: ReadonlySet<string>
  readonly scopes: ReadonlySet<Scope>
  readonly modules: ReadonlySet<LinkedModule>
  readonly search: string
}

const INITIAL_FILTERS: FilterState = {
  statuses: new Set(),
  priorities: new Set(),
  assigneeIds: new Set(),
  originatorIds: new Set(),
  scopes: new Set(),
  modules: new Set(),
  search: '',
}

function toggleSet<V>(set: ReadonlySet<V>, v: V): ReadonlySet<V> {
  const next = new Set(set)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  return next
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

interface CounterCellProps {
  readonly label: string
  readonly value: number
  readonly emphasis?: 'default' | 'warning' | 'error'
}

function CounterCell({ label, value, emphasis = 'default' }: CounterCellProps) {
  const emphasisClass =
    emphasis === 'error'
      ? 'text-error'
      : emphasis === 'warning'
        ? 'text-tertiary'
        : 'text-on-surface'
  return (
    <div className="flex items-baseline gap-3 px-4 py-3">
      <span
        className={['text-2xl font-semibold tabular-nums', emphasisClass].join(' ')}
      >
        {value.toLocaleString('en-IN')}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
    </div>
  )
}

interface PriorityChipProps {
  readonly priority: IssuePriority
}

function PriorityChip({ priority }: PriorityChipProps) {
  if (priority === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-error-container text-on-error-container px-2 py-0.5 text-[11px] font-semibold">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Critical
      </span>
    )
  }
  if (priority === 'high') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-tertiary-container text-on-tertiary-container px-2 py-0.5 text-[11px] font-semibold">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        High
      </span>
    )
  }
  // Low + Medium share a neutral surface — inventory line 1338 calls error /
  // warning specifically only for Critical / High; Low/Medium use a neutral
  // surface_container token.
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high text-on-surface px-2 py-0.5 text-[11px] font-medium">
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

interface LinkedEntityChipProps {
  readonly entityType?: string
  readonly entityRef?: string
  readonly module: LinkedModule
}

function LinkedEntityChip({
  entityType,
  entityRef,
  module,
}: LinkedEntityChipProps) {
  if (!entityRef) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
        {LINKED_MODULE_LABEL[module]}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface">
      <span className="text-on-surface-variant">{entityType ?? 'Entity'}</span>
      <span className="font-mono">{entityRef}</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInf007() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())

  const filtered = useMemo(() => {
    return TICKETS.filter((t) => {
      if (filters.statuses.size > 0 && !filters.statuses.has(t.status)) return false
      if (
        filters.priorities.size > 0 &&
        !filters.priorities.has(t.priority)
      )
        return false
      if (filters.scopes.size > 0 && !filters.scopes.has(t.scope)) return false
      if (filters.modules.size > 0 && !filters.modules.has(t.linkedModule))
        return false
      if (filters.search.trim().length > 0) {
        const q = filters.search.trim().toLowerCase()
        const hay =
          `${t.reference} ${t.title} ${t.assigneeLabel} ${t.originatorLabel} ${t.linkedEntityRef ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [filters])

  const counters = useMemo(() => {
    const open = TICKETS.filter(
      (t) =>
        t.status === 'open' ||
        t.status === 'in_progress' ||
        t.status === 'pending_info',
    ).length
    const overdue = TICKETS.filter(
      (t) =>
        (t.status === 'open' ||
          t.status === 'in_progress' ||
          t.status === 'pending_info') &&
        ageHours(t.createdAt) >= 24,
    ).length
    const critical = TICKETS.filter(
      (t) =>
        t.priority === 'critical' &&
        (t.status === 'open' ||
          t.status === 'in_progress' ||
          t.status === 'pending_info'),
    ).length
    return { open, overdue, critical }
  }, [])

  const updateFilter = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const onToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const anyFilterActive =
    filters.statuses.size > 0 ||
    filters.priorities.size > 0 ||
    filters.assigneeIds.size > 0 ||
    filters.originatorIds.size > 0 ||
    filters.scopes.size > 0 ||
    filters.modules.size > 0 ||
    filters.search.trim().length > 0

  // Derive a unique assignee + originator option list from the fixtures.
  const assigneeOptions = useMemo(() => {
    const seen = new Map<string, string>()
    TICKETS.forEach((t) => seen.set(t.assigneeLabel, t.assigneeRole))
    return Array.from(seen.entries()).map(([label, role]) => ({
      value: label,
      label: `${label} · ${role}`,
    }))
  }, [])
  const originatorOptions = useMemo(() => {
    const seen = new Map<string, string>()
    TICKETS.forEach((t) => seen.set(t.originatorLabel, t.originatorRole))
    return Array.from(seen.entries()).map(([label, role]) => ({
      value: label,
      label: `${label} · ${role}`,
    }))
  }, [])

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-6 py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Shared Infrastructure · Issue Tracker
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Issue tickets
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Browse, filter, and triage internal issue tickets across procurement,
              inventory, production, dispatch, POS, and finance. Tickets land here
              when raised from any transactional screen via the
              <span className="font-mono mx-1">CC-ISSUE-TICKET-LINK</span>
              affordance, or via the <span className="font-medium">+ New ticket</span>
              CTA on the right.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="default" aria-label="Create a new issue ticket">
              <Link to="/SI-INF-008">
                <Plus className="h-4 w-4" aria-hidden />
                New ticket
              </Link>
            </Button>
          </div>
        </header>

        <p className="mt-3 text-xs text-on-surface-variant">
          FR22 · Reference number format
          <span className="font-mono mx-1">ISS-YYYY-SEQ</span>
          auto-generated per (brand, year). Resolved → Closed transition is
          gated to the originator + Brand Owner.
        </p>

        {/* Counters strip */}
        <section
          aria-label="Issue ticket counters"
          className="mt-6 flex flex-wrap items-stretch overflow-hidden rounded-md bg-surface-container-low"
        >
          <CounterCell label="Open + active" value={counters.open} />
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell
            label="Overdue (>24 h)"
            value={counters.overdue}
            emphasis={counters.overdue > 0 ? 'warning' : 'default'}
          />
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell
            label="Critical-priority open"
            value={counters.critical}
            emphasis={counters.critical > 0 ? 'error' : 'default'}
          />
        </section>

        {/* Filter strip */}
        <section
          aria-label="Issue ticket filters"
          className="mt-6 rounded-md bg-surface-container-low p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mr-1">
              <Filter className="h-3.5 w-3.5" aria-hidden />
              Filter
            </span>
            <FilterChipPicker<IssueStatus>
              title="Status"
              options={(
                ['open', 'in_progress', 'pending_info', 'resolved', 'closed'] as const
              ).map((v) => ({ value: v, label: STATUS_LABEL[v] }))}
              selected={filters.statuses}
              onToggle={(v) =>
                updateFilter('statuses', toggleSet(filters.statuses, v))
              }
              onClear={() => updateFilter('statuses', new Set())}
            />
            <FilterChipPicker<IssuePriority>
              title="Priority"
              options={(['low', 'medium', 'high', 'critical'] as const).map(
                (v) => ({ value: v, label: PRIORITY_LABEL[v] }),
              )}
              selected={filters.priorities}
              onToggle={(v) =>
                updateFilter('priorities', toggleSet(filters.priorities, v))
              }
              onClear={() => updateFilter('priorities', new Set())}
            />
            <FilterChipPicker
              title="Assignee"
              options={assigneeOptions}
              selected={filters.assigneeIds}
              onToggle={(v) =>
                updateFilter('assigneeIds', toggleSet(filters.assigneeIds, v))
              }
              onClear={() => updateFilter('assigneeIds', new Set())}
            />
            <FilterChipPicker
              title="Originator"
              options={originatorOptions}
              selected={filters.originatorIds}
              onToggle={(v) =>
                updateFilter(
                  'originatorIds',
                  toggleSet(filters.originatorIds, v),
                )
              }
              onClear={() => updateFilter('originatorIds', new Set())}
            />
            <FilterChipPicker<Scope>
              title="Scope"
              options={(['brand', 'cluster', 'location'] as const).map((v) => ({
                value: v,
                label: SCOPE_LABEL[v],
              }))}
              selected={filters.scopes}
              onToggle={(v) =>
                updateFilter('scopes', toggleSet(filters.scopes, v))
              }
              onClear={() => updateFilter('scopes', new Set())}
            />
            <FilterChipPicker<LinkedModule>
              title="Linked module"
              options={(
                [
                  'inventory',
                  'procurement',
                  'production',
                  'dispatch',
                  'pos',
                  'finance',
                  'other',
                ] as const
              ).map((v) => ({ value: v, label: LINKED_MODULE_LABEL[v] }))}
              selected={filters.modules}
              onToggle={(v) =>
                updateFilter('modules', toggleSet(filters.modules, v))
              }
              onClear={() => updateFilter('modules', new Set())}
            />

            <div className="ml-auto flex w-full items-center gap-2 tablet:w-auto">
              <div className="relative w-full tablet:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden
                />
                <Input
                  aria-label="Search issue tickets"
                  placeholder="Search ISS-, title, linked entity…"
                  className="pl-9"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                />
              </div>
              {anyFilterActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 gap-1"
                  onClick={() => setFilters(INITIAL_FILTERS)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  <span className="text-xs">Reset</span>
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {/* Selection summary */}
        {selectedIds.size > 0 ? (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-container-lowest p-3"
          >
            <p className="text-sm text-on-surface">
              <span className="font-semibold tabular-nums">
                {selectedIds.size}
              </span>{' '}
              ticket{selectedIds.size === 1 ? '' : 's'} selected — bulk actions
              (assign / close / re-prioritise) wire up in Arc (c).
            </p>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear selection
            </Button>
          </div>
        ) : null}

        {/* Ticket list */}
        <section aria-label="Issue tickets" className="mt-6">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">
              Tickets
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {filtered.length} of {TICKETS.length} in window
            </span>
          </header>

          {filtered.length === 0 ? (
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <Inbox
                className="mx-auto h-10 w-10 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-on-surface">
                No tickets in this window.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Try broadening the filters above, or raise a new ticket via the
                + New ticket CTA.
              </p>
              {anyFilterActive ? (
                <Button
                  variant="tonal"
                  size="sm"
                  className="mt-4"
                  onClick={() => setFilters(INITIAL_FILTERS)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Reset filters
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {/* Mobile — compact card stack (< tablet) */}
              <ul className="flex flex-col gap-3 tablet:hidden">
                {filtered.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-md bg-surface-container-lowest p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-center gap-2 mt-0.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => onToggleSelect(t.id)}
                          aria-label={`Select ${t.reference}`}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="font-mono text-[11px] text-on-surface-variant">
                          {t.reference}
                        </span>
                      </label>
                      <PriorityChip priority={t.priority} />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-on-surface">
                      {t.title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill
                        status={STATUS_TOKEN[t.status]}
                        label={STATUS_LABEL[t.status]}
                        size="sm"
                      />
                      <LinkedEntityChip
                        entityType={t.linkedEntityType}
                        entityRef={t.linkedEntityRef}
                        module={t.linkedModule}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-on-surface-variant">
                      <span>
                        Assigned{' '}
                        <span className="font-medium text-on-surface">
                          {t.assigneeLabel}
                        </span>{' '}
                        · By {t.originatorLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3 w-3" aria-hidden />
                        {ageLabel(ageHours(t.createdAt))} old · upd{' '}
                        {ageLabel(ageHours(t.updatedAt))}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button asChild variant="tonal" size="sm">
                        <Link
                          to={`/SI-INF-008?ticket=${encodeURIComponent(t.reference)}`}
                          aria-label={`Open ${t.reference}`}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                          Open
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop — data-grid rows (≥ tablet) */}
              <div className="hidden tablet:block rounded-md bg-surface-container-lowest overflow-hidden">
                <div className="grid grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,2.6fr)_auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant bg-surface-container-low">
                  <span aria-hidden />
                  <span>Reference</span>
                  <span>Title</span>
                  <span>Status</span>
                  <span>Priority</span>
                  <span>Assignee</span>
                  <span>Originator</span>
                  <span>Age · upd</span>
                  <span className="text-right">Action</span>
                </div>
                <ul>
                  {filtered.map((t) => (
                    <li
                      key={t.id}
                      className="grid grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,2.6fr)_auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-3 px-4 py-3 items-center hover:bg-surface-container-low transition-colors"
                    >
                      <label
                        className="cursor-pointer flex items-center"
                        aria-label={`Select ${t.reference}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => onToggleSelect(t.id)}
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                      <span className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-mono text-[11px] text-on-surface-variant truncate">
                          {t.reference}
                        </span>
                        <LinkedEntityChip
                          entityType={t.linkedEntityType}
                          entityRef={t.linkedEntityRef}
                          module={t.linkedModule}
                        />
                      </span>
                      <span className="text-sm text-on-surface truncate" title={t.title}>
                        {t.title}
                      </span>
                      <StatusPill
                        status={STATUS_TOKEN[t.status]}
                        label={STATUS_LABEL[t.status]}
                        size="sm"
                      />
                      <PriorityChip priority={t.priority} />
                      <span className="text-xs text-on-surface truncate">
                        <span className="font-medium">{t.assigneeLabel}</span>
                        <span className="ml-1 text-on-surface-variant">
                          · {t.assigneeRole}
                        </span>
                      </span>
                      <span className="text-xs text-on-surface truncate">
                        <span className="font-medium">{t.originatorLabel}</span>
                        <span className="ml-1 text-on-surface-variant">
                          · {t.originatorRole}
                        </span>
                      </span>
                      <span className="text-[11px] text-on-surface-variant tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden />
                          {ageLabel(ageHours(t.createdAt))}
                        </span>
                        <span className="block text-on-surface-variant">
                          upd {ageLabel(ageHours(t.updatedAt))}
                        </span>
                      </span>
                      <Button asChild variant="tonal" size="sm">
                        <Link
                          to={`/SI-INF-008?ticket=${encodeURIComponent(t.reference)}`}
                          aria-label={`Open ${t.reference}`}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                          Open
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          <Link
            to="/SI-INF-005?entity=issue_ticket"
            className="text-primary hover:underline"
          >
            <History className="inline h-3 w-3 mr-1" aria-hidden />
            Issue ticket change history (SI-INF-005 — filtered to issue tickets)
          </Link>
          {' · '}
          SI-INF-007 · Tier 2 · Phase 4 Epic 3 INF
        </footer>
      </div>
    </div>
  )
}
