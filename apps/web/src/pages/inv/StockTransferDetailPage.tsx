import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  CircleOff,
  PackageCheck,
  PackageSearch,
  Truck,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  CCReverseCancelDialog,
  IssueTicketLink,
  LifecycleStepper,
  SectionShift,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TrnDisplay,
} from '@/components/shell'
import { STOCK_TRANSFER_LIFECYCLE_STEPS } from '@/components/shell/LifecycleStepper'
import type { ReverseCancelMode } from '@/components/shell/CCReverseCancelDialog'
import type { StatusToken } from '@/components/shell/StatusPill'

import {
  useTransferDetail,
  useTransferList,
  useSubmitTransfer,
  useApproveTransfer,
  useDispatchTransfer,
  useConfirmReceipt,
  useCancelTransfer,
} from '@/hooks/inv/useStockTransfers'
import type { TransferStatus } from '@/hooks/inv/schemas'
import { useInventoryProductNames, useInventoryDepartments } from '@/hooks/inv/useProductNames'
import { useRealtimeChannel } from '@/lib/realtime-bridge'
import { qk } from '@/lib/query-keys'
import { ApiError } from '@/lib/api-client'

/**
 * SI-INV-006 — Stock Transfer Detail & Status (production port of Arc-b mockup).
 *
 * Tier 2, Epic 4 Arc (c) Wave 2. Full lifecycle detail view for a single stock
 * transfer, fed by useTransferDetail.
 *
 * Status-gated actions:
 *   draft           → Submit + Cancel (pre-confirmed dialog)
 *   pending_approval→ "View in approval inbox" + Advance-to-approved + Cancel
 *   approved        → Dispatch + disabled reverse affordance
 *   in_transit      → Confirm receipt + disabled reverse affordance
 *   received        → terminal (disabled reverse)
 *   cancelled       → terminal chip only
 *
 * Divergences from mockup:
 *   D1 — Demo StatusPicker replaced by real recent-transfers picker (useTransferList)
 *   D2 — Line table drops batch/expiry columns (no batch data on stock_transfer_lines);
 *        maps productId→name via useInventoryProductNames
 *   D3 — Status-gated real mutation actions replace single confirm/reverse
 *   D4 — CCReverseCancelDialog only for draft/pending_approval (pre-confirmed)
 *
 * Realtime: reuses the 'approval_requests' channel; invalidates the transfer
 * detail query when an approval_request_change fires for this transfer's linked
 * approvalRequestId (matched on ApprovalRequestPayload.requestId).
 *
 * FRs: FR28 (transfer lifecycle), FR117 (pre-confirmed cancel vs compensating doc).
 * RULES OF HOOKS: ALL hooks above every early return.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Static constants
// ─────────────────────────────────────────────────────────────────────────────

const TRANSFER_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'urgent_restocking', label: 'Urgent restocking' },
  { value: 'par_replenishment', label: 'PAR replenishment' },
  { value: 'expiry_redistribution', label: 'Expiry-based redistribution' },
  { value: 'event_prep', label: 'Event preparation' },
  { value: 'surplus_return', label: 'Surplus return' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — copied verbatim from mockup; status union is identical
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical status → StatusPill token mapping. */
function statusToken(s: TransferStatus): StatusToken {
  switch (s) {
    case 'in_transit':       return 'status_in_progress'
    case 'received':         return 'status_completed'
    case 'cancelled':        return 'status_cancelled'
    case 'draft':            return 'status_draft'
    case 'pending_approval': return 'status_pending_approval'
    case 'approved':         return 'status_confirmed'
    default:                 return 'status_draft'
  }
}

/** Human-readable label for each status. */
function statusLabel(s: TransferStatus): string {
  switch (s) {
    case 'in_transit':       return 'In Transit'
    case 'received':         return 'Received'
    case 'cancelled':        return 'Cancelled'
    case 'draft':            return 'Draft'
    case 'pending_approval': return 'Pending Approval'
    case 'approved':         return 'Approved'
    default:                 return s
  }
}

/**
 * Map transfer status to the active step key for LifecycleStepper.
 * STOCK_TRANSFER_LIFECYCLE_STEPS keys: 'draft' | 'approved' | 'in_transit' | 'received'.
 * 'pending_approval' is not a step key — maps to 'draft'.
 */
function statusToStepKey(s: TransferStatus): string {
  switch (s) {
    case 'draft':            return 'draft'
    case 'pending_approval': return 'draft'
    case 'approved':         return 'approved'
    case 'in_transit':       return 'in_transit'
    case 'received':         return 'received'
    case 'cancelled':        return 'draft'
    default:                 return 'draft'
  }
}

/**
 * Terminal chip — only 'cancelled' is a terminal branch.
 */
function terminalChip(s: TransferStatus): { statusToken: StatusToken; label: string } | null {
  if (s === 'cancelled') return { statusToken: 'status_cancelled', label: 'Cancelled' }
  return null
}

/**
 * FR117: derive CCReverseCancelDialog mode from status.
 * pre-confirmed  → draft, pending_approval (no stock/finance impact yet)
 * post-confirmed → approved, in_transit, received (stock already affected)
 */
function reverseCancelMode(s: TransferStatus): ReverseCancelMode {
  if (s === 'draft' || s === 'pending_approval') return 'pre-confirmed'
  return 'post-confirmed'
}

/** Format ISO datetime as "DD MMM YYYY, HH:mm" (UTC). */
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mon = months[d.getUTCMonth()]
  const yyyy = d.getUTCFullYear()
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${dd} ${mon} ${yyyy}, ${hh}:${mm}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface TransferMetaRowProps {
  readonly label: string
  readonly value: string
}

function TransferMetaRow({ label, value }: TransferMetaRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="text-sm text-on-surface">{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function StockTransferDetailPage() {
  // ── RULES OF HOOKS: ALL hooks ABOVE all early returns ─────────────────────
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [dialogOpen, setDialogOpen] = useState(false)

  // Data hooks
  const { data: transfer, isLoading, error } = useTransferDetail(id)
  const { data: recent } = useTransferList({})
  const { nameOf, isLoading: namesLoading } = useInventoryProductNames()
  const { data: depts } = useInventoryDepartments()

  // Mutation hooks
  const submit = useSubmitTransfer()
  const approve = useApproveTransfer()
  const dispatch = useDispatchTransfer()
  const confirmReceipt = useConfirmReceipt()
  const cancel = useCancelTransfer()

  // Realtime: refresh this transfer when its linked approval_request is decided.
  // ApprovalRequestPayload.requestId is the matching field.
  useRealtimeChannel({
    channelName: 'approval_requests',
    filter: (payload) =>
      Boolean(transfer?.approvalRequestId) &&
      payload.requestId === transfer?.approvalRequestId,
    invalidateKeys: id ? [qk.inv.transfers.detail(id)] : [],
  })

  // ── Derived helpers ────────────────────────────────────────────────────────
  const deptName = (did: string) => depts?.find((d) => d.id === did)?.name ?? did

  const recentSlice = (recent ?? []).slice(0, 10)

  // ── Loading guard (only when id is present — no detail to load without id) ──
  if (id && (isLoading || namesLoading)) {
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

  // ── Error guard ──
  if (id && error) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div role="alert" className="rounded-md bg-error-container p-6 text-on-error-container">
            <p className="text-sm font-medium">
              {error instanceof ApiError ? error.message : 'Failed to load transfer. Please retry.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── No id — render "Pick a transfer" prompt + recent picker ──────────────
  if (!id) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
          <header>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Stock Transfer Detail
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Transfer Detail &amp; Status
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Select a transfer below to view its lifecycle, line items, and actions.
            </p>
          </header>

          <section
            aria-label="Recent transfers"
            className="mt-8 rounded-md bg-surface-container-lowest p-4 tablet:p-6"
          >
            <h2 className="mb-4 text-sm font-semibold text-on-surface">
              Recent transfers
            </h2>
            {recentSlice.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <PackageSearch className="h-10 w-10 text-on-surface-variant" aria-hidden />
                <p className="text-sm text-on-surface-variant">No transfers found.</p>
              </div>
            ) : (
              <nav aria-label="Pick a transfer" className="flex flex-wrap gap-2">
                {recentSlice.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigate(`/inventory/transfers/${t.id}`)}
                    className={[
                      'inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-medium min-h-[36px]',
                      'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    ].join(' ')}
                  >
                    <span className="font-mono">{t.stTrn}</span>
                    <StatusPill status={statusToken(t.status)} label={statusLabel(t.status)} />
                  </button>
                ))}
              </nav>
            )}
          </section>
        </div>
      </div>
    )
  }

  // ── Transfer not found after load (id present, no error, no data) ─────────
  if (!transfer) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div className="rounded-md bg-surface-container-lowest p-10 text-center">
            <PackageSearch className="mx-auto h-10 w-10 text-on-surface-variant" aria-hidden />
            <p className="mt-3 text-base font-semibold text-on-surface">Transfer not found.</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              The transfer you requested could not be loaded.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Derived state from transfer ───────────────────────────────────────────
  const mode = reverseCancelMode(transfer.status)
  const terminal = terminalChip(transfer.status)

  // Collect active mutation errors for display
  const activeErrors: string[] = []
  if (submit.error) activeErrors.push(submit.error instanceof ApiError ? submit.error.message : String(submit.error))
  if (approve.error) activeErrors.push(approve.error instanceof ApiError ? approve.error.message : String(approve.error))
  if (dispatch.error) activeErrors.push(dispatch.error instanceof ApiError ? dispatch.error.message : String(dispatch.error))
  if (confirmReceipt.error) activeErrors.push(confirmReceipt.error instanceof ApiError ? confirmReceipt.error.message : String(confirmReceipt.error))
  if (cancel.error) activeErrors.push(cancel.error instanceof ApiError ? cancel.error.message : String(cancel.error))

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Stock Transfer Detail
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Transfer Detail &amp; Status
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              View lifecycle, line items, and perform status-gated actions for this stock transfer.
            </p>
          </div>
        </header>

        {/* Recent-transfers picker — D1 divergence (replaces fixture StatusPicker) */}
        {recentSlice.length > 0 ? (
          <section
            aria-label="Recent transfers"
            className="mt-6 rounded-md bg-surface-container-low p-4"
          >
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Recent transfers
            </p>
            <nav aria-label="Switch transfer" className="flex flex-wrap gap-2">
              {recentSlice.map((t) => {
                const active = t.id === transfer.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigate(`/inventory/transfers/${t.id}`)}
                    aria-pressed={active}
                    className={[
                      'inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-medium min-h-[36px]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      active
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
                    ].join(' ')}
                  >
                    <span className="font-mono">{t.stTrn}</span>
                    {!active ? (
                      <StatusPill status={statusToken(t.status)} label={statusLabel(t.status)} />
                    ) : null}
                  </button>
                )
              })}
            </nav>
          </section>
        ) : null}

        <SectionShift tone="low" className="mt-8" />

        {/* Mutation error display */}
        {activeErrors.length > 0 ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container p-3 text-on-error-container"
          >
            {activeErrors.map((msg, i) => (
              <p key={i} className="text-sm">
                {msg}
              </p>
            ))}
          </div>
        ) : null}

        {/* ── Section 1: Transfer header card ─────────────────────────────── */}
        <section
          aria-labelledby="transfer-header-heading"
          className="mt-6 rounded-md bg-surface-container-lowest p-4 tablet:p-6"
        >
          <h2
            id="transfer-header-heading"
            className="sr-only"
          >
            Transfer header
          </h2>

          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* TRN + status */}
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <TrnDisplay trn={transfer.stTrn} />
                <StatusPill
                  status={statusToken(transfer.status)}
                  label={statusLabel(transfer.status)}
                />
              </div>
              {transfer.bundleLegId ? (
                <span className="text-[11px] text-on-surface-variant">
                  Part of bundle leg{' '}
                  <span className="font-mono text-on-surface">{transfer.bundleLegId}</span>
                </span>
              ) : null}
            </div>

            {/* Status-gated action CTAs — D3 divergence */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* draft → Submit + Cancel */}
              {transfer.status === 'draft' ? (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    disabled={submit.isPending}
                    onClick={() => submit.mutate(transfer.id)}
                    aria-label={`Submit transfer ${transfer.stTrn} for approval`}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    {submit.isPending ? 'Submitting…' : 'Submit for approval'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancel.isPending}
                    onClick={() => setDialogOpen(true)}
                    aria-label={`Cancel transfer ${transfer.stTrn}`}
                  >
                    Cancel transfer
                  </Button>
                </>
              ) : null}

              {/* pending_approval → View in approval inbox + Advance to approved + Cancel */}
              {transfer.status === 'pending_approval' ? (
                <>
                  <Link
                    to="/approvals/inbox"
                    className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-high px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[36px]"
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    View in approval inbox
                  </Link>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(transfer.id)}
                    aria-label={`Advance transfer ${transfer.stTrn} to approved`}
                  >
                    {approve.isPending ? 'Advancing…' : 'Advance to approved'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancel.isPending}
                    onClick={() => setDialogOpen(true)}
                    aria-label={`Cancel transfer ${transfer.stTrn}`}
                  >
                    Cancel transfer
                  </Button>
                </>
              ) : null}

              {/* approved → Dispatch + disabled reverse */}
              {transfer.status === 'approved' ? (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    disabled={dispatch.isPending}
                    onClick={() => dispatch.mutate(transfer.id)}
                    aria-label={`Dispatch transfer ${transfer.stTrn}`}
                  >
                    <Truck className="h-4 w-4" aria-hidden />
                    {dispatch.isPending ? 'Dispatching…' : 'Dispatch'}
                  </Button>
                  <button
                    type="button"
                    disabled
                    title="Reverse needs a compensating document — not yet available"
                    aria-disabled="true"
                    className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium text-on-surface-variant opacity-40 cursor-not-allowed min-h-[36px] bg-surface-container-low"
                  >
                    Reverse (needs compensating document — not yet available)
                  </button>
                </>
              ) : null}

              {/* in_transit → Confirm receipt + disabled reverse */}
              {transfer.status === 'in_transit' ? (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    disabled={confirmReceipt.isPending}
                    onClick={() =>
                      confirmReceipt.mutate({ transferId: transfer.id })
                    }
                    aria-label={`Confirm receipt of ${transfer.stTrn}`}
                  >
                    <PackageCheck className="h-4 w-4" aria-hidden />
                    {confirmReceipt.isPending ? 'Confirming…' : 'Confirm receipt'}
                  </Button>
                  <button
                    type="button"
                    disabled
                    title="Reverse needs a compensating document — not yet available"
                    aria-disabled="true"
                    className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium text-on-surface-variant opacity-40 cursor-not-allowed min-h-[36px] bg-surface-container-low"
                  >
                    Reverse (needs compensating document — not yet available)
                  </button>
                </>
              ) : null}

              {/* received → terminal + disabled reverse */}
              {transfer.status === 'received' ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-3 py-1.5 text-xs font-medium text-on-surface">
                    <PackageCheck className="h-3.5 w-3.5 text-success" aria-hidden />
                    Receipt confirmed
                  </span>
                  <button
                    type="button"
                    disabled
                    title="Reverse needs a compensating document — not yet available"
                    aria-disabled="true"
                    className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium text-on-surface-variant opacity-40 cursor-not-allowed min-h-[36px] bg-surface-container-low"
                  >
                    Reverse (needs compensating document — not yet available)
                  </button>
                </>
              ) : null}

              {/* cancelled → terminal chip only */}
              {transfer.status === 'cancelled' && terminal ? (
                <StatusPill
                  status={terminal.statusToken}
                  label={terminal.label}
                />
              ) : null}
            </div>
          </div>

          <SectionShift tone="low" className="mt-5" />

          {/* Meta grid */}
          <div className="mt-5 grid grid-cols-2 tablet:grid-cols-4 gap-4">
            <TransferMetaRow
              label="Source"
              value={deptName(transfer.sourceDepartmentId)}
            />
            <TransferMetaRow
              label="Destination"
              value={deptName(transfer.destinationDepartmentId)}
            />
            <TransferMetaRow
              label="Requested by"
              value={transfer.requestedByUserId ?? '—'}
            />
            <TransferMetaRow
              label="Requested at"
              value={fmtDateTime(transfer.requestedAt)}
            />
          </div>
        </section>

        {/* ── Section 2: Lifecycle stepper ─────────────────────────────────── */}
        <section
          aria-labelledby="lifecycle-heading"
          className="mt-6 rounded-md bg-surface-container-lowest p-4 tablet:p-6"
        >
          <h2
            id="lifecycle-heading"
            className="mb-4 text-sm font-semibold text-on-surface"
          >
            Lifecycle
          </h2>
          <LifecycleStepper
            status={statusToStepKey(transfer.status)}
            steps={STOCK_TRANSFER_LIFECYCLE_STEPS}
            terminal={terminalChip(transfer.status)}
          />
          {/* Pending Approval sub-label */}
          {transfer.status === 'pending_approval' ? (
            <p className="mt-3 text-xs text-on-surface-variant">
              Approval request{' '}
              <span className="font-mono text-on-surface">
                {transfer.approvalRequestId ?? '—'}
              </span>{' '}
              is currently pending review.
            </p>
          ) : null}
        </section>

        {/* ── Section 3: Line items table — D2 divergence (no batch/expiry) ── */}
        <section
          aria-labelledby="lines-heading"
          className="mt-6"
        >
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2
              id="lines-heading"
              className="text-base font-semibold text-on-surface"
            >
              Line items
            </h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {transfer.lines.length} line{transfer.lines.length !== 1 ? 's' : ''}
            </span>
          </header>

          {transfer.lines.length === 0 ? (
            <div className="rounded-md bg-surface-container-lowest p-8 text-center">
              <p className="text-sm text-on-surface-variant">No line items on this transfer.</p>
            </div>
          ) : (
            <>
              {/* Mobile card stack */}
              <div className="flex flex-col gap-3 tablet:hidden">
                {transfer.lines.map((line) => (
                  <div
                    key={line.id}
                    className="rounded-md bg-surface-container-lowest p-4 flex flex-col gap-2"
                  >
                    <p className="font-medium text-on-surface">
                      {nameOf(line.productId)}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                          Requested
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-on-surface">
                          {line.requestedQty}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                          Fulfilled
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-on-surface">
                          {line.fulfilledQty ?? '—'}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                          Reason
                        </p>
                        <p className="text-xs text-on-surface">
                          {line.reasonCode ?? '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden tablet:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Requested</TableHead>
                      <TableHead className="text-right">Fulfilled</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfer.lines.map((line) => (
                      <TableRow key={line.id} className="hover:bg-surface-container transition-colors">
                        <TableCell>
                          <p className="font-medium text-on-surface">
                            {nameOf(line.productId)}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {line.requestedQty}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {line.fulfilledQty ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-on-surface-variant">
                          {line.reasonCode ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </section>

        {/* ── Section 4: Reason code + approval-chain status ───────────────── */}
        {(transfer.reasonCode ?? transfer.approvalRequestId) ? (
          <section
            aria-labelledby="reason-approval-heading"
            className="mt-6 rounded-md bg-surface-container-lowest p-4 tablet:p-6"
          >
            <h2
              id="reason-approval-heading"
              className="mb-4 text-sm font-semibold text-on-surface"
            >
              Reason &amp; Approval
            </h2>
            <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
              {transfer.reasonCode ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Reason code
                  </span>
                  <span className="text-sm text-on-surface">
                    {TRANSFER_REASON_OPTIONS.find((r) => r.value === transfer.reasonCode)?.label ??
                      transfer.reasonCode}
                  </span>
                </div>
              ) : null}
              {transfer.approvalRequestId ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Approval request
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-on-surface">
                      {transfer.approvalRequestId}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
                    <Link
                      to="/approvals/inbox"
                      className="text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                    >
                      View in approval inbox
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── Section 5: Audit + Issue ticket ──────────────────────────────── */}
        <section
          aria-label="Audit and issue affordances"
          className="mt-6 flex flex-wrap items-center gap-3"
        >
          <AuditLink entityType="stock_transfers" entityRef={transfer.stTrn} />
          <IssueTicketLink entityRef={transfer.stTrn} />
        </section>

        {/* In-transit status hint */}
        {transfer.status === 'in_transit' ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-md bg-surface-container-low p-3">
            <Truck
              className="h-4 w-4 shrink-0 mt-0.5 text-on-surface-variant"
              aria-hidden
            />
            <p className="text-xs text-on-surface-variant">
              This transfer is currently in transit. Use "Confirm receipt" above once goods
              arrive at{' '}
              <span className="font-medium text-on-surface">
                {deptName(transfer.destinationDepartmentId)}
              </span>
              .
            </p>
          </div>
        ) : null}

        {/* Footer */}
        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <CircleOff className="h-3 w-3" aria-hidden />
          <span>
            Status-gated actions only. Post-dispatch reverse requires a compensating document.
          </span>
        </footer>
      </div>

      {/* ── CCReverseCancelDialog — D4 divergence: only for draft/pending_approval ── */}
      {(transfer.status === 'draft' || transfer.status === 'pending_approval') ? (
        <CCReverseCancelDialog
          open={dialogOpen}
          mode={mode}
          entity={{
            typeLabel: 'Stock Transfer',
            reference: transfer.stTrn,
            statusLabel: statusLabel(transfer.status),
            currentStatusToken: statusToken(transfer.status),
            detailLine: `${deptName(transfer.sourceDepartmentId)} → ${deptName(transfer.destinationDepartmentId)} · ${transfer.lines.length} line${transfer.lines.length !== 1 ? 's' : ''}`,
          }}
          compensatingDoc={undefined}
          reasonCodeOptions={TRANSFER_REASON_OPTIONS}
          onConfirm={({ reasonCode }) => {
            cancel.mutate(transfer.id, {
              onSuccess: () => setDialogOpen(false),
            })
            void reasonCode
          }}
          onCancel={() => setDialogOpen(false)}
        />
      ) : null}
    </div>
  )
}
