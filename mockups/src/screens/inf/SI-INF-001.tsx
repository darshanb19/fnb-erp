import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck, History, Inbox, Plus, Search, X } from 'lucide-react'

import {
  ApprovalInboxCard,
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
} from '@/shell'

import {
  NOW,
  formatINR,
  purchaseOrders,
  vendors,
  recipes,
  b2bCustomers,
  locations,
} from '@/lib/sample-data'
import { personas } from '@/lib/personas'

/**
 * SI-INF-001 — Unified Approval Inbox.
 *
 * Tier 1 Group 1, screen 3 of Phase 2c-S3. The canonical anchor for the
 * `CC-APPROVAL-INBOX-CARD` pattern — every other epic surfaces approvable
 * entities into THIS inbox. No epic re-implements an approval queue.
 *
 * FR16 (configurable approval chains; threshold-based routing + delegation)
 * + FR17 (unified approval inbox; bulk approval).
 *
 * Cross-cutting:
 *   - CC-APPROVAL-INBOX-CARD — every row renders <ApprovalInboxCard />.
 *   - CC-AUDIT-LINK         — each card carries an <AuditLink /> chip.
 *   - CC-PAIRED-TRANSFER-BUNDLE — at least one fixture surfaces as a bundled
 *     card with the source-→Brand-→destination chip strip (P2B-002).
 *   - CC-DASHBOARD-TILE — the inbox count IS surfaced as a tile on morning-
 *     briefing dashboards (SI-RPT-002 already drills into this screen via the
 *     pending-approvals tile). No tile is re-rendered here per inventory line
 *     1055 — the cross-cutting reference is honoured by the upstream surface.
 *
 * Responsive — single component with breakpoint-driven layout per plan §19
 * Q3. Below `sm`: stacked compact cards. At `sm:` and up: data-grid rows with
 * checkbox column + action buttons inline.
 *
 * Bulk-approve gate — bulk eligibility is encoded per-card (`bulk_eligible`)
 * per inventory line 1070. Above-threshold cards never render a checkbox; the
 * checkbox cell renders an inline tooltip "Single-action confirm required".
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inboxes. Tailwind hover transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Brand-defined high-value threshold per inventory line 1070. Above this,
 *  bulk-approve is disabled — each card requires single-action confirm. */
const HIGH_VALUE_THRESHOLD = 50000

const NOW_ISO = `${NOW}T18:00:00+05:30`

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

type Scope = 'brand' | 'cluster' | 'location'

const SCOPE_LABEL: Record<Scope, string> = {
  brand: 'Brand-wide',
  cluster: 'Cluster',
  location: 'Location',
}

type ValueBandFilter = 'lt_25k' | 'lt_1l' | 'gte_1l'

const VALUE_BAND_LABEL: Record<ValueBandFilter, string> = {
  lt_25k: 'Below ₹ 25,000',
  lt_1l: '₹ 25,000 – ₹ 1,00,000',
  gte_1l: 'Above ₹ 1,00,000',
}

type AgeBandFilter = 'fresh' | 'over_24h' | 'over_72h'

const AGE_BAND_LABEL: Record<AgeBandFilter, string> = {
  fresh: 'Under 24 hours',
  over_24h: 'Over 24 hours',
  over_72h: 'Over 72 hours',
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture aggregation
// ─────────────────────────────────────────────────────────────────────────────

/** Convert "now − Nh" into an ISO timestamp for a card's requested_at. */
function hoursAgo(h: number): string {
  const t = new Date(NOW_ISO).getTime() - h * 3600000
  return new Date(t).toISOString()
}

const owner = personas.find((p) => p.id === 'brand-owner')!
const cluster = personas.find((p) => p.id === 'cluster-mgr')!
const finance = personas.find((p) => p.id === 'finance-mgr')!
const procurement = personas.find((p) => p.id === 'procurement-mgr')!
const kitchen = personas.find((p) => p.id === 'kitchen-mgr')!
const store = personas.find((p) => p.id === 'store-mgr')!
const dispatch = personas.find((p) => p.id === 'dispatch-staff')!

/** Persona delegate target list (excludes the current persona — owner). */
const delegateTargets = [cluster, finance, procurement, kitchen, store, dispatch].map(
  (p) => ({ id: p.id, name: p.name, role: p.role }),
)

/** Surface the actual pending_approval POs from sample-data, plus a few
 *  curated above-threshold POs so the high-value lane has stock. */
const pendingPOs = purchaseOrders.filter(
  (po) => po.status === 'pending_approval',
)

/** Helper: find a vendor name. */
const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? id

/** Helper: location label by id. */
const locationLabel = (id: string) =>
  locations.find((l) => l.id === id)?.name ?? id

/** Build the inbox cards. ~16 cards: routine requisitions + low-value POs
 *  with checkboxes; 4 high-value POs single-action only; 1 paired-transfer
 *  bundle; 1 recipe default change; 1 B2B credit-limit change. Mix of ages. */
const cards: ReadonlyArray<ApprovalCard> = (() => {
  const out: ApprovalCard[] = []

  // ── 4 above-threshold POs (no checkbox; single-action confirm) ──────────
  // Pull from real fixture data, pick the highest-value pending_approvals.
  const highValuePOs = [...pendingPOs]
    .sort((a, b) => b.total_value - a.total_value)
    .slice(0, 4)

  highValuePOs.forEach((po, idx) => {
    const reqAges = [2, 18, 26, 75] // mix — fresh, fresh, >24h, >72h
    out.push({
      id: `inbox-po-hv-${idx}`,
      source_module: 'procurement',
      entity_type: 'Purchase Order',
      entity_ref: po.po_number,
      entity_route: '/SI-PUR-003',
      requesting_user: procurement.name,
      requesting_user_role: procurement.role,
      requested_at: hoursAgo(reqAges[idx] ?? 4),
      value: po.total_value,
      value_band:
        po.total_value >= 100000
          ? `Above ₹ 1,00,000 · ${vendorName(po.vendor_id)}`
          : `Above brand threshold · ${vendorName(po.vendor_id)}`,
      chain_step:
        po.total_value >= 100000
          ? 'Step 3 of 3 · Brand Owner'
          : 'Step 2 of 2 · Cluster Manager',
      route_reason: 'auto_threshold',
      chain_state: idx === 1 ? 'awaiting_prior_step' : 'pending',
      bulk_eligible: false,
    })
  })

  // ── 6 routine requisitions (mock — Phase 4 has no requisition fixtures) ─
  const requisitions = [
    {
      ref: 'REQ-2026-WST-BAND-0418',
      requester: store,
      ageH: 0.4,
      value: 4200,
      summary: 'Onions × 18 kg; tomatoes × 12 kg; coriander × 5 kg',
      location: 'loc-pos-bandra-1',
    },
    {
      ref: 'REQ-2026-WST-BAND-0419',
      requester: kitchen,
      ageH: 1,
      value: 8800,
      summary: 'Curd × 22 kg; paneer × 8 kg; cheese mozz × 3 kg',
      location: 'loc-pos-bandra-1',
    },
    {
      ref: 'REQ-2026-WST-AND-0212',
      requester: store,
      ageH: 6,
      value: 3450,
      summary: 'Refined oil × 25 L (par-restock)',
      location: 'loc-pos-andheri-1',
    },
    {
      ref: 'REQ-2026-WST-PWI-0184',
      requester: kitchen,
      ageH: 18,
      value: 12300,
      summary: 'Mutton × 6 kg; lamb × 4 kg (weekend forecast)',
      location: 'loc-pos-powai-1',
    },
    {
      ref: 'REQ-2026-WST-BAND-0420',
      requester: dispatch,
      ageH: 28,
      value: 5600,
      summary: 'Packing supplies — biodegradable boxes × 200',
      location: 'loc-ck-bandra',
    },
    {
      ref: 'REQ-2026-WST-AND-0213',
      requester: store,
      ageH: 50,
      value: 7900,
      summary: 'Rice basmati × 25 kg; toor dal × 10 kg',
      location: 'loc-pos-andheri-1',
    },
  ] as const

  requisitions.forEach((r, idx) => {
    out.push({
      id: `inbox-req-${idx}`,
      source_module: 'inventory',
      entity_type: 'Material Requisition',
      entity_ref: r.ref,
      entity_route: '/SI-INV-005',
      requesting_user: r.requester.name,
      requesting_user_role: r.requester.role,
      requested_at: hoursAgo(r.ageH),
      value: r.value,
      value_band: `${formatINR(r.value)} · ${locationLabel(r.location)}`,
      chain_step: 'Step 1 of 1 · Cluster Manager',
      route_reason: 'auto_threshold',
      chain_state: 'pending',
      bulk_eligible: true,
    })
  })

  // ── 2 low-value POs (with checkbox) ─────────────────────────────────────
  const lowValuePOs = [...pendingPOs]
    .filter((po) => po.total_value < HIGH_VALUE_THRESHOLD)
    .slice(0, 2)
  lowValuePOs.forEach((po, idx) => {
    const ageH = idx === 0 ? 4 : 22
    out.push({
      id: `inbox-po-lv-${idx}`,
      source_module: 'procurement',
      entity_type: 'Purchase Order',
      entity_ref: po.po_number,
      entity_route: '/SI-PUR-003',
      requesting_user: procurement.name,
      requesting_user_role: procurement.role,
      requested_at: hoursAgo(ageH),
      value: po.total_value,
      value_band: `Below ₹ 50,000 · ${vendorName(po.vendor_id)}`,
      chain_step: 'Step 1 of 1 · Cluster Manager',
      route_reason: 'auto_threshold',
      chain_state: 'pending',
      bulk_eligible: true,
    })
  })

  // ── 1 paired Brand-Store transfer bundle (CC-PAIRED-TRANSFER-BUNDLE) ─────
  out.push({
    id: 'inbox-bundle-001',
    source_module: 'inventory',
    entity_type: 'Paired Transfer Bundle',
    entity_ref: 'PTR-2026-WST-0042',
    entity_route: '/SI-INV-007',
    requesting_user: cluster.name,
    requesting_user_role: cluster.role,
    requested_at: hoursAgo(8),
    value: 18450,
    value_band: 'Cross-cluster · semi-product transfer',
    chain_step: 'Step 2 of 2 · Brand Owner',
    route_reason: 'chain_step',
    chain_state: 'pending',
    bulk_eligible: false,
    bundle: {
      source_location: 'CK Bandra',
      brand_step: 'Brand routing',
      destination_location: 'POS Powai',
    },
  })

  // ── 1 recipe-default change ─────────────────────────────────────────────
  const targetRecipe = recipes[2]!
  out.push({
    id: 'inbox-rec-001',
    source_module: 'recipe',
    entity_type: 'Recipe default change',
    entity_ref: targetRecipe.id,
    entity_route: '/SI-REC-003',
    requesting_user: kitchen.name,
    requesting_user_role: kitchen.role,
    requested_at: hoursAgo(14),
    value: 0,
    value_band: 'No monetary footprint · default version v3.1 → v3.2',
    chain_step: 'Step 1 of 2 · Cluster Manager',
    route_reason: 'chain_step',
    chain_state: 'awaiting_prior_step',
    bulk_eligible: false,
  })

  // ── 1 B2B credit-limit change ──────────────────────────────────────────
  const targetB2B = b2bCustomers[0]!
  out.push({
    id: 'inbox-b2b-001',
    source_module: 'b2b',
    entity_type: 'Credit-limit change',
    entity_ref: `B2B-CL-${targetB2B.id.toUpperCase()}-0001`,
    entity_route: '/SI-DSP-003',
    requesting_user: finance.name,
    requesting_user_role: finance.role,
    requested_at: hoursAgo(78),
    value: 250000,
    value_band: `Limit ₹ 1,50,000 → ₹ 2,50,000 · ${targetB2B.name}`,
    chain_step: 'Step 2 of 2 · Brand Owner',
    route_reason: 'delegated',
    chain_state: 'delegated',
    bulk_eligible: false,
  })

  // ── 1 dispatch-related approval ─────────────────────────────────────────
  out.push({
    id: 'inbox-dsp-001',
    source_module: 'dispatch',
    entity_type: 'B2B challan price exception',
    entity_ref: 'CHL-2026-WST-0118',
    entity_route: '/SI-DSP-003',
    requesting_user: dispatch.name,
    requesting_user_role: dispatch.role,
    requested_at: hoursAgo(3),
    value: 14200,
    value_band: 'Negotiated −4 % vs catalogue · Sky Lounge Bandra',
    chain_step: 'Step 1 of 1 · Cluster Manager',
    route_reason: 'auto_threshold',
    chain_state: 'pending',
    bulk_eligible: true,
  })

  return out
})()

// ─────────────────────────────────────────────────────────────────────────────
// Filter machinery
// ─────────────────────────────────────────────────────────────────────────────

interface FilterState {
  readonly scopes: ReadonlySet<Scope>
  readonly modules: ReadonlySet<ApprovalSourceModule>
  readonly valueBands: ReadonlySet<ValueBandFilter>
  readonly ageBands: ReadonlySet<AgeBandFilter>
  readonly originatorIds: ReadonlySet<string>
  readonly search: string
}

const INITIAL_FILTERS: FilterState = {
  scopes: new Set(),
  modules: new Set(),
  valueBands: new Set(),
  ageBands: new Set(),
  originatorIds: new Set(),
  search: '',
}

function valueBandOf(value: number): ValueBandFilter {
  if (value < 25000) return 'lt_25k'
  if (value < 100000) return 'lt_1l'
  return 'gte_1l'
}

function ageBandOf(hrs: number): AgeBandFilter {
  if (hrs >= 72) return 'over_72h'
  if (hrs >= 24) return 'over_24h'
  return 'fresh'
}

// Match originator persona id from requesting_user name.
function originatorIdOf(card: ApprovalCard): string {
  const p = personas.find((pp) => pp.name === card.requesting_user)
  return p?.id ?? 'unknown'
}

// Derive a notional scope per card. POs / requisitions tied to a cluster from
// fixture data; bundle + B2B + recipe-default are brand-level.
function scopeOf(card: ApprovalCard): Scope {
  if (
    card.source_module === 'b2b' ||
    card.source_module === 'recipe' ||
    !!card.bundle
  )
    return 'brand'
  if (card.source_module === 'dispatch') return 'cluster'
  // Inventory requisition / low-value PO → location.
  if (
    card.source_module === 'inventory' ||
    card.source_module === 'procurement'
  ) {
    return card.value >= HIGH_VALUE_THRESHOLD ? 'cluster' : 'location'
  }
  return 'cluster'
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
      <span className={['text-2xl font-semibold tabular-nums', emphasisClass].join(' ')}>
        {value.toLocaleString('en-IN')}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInf001() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (filters.scopes.size > 0 && !filters.scopes.has(scopeOf(c))) return false
      if (filters.modules.size > 0 && !filters.modules.has(c.source_module))
        return false
      if (filters.valueBands.size > 0) {
        // 0-value entries (recipe-default, etc.) only match the lt_25k band
        const band = valueBandOf(c.value)
        if (!filters.valueBands.has(band)) return false
      }
      if (filters.ageBands.size > 0) {
        const hrs = ageHours(c.requested_at, NOW_ISO)
        const band = ageBandOf(hrs)
        // For "over_24h" we include everything ≥24h (i.e. also over_72h).
        const matches =
          (filters.ageBands.has('over_72h') && band === 'over_72h') ||
          (filters.ageBands.has('over_24h') && hrs >= 24) ||
          (filters.ageBands.has('fresh') && hrs < 24)
        if (!matches) return false
      }
      if (filters.originatorIds.size > 0) {
        if (!filters.originatorIds.has(originatorIdOf(c))) return false
      }
      if (filters.search.trim().length > 0) {
        const q = filters.search.trim().toLowerCase()
        const hay =
          `${c.entity_ref} ${c.entity_type} ${c.requesting_user} ${c.value_band} ${c.chain_step}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [filters])

  const counters = useMemo(() => {
    const total = cards.length
    let over24 = 0
    let over72 = 0
    cards.forEach((c) => {
      const hrs = ageHours(c.requested_at, NOW_ISO)
      if (hrs >= 24) over24++
      if (hrs >= 72) over72++
    })
    return { total, over24, over72 }
  }, [])

  const selectedCards = useMemo(
    () => filtered.filter((c) => selectedIds.has(c.id) && c.bulk_eligible),
    [filtered, selectedIds],
  )
  const selectedTotal = selectedCards.reduce((acc, c) => acc + c.value, 0)

  const toggleSet = <V extends string>(set: ReadonlySet<V>, v: V): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

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

  // No-op handlers — visual + interaction skeleton only per task brief.
  const onApprove = (_id: string, _comment: string) => {
    void _id
    void _comment
  }
  const onReject = (_id: string, _reason: string) => {
    void _id
    void _reason
  }
  const onDelegate = (_id: string, _reason: string, _targetId: string) => {
    void _id
    void _reason
    void _targetId
  }

  const anyFilterActive =
    filters.scopes.size > 0 ||
    filters.modules.size > 0 ||
    filters.valueBands.size > 0 ||
    filters.ageBands.size > 0 ||
    filters.originatorIds.size > 0 ||
    filters.search.trim().length > 0

  const ORIGINATOR_OPTIONS = [
    procurement,
    cluster,
    finance,
    kitchen,
    store,
    dispatch,
    owner,
  ].map((p) => ({ value: p.id, label: `${p.name} · ${p.role}` }))

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-6 py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Shared Infrastructure · Approvals
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Approval inbox
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Every pending approval routed to you across procurement, inventory,
              recipes, production, dispatch, and B2B — in one triageable inbox.
              Bulk-approve confidence-rated routine items; high-value items
              require a single-action confirm.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                  disabled={selectedCards.length === 0}
                  aria-label={`Bulk approve ${selectedCards.length} items`}
                >
                  <CheckCheck className="h-4 w-4" aria-hidden />
                  Bulk approve
                  {selectedCards.length > 0 ? (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-pill bg-on-primary px-1.5 text-[10px] font-semibold text-primary min-w-[1.25rem]">
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
                    // Visual only — clear selection and dismiss.
                    clearSelection()
                    setBulkConfirmOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <p className="mt-3 text-xs text-on-surface-variant">
          FR16 + FR17 · Bulk-approve gated to confidence-rated routine actions ·
          Paired Brand-Store transfers arrive as a single bundled card per
          P2B-002.
        </p>

        {/* Counters strip */}
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

        {/* Filter strip */}
        <section
          aria-label="Approval filters"
          className="mt-6 rounded-md bg-surface-container-low p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <FilterChipPicker<Scope>
              title="Scope"
              options={(['brand', 'cluster', 'location'] as const).map((v) => ({
                value: v,
                label: SCOPE_LABEL[v],
              }))}
              selected={filters.scopes}
              onToggle={(v) => updateFilter('scopes', toggleSet(filters.scopes, v))}
              onClear={() => updateFilter('scopes', new Set())}
            />
            <FilterChipPicker
              title="Module"
              options={MODULE_FILTER_OPTIONS}
              selected={filters.modules}
              onToggle={(v) =>
                updateFilter('modules', toggleSet(filters.modules, v))
              }
              onClear={() => updateFilter('modules', new Set())}
            />
            <FilterChipPicker<ValueBandFilter>
              title="Value band"
              options={(['lt_25k', 'lt_1l', 'gte_1l'] as const).map((v) => ({
                value: v,
                label: VALUE_BAND_LABEL[v],
              }))}
              selected={filters.valueBands}
              onToggle={(v) =>
                updateFilter('valueBands', toggleSet(filters.valueBands, v))
              }
              onClear={() => updateFilter('valueBands', new Set())}
            />
            <FilterChipPicker<AgeBandFilter>
              title="Age band"
              options={(['fresh', 'over_24h', 'over_72h'] as const).map((v) => ({
                value: v,
                label: AGE_BAND_LABEL[v],
              }))}
              selected={filters.ageBands}
              onToggle={(v) =>
                updateFilter('ageBands', toggleSet(filters.ageBands, v))
              }
              onClear={() => updateFilter('ageBands', new Set())}
            />
            <FilterChipPicker
              title="Originator"
              options={ORIGINATOR_OPTIONS}
              selected={filters.originatorIds}
              onToggle={(v) =>
                updateFilter('originatorIds', toggleSet(filters.originatorIds, v))
              }
              onClear={() => updateFilter('originatorIds', new Set())}
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

        {/* Selection summary band — visible whenever ≥1 selected */}
        {selectedCards.length > 0 ? (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-container-lowest p-3"
          >
            <p className="text-sm text-on-surface">
              <span className="font-semibold tabular-nums">
                {selectedCards.length}
              </span>{' '}
              routine {selectedCards.length === 1 ? 'item' : 'items'} selected ·{' '}
              <span className="font-semibold tabular-nums">
                {formatINR(selectedTotal)}
              </span>{' '}
              combined value
            </p>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear selection
            </Button>
          </div>
        ) : null}

        {/* Inbox list */}
        <section
          aria-label="Pending approvals"
          className="mt-6"
        >
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">Pending</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {filtered.length} of {cards.length} in window
            </span>
          </header>

          {filtered.length === 0 ? (
            <div className="rounded-md bg-surface-container-lowest p-10 text-center">
              <Inbox
                className="mx-auto h-10 w-10 text-on-surface-variant"
                aria-hidden
              />
              <p className="mt-3 text-base font-semibold text-on-surface">
                No pending approvals — inbox is clear.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                When new requests route to you, they will land here. Try
                broadening the filters if you expected something.
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
              {/* Mobile — compact card stack (< sm) */}
              <div className="flex flex-col gap-3 tablet:hidden">
                {filtered.map((card) => (
                  <ApprovalInboxCard
                    key={card.id}
                    card={card}
                    selected={selectedIds.has(card.id)}
                    onToggleSelect={onToggleSelect}
                    layout="card"
                    onApprove={onApprove}
                    onReject={onReject}
                    onDelegate={onDelegate}
                    delegateTargets={delegateTargets}
                  />
                ))}
              </div>

              {/* Desktop — data-grid rows (sm: and up) */}
              <div className="hidden flex-col gap-2 tablet:flex">
                {filtered.map((card) => (
                  <ApprovalInboxCard
                    key={card.id}
                    card={card}
                    selected={selectedIds.has(card.id)}
                    onToggleSelect={onToggleSelect}
                    layout="row"
                    onApprove={onApprove}
                    onReject={onReject}
                    onDelegate={onDelegate}
                    delegateTargets={delegateTargets}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          <Link to="/SI-INF-005" className="text-primary hover:underline">
            <History className="inline h-3 w-3 mr-1" aria-hidden />
            Audit trail viewer (SI-INF-005)
          </Link>
          {' · '}
          SI-INF-001 · Tier 1 Group 1 · Phase 2c-S3
        </footer>
      </div>
    </div>
  )
}
