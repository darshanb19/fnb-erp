/**
 * ApprovalInboxPage — SI-INF-001 Unified Approval Inbox (Tier 1 hero).
 *
 * Phase 4 Epic 3 INF Arc (c), Task C3.
 *
 * FR16 (configurable approval chains; threshold-based routing + delegation)
 * + FR17 (unified approval inbox; bulk approval).
 *
 * DL-040: BO self-creation cards drill out to /users/approvals?id=<requestId>
 * — no inline approve/reject buttons for that entity type.
 *
 * Realtime channel #1: already wired inside useApprovalInbox via
 * useRealtimeChannel('approval_requests'). No extra mount needed here.
 *
 * Token discipline:
 *   - Zero hex literals — all colour from DESIGN.md token classes.
 *   - Lucide icons only.
 *   - No banned border classes.
 *   - Inter font inherited (no inline font-family).
 *   - No entrance animations (CLAUDE.md animation policy — inbox is a
 *     banned surface for transitions).
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCheck,
  Inbox,
  Plus,
  Search,
  X,
} from 'lucide-react'

import {
  ApprovalInboxCard,
  AuditLink,
  BulkApproveConfirm,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  ageHours,
  type ApprovalCard,
  type ApprovalSourceModule,
} from '@/components/shell'

import {
  useApprovalInbox,
  useDecideApproval,
  useDelegateApproval,
  type PendingApprovalRow,
} from '@/hooks/useApprovals'
import { useUsers } from '@/hooks/useUsers'
import { ApiError } from '@/lib/api-client'
import { useSession } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIGH_VALUE_THRESHOLD = 50_000

const NOW_ISO = new Date().toISOString()

// ---------------------------------------------------------------------------
// Entity type mappings
// ---------------------------------------------------------------------------

type RequestEntityType =
  | 'po_threshold'
  | 'gr_shelf_life_exception'
  | 'recipe_default_change'
  | 'bo_self_creation'
  | 'inventory_adjustment'
  | 'b2b_credit_limit_change'

const ENTITY_TO_MODULE: Record<RequestEntityType, ApprovalSourceModule> = {
  po_threshold: 'procurement',
  gr_shelf_life_exception: 'procurement',
  recipe_default_change: 'recipe',
  bo_self_creation: 'user',
  inventory_adjustment: 'inventory',
  b2b_credit_limit_change: 'b2b',
}

const ENTITY_TYPE_LABEL: Record<RequestEntityType, string> = {
  po_threshold: 'Purchase Order',
  gr_shelf_life_exception: 'GR Shelf-Life Exception',
  recipe_default_change: 'Recipe Default Change',
  bo_self_creation: 'Brand Owner Account',
  inventory_adjustment: 'Inventory Adjustment',
  b2b_credit_limit_change: 'B2B Credit Limit',
}

function entityRoute(row: PendingApprovalRow): string {
  if (row.request.entityType === 'bo_self_creation') {
    return `/users/approvals?id=${row.request.id}`
  }
  // Other entity types — no production page exists yet (Epic 4+).
  console.warn(
    `[ApprovalInboxPage] No production page for entityType="${row.request.entityType}". Returning "#".`,
  )
  return '#'
}

function valueBandLabel(value: number | null): string {
  if (value === null) return 'No monetary footprint'
  if (value < 25_000) return 'Below ₹25,000'
  if (value < 100_000) return '₹25,000 – ₹1,00,000'
  return 'Above ₹1,00,000'
}

function adaptToCard(row: PendingApprovalRow, userName: string): ApprovalCard {
  const rawValue = row.request.entityValue
  const value = rawValue !== null ? Number(rawValue) : 0
  const isBoSelfCreation = row.request.entityType === 'bo_self_creation'
  const entityType = row.request.entityType as RequestEntityType
  return {
    id: row.request.id,
    source_module: ENTITY_TO_MODULE[entityType] ?? 'inventory',
    entity_type: ENTITY_TYPE_LABEL[entityType] ?? row.request.entityType,
    entity_ref: row.request.entityRef,
    entity_route: entityRoute(row),
    requesting_user: userName,
    requesting_user_role: '',
    requested_at: row.request.createdAt,
    value,
    value_band: valueBandLabel(rawValue !== null ? value : null),
    chain_step: `Step ${row.step.stepIndex + 1}`,
    route_reason: 'auto_threshold',
    chain_state: row.step.escalatedAt !== null ? 'delegated' : 'pending',
    bulk_eligible: !isBoSelfCreation && value < HIGH_VALUE_THRESHOLD,
  }
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type ValueBandFilter = 'lt_25k' | 'lt_1l' | 'gte_1l'
type AgeBandFilter = 'fresh' | 'over_24h' | 'over_72h'

const MODULE_FILTER_OPTIONS: ReadonlyArray<{
  value: ApprovalSourceModule
  label: string
}> = [
  { value: 'procurement', label: 'Procurement' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'recipe', label: 'Recipe' },
  { value: 'production', label: 'Production' },
  { value: 'dispatch', label: 'Dispatch' },
  { value: 'user', label: 'User' },
  { value: 'b2b', label: 'B2B' },
]

const VALUE_BAND_LABEL: Record<ValueBandFilter, string> = {
  lt_25k: 'Below ₹ 25,000',
  lt_1l: '₹ 25,000 – ₹ 1,00,000',
  gte_1l: 'Above ₹ 1,00,000',
}

const AGE_BAND_LABEL: Record<AgeBandFilter, string> = {
  fresh: 'Under 24 hours',
  over_24h: 'Over 24 hours',
  over_72h: 'Over 72 hours',
}

function valueBandOf(value: number): ValueBandFilter {
  if (value < 25_000) return 'lt_25k'
  if (value < 100_000) return 'lt_1l'
  return 'gte_1l'
}

function ageBandOf(hrs: number): AgeBandFilter {
  if (hrs >= 72) return 'over_72h'
  if (hrs >= 24) return 'over_24h'
  return 'fresh'
}

// ---------------------------------------------------------------------------
// FilterChipPicker sub-component
// ---------------------------------------------------------------------------

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
          className="h-9 px-3 gap-1.5 rounded-full"
        >
          <span className="text-xs font-medium">{title}</span>
          {count > 0 ? (
            <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
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

// ---------------------------------------------------------------------------
// CounterCell sub-component
// ---------------------------------------------------------------------------

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
      <span className={['text-2xl font-semibold tabular-nums', emphasisClass].join(' ')}>
        {value.toLocaleString('en-IN')}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BOAccountApprovalCard — DL-040 drill-out card (no inline approve/reject)
// ---------------------------------------------------------------------------

interface BOAccountApprovalCardProps {
  readonly row: PendingApprovalRow
  readonly userName: string
}

function BOAccountApprovalCard({ row, userName }: BOAccountApprovalCardProps) {
  const hrs = ageHours(row.request.createdAt, NOW_ISO)
  const ageDisplay =
    hrs < 1 ? 'just now' : hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`

  return (
    <article
      aria-label={`Brand Owner approval: ${row.request.entityRef}`}
      className="rounded-md bg-surface-container-lowest p-4 flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between"
    >
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          User · Brand Owner Account
        </span>
        <p className="font-mono text-sm text-on-surface">{row.request.entityRef}</p>
        <p className="text-xs text-on-surface-variant">
          Requested by{' '}
          <span className="text-on-surface">{userName}</span>
          {' · '}
          {ageDisplay}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <AuditLink entityType="approval_requests" entityRef={row.request.entityRef} compact />
        <Link
          to={`/users/approvals?id=${row.request.id}`}
          className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container px-3 py-2 text-xs font-medium text-on-surface min-h-[44px] tablet:min-h-[36px] hover:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Review in user approvals
        </Link>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// InboxCard — routes to BOAccountApprovalCard or ApprovalInboxCard
// ---------------------------------------------------------------------------

interface InboxCardProps {
  readonly row: PendingApprovalRow
  readonly card: ApprovalCard
  readonly selected: boolean
  readonly onToggleSelect: (id: string) => void
  readonly layout: 'row' | 'card'
  readonly onApprove: (id: string, comment: string) => void
  readonly onReject: (id: string, reason: string) => void
  readonly onDelegate: (id: string, reason: string, targetId: string) => void
  readonly delegateTargets: ReadonlyArray<{ id: string; name: string; role: string }>
  readonly userName: string
}

function InboxCard({
  row,
  card,
  selected,
  onToggleSelect,
  layout,
  onApprove,
  onReject,
  onDelegate,
  delegateTargets,
  userName,
}: InboxCardProps) {
  if (row.request.entityType === 'bo_self_creation') {
    return <BOAccountApprovalCard row={row} userName={userName} />
  }
  return (
    <ApprovalInboxCard
      card={card}
      selected={selected}
      onToggleSelect={onToggleSelect}
      layout={layout}
      onApprove={onApprove}
      onReject={onReject}
      onDelegate={onDelegate}
      delegateTargets={delegateTargets}
    />
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ApprovalInboxPage() {
  const { session } = useSession()


  // ── Data fetching ──────────────────────────────────────────────────────────
  const inboxQuery = useApprovalInbox()
  const usersQuery = useUsers()
  const decideApproval = useDecideApproval()
  const delegateApproval = useDelegateApproval()

  // ── Filter state ───────────────────────────────────────────────────────────
  const [moduleFilter, setModuleFilter] = useState<ReadonlySet<ApprovalSourceModule>>(
    new Set(),
  )
  const [valueBandFilter, setValueBandFilter] = useState<ReadonlySet<ValueBandFilter>>(
    new Set(),
  )
  const [ageBandFilter, setAgeBandFilter] = useState<ReadonlySet<AgeBandFilter>>(
    new Set(),
  )
  const [search, setSearch] = useState('')

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)

  // ── Bulk-approve state ─────────────────────────────────────────────────────
  const [bulkProgress, setBulkProgress] = useState<{
    running: boolean
    errors: string[]
  }>({ running: false, errors: [] })

  // ── User lookup map ────────────────────────────────────────────────────────
  const userNameById = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>()
    for (const u of usersQuery.data ?? []) {
      m.set(u.id, u.fullName)
    }
    return m
  }, [usersQuery.data])

  function lookupUserName(userId: string): string {
    return userNameById.get(userId) ?? `${userId.slice(0, 8)}…`
  }

  // ── Delegate target list ───────────────────────────────────────────────────
  const delegateTargets = useMemo(() => {
    const currentId = session?.user.id
    return (usersQuery.data ?? [])
      .filter(
        (u) =>
          u.active &&
          u.approvalStatus === 'approved' &&
          u.id !== currentId,
      )
      .map((u) => ({ id: u.id, name: u.fullName, role: u.role }))
  }, [usersQuery.data, session?.user.id])

  // ── Adapt rows to ApprovalCard ─────────────────────────────────────────────
  const rows = inboxQuery.data ?? []

  const adaptedRows = useMemo(
    () =>
      rows.map((row) => ({
        row,
        card: adaptToCard(row, lookupUserName(row.request.requestingUserId)),
        userName: lookupUserName(row.request.requestingUserId),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, userNameById],
  )

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return adaptedRows.filter(({ card }) => {
      if (moduleFilter.size > 0 && !moduleFilter.has(card.source_module)) return false
      if (valueBandFilter.size > 0) {
        const band = valueBandOf(card.value)
        if (!valueBandFilter.has(band)) return false
      }
      if (ageBandFilter.size > 0) {
        const hrs = ageHours(card.requested_at, NOW_ISO)
        const band = ageBandOf(hrs)
        const matches =
          (ageBandFilter.has('over_72h') && band === 'over_72h') ||
          (ageBandFilter.has('over_24h') && hrs >= 24) ||
          (ageBandFilter.has('fresh') && hrs < 24)
        if (!matches) return false
      }
      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase()
        const hay =
          `${card.entity_ref} ${card.entity_type} ${card.requesting_user} ${card.value_band} ${card.chain_step}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [adaptedRows, moduleFilter, valueBandFilter, ageBandFilter, search])

  // ── Counters ───────────────────────────────────────────────────────────────
  const counters = useMemo(() => {
    const total = rows.length
    let over24 = 0
    let over72 = 0
    for (const { card } of adaptedRows) {
      const hrs = ageHours(card.requested_at, NOW_ISO)
      if (hrs >= 24) over24++
      if (hrs >= 72) over72++
    }
    return { total, over24, over72 }
  }, [rows.length, adaptedRows])

  // ── Selected cards (only bulk-eligible) ────────────────────────────────────
  const selectedCards = useMemo(
    () => filtered.filter(({ card }) => selectedIds.has(card.id) && card.bulk_eligible),
    [filtered, selectedIds],
  )
  const selectedTotal = selectedCards.reduce((acc, { card }) => acc + card.value, 0)

  // ── Helpers ────────────────────────────────────────────────────────────────
  function toggleSet<V>(set: ReadonlySet<V>, v: V): ReadonlySet<V> {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  const onToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  // ── Action handlers ────────────────────────────────────────────────────────
  const onApprove = (id: string, comment: string) => {
    void decideApproval.mutateAsync({ requestId: id, decision: 'approved', comment })
  }

  const onReject = (id: string, reason: string) => {
    void decideApproval.mutateAsync({ requestId: id, decision: 'rejected', comment: reason })
  }

  const onDelegate = (id: string, reason: string, targetUserId: string) => {
    void delegateApproval.mutateAsync({ requestId: id, targetUserId, reasonCode: reason })
  }

  const onBulkApprove = async () => {
    if (selectedCards.length === 0) return
    setBulkProgress({ running: true, errors: [] })
    const results = await Promise.allSettled(
      selectedCards.map(({ card }) =>
        decideApproval.mutateAsync({ requestId: card.id, decision: 'approved', comment: '' }),
      ),
    )
    const errors: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const ref = selectedCards[i]?.card.entity_ref ?? '(unknown)'
        const msg =
          r.reason instanceof ApiError
            ? r.reason.message
            : r.reason instanceof Error
              ? r.reason.message
              : 'Unknown error'
        errors.push(`${ref}: ${msg}`)
      }
    })
    setBulkProgress({ running: false, errors })
    clearSelection()
    setBulkConfirmOpen(false)
  }

  const anyFilterActive =
    moduleFilter.size > 0 ||
    valueBandFilter.size > 0 ||
    ageBandFilter.size > 0 ||
    search.trim().length > 0

  const resetFilters = () => {
    setModuleFilter(new Set())
    setValueBandFilter(new Set())
    setAgeBandFilter(new Set())
    setSearch('')
  }

  const isLoading = inboxQuery.isLoading
  const fetchError = inboxQuery.error

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Shared Infrastructure · Approvals
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface flex items-center gap-2">
              Approval inbox
              {counters.total > 0 ? (
                <span className="inline-flex items-center justify-center rounded-full bg-primary px-2.5 py-0.5 text-sm font-semibold text-on-primary tabular-nums">
                  {counters.total}
                </span>
              ) : null}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Every pending approval routed to you across procurement, inventory,
              recipes, production, dispatch, and B2B — in one triageable inbox.
              Bulk-approve confidence-rated routine items; high-value items require
              a single-action confirm.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink
              entityType="approval_requests"
              label="Audit trail"
              className="text-xs"
            />
            <Popover
              open={bulkConfirmOpen}
              onOpenChange={(o) => {
                if (selectedCards.length === 0) return
                setBulkConfirmOpen(o)
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  size="default"
                  disabled={selectedCards.length === 0 || bulkProgress.running}
                  aria-label={`Bulk approve ${selectedCards.length} items`}
                >
                  <CheckCheck className="h-4 w-4" aria-hidden />
                  Bulk approve
                  {selectedCards.length > 0 ? (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-on-primary px-1.5 text-[10px] font-semibold text-primary min-w-[1.25rem]">
                      {selectedCards.length}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0">
                <BulkApproveConfirm
                  count={selectedCards.length}
                  totalValue={selectedTotal}
                  onCancel={() => setBulkConfirmOpen(false)}
                  onConfirm={() => {
                    void onBulkApprove()
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <p className="mt-2 text-xs text-on-surface-variant">
          Bulk-approve gated to confidence-rated routine actions ·
          High-value items (&ge;₹50,000) require single-action confirm.
        </p>

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {fetchError ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {fetchError instanceof ApiError
              ? `Error loading approvals: ${fetchError.message}`
              : 'Failed to load the approval inbox. Please refresh the page.'}
          </div>
        ) : null}

        {/* ── Bulk error summary ────────────────────────────────────────────── */}
        {bulkProgress.errors.length > 0 ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            <p className="font-medium">Bulk approve — {bulkProgress.errors.length} failed:</p>
            <ul className="mt-1 list-disc pl-4">
              {bulkProgress.errors.map((e, i) => (
                <li key={i} className="text-xs">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* ── Counters strip ────────────────────────────────────────────────── */}
        {!isLoading ? (
          <section
            aria-label="Approval counters"
            className="mt-6 flex flex-wrap items-stretch overflow-hidden rounded-md bg-surface-container-low"
          >
            <CounterCell label="Total pending" value={counters.total} />
            <SectionShift orientation="vertical" tone="high" />
            <CounterCell
              label="Over 24 hours"
              value={counters.over24}
              emphasis={counters.over24 > 0 ? 'warning' : 'default'}
            />
            <SectionShift orientation="vertical" tone="high" />
            <CounterCell
              label="Over 72 hours"
              value={counters.over72}
              emphasis={counters.over72 > 0 ? 'error' : 'default'}
            />
          </section>
        ) : null}

        {/* ── Filter strip ──────────────────────────────────────────────────── */}
        <section
          aria-label="Approval filters"
          className="mt-6 rounded-md bg-surface-container-low p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <FilterChipPicker
              title="Module"
              options={MODULE_FILTER_OPTIONS}
              selected={moduleFilter}
              onToggle={(v) => setModuleFilter((prev) => toggleSet(prev, v))}
              onClear={() => setModuleFilter(new Set())}
            />
            <FilterChipPicker<ValueBandFilter>
              title="Value band"
              options={(['lt_25k', 'lt_1l', 'gte_1l'] as const).map((v) => ({
                value: v,
                label: VALUE_BAND_LABEL[v],
              }))}
              selected={valueBandFilter}
              onToggle={(v) => setValueBandFilter((prev) => toggleSet(prev, v))}
              onClear={() => setValueBandFilter(new Set())}
            />
            <FilterChipPicker<AgeBandFilter>
              title="Age band"
              options={(['fresh', 'over_24h', 'over_72h'] as const).map((v) => ({
                value: v,
                label: AGE_BAND_LABEL[v],
              }))}
              selected={ageBandFilter}
              onToggle={(v) => setAgeBandFilter((prev) => toggleSet(prev, v))}
              onClear={() => setAgeBandFilter(new Set())}
            />

            <div className="ml-auto flex w-full items-center gap-2 tablet:w-auto">
              <div className="relative w-full tablet:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden
                />
                <Input
                  aria-label="Search approvals by entity reference"
                  placeholder="Search PO-2026-…, REQ-, REC-…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {anyFilterActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 gap-1"
                  onClick={resetFilters}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  <span className="text-xs">Reset</span>
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── Selection summary band ────────────────────────────────────────── */}
        {selectedCards.length > 0 ? (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-container-lowest p-3"
          >
            <p className="text-sm text-on-surface">
              <span className="font-semibold tabular-nums">{selectedCards.length}</span>{' '}
              routine {selectedCards.length === 1 ? 'item' : 'items'} selected{' '}
              {selectedTotal > 0 ? (
                <>
                  ·{' '}
                  <span className="font-semibold tabular-nums">
                    ₹{selectedTotal.toLocaleString('en-IN')}
                  </span>{' '}
                  combined value
                </>
              ) : null}
            </p>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear selection
            </Button>
          </div>
        ) : null}

        {/* ── Inbox list ────────────────────────────────────────────────────── */}
        <section aria-label="Pending approvals" className="mt-6">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">Pending</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {isLoading
                ? '…'
                : `${filtered.length} of ${counters.total} in window`}
            </span>
          </header>

          {isLoading ? (
            <div role="status" aria-label="Loading approvals…" className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-md bg-surface-container-lowest p-4 flex items-center gap-4 min-h-[72px]"
                >
                  <div className="h-5 w-5 rounded-sm bg-surface-container-high animate-pulse" />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="h-3 w-48 rounded bg-surface-container-high animate-pulse" />
                    <div className="h-3 w-32 rounded bg-surface-container-high animate-pulse" />
                  </div>
                  <div className="h-4 w-24 rounded bg-surface-container-high animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <Inbox
                className="mx-auto h-10 w-10 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-on-surface">
                {anyFilterActive
                  ? 'No approvals match the current filter.'
                  : 'Inbox is clear — no pending approvals.'}
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                {anyFilterActive
                  ? 'Try broadening the filters or reset them.'
                  : 'When new requests route to you, they will land here.'}
              </p>
              {anyFilterActive ? (
                <Button
                  variant="tonal"
                  size="sm"
                  className="mt-4"
                  onClick={resetFilters}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Reset filters
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {/* Mobile — compact card stack */}
              <div className="flex flex-col gap-3 tablet:hidden">
                {filtered.map(({ row, card, userName }) => (
                  <InboxCard
                    key={card.id}
                    row={row}
                    card={card}
                    selected={selectedIds.has(card.id)}
                    onToggleSelect={onToggleSelect}
                    layout="card"
                    onApprove={onApprove}
                    onReject={onReject}
                    onDelegate={onDelegate}
                    delegateTargets={delegateTargets}
                    userName={userName}
                  />
                ))}
              </div>

              {/* Desktop — data-grid rows */}
              <div className="hidden flex-col gap-2 tablet:flex">
                {filtered.map(({ row, card, userName }) => (
                  <InboxCard
                    key={card.id}
                    row={row}
                    card={card}
                    selected={selectedIds.has(card.id)}
                    onToggleSelect={onToggleSelect}
                    layout="row"
                    onApprove={onApprove}
                    onReject={onReject}
                    onDelegate={onDelegate}
                    delegateTargets={delegateTargets}
                    userName={userName}
                  />
                ))}
              </div>
            </>
          )}
        </section>

      </div>
    </div>
  )
}
