import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  CircleOff,
  PackageCheck,
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
} from '@/shell'
import { STOCK_TRANSFER_LIFECYCLE_STEPS } from '@/shell/LifecycleStepper'
import type { ReverseCancelMode } from '@/shell/CCReverseCancelDialog'
import type { StatusToken } from '@/shell/StatusPill'

import { materials, departments } from '@/lib/sample-data'
import {
  transfers,
  stockBatches,
  TRANSFER_REASON_OPTIONS,
  type Transfer,
  type TransferStatus,
} from '@/lib/inv-sample-data'

/**
 * SI-INV-006 — Stock Transfer Detail & Status.
 *
 * Tier 2, Epic 4 Arc (b) W2. Read-mostly detail view for a single stock
 * transfer — lifecycle stepper + line items + reverse/cancel affordance.
 *
 * FRs consumed:
 *   - FR28 — stock transfer lifecycle (Draft → Approved → In Transit → Received)
 *   - FR117 — pre-confirmed clean cancel (Draft/Pending Approval) vs
 *     post-confirmed compensating document (Approved/In Transit/Received)
 *
 * Cross-cutting patterns consumed:
 *   - CC-TRN-DISPLAY — TrnDisplay for the canonical stTrn.
 *   - CC-LIFECYCLE-STEPPER — LifecycleStepper with STOCK_TRANSFER_LIFECYCLE_STEPS.
 *   - CC-REVERSE-CANCEL — CCReverseCancelDialog, mode driven by current status.
 *   - CC-AUDIT-LINK — AuditLink drill-through to SI-INF-005.
 *   - CC-ISSUE-TICKET-LINK — IssueTicketLink affordance.
 *
 * Route: /SI-INV-006?id=<transfer_id>  — defaults to 'st-004' (in_transit).
 * Status selector: ?id= picks one of the six fixture transfers.
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory / transaction detail screens.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical status → StatusPill token mapping per task-11-brief. */
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
 * Note: 'pending_approval' is NOT in the steps array — map it to 'draft' (still early lifecycle).
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
 * Whether the status is a terminal branch that should render the terminal chip.
 * 'cancelled' is the only terminal state in the transfer lifecycle.
 */
function terminalChip(s: TransferStatus): { statusToken: StatusToken; label: string } | null {
  if (s === 'cancelled') return { statusToken: 'status_cancelled', label: 'Cancelled' }
  return null
}

/**
 * FR117: derive the CCReverseCancelDialog mode from transfer status.
 * pre-confirmed  → Draft, Pending Approval (no stock/finance impact yet)
 * post-confirmed → Approved, In Transit, Received (stock already affected)
 */
function reverseCancelMode(s: TransferStatus): ReverseCancelMode {
  if (s === 'draft' || s === 'pending_approval') return 'pre-confirmed'
  return 'post-confirmed'
}

/** Format an ISO datetime as "DD MMM YYYY, HH:mm". */
function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
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

interface StatusPickerProps {
  readonly currentId: string
  readonly onSelect: (id: string) => void
}

/**
 * Quick-pick bar for cycling between all 6 lifecycle-demo transfers.
 * Deterministic: uses fixture ids, no Math.random.
 */
function StatusPicker({ currentId, onSelect }: StatusPickerProps) {
  return (
    <nav
      aria-label="Switch demo transfer"
      className="flex flex-wrap gap-2"
    >
      {transfers.map((t) => {
        const active = t.id === currentId
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-pressed={active}
            className={[
              'rounded-pill px-3 py-1.5 text-xs font-medium min-h-[36px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              active
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
            ].join(' ')}
          >
            {statusLabel(t.status)}
          </button>
        )
      })}
    </nav>
  )
}

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
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv006() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmReceiptDone, setConfirmReceiptDone] = useState(false)

  // Default to st-004 (in_transit) per brief
  const idParam = searchParams.get('id') ?? 'st-004'
  const transfer: Transfer =
    transfers.find((t) => t.id === idParam) ?? transfers.find((t) => t.id === 'st-004')!

  const deptName = (id: string): string =>
    departments.find((d) => d.id === id)?.name ?? id

  const matName = (id: string): string =>
    materials.find((m) => m.id === id)?.name ?? id

  const matCat = (id: string): string =>
    materials.find((m) => m.id === id)?.category ?? ''

  const batchNumber = (batchId: string): string =>
    stockBatches.find((b) => b.id === batchId)?.batchNumber ?? batchId

  const batchExpiry = (batchId: string): string | null =>
    stockBatches.find((b) => b.id === batchId)?.expiryDate ?? null

  const batchExpiryBand = (batchId: string) =>
    stockBatches.find((b) => b.id === batchId)?.expiryBand ?? 'fresh'

  // For ExpiryPip inline
  type ExpiryBand = '24h' | '48h' | '72h' | 'fresh'
  const EXPIRY_BAND_LABEL: Record<ExpiryBand, string> = {
    '24h': 'Within 24 h',
    '48h': 'Within 48 h',
    '72h': 'Within 72 h',
    fresh: '> 72 h',
  }

  function ExpiryPip({ band }: { band: ExpiryBand }) {
    if (band === 'fresh') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
          {EXPIRY_BAND_LABEL[band]}
        </span>
      )
    }
    const colourClass = band === '24h' ? 'text-error' : 'text-tertiary'
    const pipColour = band === '24h' ? 'bg-error' : 'bg-tertiary'
    return (
      <span className="inline-flex items-stretch overflow-hidden rounded-sm bg-surface-container-lowest">
        <span aria-hidden className={`w-1 shrink-0 ${pipColour}`} />
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium ${colourClass}`}>
          {EXPIRY_BAND_LABEL[band]}
        </span>
      </span>
    )
  }

  // Reason label
  const reasonLabel = (code: string | null): string | null => {
    if (!code) return null
    return TRANSFER_REASON_OPTIONS.find((r) => r.value === code)?.label ?? code
  }

  // Is the transfer in a terminal state?
  const isTerminal = transfer.status === 'cancelled'
  // Show confirm-receipt affordance only when in_transit and not yet confirmed
  const showConfirmReceipt =
    transfer.status === 'in_transit' && !confirmReceiptDone
  // Show reverse/cancel CTA for non-terminal states
  const showReverseCancel = !isTerminal

  const mode = reverseCancelMode(transfer.status)

  const handleSwitchTransfer = (id: string) => {
    setSearchParams({ id })
    setConfirmReceiptDone(false)
    setDialogOpen(false)
  }

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
              View a single transfer's lifecycle, line items, batch references,
              and raise-issue or reverse/cancel affordances (FR28, FR117).
            </p>
          </div>
        </header>

        {/* Demo picker — cycle through lifecycle states */}
        <section
          aria-label="Demo: switch lifecycle state"
          className="mt-6 rounded-md bg-surface-container-low p-4"
        >
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Demo: switch transfer
          </p>
          <StatusPicker currentId={transfer.id} onSelect={handleSwitchTransfer} />
        </section>

        <SectionShift tone="low" className="mt-8" />

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

            {/* Action CTAs */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {showConfirmReceipt ? (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setConfirmReceiptDone(true)}
                  aria-label={`Confirm receipt of ${transfer.stTrn}`}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Confirm receipt
                </Button>
              ) : null}
              {confirmReceiptDone ? (
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-3 py-1.5 text-xs font-medium text-on-surface">
                  <PackageCheck className="h-3.5 w-3.5 text-success" aria-hidden />
                  Receipt confirmed
                </span>
              ) : null}
              {showReverseCancel ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                  aria-label={
                    mode === 'pre-confirmed'
                      ? `Cancel transfer ${transfer.stTrn}`
                      : `Reverse transfer ${transfer.stTrn}`
                  }
                >
                  {mode === 'pre-confirmed' ? 'Cancel transfer' : 'Reverse transfer'}
                </Button>
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
              value={transfer.requestedBy}
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
          {/* Pending Approval sub-label — not in step list but surfaced here */}
          {transfer.status === 'pending_approval' ? (
            <p className="mt-3 text-xs text-on-surface-variant">
              Approval request{' '}
              <span className="font-mono text-on-surface">{transfer.approvalRequestId}</span>{' '}
              is currently pending review.
            </p>
          ) : null}
        </section>

        {/* ── Section 3: Line items table ──────────────────────────────────── */}
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

          {/* Mobile card stack */}
          <div className="flex flex-col gap-3 tablet:hidden">
            {transfer.lines.map((line, idx) => {
              const band = batchExpiryBand(line.sourceBatchId)
              return (
                <div
                  key={idx}
                  className="rounded-md bg-surface-container-lowest p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-on-surface">{matName(line.materialId)}</p>
                      <p className="text-xs text-on-surface-variant">{matCat(line.materialId)}</p>
                    </div>
                    <ExpiryPip band={band} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                        Requested
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-on-surface">
                        {line.requestedQty} {line.uom}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                        Fulfilled
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-on-surface">
                        {line.fulfilledQty !== null ? `${line.fulfilledQty} ${line.uom}` : '—'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                        Batch
                      </p>
                      <p className="font-mono text-xs text-on-surface">
                        {batchNumber(line.sourceBatchId)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                        Expiry date
                      </p>
                      <p className="font-mono text-xs text-on-surface">
                        {batchExpiry(line.sourceBatchId) ?? '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden tablet:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Fulfilled</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Expiry date</TableHead>
                  <TableHead>Expiry band</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfer.lines.map((line, idx) => {
                  const band = batchExpiryBand(line.sourceBatchId)
                  return (
                    <TableRow key={idx} className="hover:bg-surface-container transition-colors">
                      <TableCell>
                        <p className="font-medium text-on-surface">{matName(line.materialId)}</p>
                        <p className="text-xs text-on-surface-variant">{matCat(line.materialId)}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.requestedQty} {line.uom}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.fulfilledQty !== null
                          ? `${line.fulfilledQty} ${line.uom}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-on-surface">
                          {batchNumber(line.sourceBatchId)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-on-surface">
                          {batchExpiry(line.sourceBatchId) ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ExpiryPip band={band} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
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
                    {reasonLabel(transfer.reasonCode)}
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
                    <ArrowRight
                      className="h-3.5 w-3.5 text-on-surface-variant"
                      aria-hidden
                    />
                    <a
                      href={`/SI-INF-001?ref=${encodeURIComponent(transfer.approvalRequestId)}`}
                      className="text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                    >
                      View in approval inbox
                    </a>
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
          <AuditLink entityRef={transfer.stTrn} />
          <IssueTicketLink entityRef={transfer.stTrn} />
        </section>

        {/* In-transit status hint */}
        {transfer.status === 'in_transit' && !confirmReceiptDone ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-md bg-surface-container-low p-3">
            <Truck
              className="h-4 w-4 shrink-0 mt-0.5 text-on-surface-variant"
              aria-hidden
            />
            <p className="text-xs text-on-surface-variant">
              This transfer is currently in transit. Use "Confirm receipt" above
              once goods arrive at{' '}
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
            Read-only view — no draft state. Reverse/cancel opens the
            CC-REVERSE-CANCEL dialog per FR117.
          </span>
          <span className="ml-auto">
            SI-INV-006 · Tier 2 · Phase 4 Epic 4 Arc (b)
          </span>
        </footer>
      </div>

      {/* ── CCReverseCancelDialog ─────────────────────────────────────────── */}
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
        compensatingDoc={
          mode === 'post-confirmed'
            ? {
                typeLabel: 'Transfer Reversal',
                summary:
                  'A compensating Transfer Reversal document will be created to reverse the stock movements already recorded for this transfer.',
              }
            : undefined
        }
        reasonCodeOptions={TRANSFER_REASON_OPTIONS}
        onConfirm={({ reasonCode, notes }) => {
          // Visual-only: just close the dialog in the mockup
          console.info('[SI-INV-006] Reverse/cancel confirmed', { reasonCode, notes })
          setDialogOpen(false)
        }}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  )
}
