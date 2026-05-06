import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  FileText,
  Mail,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  Store,
  XCircle,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  IssueTicketLink,
  LifecycleStepper,
  type POLifecycleState,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ProvisionalFlag,
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

import {
  NOW,
  formatINR,
  goodsReceipts,
  locations,
  materials,
  purchaseOrders,
  vendors,
  type GR,
  type PO,
  type POStatus,
} from '@/lib/sample-data'

import { tokens, type StatusKey } from '@/tokens'

/**
 * SI-PUR-003 — PO Detail & Lifecycle Status.
 *
 * Tier 1 Group 1, screen 8 of Phase 2c-S3. Anchors the canonical 5-status
 * PO lifecycle chrome reused across the procurement / transfer / B2B
 * lifecycles. Per DL-001 + FR42 + PRD line 650 + FR47a — the lifecycle
 * runs Draft → Pending Approval → Approved → Sent → (Partially / Fully)
 * Received → Closed, with two terminal branches: Cancelled and Closed —
 * GR Rejected.
 *
 * The screen renders a SINGLE detailed PO (default fixture is the first
 * pending-GR PO, which exercises the lifecycle stepper at the
 * `partially_received` active step and surfaces the linked GR record). A
 * variant toggle drops the same PO into the `closed_gr_rejected` terminal
 * branch so the GR-rejected chrome (rejection reason, vendor CN ref,
 * production-order closure note) is visible without rebuilding the screen.
 *
 * Cross-cutting:
 *   - CC-TRN-DISPLAY (header)
 *   - CC-AUDIT-LINK (header)
 *   - CC-REVERSE-CANCEL (Cancel PO gated on draft / pending_approval)
 *   - CC-ISSUE-TICKET-LINK (header)
 *   - CC-PROVISIONAL-FLAG (line items derived from a Pending-GR PO)
 *
 * No animation per CLAUDE.md animation policy + DESIGN.md §10.3.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PO state mapping
//
// The fixture's `POStatus` enum (sample-data.ts) compresses the PRD line-650
// canonical lifecycle for storage convenience. We unflatten it here so the
// stepper, status pill, and reverse-cancel gating use the canonical labels.
// ─────────────────────────────────────────────────────────────────────────────

function lifecycleStateOf(status: POStatus): POLifecycleState {
  switch (status) {
    case 'draft':
      return 'draft'
    case 'pending_approval':
      return 'pending_approval'
    case 'confirmed':
      return 'approved'
    case 'pending_gr':
      return 'partially_received'
    case 'closed':
      return 'fully_received'
    case 'cancelled':
      return 'cancelled'
    case 'gr_rejected':
      return 'closed_gr_rejected'
  }
}

function statusTokenOf(state: POLifecycleState): StatusKey {
  switch (state) {
    case 'draft':
      return 'status_draft'
    case 'pending_approval':
      return 'status_pending_approval'
    case 'approved':
      return 'status_confirmed'
    case 'sent':
      return 'status_in_progress'
    case 'partially_received':
      return 'status_in_progress'
    case 'fully_received':
      return 'status_completed'
    case 'closed':
      return 'status_closed'
    case 'cancelled':
      return 'status_cancelled'
    case 'closed_gr_rejected':
      return 'status_gr_rejected'
  }
}

function statusLabelOf(state: POLifecycleState): string {
  switch (state) {
    case 'draft':
      return 'Draft'
    case 'pending_approval':
      return 'Pending Approval'
    case 'approved':
      return 'Approved'
    case 'sent':
      return 'Sent'
    case 'partially_received':
      return 'Partially Received'
    case 'fully_received':
      return 'Fully Received'
    case 'closed':
      return 'Closed'
    case 'cancelled':
      return 'Cancelled'
    case 'closed_gr_rejected':
      return 'Closed — GR Rejected'
  }
}

function rejectionReasonLabel(
  reason: NonNullable<PO['gr_rejection_reason']>,
): string {
  switch (reason) {
    case 'shelf_life':
      return 'Shelf life expired on receipt'
    case 'quality':
      return 'Quality below specification'
    case 'quantity_mismatch':
      return 'Quantity mismatch versus PO'
    case 'damage':
      return 'Damage in transit'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture pick
//
// Default: the first `pending_gr` PO with at least one linked GR — exercises
// the stepper at `partially_received` and renders the linked-GR drill list.
// ─────────────────────────────────────────────────────────────────────────────

const HERO_PO: PO = (() => {
  const candidate = purchaseOrders.find((p) => p.status === 'pending_gr')
  return candidate ?? purchaseOrders[0]!
})()

const linkedGRsFor = (po: PO): ReadonlyArray<GR> =>
  goodsReceipts.filter((gr) => gr.po_id === po.id)

// Fixture "GR-rejected" variant — picks a real `gr_rejected` PO from the
// fixture so its rejection reason + vendor CN reference are real strings.
const GR_REJECTED_PO: PO = (() => {
  const candidate = purchaseOrders.find((p) => p.status === 'gr_rejected')
  return candidate ?? HERO_PO
})()

// ─────────────────────────────────────────────────────────────────────────────
// Approval-history fixture
// ─────────────────────────────────────────────────────────────────────────────

interface ApprovalEvent {
  readonly id: string
  readonly approver_name: string
  readonly approver_role: string
  readonly decision: 'approved' | 'rejected'
  readonly at: string
  readonly comment?: string
  readonly route_reason: string
}

function buildApprovalHistory(po: PO): ReadonlyArray<ApprovalEvent> {
  // Step 1: Cluster Manager — auto-routed by threshold band
  // Step 2: Brand Owner — high-value chain step
  return [
    {
      id: `${po.id}-step-1`,
      approver_name: 'Rohan Mehta',
      approver_role: 'Cluster Manager',
      decision: 'approved',
      at: `${po.raised_on}T11:42:00+05:30`,
      comment: 'Vendor scorecard healthy; quantities match weekly forecast.',
      route_reason: `Routed by threshold band — value ${formatINR(po.total_value)} above ₹ 25,000 cluster cap`,
    },
    {
      id: `${po.id}-step-2`,
      approver_name: 'Aanya Khanna',
      approver_role: 'Brand Owner',
      decision: 'approved',
      at: `${po.raised_on}T16:05:00+05:30`,
      route_reason: 'Chain step 2 — brand-level sign-off on Bharat Spice contract scope',
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF distribution fixture
// ─────────────────────────────────────────────────────────────────────────────

interface PDFDistribution {
  readonly sent: boolean
  readonly sent_at: string
  readonly recipient_email: string
}

function buildPDFDistribution(po: PO): PDFDistribution {
  // Hard-coded for visual fidelity — production wires through FR44 service.
  return {
    sent: po.status !== 'draft' && po.status !== 'pending_approval',
    sent_at: `${po.raised_on}T18:30:00+05:30`,
    recipient_email: 'orders@bharatspicetraders.in',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: vendor / location / department lookups
// ─────────────────────────────────────────────────────────────────────────────

const vendorById = (id: string) => vendors.find((v) => v.id === id)
const locationById = (id: string) => locations.find((l) => l.id === id)
const materialById = (id: string) => materials.find((m) => m.id === id)

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderMetaProps {
  readonly label: string
  readonly value: React.ReactNode
  readonly icon?: React.ReactNode
}

function HeaderMeta({ label, value, icon }: HeaderMetaProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-sm text-on-surface truncate">{value}</span>
    </div>
  )
}

interface LineItemRowProps {
  readonly line: PO['lines'][number]
  readonly receivedQty: number
  readonly isProvisional: boolean
}

function LineItemRow({ line, receivedQty, isProvisional }: LineItemRowProps) {
  const mat = materialById(line.material_id)
  const matName = mat?.name ?? line.material_id
  const ratio = line.qty > 0 ? receivedQty / line.qty : 0
  const variancePct = Math.round((1 - ratio) * 100)
  const isPartial = receivedQty > 0 && receivedQty < line.qty
  const isFull = receivedQty >= line.qty
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="font-medium text-on-surface">{matName}</span>
          {isProvisional ? <ProvisionalFlag size="sm" /> : null}
        </div>
        <p className="text-[11px] text-on-surface-variant mt-0.5">
          {mat?.category ?? '—'}
        </p>
      </TableCell>
      <TableCell className="text-on-surface-variant text-xs">{line.uom}</TableCell>
      <TableCell className="text-right tabular-nums text-on-surface">
        {line.qty}
      </TableCell>
      <TableCell>
        {receivedQty === 0 ? (
          <span className="text-xs text-on-surface-variant">—</span>
        ) : (
          <span
            role="status"
            className={[
              'inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-medium tabular-nums',
              isFull
                ? 'bg-success text-on-success'
                : 'bg-surface-container-high text-tertiary',
            ].join(' ')}
            aria-label={`${receivedQty} of ${line.qty} ${line.uom} received`}
          >
            {isFull ? (
              <CheckCircle2 className="h-3 w-3" aria-hidden />
            ) : null}
            {receivedQty} of {line.qty} {line.uom} · {Math.round(ratio * 100)} %
          </span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums text-on-surface">
        {formatINR(line.unit_price)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-on-surface">
        {formatINR(line.line_total)}
      </TableCell>
      <TableCell className="text-right">
        {isPartial ? (
          <StatusPill
            status="status_variance_flagged"
            size="sm"
            label={`${variancePct} % short`}
          />
        ) : isFull ? (
          <span className="text-[11px] text-on-surface-variant">On plan</span>
        ) : (
          <span className="text-[11px] text-on-surface-variant">Awaited</span>
        )}
      </TableCell>
    </TableRow>
  )
}

interface ApprovalTimelineProps {
  readonly events: ReadonlyArray<ApprovalEvent>
  readonly currentState: POLifecycleState
}

function ApprovalTimeline({ events, currentState }: ApprovalTimelineProps) {
  if (currentState === 'draft' && events.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">Approval not yet routed.</p>
    )
  }
  return (
    <ol className="flex flex-col gap-3">
      {events.map((ev, idx) => {
        const isApproved = ev.decision === 'approved'
        return (
          <li key={ev.id} className="flex gap-3">
            <div className="flex flex-col items-center pt-0.5">
              <span
                aria-hidden
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-pill',
                  isApproved
                    ? 'bg-success text-on-success'
                    : 'bg-error text-on-error',
                ].join(' ')}
              >
                {isApproved ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
              </span>
              {idx < events.length - 1 ? (
                <span
                  aria-hidden
                  className="mt-1 h-full w-1 bg-surface-container-high rounded-pill"
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-1 pb-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium text-on-surface">
                  {ev.approver_name}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                  {ev.approver_role}
                </span>
                <StatusPill
                  status={isApproved ? 'status_completed' : 'status_rejected'}
                  size="sm"
                  label={isApproved ? 'Approved' : 'Rejected'}
                />
              </div>
              <span className="text-[11px] text-on-surface-variant tabular-nums">
                {ev.at.replace('T', ' · ').slice(0, 19)} IST
              </span>
              {ev.comment ? (
                <p className="text-sm text-on-surface">{ev.comment}</p>
              ) : null}
              <p className="text-[11px] text-on-surface-variant">
                {ev.route_reason}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

interface LinkedGRRowProps {
  readonly gr: GR
}

function LinkedGRRow({ gr }: LinkedGRRowProps) {
  const totalReceived = gr.lines.reduce((acc, l) => acc + l.received_qty, 0)
  const totalUsable = gr.lines.reduce((acc, l) => acc + l.usable_qty, 0)
  const yieldFactor = totalReceived > 0 ? totalUsable / totalReceived : 0
  const grStatus =
    gr.status === 'confirmed'
      ? 'status_completed'
      : gr.status === 'rejected'
        ? 'status_gr_rejected'
        : 'status_pending_gr'
  const grStatusLabel =
    gr.status === 'confirmed'
      ? 'Confirmed'
      : gr.status === 'rejected'
        ? 'Rejected'
        : 'Pending'
  return (
    <Link
      to={`/SI-INV-010?gr=${encodeURIComponent(gr.trn)}`}
      className={[
        'group flex flex-wrap items-center gap-3 rounded-sm bg-surface-container-low px-3 py-3',
        'hover:bg-surface-container-high transition-colors min-h-[44px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      ].join(' ')}
    >
      <div className="flex flex-col min-w-0 flex-1">
        <TrnDisplay trn={gr.trn} copyable={false} />
        <span className="text-[11px] text-on-surface-variant tabular-nums mt-0.5">
          Received {gr.received_on} · {totalReceived.toFixed(2)} units · yield{' '}
          {(yieldFactor * 100).toFixed(0)} %
        </span>
      </div>
      <StatusPill status={grStatus} size="sm" label={grStatusLabel} />
      <ChevronRight
        className="h-4 w-4 text-on-surface-variant opacity-60 group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  )
}

interface PDFDistributionPanelProps {
  readonly distribution: PDFDistribution
}

function PDFDistributionPanel({ distribution }: PDFDistributionPanelProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md bg-surface-container-low p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            PDF distribution
          </span>
          {distribution.sent ? (
            <>
              <p className="text-sm text-on-surface">
                Sent to{' '}
                <span className="font-medium">{distribution.recipient_email}</span>
              </p>
              <p className="text-[11px] text-on-surface-variant tabular-nums">
                {distribution.sent_at.replace('T', ' · ').slice(0, 19)} IST
              </p>
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">
              Not yet sent — vendor copy queues on approval.
            </p>
          )}
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="tonal" size="sm" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Re-send PDF to vendor
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[320px] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Re-send PDF to vendor
            </p>
            <p className="mt-2 text-sm text-on-surface">
              Confirms a fresh PDF is queued to the recipient below.
            </p>
            <div className="mt-3 flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Recipient
              </span>
              <span className="font-mono text-xs text-on-surface">
                {distribution.recipient_email}
              </span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                Send
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

interface CancelPOActionProps {
  readonly currentState: POLifecycleState
  readonly poTrn: string
}

function CancelPOAction({ currentState, poTrn }: CancelPOActionProps) {
  const [open, setOpen] = useState(false)
  const cancellable = currentState === 'draft' || currentState === 'pending_approval'

  if (!cancellable) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        title="Cannot cancel after Approved — use compensating document path"
        aria-label="Cancel PO — disabled after Approved"
        className="gap-1.5"
      >
        <CircleOff className="h-3.5 w-3.5" aria-hidden />
        Cancel PO
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-error">
          <XCircle className="h-3.5 w-3.5" aria-hidden />
          Cancel PO
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Cancel {poTrn}
        </p>
        <p className="mt-2 text-sm text-on-surface">
          Cancellation is reversible while the PO sits in Draft or Pending
          Approval. The vendor is not notified until you re-issue.
        </p>
        <div className="mt-3 flex flex-col gap-1">
          <label
            htmlFor="cancel-reason"
            className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
          >
            Reason
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            placeholder="Why is this happening?"
            aria-label="Cancellation reason"
            className={[
              'rounded-sm bg-surface-container-low px-3 py-2 text-sm text-on-surface',
              'placeholder:text-on-surface-variant resize-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            ].join(' ')}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Keep PO
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel PO
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface MarkAsSentActionProps {
  readonly currentState: POLifecycleState
  readonly poTrn: string
}

function MarkAsSentAction({ currentState, poTrn }: MarkAsSentActionProps) {
  const [open, setOpen] = useState(false)
  if (currentState !== 'approved') return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="default" size="sm" className="gap-1.5">
          <Send className="h-3.5 w-3.5" aria-hidden />
          Mark as Sent
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Mark {poTrn} as Sent
        </p>
        <p className="mt-2 text-sm text-on-surface">
          Moves the PO from Approved to Sent and records the dispatch
          timestamp. Vendor copy stays as previously sent.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Confirm
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface SendPDFActionProps {
  readonly currentState: POLifecycleState
  readonly poTrn: string
  readonly recipient: string
}

function SendPDFAction({ currentState, poTrn, recipient }: SendPDFActionProps) {
  const [open, setOpen] = useState(false)
  // PDF send is the canonical sub-affordance once approved
  if (currentState === 'draft' || currentState === 'pending_approval') {
    return null
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="tonal" size="sm" className="gap-1.5">
          <Mail className="h-3.5 w-3.5" aria-hidden />
          Send PDF to vendor
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Send PDF · {poTrn}
        </p>
        <p className="mt-2 text-sm text-on-surface">
          Generates a fresh PDF (FR44) and delivers it to the recipient below.
        </p>
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Recipient
          </span>
          <span className="font-mono text-xs text-on-surface">{recipient}</span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={() => setOpen(false)}>
            <Send className="h-3.5 w-3.5" aria-hidden />
            Send
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

type Variant = 'default' | 'gr_rejected'

export default function SiPur003() {
  const [variant, setVariant] = useState<Variant>('default')

  const po = variant === 'gr_rejected' ? GR_REJECTED_PO : HERO_PO
  const lifecycleState = lifecycleStateOf(po.status)
  const vendor = vendorById(po.vendor_id)
  const location = locationById(po.location_id)
  const linkedGRs = useMemo(() => linkedGRsFor(po), [po])
  const approvalHistory = useMemo(() => buildApprovalHistory(po), [po])
  const distribution = useMemo(() => buildPDFDistribution(po), [po])

  // Per-line received quantity — for the partially-received variant we
  // synthesise a partial fulfillment by halving the latest GR's lines.
  const receivedByMaterial = useMemo(() => {
    const map = new Map<string, number>()
    if (linkedGRs.length === 0) return map
    const latest = linkedGRs[linkedGRs.length - 1]!
    for (const grLine of latest.lines) {
      // For pending-GR (partially received) variant, show partial fulfillment.
      const factor =
        po.status === 'pending_gr'
          ? 0.5
          : po.status === 'closed'
            ? 1
            : po.status === 'gr_rejected'
              ? 0
              : 0
      map.set(grLine.material_id, Math.round(grLine.received_qty * factor * 100) / 100)
    }
    return map
  }, [linkedGRs, po.status])

  // Aggregate fulfillment ratio for the stepper — sum received / sum ordered.
  const fulfillmentRatio = useMemo(() => {
    if (po.lines.length === 0) return 0
    const ordered = po.lines.reduce((acc, l) => acc + l.qty, 0)
    const received = po.lines.reduce(
      (acc, l) => acc + (receivedByMaterial.get(l.material_id) ?? 0),
      0,
    )
    return ordered > 0 ? received / ordered : 0
  }, [po.lines, receivedByMaterial])

  // Existing tickets — fixture: 2 against the partially-received PO so the
  // IssueTicketLink renders its "View N tickets" surface.
  const existingTickets = [
    {
      id: `ITK-2026-${po.po_number.slice(-4)}-A`,
      subject: 'Vendor confirmed late dispatch by 2 days',
      severity: 'medium' as const,
    },
    {
      id: `ITK-2026-${po.po_number.slice(-4)}-B`,
      subject: 'Quantity short on first GR — reconcile',
      severity: 'high' as const,
    },
  ]

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Variant toggle — visual contract control */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-pill bg-surface-container-low px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Lifecycle variant
          </span>
          <Button
            variant={variant === 'default' ? 'tonal' : 'ghost'}
            size="sm"
            onClick={() => setVariant('default')}
            aria-pressed={variant === 'default'}
          >
            Partially Received
          </Button>
          <Button
            variant={variant === 'gr_rejected' ? 'tonal' : 'ghost'}
            size="sm"
            onClick={() => setVariant('gr_rejected')}
            aria-pressed={variant === 'gr_rejected'}
          >
            Closed — GR Rejected
          </Button>
          <span className="ml-auto text-[11px] text-on-surface-variant">
            Visual permutation only — switches the active fixture PO.
          </span>
        </div>

        {/* Page header */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Procurement · Purchase order detail
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <h1 className="text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
                  {po.po_number}
                </h1>
                <StatusPill
                  status={statusTokenOf(lifecycleState)}
                  label={statusLabelOf(lifecycleState)}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <TrnDisplay trn={po.trn} />
                <AuditLink entityRef={po.trn} />
                <IssueTicketLink
                  entityRef={po.trn}
                  existingTicketCount={existingTickets.length}
                  existingTickets={existingTickets}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SendPDFAction
                currentState={lifecycleState}
                poTrn={po.trn}
                recipient={distribution.recipient_email}
              />
              <MarkAsSentAction currentState={lifecycleState} poTrn={po.trn} />
              <CancelPOAction currentState={lifecycleState} poTrn={po.trn} />
            </div>
          </div>

          {/* Header meta strip */}
          <div className="grid grid-cols-2 tablet:grid-cols-4 desktop:grid-cols-6 gap-4 rounded-md bg-surface-container-lowest p-4">
            <HeaderMeta
              label="Vendor"
              icon={<Store className="h-3 w-3" aria-hidden />}
              value={
                <Link
                  to={`/SI-MDM-005?vendor=${encodeURIComponent(po.vendor_id)}`}
                  className="text-primary hover:underline"
                >
                  {vendor?.name ?? po.vendor_id}
                </Link>
              }
            />
            <HeaderMeta
              label="Created"
              icon={<CalendarDays className="h-3 w-3" aria-hidden />}
              value={po.raised_on}
            />
            <HeaderMeta
              label="Expected delivery"
              icon={<CalendarDays className="h-3 w-3" aria-hidden />}
              value={po.expected_on}
            />
            <HeaderMeta
              label="Location"
              icon={<MapPin className="h-3 w-3" aria-hidden />}
              value={location?.name ?? po.location_id}
            />
            <HeaderMeta
              label="Department"
              icon={<ShieldCheck className="h-3 w-3" aria-hidden />}
              value="Kitchen — Dry Store"
            />
            <HeaderMeta
              label="Total value"
              icon={<FileText className="h-3 w-3" aria-hidden />}
              value={
                <span className="font-semibold tabular-nums">
                  {formatINR(po.total_value)}
                </span>
              }
            />
          </div>
        </header>

        {/* Lifecycle stepper */}
        <section
          aria-label="PO lifecycle progression"
          className="mt-6 rounded-md bg-surface-container-lowest p-4 tablet:p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold text-on-surface">
              Lifecycle
            </h2>
            <p className="text-[11px] text-on-surface-variant">
              Canonical PO path per FR42 · terminal branches per FR47a
            </p>
          </div>
          <LifecycleStepper
            status={lifecycleState}
            lineItemFulfillmentRatio={fulfillmentRatio}
          />
        </section>

        {/* Two-column layout: line items + side panels */}
        <div className="mt-6 grid grid-cols-1 desktop:grid-cols-3 gap-6">
          {/* Line items */}
          <section
            aria-label="Line items"
            className="desktop:col-span-2 flex flex-col gap-3"
          >
            <header className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-on-surface">
                Line items ({po.lines.length})
              </h2>
              <span className="text-[11px] text-on-surface-variant tabular-nums">
                Total {formatINR(po.total_value)}
              </span>
            </header>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.lines.map((line, idx) => (
                  <LineItemRow
                    key={`${line.material_id}-${idx}`}
                    line={line}
                    receivedQty={receivedByMaterial.get(line.material_id) ?? 0}
                    isProvisional={po.is_provisional}
                  />
                ))}
              </TableBody>
            </Table>
          </section>

          {/* Side panels */}
          <aside className="flex flex-col gap-6">
            {/* Approval history */}
            <section
              aria-label="Approval history"
              className="rounded-md bg-surface-container-lowest p-4 tablet:p-5"
            >
              <header className="mb-3 flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-on-surface">
                  Approval history
                </h2>
                <span className="text-[11px] text-on-surface-variant">
                  {approvalHistory.length} step
                  {approvalHistory.length === 1 ? '' : 's'}
                </span>
              </header>
              <ApprovalTimeline
                events={approvalHistory}
                currentState={lifecycleState}
              />
            </section>

            {/* Linked GRs */}
            <section
              aria-label="Linked goods receipts"
              className="rounded-md bg-surface-container-lowest p-4 tablet:p-5"
            >
              <header className="mb-3 flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-on-surface">
                  Linked GRs
                </h2>
                <span className="text-[11px] text-on-surface-variant">
                  {linkedGRs.length} record{linkedGRs.length === 1 ? '' : 's'}
                </span>
              </header>
              {linkedGRs.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  No goods receipts linked yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {linkedGRs.map((gr) => (
                    <LinkedGRRow key={gr.id} gr={gr} />
                  ))}
                </div>
              )}
            </section>

            {/* PDF distribution */}
            <PDFDistributionPanel distribution={distribution} />
          </aside>
        </div>

        {/* GR-rejected branch — surfaces only when in that terminal state */}
        {lifecycleState === 'closed_gr_rejected' && po.gr_rejection_reason ? (
          <section
            aria-label="GR rejection details"
            className="mt-6 rounded-md p-4 tablet:p-5"
            style={{
              backgroundColor: tokens.error_container,
              color: tokens.on_error_container,
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-medium uppercase tracking-wider">
                  GR-rejected closure
                </span>
                <h2 className="mt-1 text-base font-semibold">
                  {rejectionReasonLabel(po.gr_rejection_reason)}
                </h2>
                <p className="mt-2 text-sm">
                  Per FR47a, this PO is permanently closed via the
                  GR-rejected terminal. The provisional cost basis carried
                  through to any linked production order is locked; FR67a
                  closure note has been written to the production-order
                  record.
                </p>
              </div>
              {linkedGRs.length > 0 && linkedGRs[0]?.vendor_cn_ref ? (
                <Link
                  to="/SI-PUR-009"
                  className={[
                    'inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-xs font-medium',
                    'bg-on-error-container text-error-container hover:opacity-90',
                    'min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  ].join(' ')}
                >
                  View vendor credit note
                  <span className="font-mono">{linkedGRs[0].vendor_cn_ref}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <FileText className="h-3 w-3" aria-hidden />
          <span>
            Read-mostly · sub-affordances respect CC-REVERSE-CANCEL gating ·
            issue tickets and audit history drill from the header chips.
          </span>
          <span className="ml-auto">
            SI-PUR-003 · Tier 1 Group 1 · Phase 2c-S3 · NOW {NOW}
          </span>
        </footer>
      </div>
    </div>
  )
}
