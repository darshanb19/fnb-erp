/**
 * SI-INV-013 — Inventory Adjustment.
 *
 * Tier 1 · Group 3 · Phase 4 Epic 4 Arc (b) W3.
 *
 * FRs: FR37 (inventory adjustment with mandatory per-line reason codes),
 *      FR114 (implausibility warn-and-log when delta exceeds tolerance; the
 *      override + reason are captured in the audit log per the warn-and-log model),
 *      FR117 (reverse/cancel — post-confirmed creates compensating doc).
 *
 * CC-patterns consumed:
 *   - CC-DRAFT-PILL           — DraftPill isDraft mobileEyebrow (unsaved adjustment).
 *   - CC-IMPLAUSIBILITY-WARN  — CCImplausibilityWarn beneath any line whose
 *                               |delta| exceeds 80% of currentOnHand (FR114).
 *   - CC-AUDIT-LINK           — AuditLink (entityRef = adjTrn).
 *   - CC-TRN-DISPLAY          — TrnDisplay (adjTrn).
 *   - CC-REVERSE-CANCEL       — CCReverseCancelDialog (FR117; mode by status).
 *   - CC-APPROVAL-INBOX-CARD  — ApprovalInboxCard preview when aggregate > ₹5,000.
 *
 * NOT consumed:
 *   - CC-VOICE-INPUT — Screen inventory does not cite FR112 for adjustments.
 *
 * Sections:
 *   1. Header — department/location, requested-by, requested-at; DraftPill.
 *   2. Per-line Table (responsive: mobile cards / desktop table): item,
 *      batch ref, current on-hand, adjusted qty Input, delta (signed, computed),
 *      UOM, mandatory reason Select from ADJUSTMENT_REASON_OPTIONS.
 *   3. Aggregate value impact (₹ via formatINR) — drives approval routing.
 *   4. Approval-chain preview via ApprovalInboxCard when aggregate > ₹5,000.
 *   5. CCImplausibilityWarn beneath any line whose |delta| > 80% of on-hand.
 *   6. CCReverseCancelDialog for reverse/cancel (FR117) — mode by status.
 *
 * Status tokens: status_draft / status_pending_approval / status_confirmed /
 *   status_cancelled.
 *
 * Fixtures: inventoryAdjustments[1] = over-threshold (adj-002, pending_approval);
 *   inventoryAdjustments[3] = FR114-tripping (adj-004, draft sugar 87.5%).
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory/transaction screens.
 */

import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  MapPin,
  RotateCcw,
  User,
} from 'lucide-react'

import {
  ApprovalInboxCard,
  AuditLink,
  Button,
  CCImplausibilityWarn,
  CCReverseCancelDialog,
  DraftPill,
  Input,
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
import type { ApprovalCard } from '@/shell'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  departments,
  locations,
  materials,
} from '@/lib/sample-data'

import {
  inventoryAdjustments,
  stockBatches,
  ADJUSTMENT_REASON_OPTIONS,
  IMPLAUSIBILITY_REASON_OPTIONS,
  formatINR,
  type Adjustment,
  type AdjustmentLine,
} from '@/lib/inv-sample-data'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Approval threshold in ₹ — aggregate value impact crossing this triggers routing. */
const APPROVAL_THRESHOLD = 5000

/** Implausibility threshold — delta / currentOnHand > this ratio triggers FR114 warn. */
const IMPLAUSIBILITY_RATIO = 0.8

// Pick the two feature-showcase adjustments as per brief:
//   adj-002 = over-threshold pending_approval (approval-routed)
//   adj-004 = draft, FR114-tripping (implausibility warn)
const ADJ_OVER_THRESHOLD = inventoryAdjustments.find((a) => a.id === 'adj-002')!
const ADJ_IMPLAUSIBLE    = inventoryAdjustments.find((a) => a.id === 'adj-004')!

// Reverse/cancel reason codes for FR117 (FR15a — closed list)
const REVERSE_CANCEL_REASON_OPTIONS = [
  { value: 'data_entry_error',    label: 'Data entry error' },
  { value: 'duplicate_entry',     label: 'Duplicate entry' },
  { value: 'incorrect_qty',       label: 'Incorrect quantity entered' },
  { value: 'wrong_batch',         label: 'Wrong batch selected' },
  { value: 'approver_rejected',   label: 'Approver requested reversal' },
  { value: 'other',               label: 'Other (add note)' },
]

// Delegate targets for ApprovalInboxCard
const DELEGATE_TARGETS = [
  { id: 'usr-fm-001', name: 'Ritika Nair',    role: 'Finance Manager' },
  { id: 'usr-cm-001', name: 'Dhruv Kapoor',  role: 'Cluster Manager' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function deptLabel(departmentId: string): string {
  return departments.find((d) => d.id === departmentId)?.name ?? departmentId
}

function locationForDept(departmentId: string): string {
  const dept = departments.find((d) => d.id === departmentId)
  if (!dept) return '—'
  return locations.find((l) => l.id === dept.location_id)?.name ?? dept.location_id
}

function materialName(materialId: string): string {
  return materials.find((m) => m.id === materialId)?.name ?? materialId
}

function batchNumber(batchId: string): string {
  return stockBatches.find((b) => b.id === batchId)?.batchNumber ?? batchId
}

function formatDate(iso: string): string {
  // Derive display from the deterministic ISO string — no argless new Date()
  return iso.slice(0, 10)
}

function statusToken(
  status: Adjustment['status'],
): 'status_draft' | 'status_pending_approval' | 'status_confirmed' | 'status_cancelled' {
  if (status === 'draft')            return 'status_draft'
  if (status === 'pending_approval') return 'status_pending_approval'
  if (status === 'confirmed')        return 'status_confirmed'
  return 'status_cancelled'
}

/** Build the ApprovalCard shape for the ApprovalInboxCard preview. */
function buildApprovalCard(adj: Adjustment): ApprovalCard {
  return {
    id:                   adj.approvalRequestId ?? `apr-preview-${adj.id}`,
    source_module:        'inventory',
    entity_type:          'Inventory Adjustment',
    entity_ref:           adj.adjTrn,
    entity_route:         `/SI-INV-013?item=${encodeURIComponent(adj.adjTrn)}`,
    requesting_user:      adj.requestedBy,
    requesting_user_role: 'Inventory Manager',
    requested_at:         adj.requestedAt,
    value:                Math.abs(adj.aggregateValueImpact),
    value_band:           'Above ₹5,000 threshold',
    chain_step:           'Step 1 of 2 · Finance Manager',
    route_reason:         'auto_threshold',
    chain_state:          'pending',
    bulk_eligible:        false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-line editable state
// ─────────────────────────────────────────────────────────────────────────────

interface LineState {
  adjustedQty: string
  reasonCode: string
  implausibilityReason: string | null
  implausibilityOverridden: boolean
}

function initLineState(line: AdjustmentLine): LineState {
  // Adjusted qty = currentOnHand + delta (the fixture's committed answer)
  return {
    adjustedQty:            String(line.currentOnHand + line.delta),
    reasonCode:             line.reasonCode,
    implausibilityReason:   null,
    implausibilityOverridden: false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AdjustmentDetailSection — one adjustment's full detail panel
// ─────────────────────────────────────────────────────────────────────────────

interface AdjustmentDetailSectionProps {
  adj: Adjustment
  showApprovalPreview: boolean
}

function AdjustmentDetailSection({
  adj,
  showApprovalPreview,
}: AdjustmentDetailSectionProps) {
  // Initialise per-line state from fixture values
  const [lineStates, setLineStates] = useState<LineState[]>(
    adj.lines.map(initLineState),
  )
  const [reverseCancelOpen, setReverseCancelOpen] = useState(false)

  const isDraft = adj.status === 'draft'
  const isPreConfirmed = adj.status === 'draft' || adj.status === 'pending_approval'

  // Derive live delta and aggregate value from current lineStates
  const liveDeltaForLine = (idx: number): number => {
    const parsed = parseFloat(lineStates[idx].adjustedQty)
    if (isNaN(parsed)) return 0
    return parsed - adj.lines[idx].currentOnHand
  }

  // Any line has a pending implausibility warn that hasn't been overridden?
  const hasUnresolvedImplausibility = adj.lines.some((line, idx) => {
    const liveDelta = liveDeltaForLine(idx)
    // Guard div-by-zero: when currentOnHand <= 0 base implausibility on absolute
    // delta magnitude (>50 units) so a zero-on-hand line doesn't always warn.
    const liveRatio = line.currentOnHand > 0
      ? Math.abs(liveDelta) / line.currentOnHand
      : (Math.abs(liveDelta) > 50 ? 1 : 0)
    return liveRatio > IMPLAUSIBILITY_RATIO && !lineStates[idx].implausibilityOverridden
  })

  /** Live aggregate value impact — recomputed from current lineStates.
   *  Value contribution per line: |liveDelta| × unitCost.
   *  unitCost = batch costPerUnit if batch known, else material lkp_per_uom, else 0.
   *  Sign reflects net direction: positive = write-up, negative = write-down. */
  const liveAggregateValue = useMemo(() => {
    return adj.lines.reduce((sum, line, idx) => {
      const liveDelta = liveDeltaForLine(idx)
      const unitCost =
        stockBatches.find((b) => b.id === line.batchId)?.costPerUnit ??
        materials.find((m) => m.id === line.materialId)?.lkp_per_uom ??
        0
      return sum + liveDelta * unitCost
    }, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineStates]) // liveDeltaForLine reads lineStates; adj.lines is stable

  const updateLine = (idx: number, patch: Partial<LineState>) => {
    setLineStates((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    )
  }

  const approvalCard = buildApprovalCard(adj)

  const statusTkn = statusToken(adj.status)
  const statusLabel =
    adj.status === 'draft'            ? 'Draft'            :
    adj.status === 'pending_approval' ? 'Pending approval' :
    adj.status === 'confirmed'        ? 'Confirmed'        :
    'Cancelled'

  return (
    <section
      aria-label={`Adjustment ${adj.adjTrn}`}
      className="rounded-md bg-surface-container-lowest"
    >
      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        {/* Top row: TRN + status + draft pill */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <TrnDisplay trn={adj.adjTrn} />
              <StatusPill status={statusTkn} label={statusLabel} size="sm" />
              {isDraft && <DraftPill isDraft mobileEyebrow />}
            </div>
          </div>
          {/* Reverse/Cancel affordance (FR117) */}
          {adj.status !== 'cancelled' && (
            <Button
              variant="tonal"
              size="sm"
              onClick={() => setReverseCancelOpen(true)}
              aria-label={`${isPreConfirmed ? 'Cancel' : 'Reverse'} adjustment ${adj.adjTrn}`}
            >
              <RotateCcw size={14} aria-hidden />
              {isPreConfirmed ? 'Cancel' : 'Reverse'}
            </Button>
          )}
        </div>

        {/* Meta: department, location, requested-by, requested-at */}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 tablet:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
              <ClipboardList size={11} aria-hidden />
              Department
            </dt>
            <dd className="text-sm text-on-surface">{deptLabel(adj.departmentId)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
              <MapPin size={11} aria-hidden />
              Location
            </dt>
            <dd className="text-sm text-on-surface">{locationForDept(adj.departmentId)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
              <User size={11} aria-hidden />
              Requested by
            </dt>
            <dd className="text-sm text-on-surface">{adj.requestedBy}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
              <CalendarDays size={11} aria-hidden />
              Requested at
            </dt>
            <dd className="text-sm text-on-surface">{formatDate(adj.requestedAt)}</dd>
          </div>
        </dl>

        {/* AuditLink */}
        <div className="mt-4">
          <AuditLink entityRef={adj.adjTrn} />
        </div>
      </div>

      <SectionShift tone="low" />

      {/* ── Per-line table ──────────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-3">
          Adjustment lines
        </p>

        {/* Mobile card stack (tablet:hidden) */}
        <div className="flex flex-col gap-3 tablet:hidden">
          {adj.lines.map((line, idx) => {
            const state    = lineStates[idx]
            const liveDelta = liveDeltaForLine(idx)
            const liveRatio = line.currentOnHand > 0
              ? Math.abs(liveDelta) / line.currentOnHand
              : (Math.abs(liveDelta) > 50 ? 1 : 0)
            const showWarn  = liveRatio > IMPLAUSIBILITY_RATIO && !state.implausibilityOverridden
            const showDone  = liveRatio > IMPLAUSIBILITY_RATIO &&  state.implausibilityOverridden
            const deltaSign = liveDelta >= 0 ? '+' : ''
            const deltaClass =
              liveDelta < 0 ? 'text-error font-medium tabular-nums' :
              liveDelta > 0 ? 'text-success font-medium tabular-nums' :
              'text-on-surface-variant tabular-nums'

            const lineId = `mob-line-${adj.id}-${idx}`

            return (
              <article
                key={`${line.batchId}-${idx}`}
                aria-label={`Line ${idx + 1}: ${materialName(line.materialId)}`}
                className="rounded-md bg-surface-container p-4 flex flex-col gap-3"
              >
                {/* Item + batch */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium text-on-surface truncate">
                      {materialName(line.materialId)}
                    </span>
                    <span className="font-mono text-[11px] text-on-surface-variant">
                      {batchNumber(line.batchId)}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant tabular-nums">
                    {line.uom}
                  </span>
                </div>

                {/* On-hand */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Current on-hand
                  </span>
                  <span className="text-sm tabular-nums text-on-surface">
                    {line.currentOnHand} {line.uom}
                  </span>
                </div>

                {/* Adjusted qty input */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`${lineId}-qty`}
                    className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant"
                  >
                    Adjusted qty
                  </label>
                  <Input
                    id={`${lineId}-qty`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={state.adjustedQty}
                    onChange={(e) =>
                      updateLine(idx, {
                        adjustedQty: e.target.value,
                        // Reset implausibility override when qty changes
                        implausibilityOverridden: false,
                        implausibilityReason: null,
                      })
                    }
                    aria-label={`Adjusted quantity for ${materialName(line.materialId)}`}
                    className="w-full"
                  />
                </div>

                {/* Delta */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                    Delta
                  </span>
                  <span className={deltaClass}>
                    {deltaSign}{liveDelta.toFixed(2)} {line.uom}
                  </span>
                </div>

                {/* Reason code */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`${lineId}-reason`}
                    className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant"
                  >
                    Reason
                    <span className="text-error ml-0.5" aria-hidden>*</span>
                  </label>
                  <Select
                    value={state.reasonCode}
                    onValueChange={(v) => updateLine(idx, { reasonCode: v })}
                  >
                    <SelectTrigger id={`${lineId}-reason`} aria-required="true">
                      <SelectValue placeholder="Select reason…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_REASON_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Implausibility warn (FR114) */}
                {(showWarn || showDone) && (
                  <CCImplausibilityWarn
                    message={`Delta is ${Math.round(liveRatio * 100)}% of on-hand stock — this exceeds the plausibility threshold (80%). Override requires a structured reason.`}
                    reasonCodes={IMPLAUSIBILITY_REASON_OPTIONS}
                    selectedReason={state.implausibilityReason}
                    onSelectReason={(v) => updateLine(idx, { implausibilityReason: v })}
                    onOverride={() =>
                      updateLine(idx, { implausibilityOverridden: true })
                    }
                    overridden={state.implausibilityOverridden}
                  />
                )}
              </article>
            )
          })}
        </div>

        {/* Desktop table (hidden on mobile) */}
        <div className="hidden tablet:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Batch ref</TableHead>
                <TableHead className="text-right">On-hand</TableHead>
                <TableHead className="w-36">Adjusted qty</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead className="w-48">
                  Reason
                  <span className="text-error ml-0.5" aria-hidden>*</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adj.lines.map((line, idx) => {
                const state     = lineStates[idx]
                const liveDelta  = liveDeltaForLine(idx)
                const liveRatio  = line.currentOnHand > 0
                  ? Math.abs(liveDelta) / line.currentOnHand
                  : (Math.abs(liveDelta) > 50 ? 1 : 0)
                const showWarn   = liveRatio > IMPLAUSIBILITY_RATIO && !state.implausibilityOverridden
                const showDone   = liveRatio > IMPLAUSIBILITY_RATIO &&  state.implausibilityOverridden
                const deltaSign  = liveDelta >= 0 ? '+' : ''
                const deltaClass =
                  liveDelta < 0 ? 'text-error font-medium tabular-nums' :
                  liveDelta > 0 ? 'text-success font-medium tabular-nums' :
                  'text-on-surface-variant tabular-nums'

                const lineId = `desk-line-${adj.id}-${idx}`

                return (
                  <React.Fragment key={`frag-${line.batchId}-${idx}`}>
                    <TableRow>
                      <TableCell className="font-medium text-on-surface">
                        {materialName(line.materialId)}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[11px] text-on-surface-variant">
                          {batchNumber(line.batchId)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.currentOnHand}
                      </TableCell>
                      <TableCell>
                        <Input
                          id={`${lineId}-qty`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={state.adjustedQty}
                          onChange={(e) =>
                            updateLine(idx, {
                              adjustedQty: e.target.value,
                              implausibilityOverridden: false,
                              implausibilityReason: null,
                            })
                          }
                          aria-label={`Adjusted quantity for ${materialName(line.materialId)}`}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell className={`text-right ${deltaClass}`}>
                        {deltaSign}{liveDelta.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-on-surface-variant">
                        {line.uom}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={state.reasonCode}
                          onValueChange={(v) => updateLine(idx, { reasonCode: v })}
                        >
                          <SelectTrigger
                            id={`${lineId}-reason`}
                            aria-required="true"
                            aria-label={`Reason for ${materialName(line.materialId)} line`}
                          >
                            <SelectValue placeholder="Select reason…" />
                          </SelectTrigger>
                          <SelectContent>
                            {ADJUSTMENT_REASON_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                    {/* Implausibility warn row (FR114) — spans full width */}
                    {(showWarn || showDone) && (
                      <TableRow>
                        <TableCell colSpan={7} className="pt-0">
                          <CCImplausibilityWarn
                            message={`Delta is ${Math.round(liveRatio * 100)}% of on-hand stock — this exceeds the plausibility threshold (80%). Override requires a structured reason.`}
                            reasonCodes={IMPLAUSIBILITY_REASON_OPTIONS}
                            selectedReason={state.implausibilityReason}
                            onSelectReason={(v) =>
                              updateLine(idx, { implausibilityReason: v })
                            }
                            onOverride={() =>
                              updateLine(idx, { implausibilityOverridden: true })
                            }
                            overridden={state.implausibilityOverridden}
                            className="mt-1"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <SectionShift tone="low" />

      {/* ── Aggregate value impact ─────────────────────────────────────────── */}
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
            Aggregate value impact
          </span>
          <span
            className={[
              'text-2xl font-semibold tabular-nums',
              liveAggregateValue < 0 ? 'text-error' : 'text-on-surface',
            ].join(' ')}
          >
            {formatINR(liveAggregateValue)}
          </span>
          {Math.abs(liveAggregateValue) > APPROVAL_THRESHOLD ? (
            <span className="flex items-center gap-1.5 text-xs text-warning mt-0.5">
              <AlertTriangle size={13} aria-hidden />
              Exceeds ₹5,000 threshold — approval routing triggered
            </span>
          ) : (
            <span className="text-[11px] text-on-surface-variant">
              Below ₹5,000 threshold — no approval required
            </span>
          )}
        </div>

        {/* Submit action (visual — blocked if unresolved implausibility).
            Gate requires implausibilityOverridden=true (the explicit override-confirm
            from CCImplausibilityWarn), not merely a selectedReason. This is
            intentionally stricter than the shell contract's default: adjustment
            screens require the user to actively confirm the override before submitting,
            ensuring the override intent is captured in the audit log (FR114 warn-and-log). */}
        {(adj.status === 'draft') && (
          <Button
            disabled={hasUnresolvedImplausibility}
            aria-disabled={hasUnresolvedImplausibility}
            title={
              hasUnresolvedImplausibility
                ? 'Resolve all implausibility warnings before submitting'
                : undefined
            }
          >
            {Math.abs(liveAggregateValue) > APPROVAL_THRESHOLD
              ? 'Submit for approval'
              : 'Submit adjustment'}
          </Button>
        )}
      </div>

      {/* ── Approval-chain preview (shown when over threshold) ────────────── */}
      {showApprovalPreview && adj.approvalRequestId && (
        <>
          <SectionShift tone="low" />
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-3">
              Approval chain
            </p>
            <ApprovalInboxCard
              card={approvalCard}
              selected={false}
              onToggleSelect={() => {/* preview only */}}
              layout="card"
              onApprove={() => {/* preview */}}
              onReject={() => {/* preview */}}
              onDelegate={() => {/* preview */}}
              delegateTargets={DELEGATE_TARGETS}
            />
          </div>
        </>
      )}

      {/* ── CCReverseCancelDialog (FR117) ─────────────────────────────────── */}
      <CCReverseCancelDialog
        open={reverseCancelOpen}
        mode={isPreConfirmed ? 'pre-confirmed' : 'post-confirmed'}
        entity={{
          typeLabel:           'Inventory Adjustment',
          reference:           adj.adjTrn,
          statusLabel:         statusLabel,
          currentStatusToken:  statusTkn,
          detailLine:          `${deptLabel(adj.departmentId)} · ${adj.requestedBy} · ${formatDate(adj.requestedAt)}`,
        }}
        compensatingDoc={
          !isPreConfirmed
            ? {
                typeLabel: 'Adjustment Reversal',
                reference: undefined,
                summary:   `Creates a compensating adjustment that reverses the stock impact of ${adj.adjTrn}. The original stays immutable; this doc zeroes its effect.`,
              }
            : undefined
        }
        reasonCodeOptions={REVERSE_CANCEL_REASON_OPTIONS}
        notesPlaceholder="e.g. quantity entered in wrong unit — correcting via new adjustment"
        onConfirm={({ reasonCode, notes }) => {
          // In the mockup we just close the dialog; real service wires here.
          void reasonCode
          void notes
          setReverseCancelOpen(false)
        }}
        onCancel={() => setReverseCancelOpen(false)}
      />
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SI-INV-013 — main page component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv013() {
  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Inventory · Adjustments
        </p>
        <h1 className="mt-1 text-2xl tablet:text-[2rem] font-bold leading-tight tracking-tight text-on-surface">
          Inventory Adjustment
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Record stock count corrections with mandatory per-line reason codes.
          High-value adjustments route automatically through the approval engine.
        </p>

        <div className="mt-8 flex flex-col gap-8">

          {/* ── Showcase 1: Over-threshold (pending_approval) ─────────────── */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-3">
              Example A — approval-routed adjustment (value &gt; ₹5,000)
            </p>
            <AdjustmentDetailSection
              adj={ADJ_OVER_THRESHOLD}
              showApprovalPreview
            />
          </div>

          <SectionShift tone="high" />

          {/* ── Showcase 2: FR114-tripping draft ─────────────────────────── */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-3">
              Example B — implausibility warn (FR114 · |delta| &gt; 80% of on-hand)
            </p>
            <AdjustmentDetailSection
              adj={ADJ_IMPLAUSIBLE}
              showApprovalPreview={false}
            />
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <SectionShift tone="high" className="mt-10" aria-hidden />
        <p className="mt-4 text-[11px] text-on-surface-variant text-center">
          SI-INV-013 · Tier 1 Group 3 · Phase 4 Epic 4 Arc (b)
        </p>

      </div>
    </div>
  )
}
