import { type ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  Clock,
  GitMerge,
  Layers,
  MessageSquare,
  MoreHorizontal,
  OctagonX,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'
import { StatusPill } from './StatusPill'
import { AuditLink } from './AuditLink'
import { tokens } from '@/tokens'

/**
 * ApprovalInboxCard — CC-APPROVAL-INBOX-CARD canonical card.
 *
 * The inbox-row chrome shipped by SI-INF-001 (the Unified Approval Inbox).
 * Every other epic that has an approvable entity (PO approvals, requisitions,
 * recipe-default changes, paired Brand-Store transfer bundles, B2B credit-
 * limit changes, etc.) surfaces those entities into THIS card via the inbox —
 * no epic re-implements an approval queue.
 *
 * The schema captured here matches the §05 inventory data-displayed bullets
 * for SI-INF-001:
 *   - source module + entity type and reference
 *   - requesting user + requested-at timestamp
 *   - value or threshold band
 *   - current chain step + route reason ("auto-routed by threshold" vs
 *     "delegated")
 *   - per-card status (Pending / Pending — Awaiting Prior Step /
 *     Pending — Delegated)
 *   - bulk-select checkbox (gated to confidence-rated routine actions only)
 *   - inline audit-trail affordance (CC-AUDIT-LINK)
 *
 * Two layout modes — driven by the inbox screen's responsive breakpoint
 * (one component, breakpoint-driven layout per plan §19 Q3):
 *   - layout="row"  : desktop data-grid row (sm: and up).
 *   - layout="card" : mobile compact stack (< sm).
 *
 * Bundle support — `bundle` carries the `CC-PAIRED-TRANSFER-BUNDLE` shape
 * (source location → Brand → destination location). When provided, the card
 * renders a 3-chip connector strip in place of the single-entity title.
 *
 * Animation — NONE. Per CLAUDE.md animation policy, inbox lists are exactly
 * the surface where entrance animations are banned. Tailwind hover transitions
 * are fine.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ApprovalSourceModule =
  | 'procurement'
  | 'inventory'
  | 'recipe'
  | 'production'
  | 'dispatch'
  | 'user'
  | 'b2b'

/** Per-card approval state — three Pending sub-flavours per inventory line 1039. */
export type ApprovalChainState =
  | 'pending'
  | 'awaiting_prior_step'
  | 'delegated'

/** Why this card landed in this user's inbox. */
export type RouteReason = 'auto_threshold' | 'delegated' | 'chain_step'

/** Paired Brand-Store transfer bundle (P2B-002 / CC-PAIRED-TRANSFER-BUNDLE). */
export interface PairedTransferBundle {
  readonly source_location: string
  readonly brand_step: string
  readonly destination_location: string
}

export interface ApprovalCard {
  readonly id: string
  readonly source_module: ApprovalSourceModule
  /** Human-readable entity type (e.g. "Purchase Order", "Material Requisition"). */
  readonly entity_type: string
  /** Display reference (e.g. PO-2026-…, REQ-…, REC-… ). */
  readonly entity_ref: string
  /** Drill route to the source-entity detail screen. */
  readonly entity_route: string
  /** Requesting user persona name. */
  readonly requesting_user: string
  /** Requesting user's role label. */
  readonly requesting_user_role: string
  /** ISO timestamp of the request. */
  readonly requested_at: string
  /** Monetary value in ₹ (integer). 0 means "no monetary footprint" (e.g. a recipe-default change). */
  readonly value: number
  /** Threshold band label, e.g. "Below ₹50,000", "Above brand threshold". */
  readonly value_band: string
  /** Approval chain step description, e.g. "Step 2 of 3 · Cluster Manager". */
  readonly chain_step: string
  /** Why this card landed here. */
  readonly route_reason: RouteReason
  /** Per-card chain state (Pending / Awaiting Prior Step / Delegated). */
  readonly chain_state: ApprovalChainState
  /**
   * Whether this card is bulk-eligible. Gated to confidence-rated routine
   * actions (low-value, single-line, high-confidence categories). When false,
   * the row renders no checkbox and shows a "Single-action confirm required"
   * tooltip in the checkbox cell.
   */
  readonly bulk_eligible: boolean
  /** Optional paired-transfer bundle (CC-PAIRED-TRANSFER-BUNDLE). */
  readonly bundle?: PairedTransferBundle
}

export type ApprovalLayout = 'row' | 'card'

export interface ApprovalInboxCardProps {
  readonly card: ApprovalCard
  /** Selected for bulk-approve (only meaningful when card.bulk_eligible). */
  readonly selected: boolean
  readonly onToggleSelect: (id: string) => void
  /** Layout — driven by the inbox screen's breakpoint state. */
  readonly layout: ApprovalLayout
  /** Approve handler — opens optional-comment popover internally. */
  readonly onApprove: (id: string, comment: string) => void
  /** Reject handler — mandatory reason via popover internally. */
  readonly onReject: (id: string, reason: string) => void
  /** Delegate handler — mandatory reason + target user picker internally. */
  readonly onDelegate: (id: string, reason: string, targetUserId: string) => void
  /** Persona list for the delegate target picker. */
  readonly delegateTargets: ReadonlyArray<{ id: string; name: string; role: string }>
  /** Optional className for grid/row positioning. */
  readonly className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Module → label mapping
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_LABEL: Record<ApprovalSourceModule, string> = {
  procurement: 'Procurement',
  inventory: 'Inventory',
  recipe: 'Recipe',
  production: 'Production',
  dispatch: 'Dispatch',
  user: 'User',
  b2b: 'B2B',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Indian-grouped INR formatter (matches sample-data.ts formatINR). */
function formatINR(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n).toFixed(0)
  const last3 = abs.slice(-3)
  const rest = abs.slice(0, -3)
  const grouped = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
    : last3
  // U+202F NARROW NO-BREAK SPACE (hair space per §7.4)
  return `${sign}₹ ${grouped}`
}

/** Hours-since-requested as a single integer. */
export function ageHours(iso: string, nowIso: string): number {
  const t = new Date(iso).getTime()
  const now = new Date(nowIso).getTime()
  return Math.max(0, Math.floor((now - t) / 3600000))
}

/** Friendly age label. */
export function ageLabel(hrs: number): string {
  if (hrs < 1) return 'just now'
  if (hrs < 24) return `${hrs}h`
  const d = Math.floor(hrs / 24)
  const remainder = hrs % 24
  if (remainder === 0) return `${d}d`
  return `${d}d ${remainder}h`
}

/** Age band → §6.4 functional palette token. */
export type AgeBand = 'fresh' | 'over_24h' | 'over_72h'

export function ageBand(hrs: number): AgeBand {
  if (hrs >= 72) return 'over_72h'
  if (hrs >= 24) return 'over_24h'
  return 'fresh'
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ChainStateBadge({ state }: { state: ApprovalChainState }) {
  // Family is always status_pending_approval per inventory line 1058. The
  // differentiation is in the label + a leading icon variant.
  const label =
    state === 'pending'
      ? 'Pending'
      : state === 'awaiting_prior_step'
        ? 'Pending — Awaiting prior step'
        : 'Pending — Delegated'
  return <StatusPill status="status_pending_approval" label={label} size="sm" />
}

function RouteReasonChip({ reason }: { reason: RouteReason }) {
  const label =
    reason === 'auto_threshold'
      ? 'Auto-routed by threshold'
      : reason === 'delegated'
        ? 'Delegated'
        : 'Chain step'
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-low px-2 py-0.5 text-[11px] uppercase tracking-wider text-on-surface-variant">
      {reason === 'delegated' ? (
        <UserPlus className="h-3 w-3" aria-hidden />
      ) : (
        <GitMerge className="h-3 w-3" aria-hidden />
      )}
      {label}
    </span>
  )
}

function AgePill({ hrs }: { hrs: number }) {
  const band = ageBand(hrs)
  if (band === 'fresh') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-low px-2 py-0.5 text-[11px] tabular-nums text-on-surface-variant">
        <Clock className="h-3 w-3" aria-hidden />
        {ageLabel(hrs)}
      </span>
    )
  }
  // §6.4 — warning for >24h, error for >72h. Pair with icon so colour is
  // never the only signal (§15 a11y).
  const isError = band === 'over_72h'
  return (
    <span
      role="status"
      aria-label={`Age: ${ageLabel(hrs)} — ${isError ? 'over 72 hours' : 'over 24 hours'}`}
      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium tabular-nums"
      style={{
        backgroundColor: isError ? tokens.error : tokens.warning,
        color: isError ? tokens.on_error : tokens.on_warning,
      }}
    >
      {isError ? (
        <ShieldAlert className="h-3 w-3" aria-hidden />
      ) : (
        <Clock className="h-3 w-3" aria-hidden />
      )}
      {ageLabel(hrs)}
    </span>
  )
}

function BundleStrip({ bundle }: { bundle: PairedTransferBundle }) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-sm bg-surface-container-low px-2 py-1.5"
      aria-label="Paired Brand-Store transfer bundle"
    >
      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-on-surface-variant">
        <Layers className="h-3 w-3" aria-hidden />
        Bundle
      </span>
      <span className="rounded-pill bg-surface-container-high px-2 py-0.5 text-xs text-on-surface">
        {bundle.source_location}
      </span>
      <ArrowRight
        className="h-3 w-3 shrink-0 text-on-surface-variant"
        aria-hidden
      />
      <span className="rounded-pill bg-surface-container-high px-2 py-0.5 text-xs text-on-surface">
        {bundle.brand_step}
      </span>
      <ArrowRight
        className="h-3 w-3 shrink-0 text-on-surface-variant"
        aria-hidden
      />
      <span className="rounded-pill bg-surface-container-high px-2 py-0.5 text-xs text-on-surface">
        {bundle.destination_location}
      </span>
    </div>
  )
}

interface ApprovePopoverProps {
  readonly cardId: string
  readonly entityRef: string
  readonly onConfirm: (id: string, comment: string) => void
  readonly children: ReactNode
}

function ApprovePopover({
  cardId,
  entityRef,
  onConfirm,
  children,
}: ApprovePopoverProps) {
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Approve {entityRef}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Optional comment — recorded with the approval in the audit trail.
        </p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Add a comment (optional)…"
          className={cn(
            'mt-3 w-full rounded-sm bg-surface-container-highest text-on-surface',
            'placeholder:text-on-surface-variant px-3 py-2 text-sm resize-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setComment('')
              setOpen(false)
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onConfirm(cardId, comment)
              setComment('')
              setOpen(false)
            }}
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            Confirm approval
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface RejectPopoverProps {
  readonly cardId: string
  readonly entityRef: string
  readonly onConfirm: (id: string, reason: string) => void
  readonly children: ReactNode
}

function RejectPopover({
  cardId,
  entityRef,
  onConfirm,
  children,
}: RejectPopoverProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const valid = reason.trim().length >= 4
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Reject {entityRef}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Why is this happening? A reason is required and is recorded in the
          audit trail.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Reason (required)…"
          aria-invalid={!valid && reason.length > 0}
          className={cn(
            'mt-3 w-full rounded-sm bg-surface-container-highest text-on-surface',
            'placeholder:text-on-surface-variant px-3 py-2 text-sm resize-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            'aria-invalid:ring-2 aria-invalid:ring-error',
          )}
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setReason('')
              setOpen(false)
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!valid}
            onClick={() => {
              if (!valid) return
              onConfirm(cardId, reason.trim())
              setReason('')
              setOpen(false)
            }}
          >
            <OctagonX className="h-3.5 w-3.5" aria-hidden />
            Confirm reject
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface DelegatePopoverProps {
  readonly cardId: string
  readonly entityRef: string
  readonly targets: ReadonlyArray<{ id: string; name: string; role: string }>
  readonly onConfirm: (id: string, reason: string, targetId: string) => void
  readonly children: ReactNode
}

function DelegatePopover({
  cardId,
  entityRef,
  targets,
  onConfirm,
  children,
}: DelegatePopoverProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [targetId, setTargetId] = useState<string>(targets[0]?.id ?? '')
  const valid = reason.trim().length >= 4 && targetId.length > 0
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Delegate {entityRef}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Why is this happening? Reason + target user are required.
        </p>
        <label className="mt-3 block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Target user
        </label>
        <div className="mt-1 flex flex-col gap-1">
          {targets.map((t) => {
            const active = t.id === targetId
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTargetId(t.id)}
                aria-pressed={active}
                className={cn(
                  'flex items-center justify-between rounded-sm px-2 py-1.5 text-left',
                  'min-h-[44px] tablet:min-h-[36px]',
                  'hover:bg-surface-container-high transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active ? 'bg-surface-container' : '',
                )}
              >
                <span className="flex flex-col">
                  <span className="text-sm text-on-surface">{t.name}</span>
                  <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                    {t.role}
                  </span>
                </span>
                {active ? (
                  <span className="text-[11px] font-medium text-primary">
                    Selected
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <label className="mt-3 block text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Reason
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. on leave; finance-mgr to cover"
          aria-invalid={reason.length > 0 && reason.trim().length < 4}
          className={cn(
            'mt-1 w-full rounded-sm bg-surface-container-highest text-on-surface',
            'placeholder:text-on-surface-variant px-3 py-2 text-sm resize-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            'aria-invalid:ring-2 aria-invalid:ring-error',
          )}
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setReason('')
              setOpen(false)
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            onClick={() => {
              if (!valid) return
              onConfirm(cardId, reason.trim(), targetId)
              setReason('')
              setOpen(false)
            }}
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            Confirm delegate
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const NOW_ISO = '2026-05-06T18:00:00+05:30'

export function ApprovalInboxCard({
  card,
  selected,
  onToggleSelect,
  layout,
  onApprove,
  onReject,
  onDelegate,
  delegateTargets,
  className,
}: ApprovalInboxCardProps) {
  const hrs = ageHours(card.requested_at, NOW_ISO)
  const moduleLabel = MODULE_LABEL[card.source_module]
  const valueDisplay = card.value > 0 ? formatINR(card.value) : '—'

  // Checkbox cell — gated by bulk_eligible. When false, render an empty cell
  // with an inline tooltip via title attribute (the spec says "Single-action
  // confirm required").
  const CheckboxCell = (
    <div className="flex items-start justify-center w-10 shrink-0">
      {card.bulk_eligible ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(card.id)}
          aria-label={`Select ${card.entity_ref} for bulk approval`}
          className={cn(
            'h-5 w-5 cursor-pointer rounded-sm bg-surface-container-highest',
            'accent-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        />
      ) : (
        <span
          aria-label="Single-action confirm required — bulk-approve unavailable for high-value items"
          title="Single-action confirm required"
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-surface-container-low text-on-surface-variant"
        >
          <ShieldAlert className="h-3 w-3" aria-hidden />
        </span>
      )}
    </div>
  )

  // The action buttons cluster — used in both layouts.
  const Actions = (
    <div className="flex flex-wrap items-center gap-1.5">
      <ApprovePopover
        cardId={card.id}
        entityRef={card.entity_ref}
        onConfirm={onApprove}
      >
        <Button
          size="sm"
          className="min-h-[44px] tablet:min-h-[36px]"
          aria-label={`Approve ${card.entity_ref}`}
        >
          <CheckCheck className="h-3.5 w-3.5" aria-hidden />
          Approve
        </Button>
      </ApprovePopover>
      <RejectPopover
        cardId={card.id}
        entityRef={card.entity_ref}
        onConfirm={onReject}
      >
        <Button
          size="sm"
          variant="tonal"
          className="min-h-[44px] tablet:min-h-[36px]"
          aria-label={`Reject ${card.entity_ref}`}
        >
          <OctagonX className="h-3.5 w-3.5" aria-hidden />
          Reject
        </Button>
      </RejectPopover>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="min-h-[44px] tablet:min-h-[36px]"
            aria-label={`More actions for ${card.entity_ref}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          <ul className="flex flex-col">
            <li>
              <DelegatePopover
                cardId={card.id}
                entityRef={card.entity_ref}
                targets={delegateTargets}
                onConfirm={onDelegate}
              >
                <button
                  type="button"
                  className={cn(
                    'w-full text-left flex items-center gap-2 rounded-sm px-3 py-2',
                    'text-sm text-on-surface min-h-[44px] tablet:min-h-[36px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  )}
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden />
                  Delegate…
                </button>
              </DelegatePopover>
            </li>
            <li>
              <Link
                to={card.entity_route}
                className={cn(
                  'w-full text-left flex items-center gap-2 rounded-sm px-3 py-2',
                  'text-sm text-on-surface min-h-[44px] tablet:min-h-[36px]',
                  'hover:bg-surface-container-high transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
              >
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                Open {card.entity_type}
              </Link>
            </li>
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )

  if (layout === 'card') {
    // ── Mobile compact stack ────────────────────────────────────────────────
    return (
      <article
        aria-label={`Approval card: ${card.entity_ref}`}
        className={cn(
          'rounded-md bg-surface-container-lowest p-4',
          'flex flex-col gap-3',
          className,
        )}
      >
        <header className="flex items-start gap-3">
          {CheckboxCell}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                {moduleLabel} · {card.entity_type}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-sm text-on-surface">
              {card.entity_ref}
            </p>
          </div>
          <ChainStateBadge state={card.chain_state} />
        </header>

        {card.bundle ? <BundleStrip bundle={card.bundle} /> : null}

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg font-semibold tabular-nums text-on-surface">
            {valueDisplay}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
            {card.value_band}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-on-surface-variant">
              Requested by
            </dt>
            <dd className="mt-0.5 text-on-surface">{card.requesting_user}</dd>
            <dd className="text-[10px] uppercase tracking-wider text-on-surface-variant">
              {card.requesting_user_role}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-on-surface-variant">
              Age
            </dt>
            <dd className="mt-0.5">
              <AgePill hrs={hrs} />
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10px] uppercase tracking-wider text-on-surface-variant">
              Chain step
            </dt>
            <dd className="mt-0.5 text-on-surface">{card.chain_step}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <RouteReasonChip reason={card.route_reason} />
          <AuditLink entityRef={card.entity_ref} compact />
        </div>

        <div className="flex flex-col gap-2">
          <Link
            to={card.entity_route}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-sm bg-surface-container px-3 py-2',
              'text-xs font-medium text-on-surface min-h-[44px]',
              'hover:bg-surface-container-high transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            )}
          >
            View {card.entity_type}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          {Actions}
        </div>
      </article>
    )
  }

  // ── Desktop data-grid row ─────────────────────────────────────────────────
  return (
    <article
      aria-label={`Approval row: ${card.entity_ref}`}
      className={cn(
        'rounded-md bg-surface-container-lowest p-4',
        'grid grid-cols-[2.5rem_minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-4 items-start',
        className,
      )}
    >
      {CheckboxCell}

      {/* Entity column */}
      <div className="min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            {moduleLabel} · {card.entity_type}
          </span>
          <ChainStateBadge state={card.chain_state} />
        </div>
        <p className="font-mono text-sm text-on-surface">{card.entity_ref}</p>
        {card.bundle ? <BundleStrip bundle={card.bundle} /> : null}
        <div className="flex flex-wrap gap-2">
          <RouteReasonChip reason={card.route_reason} />
          <AuditLink entityRef={card.entity_ref} compact />
        </div>
      </div>

      {/* Requester column */}
      <div className="min-w-0 flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
          Requested by
        </span>
        <span className="text-sm text-on-surface truncate">
          {card.requesting_user}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
          {card.requesting_user_role}
        </span>
        <span className="mt-1.5 text-[10px] uppercase tracking-wider text-on-surface-variant">
          Chain step
        </span>
        <span className="text-xs text-on-surface">{card.chain_step}</span>
      </div>

      {/* Value + age column */}
      <div className="min-w-0 flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
          Value
        </span>
        <span className="text-base font-semibold tabular-nums text-on-surface">
          {valueDisplay}
        </span>
        <span className="text-[11px] text-on-surface-variant">
          {card.value_band}
        </span>
        <div className="mt-1.5">
          <AgePill hrs={hrs} />
        </div>
      </div>

      {/* View entity column */}
      <div className="min-w-0 flex flex-col items-start gap-2">
        <Link
          to={card.entity_route}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm bg-surface-container px-3 py-2',
            'text-xs font-medium text-on-surface min-h-[36px]',
            'hover:bg-surface-container-high transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          View
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {/* Actions column */}
      <div className="flex shrink-0 items-start">{Actions}</div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk-approve confirm shell — used by SI-INF-001 top bar.
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkApproveConfirmProps {
  readonly count: number
  readonly totalValue: number
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function BulkApproveConfirm({
  count,
  totalValue,
  onConfirm,
  onCancel,
}: BulkApproveConfirmProps) {
  return (
    <div
      role="dialog"
      aria-label="Bulk approval confirm"
      className="rounded-md bg-surface-container-lowest p-5"
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        Bulk approve
      </p>
      <h3 className="mt-1 text-base font-semibold text-on-surface">
        Approve {count} routine {count === 1 ? 'item' : 'items'}?
      </h3>
      <p className="mt-2 text-sm text-on-surface">
        Combined value{' '}
        <span className="font-semibold tabular-nums">{formatINR(totalValue)}</span>
        . High-value items remain in the inbox for single-action confirm.
      </p>
      <p className="mt-2 text-xs text-on-surface-variant">
        <MessageSquare className="inline h-3 w-3 mr-1" aria-hidden />
        Each approval is recorded individually in the audit trail.
      </p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" aria-hidden />
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm}>
          <CheckCheck className="h-3.5 w-3.5" aria-hidden />
          Confirm bulk approve
        </Button>
      </div>
    </div>
  )
}
