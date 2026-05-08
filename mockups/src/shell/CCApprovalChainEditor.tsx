import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Input } from './Input'
import { SectionShift } from './SectionShift'
import { StatusPill } from './StatusPill'

/**
 * CCApprovalChainEditor — CC-APPROVAL-CHAIN-EDITOR canonical.
 *
 * Most novel surface in Epic 3 (per spec §5 Task B1). Drives the routing
 * engine that consumes FR16 + FR17 + FR41 (PO threshold) + FR38 (GR
 * shelf-life) + FR50 (recipe default) + FR14 (BO self-creation) + FR37
 * (inventory adjustment scope routing).
 *
 * Two-pane layout: left rail lists chain summaries with status pill (draft
 * / active / inactive) and a search-by-entity-type input; right pane is the
 * selected chain editor — header strip with editable name + status pill +
 * action cluster (Save Draft / Activate / Deactivate / Delete), then an
 * ordered step list with role select + value-band range + escalation
 * timeout + fallback delegate per step. Each step renders a routing-reason
 * summary line below the inputs ("PO value > ₹50,000 → Brand Owner") —
 * the SI-INF-002 inventory `data_displayed` field.
 *
 * Status state machine (canonical 20 token set §6.1):
 *   - draft     → status_draft     (yellow pip-pattern)
 *   - active    → status_confirmed (green row)
 *   - inactive  → status_inactive  (grey row)
 *
 * Delete is gated to draft chains only — once a chain has ever been
 * activated the routing engine has consumed it, so the audit trail
 * (FR20) requires the chain to remain queryable. Deactivate is the
 * non-destructive equivalent.
 *
 * Source FRs:
 *   - FR16 — configurable approval chains, threshold-based routing,
 *     delegation. Single source of approval-routing truth across all
 *     ten module epics.
 *   - FR17 — chains feed the unified inbox (SI-INF-001).
 *   - FR20 — chain mutations write to the audit trail.
 *
 * Tokens (DESIGN.md §6.1, §6.4): surface, surface_container_lowest,
 * surface_container_low, surface_container, surface_container_high,
 * surface_container_highest, on_surface, on_surface_variant,
 * status_draft, status_confirmed, status_inactive, primary, error.
 *
 * Borders: only `border-l-4` (status pip — selected-chain indicator in
 * the left rail) plus `focus-visible:` rings on inputs / step rows. No
 * sectioning borders; tonal section breaks via `<SectionShift>` in the
 * step list and right-pane header.
 *
 * Animation: NONE per CLAUDE.md — config form. Tailwind hover/focus
 * transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ChainStatus = 'draft' | 'active' | 'inactive'

export type ChainEntityType =
  | 'po_threshold'
  | 'gr_shelf_life_exception'
  | 'recipe_default_change'
  | 'bo_self_creation'
  | 'inventory_adjustment'

export interface ChainStep {
  readonly stepIndex: number
  /** Role key from the canonical role list. */
  readonly role: string
  /** Human-readable role label (e.g. "Brand Owner"). */
  readonly roleLabel: string
  /** Optional INR floor for this step to fire. */
  readonly valueBandMin?: number
  /** Optional INR ceiling for this step to fire. */
  readonly valueBandMax?: number
  /** Minutes before the step auto-escalates. `0` = never escalate. */
  readonly escalationTimeoutMinutes: number
  /** Optional delegate user id. */
  readonly fallbackDelegateUserId?: string
  /** Resolved display label for the delegate (consumer-supplied). */
  readonly fallbackDelegateLabel?: string
}

export interface ChainSummary {
  readonly id: string
  readonly entityType: ChainEntityType
  readonly entityTypeLabel: string
  readonly name: string
  readonly status: ChainStatus
  readonly steps: ReadonlyArray<ChainStep>
  readonly lastModifiedBy: string
  /** ISO-8601 timestamp of the most recent mutation. */
  readonly lastModifiedAt: string
}

/** Roles offered by the role-select combobox. Consumer can override. */
export interface ChainRoleOption {
  readonly value: string
  readonly label: string
}

/** Delegate-pickable users. */
export interface ChainDelegateOption {
  readonly id: string
  readonly label: string
}

export interface CreateChainInput {
  readonly entityType: ChainEntityType
  readonly entityTypeLabel: string
  readonly name: string
}

export interface UpdateChainInput {
  readonly name: string
  readonly steps: ReadonlyArray<ChainStep>
}

export interface CCApprovalChainEditorProps {
  readonly chains: ReadonlyArray<ChainSummary>
  readonly selectedChainId: string | null
  readonly onSelect: (id: string) => void
  readonly onCreateChain: (input: CreateChainInput) => void
  readonly onEditChain: (id: string, input: UpdateChainInput) => void
  readonly onActivate: (id: string) => void
  readonly onDeactivate: (id: string) => void
  readonly onSaveDraft: (id: string) => void
  readonly onDelete: (id: string) => void
  /** Roles offered in the per-step role select. */
  readonly roleOptions: ReadonlyArray<ChainRoleOption>
  /** Delegate users offered in the per-step fallback picker. */
  readonly delegateOptions: ReadonlyArray<ChainDelegateOption>
  readonly className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_TOKEN: Record<ChainStatus, 'status_draft' | 'status_confirmed' | 'status_inactive'> = {
  draft: 'status_draft',
  active: 'status_confirmed',
  inactive: 'status_inactive',
}

/** Compose a value-band fragment ("> ₹50,000", "₹25,000–₹1,00,000"). */
function valueBandFragment(min?: number, max?: number): string | null {
  const fmt = (n: number) =>
    `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  if (min === undefined && max === undefined) return null
  if (min !== undefined && max === undefined) return `> ${fmt(min)}`
  if (min === undefined && max !== undefined) return `≤ ${fmt(max)}`
  return `${fmt(min!)}–${fmt(max!)}`
}

/** "PO value > ₹50,000 → Brand Owner" — inventory-spec routing summary. */
function routingReason(
  step: ChainStep,
  entityTypeLabel: string,
): string {
  const band = valueBandFragment(step.valueBandMin, step.valueBandMax)
  const subject = band
    ? `${entityTypeLabel} value ${band}`
    : entityTypeLabel
  return `${subject} → ${step.roleLabel}`
}

function formatTimeoutLabel(minutes: number): string {
  if (minutes === 0) return '0 (no escalation)'
  if (minutes < 60) return `${minutes} min`
  if (minutes % 60 === 0) return `${minutes / 60} h`
  const h = Math.floor(minutes / 60)
  const m = minutes - h * 60
  return `${h} h ${m} min`
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CCApprovalChainEditor({
  chains,
  selectedChainId,
  onSelect,
  onCreateChain,
  onEditChain,
  onActivate,
  onDeactivate,
  onSaveDraft,
  onDelete,
  roleOptions,
  delegateOptions,
  className,
}: CCApprovalChainEditorProps) {
  const [search, setSearch] = useState('')

  const selectedChain = useMemo(
    () => chains.find((c) => c.id === selectedChainId) ?? null,
    [chains, selectedChainId],
  )

  const filteredChains = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length === 0) return chains
    return chains.filter(
      (c) =>
        c.entityTypeLabel.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q),
    )
  }, [chains, search])

  return (
    <div
      data-slot="cc-approval-chain-editor"
      className={cn(
        'rounded-md bg-surface-container-low overflow-hidden',
        'grid grid-cols-1 desktop:grid-cols-[20rem_1fr]',
        className,
      )}
    >
      {/* Left rail — chain list */}
      <aside
        aria-label="Approval chain list"
        className="bg-surface-container-lowest"
      >
        <header className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-on-surface">
              Approval chains
            </h2>
            <Button
              size="sm"
              variant="tonal"
              className="h-8 px-2.5 gap-1"
              onClick={() =>
                onCreateChain({
                  entityType: 'po_threshold',
                  entityTypeLabel: 'Purchase Order',
                  name: 'Untitled chain',
                })
              }
              aria-label="Create new approval chain"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              <span className="text-xs">New</span>
            </Button>
          </div>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
              aria-hidden
            />
            <Input
              aria-label="Search chains by entity type"
              placeholder="Search by entity type…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </header>

        <SectionShift tone="lowest" aria-hidden />

        <ul className="flex flex-col p-2 gap-1">
          {filteredChains.length === 0 ? (
            <li className="px-3 py-8 text-center text-xs text-on-surface-variant">
              {chains.length === 0
                ? 'No chains yet — start with “New”.'
                : 'No chains match the search.'}
            </li>
          ) : (
            filteredChains.map((c) => {
              const isSelected = c.id === selectedChainId
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'w-full text-left rounded-sm px-3 py-2.5 flex flex-col gap-1.5 min-h-[44px]',
                      'transition-colors hover:bg-surface-container-high',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isSelected
                        ? 'bg-surface-container border-l-4 border-l-primary pl-2'
                        : '',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        {c.entityTypeLabel}
                      </span>
                      <StatusPill status={STATUS_TOKEN[c.status]} size="sm" />
                    </div>
                    <span className="text-sm font-medium text-on-surface line-clamp-2">
                      {c.name}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {c.steps.length} step{c.steps.length === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </aside>

      {/* Right pane — selected chain editor */}
      <section
        aria-label="Approval chain editor"
        className="bg-surface-container-lowest"
      >
        {selectedChain ? (
          <ChainEditorPane
            // `key` resets local edit buffers when the consumer flips
            // selectedChainId — natural unmount-remount, no render-side
            // setState gymnastics required.
            key={selectedChain.id}
            chain={selectedChain}
            onEditChain={onEditChain}
            onActivate={onActivate}
            onDeactivate={onDeactivate}
            onSaveDraft={onSaveDraft}
            onDelete={onDelete}
            roleOptions={roleOptions}
            delegateOptions={delegateOptions}
          />
        ) : (
          <EmptyEditorPane
            hasChains={chains.length > 0}
            onCreate={() =>
              onCreateChain({
                entityType: 'po_threshold',
                entityTypeLabel: 'Purchase Order',
                name: 'Untitled chain',
              })
            }
          />
        )}
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty pane
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyEditorPaneProps {
  readonly hasChains: boolean
  readonly onCreate: () => void
}

function EmptyEditorPane({ hasChains, onCreate }: EmptyEditorPaneProps) {
  return (
    <div className="h-full flex items-center justify-center p-12">
      <div className="max-w-sm flex flex-col items-center text-center gap-3">
        <span
          aria-hidden
          className="rounded-pill bg-surface-container-high p-3"
        >
          <GitBranch className="h-6 w-6 text-on-surface-variant" aria-hidden />
        </span>
        <h3 className="text-base font-semibold text-on-surface">
          {hasChains
            ? 'Pick a chain to view its routing'
            : 'No approval chains yet'}
        </h3>
        <p className="text-xs text-on-surface-variant">
          {hasChains
            ? 'The left rail lists every configured chain — select one to inspect its ordered steps, value bands, escalation timeouts, and fallback delegates.'
            : 'Approval chains drive the routing engine. Create one for purchase orders, goods receipts with shelf-life exceptions, recipe default changes, brand-owner self-creation, or inventory adjustments — each has its own ordered steps with value-band thresholds.'}
        </p>
        {!hasChains ? (
          <Button onClick={onCreate} size="sm" className="mt-1">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New chain
          </Button>
        ) : null}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor pane
// ─────────────────────────────────────────────────────────────────────────────

interface ChainEditorPaneProps {
  readonly chain: ChainSummary
  readonly onEditChain: (id: string, input: UpdateChainInput) => void
  readonly onActivate: (id: string) => void
  readonly onDeactivate: (id: string) => void
  readonly onSaveDraft: (id: string) => void
  readonly onDelete: (id: string) => void
  readonly roleOptions: ReadonlyArray<ChainRoleOption>
  readonly delegateOptions: ReadonlyArray<ChainDelegateOption>
}

function ChainEditorPane({
  chain,
  onEditChain,
  onActivate,
  onDeactivate,
  onSaveDraft,
  onDelete,
  roleOptions,
  delegateOptions,
}: ChainEditorPaneProps) {
  // The parent passes a `key` prop bound to `chain.id`, so this component
  // unmounts + remounts when the consumer selects a different chain. That
  // means useState initialisers always reflect the freshly-selected chain
  // — no useEffect-on-prop-change reset gymnastics required.
  const [name, setName] = useState(chain.name)
  const [steps, setSteps] = useState<ReadonlyArray<ChainStep>>(chain.steps)

  const updateStep = (index: number, patch: Partial<ChainStep>) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    )
  }

  const moveStep = (index: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      const a = next[index]!
      const b = next[target]!
      next[index] = { ...b, stepIndex: index + 1 }
      next[target] = { ...a, stepIndex: target + 1 }
      return next
    })
  }

  const removeStep = (index: number) => {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, stepIndex: i + 1 })),
    )
  }

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        stepIndex: prev.length + 1,
        role: roleOptions[0]?.value ?? '',
        roleLabel: roleOptions[0]?.label ?? '',
        valueBandMin: undefined,
        valueBandMax: undefined,
        escalationTimeoutMinutes: 0,
        fallbackDelegateUserId: undefined,
        fallbackDelegateLabel: undefined,
      },
    ])
  }

  const commitEdit = () => {
    onEditChain(chain.id, { name, steps })
  }

  const isDraft = chain.status === 'draft'
  const isActive = chain.status === 'active'
  const isInactive = chain.status === 'inactive'

  return (
    <div className="flex flex-col">
      {/* Header strip */}
      <header className="p-4 flex flex-col gap-3 desktop:flex-row desktop:items-start desktop:justify-between">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            {chain.entityTypeLabel} · chain
          </span>
          <Input
            aria-label="Chain name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitEdit}
            className="h-11 text-base font-semibold"
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
            <StatusPill status={STATUS_TOKEN[chain.status]} size="sm" />
            <span>·</span>
            <span>
              Last edited by{' '}
              <span className="text-on-surface">{chain.lastModifiedBy}</span> ·{' '}
              {new Date(chain.lastModifiedAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSaveDraft(chain.id)}
          >
            Save draft
          </Button>
          {isDraft || isInactive ? (
            <Button size="sm" onClick={() => onActivate(chain.id)}>
              Activate
            </Button>
          ) : null}
          {isActive ? (
            <Button
              size="sm"
              variant="tonal"
              onClick={() => onDeactivate(chain.id)}
            >
              Deactivate
            </Button>
          ) : null}
          {isDraft ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(chain.id)}
              aria-label="Delete draft chain"
              className="text-error hover:text-error"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete
            </Button>
          ) : null}
        </div>
      </header>

      <SectionShift tone="lowest" aria-hidden />

      {/* Step list */}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-on-surface">
            Routing steps
          </h3>
          <span className="text-[11px] text-on-surface-variant tabular-nums">
            {steps.length} step{steps.length === 1 ? '' : 's'}
          </span>
        </div>

        {steps.length === 0 ? (
          <div className="rounded-md bg-surface-container-low p-6 text-center text-xs text-on-surface-variant">
            No steps yet — add at least one step before activating the chain.
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {steps.map((step, idx) => (
              <li key={`${idx}-${step.role}`}>
                <StepRow
                  step={step}
                  index={idx}
                  total={steps.length}
                  entityTypeLabel={chain.entityTypeLabel}
                  roleOptions={roleOptions}
                  delegateOptions={delegateOptions}
                  onPatch={(patch) => updateStep(idx, patch)}
                  onMoveUp={() => moveStep(idx, -1)}
                  onMoveDown={() => moveStep(idx, 1)}
                  onRemove={() => removeStep(idx)}
                  onCommit={commitEdit}
                />
              </li>
            ))}
          </ol>
        )}

        <div>
          <Button
            size="sm"
            variant="tonal"
            onClick={addStep}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add step
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step row
// ─────────────────────────────────────────────────────────────────────────────

interface StepRowProps {
  readonly step: ChainStep
  readonly index: number
  readonly total: number
  readonly entityTypeLabel: string
  readonly roleOptions: ReadonlyArray<ChainRoleOption>
  readonly delegateOptions: ReadonlyArray<ChainDelegateOption>
  readonly onPatch: (patch: Partial<ChainStep>) => void
  readonly onMoveUp: () => void
  readonly onMoveDown: () => void
  readonly onRemove: () => void
  readonly onCommit: () => void
}

function StepRow({
  step,
  index,
  total,
  entityTypeLabel,
  roleOptions,
  delegateOptions,
  onPatch,
  onMoveUp,
  onMoveDown,
  onRemove,
  onCommit,
}: StepRowProps) {
  return (
    <div className="rounded-md bg-surface-container-low p-3 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {/* Step number + reorder controls */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-primary text-on-primary text-xs font-semibold tabular-nums"
          >
            {index + 1}
          </span>
          <div className="flex flex-col">
            <button
              type="button"
              aria-label="Move step up"
              disabled={index === 0}
              onClick={onMoveUp}
              className={cn(
                'rounded-sm p-1 text-on-surface-variant hover:bg-surface-container-high',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Move step down"
              disabled={index === total - 1}
              onClick={onMoveDown}
              className={cn(
                'rounded-sm p-1 text-on-surface-variant hover:bg-surface-container-high',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-0 grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 gap-3">
          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`step-${index}-role`}
              className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
            >
              Approver role
            </label>
            <SelectShell
              id={`step-${index}-role`}
              value={step.role}
              onChange={(v) => {
                const matched = roleOptions.find((r) => r.value === v)
                onPatch({
                  role: v,
                  roleLabel: matched?.label ?? v,
                })
                onCommit()
              }}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </SelectShell>
          </div>

          {/* Value band */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Value band (₹)
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                aria-label="Value-band minimum (INR)"
                placeholder="Min"
                inputMode="numeric"
                value={step.valueBandMin ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  onPatch({
                    valueBandMin:
                      raw.length === 0 ? undefined : Number(raw) || 0,
                  })
                }}
                onBlur={onCommit}
                className="tabular-nums"
              />
              <span aria-hidden className="text-on-surface-variant">
                –
              </span>
              <Input
                aria-label="Value-band maximum (INR)"
                placeholder="Max"
                inputMode="numeric"
                value={step.valueBandMax ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  onPatch({
                    valueBandMax:
                      raw.length === 0 ? undefined : Number(raw) || 0,
                  })
                }}
                onBlur={onCommit}
                className="tabular-nums"
              />
            </div>
          </div>

          {/* Escalation timeout */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`step-${index}-timeout`}
              className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
            >
              Escalation timeout
            </label>
            <Input
              id={`step-${index}-timeout`}
              aria-label="Escalation timeout in minutes (0 = no escalation)"
              placeholder="0 = none"
              inputMode="numeric"
              value={step.escalationTimeoutMinutes}
              onChange={(e) => {
                const raw = e.target.value.trim()
                onPatch({
                  escalationTimeoutMinutes:
                    raw.length === 0 ? 0 : Number(raw) || 0,
                })
              }}
              onBlur={onCommit}
              className="tabular-nums"
            />
            <span className="text-[11px] text-on-surface-variant">
              {formatTimeoutLabel(step.escalationTimeoutMinutes)}
            </span>
          </div>

          {/* Fallback delegate */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`step-${index}-delegate`}
              className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
            >
              Fallback delegate
            </label>
            <SelectShell
              id={`step-${index}-delegate`}
              value={step.fallbackDelegateUserId ?? ''}
              onChange={(v) => {
                const matched = delegateOptions.find((d) => d.id === v)
                onPatch({
                  fallbackDelegateUserId: v.length === 0 ? undefined : v,
                  fallbackDelegateLabel: matched?.label,
                })
                onCommit()
              }}
            >
              <option value="">No delegate</option>
              {delegateOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </SelectShell>
            {step.fallbackDelegateLabel ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
                <UserRound className="h-3 w-3" aria-hidden />
                {step.fallbackDelegateLabel}
              </span>
            ) : null}
          </div>
        </div>

        {/* Remove */}
        <div className="shrink-0">
          <button
            type="button"
            aria-label="Remove step"
            onClick={onRemove}
            className={cn(
              'rounded-sm p-1.5 text-on-surface-variant hover:bg-error-container hover:text-on-error-container',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              'transition-colors',
            )}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Routing reason summary */}
      <div className="rounded-sm bg-surface-container-lowest px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Routing reason
        </span>
        <p className="text-xs text-on-surface mt-0.5">
          {routingReason(step, entityTypeLabel)}
          {step.escalationTimeoutMinutes > 0 ? (
            <>
              {' '}
              · escalates after{' '}
              <span className="tabular-nums">
                {formatTimeoutLabel(step.escalationTimeoutMinutes)}
              </span>
            </>
          ) : null}
          {step.fallbackDelegateLabel ? (
            <> · fallback {step.fallbackDelegateLabel}</>
          ) : null}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: SelectShell — appearance-none `<select>` styled to match Input.
// Inline because the project Input wraps shadcn `<input>`, not `<select>`.
// ─────────────────────────────────────────────────────────────────────────────

interface SelectShellProps {
  readonly id?: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly children: React.ReactNode
  readonly className?: string
}

function SelectShell({
  id,
  value,
  onChange,
  children,
  className,
}: SelectShellProps) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-11 w-full appearance-none rounded-sm bg-surface-container-highest pl-3 pr-9 text-sm text-on-surface',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant"
        aria-hidden
      />
    </div>
  )
}

