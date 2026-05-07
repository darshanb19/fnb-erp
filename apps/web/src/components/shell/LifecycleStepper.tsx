import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens, type StatusKey } from '@/lib/tokens'
import { StatusPill } from './StatusPill'

/**
 * LifecycleStepper — canonical 5-status lifecycle chrome (DL-001 + FR42 + PRD line 650).
 *
 * Renders a horizontal stepper visualising entity progression through a
 * fixed lifecycle. Three step states drive the chrome:
 *   - `complete` — prior steps; rendered with the §6.4 `success` token wash
 *     and a check glyph.
 *   - `active`  — the current step; rendered in the project `primary` chrome
 *     (the §5.1.1 brand colour) so the eye lands on it first.
 *   - `future`  — downstream steps; rendered in `surface_container_high`
 *     neutral chrome.
 *
 * Terminal-branch states (`cancelled`, `closed_gr_rejected` for the PO
 * lifecycle, mirrored across stock-transfer and B2B-challan lifecycles)
 * REPLACE the right-side trailing steps with a single terminal chip whose
 * chrome comes from the `<StatusPill />` token mapping. The component is
 * truly reusable: consumers may pass their own `steps` prop to drive a
 * stock-transfer lifecycle (Draft → Approved → In Transit → Received) or a
 * B2B-challan lifecycle (Draft → Dispatched → Delivered → Closed).
 *
 * Responsive behaviour — desktop renders the steps horizontally; on phones
 * we collapse to a vertical stack so each step's label remains legible.
 *
 * Animation — NONE. Per DESIGN.md §10.1 + CLAUDE.md animation policy, no
 * entrance / progression animation on lifecycle chrome (would be visual
 * noise on a transactional view). State changes are instantaneous chrome
 * swaps.
 */

/** PO lifecycle states per DL-001 + FR42 + PRD line 650 + FR47a. */
export type POLifecycleState =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'partially_received'
  | 'fully_received'
  | 'closed'
  | 'cancelled'
  | 'closed_gr_rejected'

export interface LifecycleStep {
  /** Stable key — used for React keys and matching to the active state. */
  readonly key: string
  /** Visible label per DESIGN.md §6.1 voice (e.g. "Pending Approval"). */
  readonly label: string
  /** The §6.1 `status_*` token used to chrome the chip when this step is active. */
  readonly statusToken: StatusKey
}

/**
 * Default PO lifecycle (6 visible steps + terminal-branch handling).
 * "Sent" is the bridge state between approval and goods-receipt sides per
 * the SI-PUR-003 inventory entry's Notes paragraph; we collapse the
 * `partially_received` and `fully_received` states into a single visible
 * "Received" step (the active highlight differentiates them via the chip
 * label).
 */
export const PO_LIFECYCLE_STEPS: ReadonlyArray<LifecycleStep> = [
  { key: 'draft', label: 'Draft', statusToken: 'status_draft' },
  { key: 'pending_approval', label: 'Pending Approval', statusToken: 'status_pending_approval' },
  { key: 'approved', label: 'Approved', statusToken: 'status_confirmed' },
  { key: 'sent', label: 'Sent', statusToken: 'status_in_progress' },
  { key: 'received', label: 'Received', statusToken: 'status_completed' },
  { key: 'closed', label: 'Closed', statusToken: 'status_closed' },
]

/** Stock-transfer lifecycle (4 steps). */
export const STOCK_TRANSFER_LIFECYCLE_STEPS: ReadonlyArray<LifecycleStep> = [
  { key: 'draft', label: 'Draft', statusToken: 'status_draft' },
  { key: 'approved', label: 'Approved', statusToken: 'status_confirmed' },
  { key: 'in_transit', label: 'In Transit', statusToken: 'status_in_progress' },
  { key: 'received', label: 'Received', statusToken: 'status_completed' },
]

/** B2B challan lifecycle (4 steps). */
export const B2B_CHALLAN_LIFECYCLE_STEPS: ReadonlyArray<LifecycleStep> = [
  { key: 'draft', label: 'Draft', statusToken: 'status_draft' },
  { key: 'dispatched', label: 'Dispatched', statusToken: 'status_in_progress' },
  { key: 'delivered', label: 'Delivered', statusToken: 'status_completed' },
  { key: 'closed', label: 'Closed', statusToken: 'status_closed' },
]

/** Production-Order lifecycle (DL-001, 2026-05-02): Draft → Pending GR → Confirmed → In Progress → Completed (5 steps). */
export const PRODUCTION_ORDER_LIFECYCLE_STEPS: ReadonlyArray<LifecycleStep> = [
  { key: 'draft', label: 'Draft', statusToken: 'status_draft' },
  { key: 'pending_gr', label: 'Pending GR', statusToken: 'status_pending_gr' },
  { key: 'confirmed', label: 'Confirmed', statusToken: 'status_confirmed' },
  { key: 'in_progress', label: 'In Progress', statusToken: 'status_in_progress' },
  { key: 'completed', label: 'Completed', statusToken: 'status_completed' },
]

/** Map a PO lifecycle state onto the visible step key in PO_LIFECYCLE_STEPS. */
const PO_STATE_TO_STEP_KEY: Record<POLifecycleState, string> = {
  draft: 'draft',
  pending_approval: 'pending_approval',
  approved: 'approved',
  sent: 'sent',
  partially_received: 'received',
  fully_received: 'received',
  closed: 'closed',
  // Terminals — for `cancelled` we show the steps up to draft (cancellation
  // happens early); for `closed_gr_rejected` we show every step since the PO
  // travelled the full path before the GR rejection short-circuited closure.
  cancelled: 'draft',
  closed_gr_rejected: 'received',
}

const TERMINAL_STATES: ReadonlySet<POLifecycleState> = new Set([
  'cancelled',
  'closed_gr_rejected',
])

/** For the PO terminal branches, produce the chip token + label. */
function poTerminalChip(state: POLifecycleState): {
  statusToken: StatusKey
  label: string
} | null {
  if (state === 'cancelled')
    return { statusToken: 'status_cancelled', label: 'Cancelled' }
  if (state === 'closed_gr_rejected')
    return { statusToken: 'status_gr_rejected', label: 'Closed — GR Rejected' }
  return null
}

export interface LifecycleStepperProps {
  /**
   * The active lifecycle state. For the default PO lifecycle this MUST be a
   * `POLifecycleState`; for a custom `steps` array this is matched by key
   * against `step.key`, so any string is acceptable.
   */
  status: POLifecycleState | string
  /**
   * Optional fulfillment ratio (0–1) shown under the active step when
   * status is `partially_received`. Renders "X of Y received".
   */
  lineItemFulfillmentRatio?: number
  /**
   * Optional override for the steps. Default = PO_LIFECYCLE_STEPS. Pass the
   * stock-transfer or B2B-challan arrays exported from this module — or any
   * custom shape — to reuse the chrome on those lifecycles. When `steps` is
   * supplied, the active-step matching falls back to `status === step.key`.
   */
  steps?: ReadonlyArray<LifecycleStep>
  /**
   * Optional terminal-branch chip override. When supplied (and non-null),
   * the stepper renders the trailing terminal chip instead of the right-side
   * future steps. Lets non-PO lifecycles signal their own terminal states.
   */
  terminal?: { statusToken: StatusKey; label: string } | null
  className?: string
}

interface StepChipProps {
  step: LifecycleStep
  state: 'complete' | 'active' | 'future'
  fulfillmentLabel?: string
}

/** A single rendered step chip. */
function StepChip({ step, state, fulfillmentLabel }: StepChipProps) {
  if (state === 'complete') {
    const successBg = tokens.success
    const successFg = tokens.on_success
    return (
      <div className="flex flex-col items-start gap-1 min-w-0">
        <span
          role="status"
          aria-label={`${step.label} — complete`}
          className="inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-xs font-medium"
          style={{ backgroundColor: successBg, color: successFg }}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          <span>{step.label}</span>
        </span>
      </div>
    )
  }
  if (state === 'active') {
    return (
      <div className="flex flex-col items-start gap-1 min-w-0">
        <StatusPill status={step.statusToken} label={step.label} />
        {fulfillmentLabel ? (
          <span className="text-[11px] text-on-surface-variant tabular-nums">
            {fulfillmentLabel}
          </span>
        ) : null}
      </div>
    )
  }
  return (
    <div className="flex flex-col items-start gap-1 min-w-0">
      <span
        aria-label={`${step.label} — not yet reached`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-xs font-medium',
          'bg-surface-container-high text-on-surface-variant',
        )}
      >
        <span>{step.label}</span>
      </span>
    </div>
  )
}

/** Connector strip between two step chips. */
function StepConnector({
  state,
  className,
}: {
  state: 'complete' | 'future'
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'shrink-0 h-1 rounded-pill',
        state === 'complete' ? 'bg-success' : 'bg-surface-container-high',
        className,
      )}
    />
  )
}

export function LifecycleStepper({
  status,
  lineItemFulfillmentRatio,
  steps,
  terminal,
  className,
}: LifecycleStepperProps) {
  const usingDefault = !steps
  const lifecycleSteps = steps ?? PO_LIFECYCLE_STEPS

  // Resolve the active-step key.
  const activeKey = usingDefault
    ? PO_STATE_TO_STEP_KEY[status as POLifecycleState]
    : status

  // Resolve the terminal chip — explicit override takes precedence; otherwise
  // PO defaults supply the cancelled / closed_gr_rejected chip when applicable.
  const resolvedTerminal =
    terminal !== undefined
      ? terminal
      : usingDefault && TERMINAL_STATES.has(status as POLifecycleState)
        ? poTerminalChip(status as POLifecycleState)
        : null

  // Active fulfillment label — only attaches to the PO `partially_received` state.
  const fulfillmentLabel =
    usingDefault &&
    (status as POLifecycleState) === 'partially_received' &&
    typeof lineItemFulfillmentRatio === 'number'
      ? `${Math.round(lineItemFulfillmentRatio * 100)} % received`
      : undefined

  // Determine each step's chrome state, then truncate when a terminal applies.
  const activeIndex = lifecycleSteps.findIndex((s) => s.key === activeKey)

  // For terminal branches, we render up to (and including) the active step,
  // then the terminal chip as a trailing badge. Otherwise we render every step.
  const visibleSteps = resolvedTerminal
    ? lifecycleSteps.slice(0, Math.max(activeIndex, 0) + 1)
    : lifecycleSteps

  return (
    <nav
      aria-label="Lifecycle progression"
      className={cn(
        'flex flex-col tablet:flex-row tablet:items-center gap-2 tablet:gap-1',
        className,
      )}
    >
      {visibleSteps.map((step, idx) => {
        const isLast = idx === visibleSteps.length - 1
        let stepState: 'complete' | 'active' | 'future'
        if (resolvedTerminal) {
          // In terminal mode, all visible steps prior to the terminal are complete.
          // The active step is replaced visually by the terminal chip. We treat
          // the rendered steps as `complete` when they sit before activeIndex,
          // and `active` if the activeIndex was reached but not yet terminal.
          if (idx < activeIndex) stepState = 'complete'
          else stepState = 'complete'
        } else {
          if (activeIndex === -1) stepState = 'future'
          else if (idx < activeIndex) stepState = 'complete'
          else if (idx === activeIndex) stepState = 'active'
          else stepState = 'future'
        }
        return (
          <div key={step.key} className="flex items-center gap-2 tablet:gap-1">
            <StepChip
              step={step}
              state={stepState}
              fulfillmentLabel={stepState === 'active' ? fulfillmentLabel : undefined}
            />
            {!isLast || resolvedTerminal ? (
              <StepConnector
                state={stepState === 'complete' ? 'complete' : 'future'}
                className="hidden tablet:block w-6"
              />
            ) : null}
          </div>
        )
      })}
      {resolvedTerminal ? (
        <div className="flex flex-col items-start gap-1 min-w-0">
          <StatusPill
            status={resolvedTerminal.statusToken}
            label={resolvedTerminal.label}
          />
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
            Terminal state
          </span>
        </div>
      ) : null}
    </nav>
  )
}
