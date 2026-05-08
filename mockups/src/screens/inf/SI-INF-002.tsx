import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { History } from 'lucide-react'

import {
  CCApprovalChainEditor,
  SectionShift,
  type ChainDelegateOption,
  type ChainRoleOption,
  type ChainSummary,
  type CreateChainInput,
  type UpdateChainInput,
} from '@/shell'

/**
 * SI-INF-002 — Approval Chain Configuration.
 *
 * Tier 1 mockup (Phase 4 invariant — Tier 1 acceptance applies even
 * though built in Phase 4). BO-only admin/setup surface that drives
 * the routing engine consumed by SI-INF-001 (the unified inbox).
 *
 * Configures FR16 (configurable approval chains; threshold-based
 * routing + delegation) for five default entity types matching the
 * Phase 4 Epic 3 INF migration 0012 seed:
 *   1. Purchase Order — PO value > ₹50,000 → Brand Owner (FR41)
 *   2. Goods Receipt — shelf-life exception → Cluster Manager →
 *      Brand Owner (FR38)
 *   3. Recipe — default-version change → Brand Owner (FR50)
 *   4. Brand Owner — self-creation → Superadmin (FR14)
 *   5. Inventory Adjustment — cluster-scoped → Cluster Manager;
 *      brand-scoped → Brand Owner (FR37)
 *
 * Cross-cutting:
 *   - CC-DRAFT-PILL — surfaced via CCApprovalChainEditor's status pill
 *     (status_draft when a chain is mid-edit before activation).
 *   - CC-AUDIT-LINK — every chain mutation writes to FR20; the
 *     screen footer links to SI-INF-005 filtered by entity-type
 *     `approval_chain` for change history.
 *
 * Tokens: surface, surface_container_lowest, surface_container_low,
 * surface_container, surface_container_high, on_surface,
 * on_surface_variant, status_draft, status_confirmed, status_inactive,
 * primary, error.
 *
 * RBAC: Brand Owner only (FR12). Mockup is open; the production page
 * (Arc (c) Task C4) wraps in `<RequirePermission permission=
 * "inf.approval.configure_chains">`.
 *
 * Animation: NONE per CLAUDE.md — config form. Tailwind transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const NOW_ISO = '2026-05-08T11:14:00+05:30'

const ROLE_OPTIONS: ReadonlyArray<ChainRoleOption> = [
  { value: 'cluster_manager', label: 'Cluster Manager' },
  { value: 'brand_owner', label: 'Brand Owner' },
  { value: 'finance_manager', label: 'Finance Manager' },
  { value: 'superadmin', label: 'Superadmin' },
]

const DELEGATE_OPTIONS: ReadonlyArray<ChainDelegateOption> = [
  { id: 'user-cm-bandra', label: 'Rohan Mehta (Cluster Manager · Bandra)' },
  { id: 'user-cm-andheri', label: 'Sneha Bose (Cluster Manager · Andheri)' },
  { id: 'user-fm-brand', label: 'Priya Iyer (Finance Manager)' },
  { id: 'user-bo', label: 'Asha Kapoor (Brand Owner)' },
]

/** Five default chains matching the migration 0012 seed. */
const DEFAULT_CHAINS: ReadonlyArray<ChainSummary> = [
  {
    id: 'chain-po',
    entityType: 'po_threshold',
    entityTypeLabel: 'Purchase Order',
    name: 'PO value-threshold routing (FR41)',
    status: 'active',
    steps: [
      {
        stepIndex: 1,
        role: 'cluster_manager',
        roleLabel: 'Cluster Manager',
        valueBandMax: 50000,
        escalationTimeoutMinutes: 1440,
      },
      {
        stepIndex: 2,
        role: 'brand_owner',
        roleLabel: 'Brand Owner',
        valueBandMin: 50000,
        escalationTimeoutMinutes: 0,
        fallbackDelegateUserId: 'user-fm-brand',
        fallbackDelegateLabel: 'Priya Iyer (Finance Manager)',
      },
    ],
    lastModifiedBy: 'Asha Kapoor',
    lastModifiedAt: '2026-04-12T09:00:00+05:30',
  },
  {
    id: 'chain-gr',
    entityType: 'gr_shelf_life_exception',
    entityTypeLabel: 'GR Shelf-Life Exception',
    name: 'GR shelf-life exception escalation (FR38)',
    status: 'active',
    steps: [
      {
        stepIndex: 1,
        role: 'cluster_manager',
        roleLabel: 'Cluster Manager',
        escalationTimeoutMinutes: 240,
      },
      {
        stepIndex: 2,
        role: 'brand_owner',
        roleLabel: 'Brand Owner',
        escalationTimeoutMinutes: 0,
      },
    ],
    lastModifiedBy: 'Asha Kapoor',
    lastModifiedAt: '2026-03-30T14:22:00+05:30',
  },
  {
    id: 'chain-rec',
    entityType: 'recipe_default_change',
    entityTypeLabel: 'Recipe Default Change',
    name: 'Recipe default-version change (FR50)',
    status: 'active',
    steps: [
      {
        stepIndex: 1,
        role: 'brand_owner',
        roleLabel: 'Brand Owner',
        escalationTimeoutMinutes: 0,
      },
    ],
    lastModifiedBy: 'Asha Kapoor',
    lastModifiedAt: '2026-03-22T16:45:00+05:30',
  },
  {
    id: 'chain-bo',
    entityType: 'bo_self_creation',
    entityTypeLabel: 'Brand Owner Self-Creation',
    name: 'Brand Owner self-creation review (FR14)',
    status: 'active',
    steps: [
      {
        stepIndex: 1,
        role: 'superadmin',
        roleLabel: 'Superadmin',
        escalationTimeoutMinutes: 0,
      },
    ],
    lastModifiedBy: 'Asha Kapoor',
    lastModifiedAt: '2026-02-01T12:00:00+05:30',
  },
  {
    id: 'chain-inv-adj',
    entityType: 'inventory_adjustment',
    entityTypeLabel: 'Inventory Adjustment',
    name: 'Inventory adjustment scope routing (FR37)',
    status: 'draft',
    steps: [
      {
        stepIndex: 1,
        role: 'cluster_manager',
        roleLabel: 'Cluster Manager',
        valueBandMax: 25000,
        escalationTimeoutMinutes: 240,
      },
      {
        stepIndex: 2,
        role: 'brand_owner',
        roleLabel: 'Brand Owner',
        valueBandMin: 25000,
        escalationTimeoutMinutes: 0,
        fallbackDelegateUserId: 'user-fm-brand',
        fallbackDelegateLabel: 'Priya Iyer (Finance Manager)',
      },
    ],
    lastModifiedBy: 'Asha Kapoor',
    lastModifiedAt: NOW_ISO,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInf002() {
  const [chains, setChains] =
    useState<ReadonlyArray<ChainSummary>>(DEFAULT_CHAINS)
  const [selectedChainId, setSelectedChainId] = useState<string | null>(
    DEFAULT_CHAINS[0]?.id ?? null,
  )

  const handleCreate = (input: CreateChainInput) => {
    const id = `chain-new-${Date.now()}`
    const next: ChainSummary = {
      id,
      entityType: input.entityType,
      entityTypeLabel: input.entityTypeLabel,
      name: input.name,
      status: 'draft',
      steps: [],
      lastModifiedBy: 'Asha Kapoor',
      lastModifiedAt: NOW_ISO,
    }
    setChains((prev) => [next, ...prev])
    setSelectedChainId(id)
  }

  const handleEdit = (id: string, input: UpdateChainInput) => {
    setChains((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              name: input.name,
              steps: input.steps,
              lastModifiedAt: NOW_ISO,
              lastModifiedBy: 'Asha Kapoor',
            }
          : c,
      ),
    )
  }

  const handleActivate = (id: string) => {
    setChains((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: 'active', lastModifiedAt: NOW_ISO }
          : c,
      ),
    )
  }

  const handleDeactivate = (id: string) => {
    setChains((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: 'inactive', lastModifiedAt: NOW_ISO }
          : c,
      ),
    )
  }

  const handleSaveDraft = (id: string) => {
    setChains((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: 'draft', lastModifiedAt: NOW_ISO }
          : c,
      ),
    )
  }

  const handleDelete = (id: string) => {
    setChains((prev) => prev.filter((c) => c.id !== id))
    setSelectedChainId((sid) => (sid === id ? null : sid))
  }

  const counters = useMemo(() => {
    const total = chains.length
    let active = 0
    let draft = 0
    let inactive = 0
    chains.forEach((c) => {
      if (c.status === 'active') active++
      else if (c.status === 'draft') draft++
      else inactive++
    })
    return { total, active, draft, inactive }
  }, [chains])

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-6 py-8 desktop:px-10 desktop:py-10">
        <header>
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Shared Infrastructure · Approvals
          </p>
          <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
            Approval chain configuration
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
            Define how approval requests route across procurement,
            inventory, recipes, and user lifecycle. Each chain configures
            the ordered approver steps the routing engine walks when an
            entity needs sign-off — value-band thresholds, escalation
            timeouts, and fallback delegates per step.
          </p>
          <p className="mt-3 text-xs text-on-surface-variant">
            FR16 + FR41 (PO threshold) + FR38 (GR shelf-life) + FR50
            (recipe default) + FR14 (BO self-creation) + FR37 (inventory
            adjustment scope). Mutations write to the audit trail per FR20.
          </p>
        </header>

        {/* Counters strip */}
        <section
          aria-label="Chain counters"
          className="mt-6 flex flex-wrap items-stretch overflow-hidden rounded-md bg-surface-container-low"
        >
          <CounterCell label="Total chains" value={counters.total} />
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell label="Active" value={counters.active} />
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell label="Draft" value={counters.draft} />
          <SectionShift orientation="vertical" tone="high" />
          <CounterCell label="Inactive" value={counters.inactive} />
        </section>

        {/* Editor */}
        <section aria-label="Approval chain editor" className="mt-6">
          <CCApprovalChainEditor
            chains={chains}
            selectedChainId={selectedChainId}
            onSelect={setSelectedChainId}
            onCreateChain={handleCreate}
            onEditChain={handleEdit}
            onActivate={handleActivate}
            onDeactivate={handleDeactivate}
            onSaveDraft={handleSaveDraft}
            onDelete={handleDelete}
            roleOptions={ROLE_OPTIONS}
            delegateOptions={DELEGATE_OPTIONS}
          />
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          <Link
            to="/SI-INF-005?entity=approval_chain"
            className="text-primary hover:underline"
          >
            <History className="inline h-3 w-3 mr-1" aria-hidden />
            Chain change history (SI-INF-005 — filtered to approval chains)
          </Link>
          {' · '}
          SI-INF-002 · Tier 1 (Phase 4 deferred-hero) · Phase 4 Epic 3 INF
        </footer>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CounterCell — local copy of the SI-INF-001 pattern so the counters strip
// stays consistent across the two BO-facing INF screens. Not extracted to
// shell yet because only two screens consume it; promote when a third
// consumer surfaces.
// ─────────────────────────────────────────────────────────────────────────────

interface CounterCellProps {
  readonly label: string
  readonly value: number
}

function CounterCell({ label, value }: CounterCellProps) {
  return (
    <div className="flex items-baseline gap-3 px-4 py-3">
      <span className="text-2xl font-semibold tabular-nums text-on-surface">
        {value.toLocaleString('en-IN')}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
    </div>
  )
}
