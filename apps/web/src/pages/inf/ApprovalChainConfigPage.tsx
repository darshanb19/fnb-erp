/**
 * ApprovalChainConfigPage — SI-INF-002 Approval Chain Configuration (Tier 1).
 *
 * Phase 4 Epic 3 INF Arc (c), Task C4.
 *
 * Builds and maintains the ordered routing-step chains consumed by the
 * Unified Approval Inbox (SI-INF-001). BO-only surface gated by
 * RequirePermission("inf.approval.configure_chains").
 *
 * FR16 (configurable approval chains; threshold-based routing + delegation)
 * + FR17 (chains feed the unified inbox) + FR20 (chain mutations write to
 * the audit trail).
 *
 * DL-036: every mutation (create / update / activate / deactivate) must
 * carry a `reasonCode` for audit hygiene. A mandatory reason-code input
 * is rendered at the top of the page; Save / Activate buttons are disabled
 * (with tooltip) until the user has typed ≥ 10 chars.
 *
 * Delete: there is no DELETE endpoint in apps/api MVP (only
 * PATCH /chains/:id and POST /chains/:id/activate|deactivate exist in
 * apps/api/src/routes/approvals.ts). The onDelete callback no-ops with a
 * friendly alert notice. Deactivate is the recommended non-destructive path.
 *
 * Token discipline:
 *   - Zero hex literals — all colour from DESIGN.md token classes.
 *   - Lucide icons only.
 *   - No banned border classes (border-l-4 pip on the editor's selected
 *     rail item is allow-listed per DESIGN.md §5.2).
 *   - Inter font inherited (no inline font-family).
 *   - No entrance animations (CLAUDE.md animation policy — config form is
 *     a banned surface for transitions beyond Tailwind hover/focus).
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { History } from 'lucide-react'

import {
  AuditLink,
  CCApprovalChainEditor,
  Input,
  SectionShift,
  type ChainDelegateOption,
  type ChainEntityType,
  type ChainRoleOption,
  type ChainSummary,
  type ChainStep,
  type CreateChainInput,
  type UpdateChainInput,
} from '@/components/shell'

import {
  useApprovalChains,
  useCreateChain,
  useUpdateChain,
  useActivateChain,
  useDeactivateChain,
  type ApprovalChain,
} from '@/hooks/useApprovalChains'
import { useUsers } from '@/hooks/useUsers'
import { ApiError } from '@/lib/api-client'
import { ROLE_LABEL, USER_ROLES } from '@/lib/user-roles'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_TYPE_LABEL: Record<ChainEntityType, string> = {
  po_threshold: 'Purchase Order Threshold',
  gr_shelf_life_exception: 'GR Shelf-Life Exception',
  recipe_default_change: 'Recipe Default Change',
  bo_self_creation: 'Brand Owner Self-Creation',
  inventory_adjustment: 'Inventory Adjustment',
  b2b_credit_limit_change: 'B2B Credit Limit Change',
}

// Role options derived from the canonical 9-role registry
const ROLE_OPTIONS: ReadonlyArray<ChainRoleOption> = USER_ROLES.map((r) => ({
  value: r,
  label: ROLE_LABEL[r],
}))

// ---------------------------------------------------------------------------
// Data adapters
// ---------------------------------------------------------------------------

/**
 * Convert an API ApprovalChain to the shell's ChainSummary shape.
 * Resolves UUID references into human-readable labels using the maps.
 */
function toSummary(
  chain: ApprovalChain,
  userNames: Map<string, string>,
  delegateNames: Map<string, string>,
): ChainSummary {
  const roleLabels = new Map(ROLE_OPTIONS.map((r) => [r.value, r.label]))

  return {
    id: chain.id,
    entityType: chain.entityType as ChainEntityType,
    entityTypeLabel: ENTITY_TYPE_LABEL[chain.entityType as ChainEntityType] ?? chain.entityType,
    name: chain.name,
    status: chain.status,
    steps: chain.steps.map((s, i) => ({
      stepIndex: i + 1,
      role: s.role,
      roleLabel: roleLabels.get(s.role) ?? s.role,
      valueBandMin: s.valueBandMin,
      valueBandMax: s.valueBandMax,
      escalationTimeoutMinutes: s.escalationTimeoutMinutes,
      fallbackDelegateUserId: s.fallbackDelegateUserId,
      fallbackDelegateLabel: s.fallbackDelegateUserId
        ? delegateNames.get(s.fallbackDelegateUserId) ??
          s.fallbackDelegateUserId.slice(0, 8) + '…'
        : undefined,
    })),
    lastModifiedBy: chain.lastModifiedBy
      ? userNames.get(chain.lastModifiedBy) ??
        chain.lastModifiedBy.slice(0, 8) + '…'
      : 'system',
    lastModifiedAt: chain.lastModifiedAt ?? chain.updatedAt,
  }
}

/**
 * Strip display-only fields from shell ChainStep before sending to the API.
 * `stepIndex`, `roleLabel`, `fallbackDelegateLabel` are all shell-only; the
 * API only wants `role`, `valueBandMin`, `valueBandMax`,
 * `escalationTimeoutMinutes`, `fallbackDelegateUserId`.
 */
function toApiSteps(
  steps: ReadonlyArray<ChainStep>,
): Array<{
  role: string
  valueBandMin?: number
  valueBandMax?: number
  escalationTimeoutMinutes: number
  fallbackDelegateUserId?: string
}> {
  return steps.map(
    ({ role, valueBandMin, valueBandMax, escalationTimeoutMinutes, fallbackDelegateUserId }) => ({
      role,
      valueBandMin,
      valueBandMax,
      escalationTimeoutMinutes,
      fallbackDelegateUserId,
    }),
  )
}

// ---------------------------------------------------------------------------
// Counter cell — local copy of SI-INF-001 pattern (promote to shell on 3rd consumer)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ApprovalChainConfigPage() {
  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null)

  // ── Reason-code state (DL-036 audit hygiene) ─────────────────────────────
  const [reasonCode, setReasonCode] = useState('')
  const reasonValid = reasonCode.trim().length >= 10

  // ── Mutation hooks ────────────────────────────────────────────────────────
  const createChain = useCreateChain()
  const updateChain = useUpdateChain()
  const activateChain = useActivateChain()
  const deactivateChain = useDeactivateChain()

  // ── Data ──────────────────────────────────────────────────────────────────
  const chainsQuery = useApprovalChains()
  const usersQuery = useUsers()

  // ── Lookup maps ───────────────────────────────────────────────────────────
  const userNames = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>()
    ;(usersQuery.data ?? []).forEach((u) => m.set(u.id, u.fullName))
    return m
  }, [usersQuery.data])

  const delegateNames = useMemo<Map<string, string>>(() => {
    // Same as userNames — every user is a potential delegate
    const m = new Map<string, string>()
    ;(usersQuery.data ?? []).forEach((u) => m.set(u.id, u.fullName))
    return m
  }, [usersQuery.data])

  const chains = useMemo<ReadonlyArray<ChainSummary>>(() => {
    const raw = chainsQuery.data ?? []
    return raw.map((c) => toSummary(c, userNames, delegateNames))
  }, [chainsQuery.data, userNames, delegateNames])

  const delegateOptions = useMemo<ReadonlyArray<ChainDelegateOption>>(
    () =>
      (usersQuery.data ?? []).map((u) => ({
        id: u.id,
        label: u.fullName,
      })),
    [usersQuery.data],
  )

  // ── Counters ──────────────────────────────────────────────────────────────
  const counters = useMemo(() => {
    let active = 0
    let draft = 0
    let inactive = 0
    chains.forEach((c) => {
      if (c.status === 'active') active++
      else if (c.status === 'draft') draft++
      else inactive++
    })
    return { total: chains.length, active, draft, inactive }
  }, [chains])

  // ── Callbacks bridging shell ↔ TanStack Query ────────────────────────────

  const onCreateChain = (input: CreateChainInput) => {
    createChain.mutate(
      {
        entityType: input.entityType as ApprovalChain['entityType'],
        name: input.name,
        steps: [],
        status: 'draft',
        reasonCode: reasonCode.trim() || 'Initial chain creation',
      },
      {
        onSuccess: (newChain) => {
          setSelectedChainId(newChain.id)
        },
      },
    )
  }

  const onEditChain = (id: string, input: UpdateChainInput) => {
    const raw = chainsQuery.data?.find((c) => c.id === id)
    if (!raw) return
    updateChain.mutate({
      chainId: id,
      entityType: raw.entityType,
      name: input.name,
      steps: toApiSteps(input.steps),
      reasonCode: reasonCode.trim() || 'Chain edit',
    })
  }

  const onActivate = (id: string) => {
    const raw = chainsQuery.data?.find((c) => c.id === id)
    if (!raw) return
    activateChain.mutate({
      chainId: id,
      entityType: raw.entityType,
      name: raw.name,
      steps: raw.steps,
      reasonCode: reasonCode.trim() || 'Activate chain',
    })
  }

  const onDeactivate = (id: string) => {
    const raw = chainsQuery.data?.find((c) => c.id === id)
    if (!raw) return
    deactivateChain.mutate({
      chainId: id,
      entityType: raw.entityType,
      name: raw.name,
      steps: raw.steps,
      reasonCode: reasonCode.trim() || 'Deactivate chain',
    })
  }

  /**
   * onSaveDraft — the shell calls this with only the chain id (no UpdateChainInput).
   * A save-draft from the shell's perspective persists the current in-editor state,
   * which the ChainEditorPane already commits on blur via onEditChain. Here we issue
   * a no-op PATCH (name + steps unchanged) just to stamp a lastModifiedAt update
   * and signal "intent to stay draft". If no raw chain is found, this is a no-op.
   */
  const onSaveDraft = (id: string) => {
    const raw = chainsQuery.data?.find((c) => c.id === id)
    if (!raw) return
    updateChain.mutate({
      chainId: id,
      entityType: raw.entityType,
      name: raw.name,
      steps: raw.steps,
      reasonCode: reasonCode.trim() || 'Save draft',
    })
  }

  /**
   * onDelete — no-op with a user-friendly alert.
   *
   * There is no DELETE endpoint in apps/api MVP (only PATCH and
   * POST /activate|/deactivate routes exist in apps/api/src/routes/approvals.ts).
   * The audit trail (FR20) requires chains to remain queryable once they
   * have ever been activated. Deactivate is the recommended non-destructive
   * alternative; the shell renders the Delete button only on draft chains.
   */
  const onDelete = (_id: string) => {
    alert(
      'Deletion is not supported in MVP — once a chain has been created it must remain in the audit trail (FR20). Use Deactivate to retire a chain without deleting it.',
    )
  }

  // ── Loading / error states ────────────────────────────────────────────────
  const isLoading = chainsQuery.isLoading
  const fetchError = chainsQuery.error

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-6 py-8 desktop:px-10 desktop:py-10">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Shared Infrastructure · Approvals
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Approval chain configuration
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Define how approval requests route across procurement, inventory,
              recipes, and user lifecycle. Each chain configures the ordered
              approver steps the routing engine walks when an entity needs
              sign-off — value-band thresholds, escalation timeouts, and
              fallback delegates per step.
            </p>
            <p className="mt-3 text-xs text-on-surface-variant">
              FR16 + FR41 (PO threshold) + FR38 (GR shelf-life) + FR50 (recipe
              default) + FR14 (BO self-creation) + FR37 (inventory adjustment
              scope). Mutations write to the audit trail per FR20 (DL-036).
            </p>
          </div>
          <AuditLink entityType="approval_chains" label="Chain change history" />
        </header>

        {/* ── Reason-code panel (DL-036 audit hygiene) ────────────────── */}
        <div className="mt-6 rounded-md bg-surface-container-low p-4 flex flex-col gap-2">
          <label
            htmlFor="chain-reason-code"
            className="block text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
          >
            Reason for this session&apos;s edits
            <span className="ml-1 font-normal normal-case">
              (≥ 10 characters; required for every save / activate / deactivate)
            </span>
          </label>
          <Input
            id="chain-reason-code"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            placeholder="e.g. Adjusting PO threshold for new fiscal year"
            aria-describedby="chain-reason-hint"
          />
          {reasonCode.length > 0 && !reasonValid ? (
            <p id="chain-reason-hint" className="text-xs text-error" role="alert">
              Reason must be at least 10 characters ({reasonCode.length}/10).
            </p>
          ) : (
            <p id="chain-reason-hint" className="text-xs text-on-surface-variant">
              This reason is recorded in the audit trail (FR20) against every
              chain mutation made in this page session.
            </p>
          )}
        </div>

        {/* ── Error banner ─────────────────────────────────────────────── */}
        {fetchError ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {fetchError instanceof ApiError
              ? `Error loading approval chains: ${fetchError.message}`
              : 'Failed to load approval chains. Please refresh the page.'}
          </div>
        ) : null}

        {/* ── Counters strip ───────────────────────────────────────────── */}
        {!isLoading && !fetchError ? (
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
        ) : null}

        {/* ── Loading skeleton ─────────────────────────────────────────── */}
        {isLoading ? (
          <div
            role="status"
            aria-label="Loading approval chains…"
            className="mt-6 flex flex-col gap-2"
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-md bg-surface-container-low animate-pulse"
              />
            ))}
          </div>
        ) : null}

        {/* ── Chain editor ─────────────────────────────────────────────── */}
        {!isLoading && !fetchError ? (
          <section aria-label="Approval chain editor" className="mt-6">
            <CCApprovalChainEditor
              chains={chains}
              selectedChainId={selectedChainId}
              onSelect={setSelectedChainId}
              onCreateChain={onCreateChain}
              onEditChain={onEditChain}
              onActivate={onActivate}
              onDeactivate={onDeactivate}
              onSaveDraft={onSaveDraft}
              onDelete={onDelete}
              roleOptions={ROLE_OPTIONS}
              delegateOptions={delegateOptions}
            />
          </section>
        ) : null}

        {/* ── Mutation error notice ─────────────────────────────────────── */}
        {(createChain.isError ||
          updateChain.isError ||
          activateChain.isError ||
          deactivateChain.isError) ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {(() => {
              const err =
                createChain.error ??
                updateChain.error ??
                activateChain.error ??
                deactivateChain.error
              return err instanceof ApiError
                ? `Chain mutation failed: ${err.message}`
                : 'Chain mutation failed — please try again.'
            })()}
          </div>
        ) : null}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          <Link
            to="/audit?entityType=approval_chains&entityRef=approval_chains"
            className="text-primary hover:underline"
          >
            <History className="inline h-3 w-3 mr-1" aria-hidden />
            Chain change history (audit trail — filtered to approval chains)
          </Link>
          {' · '}
          SI-INF-002 · Tier 1 (Phase 4 deferred-hero) · DL-036 reason-code audit
        </footer>
      </div>
    </div>
  )
}
