import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  MapPin,
  RotateCcw,
} from 'lucide-react'

import {
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
} from '@/components/shell'

import { useInventoryDepartments } from '@/hooks/inv/useProductNames'
import { useDepartmentStock } from '@/hooks/inv/useStock'
import {
  useRecordAdjustment,
  useConfirmAdjustment,
  useCancelAdjustment,
  type RecordAdjustmentLineInput,
} from '@/hooks/inv/useInventoryAdjustments'
import { ApiError } from '@/lib/api-client'
import type { InventoryDepartment } from '@/hooks/inv/schemas'

/**
 * SI-INV-013 — Inventory Adjustment production page.
 *
 * Tier 1 Group 3 · Phase 4 Epic 4 Arc (c) Wave 3.
 *
 * FRs: FR37 (mandatory per-line reason codes), FR114 (implausibility warn-and-log,
 *      client-advisory; override gates submit, reason NOT sent to backend),
 *      FR117 (cancel via CCReverseCancelDialog, pre-confirmed only once draft exists).
 *
 * Divergences from mockup (Wave-3 spec):
 *   1. Dropped the two-instance demo (ADJ_OVER_THRESHOLD / ADJ_IMPLAUSIBLE) —
 *      production page is a CREATE form for ONE adjustment against a chosen dept.
 *   2. CCImplausibilityWarn is client-advisory: the implausibilityReason is NOT
 *      sent to the backend (RecordAdjustmentLineInput has no such field). The
 *      override gates submit as an audit-intent check (FR114 warn-and-log).
 *   3. Approval threshold note is generic ("brand's threshold") — the backend
 *      constant (e.g. ₹5,000) is authoritative; we do NOT hard-code it here.
 *   4. Post-confirmed reverse path has no backend — dialog restricted to
 *      pre-confirmed (cancel only while draft exists).
 *   5. AuditLink uses entityType="inventory_adjustments" (the Drizzle table name).
 *   6. Select components → token-styled native <select> (no @/components/ui/select
 *      in production).
 *   7. Aggregate value impact: computed client-side for display only. Backend
 *      authoritatively recomputes and decides approval routing.
 *
 * Route: /inventory/adjustments/new (RequireAuth only, DL-049 pattern).
 *
 * Animation: NONE. CLAUDE.md bans entrance animations on inventory/transaction
 * screens.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline constants
// ─────────────────────────────────────────────────────────────────────────────

const ADJUSTMENT_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'physical_count',      label: 'Physical count correction' },
  { value: 'spoilage',            label: 'Spoilage / waste' },
  { value: 'damage',              label: 'Damage write-off' },
  { value: 'theft',               label: 'Theft / shrinkage' },
  { value: 'expiry',              label: 'Expiry write-off' },
  { value: 'production_variance', label: 'Production variance' },
  { value: 'recipe_correction',   label: 'Recipe correction' },
  { value: 'receiving_error',     label: 'Receiving entry error' },
  { value: 'other',               label: 'Other (add note)' },
]

const IMPLAUSIBILITY_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'recount_confirmed',  label: 'Recount confirmed — count is correct' },
  { value: 'recording_error',    label: 'Recording error — correcting now' },
  { value: 'genuine_spoilage',   label: 'Genuine spoilage event' },
  { value: 'transfer_missing',   label: 'Transfer not yet recorded' },
  { value: 'other',              label: 'Other (add note)' },
]

const REVERSE_CANCEL_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'data_entry_error',  label: 'Data entry error' },
  { value: 'duplicate_entry',   label: 'Duplicate entry' },
  { value: 'incorrect_qty',     label: 'Incorrect quantity entered' },
  { value: 'wrong_batch',       label: 'Wrong batch selected' },
  { value: 'approver_rejected', label: 'Approver requested reversal' },
  { value: 'other',             label: 'Other (add note)' },
]

/** Implausibility threshold — |delta| / currentOnHand > this ratio triggers FR114. */
const IMPLAUSIBILITY_RATIO = 0.8

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AdjLineState {
  productId: string
  productName: string
  onHand: number
  unit: string
  adjustedQty: string
  reason: string
  implausibilitySelectedReason: string | null
  implausibilityOverridden: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * deriveLocationCode — mirrors the helper from StockTransferCreatePage.
 * Derives a sanitised location code from department name/code for the
 * locationCode field required by the backend (RecordAdjustmentInput).
 */
function deriveLocationCode(dept: InventoryDepartment | undefined): string {
  if (!dept) return 'INV'
  return (
    (dept.code ?? dept.name ?? 'INV')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 20)
      .toUpperCase()
  ) || 'INV'
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared loading / error JSX (brief-specified patterns)
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
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

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
        <div role="alert" className="rounded-md bg-error-container p-6 text-on-error-container">
          <p className="text-sm font-medium">
            {error instanceof ApiError
              ? error.message
              : 'Failed to load stock data. Please retry.'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function InventoryAdjustmentPage() {
  const navigate = useNavigate()

  // ── ALL hooks ABOVE the early loading/error/guard returns ─────────────────
  // (eslint not installed — a Wave-1 page crashed on hooks-below-early-returns)

  const { data: depts, isLoading: deptsLoading } = useInventoryDepartments()

  const [selectedDeptId, setSelectedDeptId] = useState<string | undefined>(undefined)

  const effectiveDeptId = selectedDeptId ?? depts?.[0]?.id

  const {
    data: stockResult,
    isLoading: stockLoading,
    error: stockError,
  } = useDepartmentStock(effectiveDeptId)

  // Lines — one per on-hand product in the selected department
  const [lines, setLines] = useState<AdjLineState[]>([])

  // Notes field (optional)
  const [notes, setNotes] = useState('')

  // Draft state — becomes true once recordAdjustment succeeds (before confirm)
  const [isDraft, setIsDraft] = useState(false)
  const [adjId, setAdjId] = useState<string | undefined>(undefined)
  const [adjTrn, setAdjTrn] = useState<string | undefined>(undefined)
  const [adjStatus, setAdjStatus] = useState<string>('draft')

  // Reverse/cancel dialog
  const [reverseCancelOpen, setReverseCancelOpen] = useState(false)

  // Mutations
  const { mutateAsync: recordAdjustment, isPending: isRecording, error: recordError } = useRecordAdjustment()
  const { mutateAsync: confirmAdjustment, isPending: isConfirming, error: confirmError } = useConfirmAdjustment()
  const { mutateAsync: cancelAdjustment, isPending: isCancelling, error: cancelError } = useCancelAdjustment()

  // Selected dept object
  const selectedDept = depts?.find((d) => d.id === effectiveDeptId)

  // Seed lines when stock data loads or dept changes
  const stockItems = stockResult?.items ?? []

  // Memoize so lines are only re-seeded when dept changes (not on every render)
  const seededLines = useMemo<AdjLineState[]>(() => {
    return stockItems.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      onHand: row.quantity,
      unit: row.unit,
      adjustedQty: String(row.quantity),
      reason: '',
      implausibilitySelectedReason: null,
      implausibilityOverridden: false,
    }))
  // deps use stockItems.length (not stockItems) deliberately: only re-seed when the product set changes size, not on every poll that re-creates the array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDeptId, stockItems.length])

  // Update lines from seed whenever seededLines changes (dept switch)
  // We maintain local edits in `lines`; if seededLines changes (dept changed),
  // reset to fresh. We only reset if the dept changed (tracked via seededLines
  // identity). We accomplish this by keeping a separate "source dept" ref
  // tracked through the seededLines memo.
  const [lastSeededDeptId, setLastSeededDeptId] = useState<string | undefined>(undefined)
  if (effectiveDeptId !== lastSeededDeptId && stockItems.length > 0) {
    setLastSeededDeptId(effectiveDeptId)
    setLines(seededLines)
  }

  // Live delta per line
  function liveDeltaForLine(idx: number): number {
    const parsed = parseFloat(lines[idx]?.adjustedQty ?? '')
    if (isNaN(parsed)) return 0
    return parsed - (lines[idx]?.onHand ?? 0)
  }

  // Any unoverridden implausibility blocks submit
  const hasUnresolvedImplausibility = useMemo(() => {
    return lines.some((line, idx) => {
      const liveDelta = liveDeltaForLine(idx)
      const liveRatio =
        line.onHand > 0
          ? Math.abs(liveDelta) / line.onHand
          : Math.abs(liveDelta) > 50 ? 1 : 0
      return liveRatio > IMPLAUSIBILITY_RATIO && !line.implausibilityOverridden
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines])

  // Submit gate: all edited lines (where adjustedQty !== onHand) must have a reason,
  // no unresolved implausibility, and at least one line must be changed
  const editedLines = lines.filter(
    (l) => {
      const parsed = parseFloat(l.adjustedQty)
      return !isNaN(parsed) && parsed !== l.onHand
    }
  )

  const submitGated =
    editedLines.length === 0 ||
    editedLines.some((l) => !l.reason) ||
    hasUnresolvedImplausibility ||
    isDraft // prevent double-submit after draft created

  const isPending = isRecording || isConfirming || isCancelling

  const submitError = recordError ?? confirmError ?? cancelError

  // ── Loading state ──────────────────────────────────────────────────────────
  if (deptsLoading || (stockLoading && !stockResult)) {
    return <LoadingState />
  }

  if (stockError) {
    return <ErrorState error={stockError} />
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function updateLine(idx: number, patch: Partial<AdjLineState>) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    )
  }

  async function handleSubmit() {
    if (!effectiveDeptId || !selectedDept) return

    const locationCode = deriveLocationCode(selectedDept)

    const inputLines: RecordAdjustmentLineInput[] = editedLines.map((l) => ({
      productId: l.productId,
      delta: parseFloat(l.adjustedQty) - l.onHand,
      reasonCode: l.reason,
      currentOnHand: l.onHand,
    }))

    try {
      const result = await recordAdjustment({
        departmentId: effectiveDeptId,
        locationCode,
        notes: notes.trim() || undefined,
        lines: inputLines,
      })

      setAdjId(result.adjustmentId)
      setAdjTrn(result.adjTrn)
      setAdjStatus(result.status)
      setIsDraft(true)

      if (result.status === 'pending_approval' || result.approvalRequestId) {
        // Routed through the Epic-3 approval engine
        navigate('/approvals/inbox')
      }
      // Otherwise: draft created — confirm button becomes available
    } catch {
      // recordError rendered inline
    }
  }

  async function handleConfirm() {
    if (!adjId) return
    try {
      const res = await confirmAdjustment(adjId)
      setAdjStatus(res.status)
      setIsDraft(false)
    } catch {
      // confirmError rendered inline
    }
  }

  async function handleCancel({ reasonCode, notes: cancelNotes }: { reasonCode: string; notes?: string }) {
    if (!adjId) return
    // The cancel endpoint takes no payload — notes/reasonCode are captured by the dialog for UX but not yet persisted (no backend field).
    void cancelNotes
    void reasonCode
    try {
      await cancelAdjustment(adjId)
      setAdjStatus('cancelled')
      setIsDraft(false)
      setReverseCancelOpen(false)
    } catch {
      // cancelError rendered inline
    }
  }

  // ── Status helpers ─────────────────────────────────────────────────────────

  const statusTokenMap: Record<string, 'status_draft' | 'status_pending_approval' | 'status_confirmed' | 'status_cancelled'> = {
    draft: 'status_draft',
    pending_approval: 'status_pending_approval',
    confirmed: 'status_confirmed',
    cancelled: 'status_cancelled',
  }
  const adjStatusToken = statusTokenMap[adjStatus] ?? 'status_draft'
  const adjStatusLabel =
    adjStatus === 'draft'            ? 'Draft'            :
    adjStatus === 'pending_approval' ? 'Pending approval' :
    adjStatus === 'confirmed'        ? 'Confirmed'        :
    adjStatus === 'cancelled'        ? 'Cancelled'        :
    'Draft'

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Adjustments
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Inventory Adjustment
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Record stock count corrections with mandatory per-line reason codes.
              High-value adjustments route automatically through the approval engine.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isDraft && <DraftPill isDraft mobileEyebrow />}
          </div>
        </header>

        {/* ── Department picker ─────────────────────────────────────────────── */}
        <SectionShift tone="low" className="mt-8" aria-hidden />
        <section
          aria-label="Department"
          className="mt-6 rounded-md bg-surface-container-low p-4 tablet:p-5 flex flex-col gap-4"
        >
          <h2 className="text-sm font-semibold text-on-surface">Select department</h2>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="adj-dept"
              className="text-xs font-medium text-on-surface-variant"
            >
              Department
            </label>
            <select
              id="adj-dept"
              aria-label="Department"
              value={effectiveDeptId ?? ''}
              onChange={(e) => {
                setSelectedDeptId(e.target.value || undefined)
                // Reset draft + lines when dept changes
                setIsDraft(false)
                setAdjId(undefined)
                setAdjTrn(undefined)
                setAdjStatus('draft')
                setLines([])
                setNotes('')
              }}
              disabled={isDraft}
              className={[
                'h-11 rounded-md px-3 text-sm text-on-surface',
                'bg-surface-container-lowest',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'min-w-[200px]',
                isDraft ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {(!depts || depts.length === 0) ? (
                <option value="">No departments available</option>
              ) : (
                depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))
              )}
            </select>
            {selectedDept ? (
              <p className="text-xs text-on-surface-variant">
                {selectedDept.name}
                {selectedDept.code ? ` · ${selectedDept.code}` : ''}
                {' · '}
                <span className="font-mono">{deriveLocationCode(selectedDept)}</span>
              </p>
            ) : null}
          </div>
        </section>

        {/* ── Draft TRN + status + meta (visible once draft created) ────────── */}
        {isDraft && adjTrn ? (
          <>
            <SectionShift tone="low" className="mt-8" aria-hidden />
            <section
              aria-label={`Adjustment ${adjTrn}`}
              className="mt-6 rounded-md bg-surface-container-low p-4 tablet:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <TrnDisplay trn={adjTrn} />
                  <StatusPill status={adjStatusToken} label={adjStatusLabel} size="sm" />
                  <DraftPill isDraft mobileEyebrow />
                </div>
                {/* Reverse/Cancel affordance (FR117 — pre-confirmed only) */}
                {adjStatus !== 'cancelled' && adjStatus !== 'confirmed' && (
                  <Button
                    variant="tonal"
                    size="sm"
                    onClick={() => setReverseCancelOpen(true)}
                    aria-label={`Cancel adjustment ${adjTrn}`}
                  >
                    <RotateCcw size={14} aria-hidden />
                    Cancel
                  </Button>
                )}
              </div>

              {/* Meta */}
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 tablet:grid-cols-3">
                <div className="flex flex-col gap-0.5">
                  <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                    <ClipboardList size={11} aria-hidden />
                    Department
                  </dt>
                  <dd className="text-sm text-on-surface">{selectedDept?.name ?? '—'}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                    <MapPin size={11} aria-hidden />
                    Location code
                  </dt>
                  <dd className="font-mono text-sm text-on-surface">{deriveLocationCode(selectedDept)}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                    <CalendarDays size={11} aria-hidden />
                    Date
                  </dt>
                  <dd className="text-sm text-on-surface">{todayISO()}</dd>
                </div>
              </dl>

              {/* AuditLink */}
              <div className="mt-4">
                <AuditLink
                  entityType="inventory_adjustments"
                  entityRef={adjTrn}
                />
              </div>
            </section>
          </>
        ) : null}

        {/* ── Adjustment lines ─────────────────────────────────────────────── */}
        {lines.length > 0 ? (
          <>
            <SectionShift tone="low" className="mt-8" aria-hidden />
            <section aria-label="Adjustment lines" className="mt-6">
              <h2 className="text-sm font-semibold text-on-surface mb-4">
                Adjustment lines
              </h2>
              <p className="text-xs text-on-surface-variant mb-4">
                Enter the <em>corrected</em> quantity for each item. Only lines
                where the adjusted qty differs from on-hand are submitted. Reason
                is mandatory for every changed line.
              </p>

              {/* Mobile card stack */}
              <div className="flex flex-col gap-3 tablet:hidden">
                {lines.map((line, idx) => {
                  const liveDelta = liveDeltaForLine(idx)
                  const liveRatio =
                    line.onHand > 0
                      ? Math.abs(liveDelta) / line.onHand
                      : Math.abs(liveDelta) > 50 ? 1 : 0
                  const showWarn = liveRatio > IMPLAUSIBILITY_RATIO && !line.implausibilityOverridden
                  const showDone = liveRatio > IMPLAUSIBILITY_RATIO && line.implausibilityOverridden
                  const deltaSign = liveDelta >= 0 ? '+' : ''
                  const deltaClass =
                    liveDelta < 0 ? 'text-error font-medium tabular-nums' :
                    liveDelta > 0 ? 'text-success font-medium tabular-nums' :
                    'text-on-surface-variant tabular-nums'

                  const lineId = `mob-adj-${idx}`
                  const isEdited = !isNaN(parseFloat(line.adjustedQty)) && parseFloat(line.adjustedQty) !== line.onHand

                  return (
                    <article
                      key={line.productId}
                      aria-label={`Line ${idx + 1}: ${line.productName}`}
                      className="rounded-md bg-surface-container p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-on-surface truncate">
                          {line.productName}
                        </span>
                        <span className="shrink-0 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant tabular-nums">
                          {line.unit}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                          Current on-hand
                        </span>
                        <span className="text-sm tabular-nums text-on-surface">
                          {line.onHand} {line.unit}
                        </span>
                      </div>

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
                          value={line.adjustedQty}
                          onChange={(e) =>
                            updateLine(idx, {
                              adjustedQty: e.target.value,
                              // Reset implausibility override when qty changes
                              implausibilityOverridden: false,
                              implausibilitySelectedReason: null,
                            })
                          }
                          disabled={isDraft}
                          aria-label={`Adjusted quantity for ${line.productName}`}
                          className="w-full"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                          Delta
                        </span>
                        <span className={deltaClass}>
                          {deltaSign}{liveDelta.toFixed(2)} {line.unit}
                        </span>
                      </div>

                      {isEdited && (
                        <div className="flex flex-col gap-1.5">
                          <label
                            htmlFor={`${lineId}-reason`}
                            className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant"
                          >
                            Reason
                            <span className="text-error ml-0.5" aria-hidden>*</span>
                          </label>
                          <select
                            id={`${lineId}-reason`}
                            aria-required="true"
                            aria-label={`Reason for ${line.productName}`}
                            value={line.reason}
                            onChange={(e) => updateLine(idx, { reason: e.target.value })}
                            disabled={isDraft}
                            className={[
                              'h-11 rounded-md px-3 text-sm text-on-surface',
                              'bg-surface-container-lowest',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                              isDraft ? 'opacity-50 cursor-not-allowed' : '',
                            ].join(' ')}
                          >
                            <option value="">Select reason…</option>
                            {ADJUSTMENT_REASON_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Implausibility warn (FR114) */}
                      {(showWarn || showDone) && (
                        <CCImplausibilityWarn
                          message={`Delta is ${Math.round(liveRatio * 100)}% of on-hand stock — this exceeds the plausibility threshold (80%). Override requires a structured reason.`}
                          reasonCodes={IMPLAUSIBILITY_REASON_OPTIONS}
                          selectedReason={line.implausibilitySelectedReason}
                          onSelectReason={(v) =>
                            updateLine(idx, { implausibilitySelectedReason: v })
                          }
                          onOverride={() =>
                            updateLine(idx, { implausibilityOverridden: true })
                          }
                          overridden={line.implausibilityOverridden}
                        />
                      )}
                    </article>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden tablet:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
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
                    {lines.map((line, idx) => {
                      const liveDelta = liveDeltaForLine(idx)
                      const deltaSign = liveDelta >= 0 ? '+' : ''
                      const deltaClass =
                        liveDelta < 0 ? 'text-error font-medium tabular-nums' :
                        liveDelta > 0 ? 'text-success font-medium tabular-nums' :
                        'text-on-surface-variant tabular-nums'

                      const lineId = `desk-adj-${idx}`
                      const isEdited = !isNaN(parseFloat(line.adjustedQty)) && parseFloat(line.adjustedQty) !== line.onHand

                      return (
                        <TableRow key={line.productId} className={isDraft ? 'opacity-60' : ''}>
                          <TableCell className="font-medium text-on-surface">
                            {line.productName}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {line.onHand}
                          </TableCell>
                          <TableCell>
                            <Input
                              id={`${lineId}-qty`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.adjustedQty}
                              onChange={(e) =>
                                updateLine(idx, {
                                  adjustedQty: e.target.value,
                                  implausibilityOverridden: false,
                                  implausibilitySelectedReason: null,
                                })
                              }
                              disabled={isDraft}
                              aria-label={`Adjusted quantity for ${line.productName}`}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className={`text-right ${deltaClass}`}>
                            {deltaSign}{liveDelta.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-on-surface-variant">
                            {line.unit}
                          </TableCell>
                          <TableCell>
                            {isEdited ? (
                              <select
                                id={`${lineId}-reason`}
                                aria-required="true"
                                aria-label={`Reason for ${line.productName} line`}
                                value={line.reason}
                                onChange={(e) => updateLine(idx, { reason: e.target.value })}
                                disabled={isDraft}
                                className={[
                                  'h-11 w-full rounded-md px-3 text-sm text-on-surface',
                                  'bg-surface-container-lowest',
                                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                  isDraft ? 'opacity-50 cursor-not-allowed' : '',
                                ].join(' ')}
                              >
                                <option value="">Select reason…</option>
                                {ADJUSTMENT_REASON_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-on-surface-variant text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                {/* Desktop implausibility warnings (below table, per affected line) */}
                {lines.map((line, idx) => {
                  const liveDelta = liveDeltaForLine(idx)
                  const liveRatio =
                    line.onHand > 0
                      ? Math.abs(liveDelta) / line.onHand
                      : Math.abs(liveDelta) > 50 ? 1 : 0
                  const showWarn = liveRatio > IMPLAUSIBILITY_RATIO && !line.implausibilityOverridden
                  const showDone = liveRatio > IMPLAUSIBILITY_RATIO && line.implausibilityOverridden
                  if (!showWarn && !showDone) return null
                  return (
                    <div key={`warn-${line.productId}`} className="mt-2">
                      <p className="text-xs text-on-surface-variant mb-1">
                        <span className="font-medium text-on-surface">{line.productName}</span> — implausibility warning:
                      </p>
                      <CCImplausibilityWarn
                        message={`Delta is ${Math.round(liveRatio * 100)}% of on-hand stock — this exceeds the plausibility threshold (80%). Override requires a structured reason.`}
                        reasonCodes={IMPLAUSIBILITY_REASON_OPTIONS}
                        selectedReason={line.implausibilitySelectedReason}
                        onSelectReason={(v) =>
                          updateLine(idx, { implausibilitySelectedReason: v })
                        }
                        onOverride={() =>
                          updateLine(idx, { implausibilityOverridden: true })
                        }
                        overridden={line.implausibilityOverridden}
                      />
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        ) : effectiveDeptId && !stockLoading ? (
          <>
            <SectionShift tone="low" className="mt-8" aria-hidden />
            <div className="mt-6 rounded-md bg-surface-container-low p-6 flex flex-col items-center gap-2 text-center">
              <AlertCircle aria-hidden className="h-8 w-8 text-on-surface-variant" />
              <p className="text-sm text-on-surface-variant">
                No stock found at the selected department. Try a different department.
              </p>
            </div>
          </>
        ) : null}

        {/* ── Notes ─────────────────────────────────────────────────────────── */}
        {lines.length > 0 && !isDraft ? (
          <>
            <SectionShift tone="low" className="mt-8" aria-hidden />
            <section aria-label="Notes" className="mt-6 flex flex-col gap-1.5">
              <label
                htmlFor="adj-notes"
                className="text-xs font-medium text-on-surface-variant"
              >
                Notes
                <span className="ml-1 font-normal text-on-surface-variant">(optional)</span>
              </label>
              <textarea
                id="adj-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. end-of-shift physical count correction, all items recounted"
                className={[
                  'rounded-sm bg-surface-container-lowest p-3 text-sm text-on-surface',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                ].join(' ')}
              />
            </section>
          </>
        ) : null}

        {/* ── Value impact + submit ─────────────────────────────────────────── */}
        {lines.length > 0 ? (
          <>
            <SectionShift tone="low" className="mt-8" aria-hidden />
            <section
              aria-label="Submit adjustment"
              className="mt-6 flex flex-col gap-4"
            >
              {/* Approval note (generic — no hard-coded threshold) */}
              <div className="flex items-start gap-2 rounded-md bg-surface-container p-3">
                <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-on-surface-variant mt-0.5" />
                <p className="text-xs text-on-surface-variant">
                  <span className="font-medium text-on-surface">Approval routing:</span>{' '}
                  If the aggregate value impact of this adjustment exceeds your brand&apos;s
                  configured threshold, it will be automatically routed through the Unified
                  Approval Inbox. The backend determines routing authoritatively.
                </p>
              </div>

              {/* Inline backend error */}
              {submitError ? (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-md bg-error-container p-4 text-on-error-container"
                >
                  <AlertCircle aria-hidden className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-sm">
                    {submitError instanceof ApiError
                      ? submitError.message
                      : 'Submit failed — please check the form and try again.'}
                  </p>
                </div>
              ) : null}

              {/* Unoverridden implausibility advisory */}
              {hasUnresolvedImplausibility ? (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-md bg-surface-container p-4"
                >
                  <AlertCircle aria-hidden className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                  <p className="text-sm text-on-surface-variant">
                    One or more lines have large deltas that exceed the implausibility
                    threshold. Override each flagged line before submitting.
                  </p>
                </div>
              ) : null}

              {/* Confirm section (draft created, not yet confirmed) */}
              {isDraft && adjId && adjStatus === 'draft' ? (
                <div className="rounded-md bg-surface-container-low p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      Draft created
                    </span>
                    <p className="text-sm text-on-surface">
                      Review the adjustment above, then confirm to apply stock changes.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(-1)}
                      aria-label="Cancel and go back"
                    >
                      Back
                    </Button>
                    <Button
                      variant="tonal"
                      size="sm"
                      disabled={isConfirming}
                      onClick={() => { void handleConfirm() }}
                      aria-label="Confirm adjustment"
                    >
                      {isConfirming ? 'Confirming…' : 'Confirm adjustment'}
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Confirmed notice */}
              {adjStatus === 'confirmed' ? (
                <div className="rounded-md bg-surface-container p-4 flex items-start gap-3">
                  <CheckCircle aria-hidden className="h-4 w-4 shrink-0 text-success mt-0.5" />
                  <p className="text-sm text-on-surface">
                    Adjustment <span className="font-mono">{adjTrn}</span> confirmed
                    — stock has been updated.
                  </p>
                </div>
              ) : null}

              {/* Cancelled notice */}
              {adjStatus === 'cancelled' ? (
                <div className="rounded-md bg-surface-container p-4 flex items-start gap-3">
                  <AlertCircle aria-hidden className="h-4 w-4 shrink-0 text-on-surface-variant mt-0.5" />
                  <p className="text-sm text-on-surface-variant">
                    Adjustment cancelled.
                  </p>
                </div>
              ) : null}

              {/* Initial submit CTA (before draft exists) */}
              {!isDraft ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 tablet:h-9"
                    onClick={() => navigate(-1)}
                    aria-label="Cancel and go back"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="tonal"
                    size="sm"
                    className="h-11 tablet:h-9"
                    disabled={submitGated || isPending}
                    onClick={() => { void handleSubmit() }}
                    title={
                      hasUnresolvedImplausibility
                        ? 'Resolve all implausibility warnings before submitting'
                        : editedLines.length === 0
                        ? 'Adjust at least one quantity before submitting'
                        : undefined
                    }
                    aria-label="Submit adjustment"
                  >
                    {isRecording ? 'Submitting…' : 'Submit adjustment'}
                  </Button>
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {/* ── CCReverseCancelDialog (FR117 — pre-confirmed only) ─────────────── */}
        {isDraft && adjId && adjTrn ? (
          <CCReverseCancelDialog
            open={reverseCancelOpen}
            mode="pre-confirmed"
            entity={{
              typeLabel:          'Inventory Adjustment',
              reference:          adjTrn,
              statusLabel:        adjStatusLabel,
              currentStatusToken: adjStatusToken,
              detailLine:         `${selectedDept?.name ?? '—'} · ${todayISO()}`,
            }}
            reasonCodeOptions={REVERSE_CANCEL_REASON_OPTIONS}
            notesPlaceholder="e.g. quantity entered in wrong unit — correcting via new adjustment"
            onConfirm={({ reasonCode, notes: cancelNotes }) => {
              void handleCancel({ reasonCode, notes: cancelNotes })
            }}
            onCancel={() => setReverseCancelOpen(false)}
          />
        ) : null}

      </div>
    </div>
  )
}
